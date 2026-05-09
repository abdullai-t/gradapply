// @ts-nocheck
import { NextResponse } from "next/server";

import { runOrchestrator, runOrchestratorStream } from "@/lib/agents";
import type { StreamEvent } from "@/lib/agents";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";
import { assertChatPostAllowedForUser } from "@/lib/upstash-rate-limit";

import { bad, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import { sendMessageSchema } from "./schemas";
import {
  buildSchoolScopeWhere,
  chatSupportsSchoolScope,
  reverseChronologicalToHistory,
} from "./shared";

export const send = withPlanGate("assistant", async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const chatCap = await assertChatPostAllowedForUser(userId);
  if (!chatCap.ok) {
    return NextResponse.json(
      { error: "Too many assistant messages. Please wait and try again." },
      {
        status: 429,
        headers: { RetryAfter: String(chatCap.retryAfterSec) },
      },
    );
  }

  const quota = await billingPrecheckResponse(userId);
  if (quota) return quota;

  const mode = parsed.data.mode;
  const message = parsed.data.message;
  const schoolId = parsed.data.schoolId ?? null;
  const supportsSchoolScope = await chatSupportsSchoolScope();
  const wantStream = parsed.data.stream;

  // --- Streaming path ---
  if (wantStream) {
    const prior = await prisma.chatMessage.findMany({
      where: {
        userId,
        mode,
        ...buildSchoolScopeWhere(supportsSchoolScope, schoolId),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    const history = reverseChronologicalToHistory(prior);

    const { stream, finalResult } = runOrchestratorStream(
      {
        mode,
        message,
        history,
        payload: {
          ...(schoolId ? { schoolId } : {}),
        },
      },
      userId,
    );

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            const line = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(line));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errEvent: StreamEvent = {
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred",
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }

        // After stream closes: persist messages + billing
        try {
          const result = await finalResult;

          await prisma.$transaction([
            prisma.chatMessage.create({
              data: {
                userId,
                role: "user",
                content: message,
                mode,
                ...(supportsSchoolScope ? { schoolId } : {}),
              },
            }),
            prisma.chatMessage.create({
              data: {
                userId,
                role: "assistant",
                content: result.reply,
                mode,
                ...(supportsSchoolScope ? { schoolId } : {}),
              },
            }),
          ]);

          await finalizeAiConsumption(userId);

          console.info("[chat][agent-stream]", {
            userId,
            mode,
            agentId: result.agentId,
            traceId: result.traceId,
            provider: result.modelUsed.provider,
            model: result.modelUsed.model,
          });
        } catch (e) {
          console.error("[chat][stream-persist-error]", e);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // --- Non-streaming path (unchanged) ---
  const prior = await prisma.chatMessage.findMany({
    where: {
      userId,
      mode,
      ...buildSchoolScopeWhere(supportsSchoolScope, schoolId),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const history = reverseChronologicalToHistory(prior);

  let reply: string;
  let agent: {
    tabMode: string;
    effectiveMode: string;
    label: string;
    routedFromGeneral: boolean;
    creditFallback: boolean;
  };

  try {
    const result = await runOrchestrator(
      {
        mode,
        message,
        history,
        payload: {
          ...(schoolId ? { schoolId } : {}),
        },
      },
      userId,
    );
    reply = result.reply;
    agent = {
      tabMode: mode,
      effectiveMode: result.agentId,
      label: result.agentId,
      routedFromGeneral: false,
      creditFallback: false,
    };
    console.info("[chat][agent-system]", {
      userId,
      mode,
      agentId: result.agentId,
      traceId: result.traceId,
      provider: result.modelUsed.provider,
      model: result.modelUsed.model,
    });
  } catch (e) {
    return NextResponse.json(
      { error: formatLlmFailureMessage(e) },
      { status: 500 },
    );
  }

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        userId,
        role: "user",
        content: message,
        mode,
        ...(supportsSchoolScope ? { schoolId } : {}),
      },
    }),
    prisma.chatMessage.create({
      data: {
        userId,
        role: "assistant",
        content: reply,
        mode,
        ...(supportsSchoolScope ? { schoolId } : {}),
      },
    }),
  ]);

  await finalizeAiConsumption(userId);

  return ok({ reply, agent });
});
