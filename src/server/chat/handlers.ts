import { NextResponse } from "next/server";

import { runOrchestrator, runOrchestratorStream } from "@/lib/agents";
import type { StreamEvent } from "@/lib/agents";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { getUserPlanTier } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import { assertChatPostAllowedForUser } from "@/lib/upstash-rate-limit";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";
import { withPlanGate } from "../_with-plan-gate";

import { sendMessageSchema } from "./schemas";

function chatSupportsSchoolScope(): boolean {
  try {
    const modelFields =
      (prisma as any)?._runtimeDataModel?.models?.ChatMessage?.fields;
    return Array.isArray(modelFields)
      ? modelFields.some((f: { name?: string }) => f.name === "schoolId")
      : false;
  } catch {
    return false;
  }
}

export const history = withAuth(async (req, { userId }) => {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const schoolId = url.searchParams.get("schoolId");
  const supportsSchoolScope = chatSupportsSchoolScope();

  // Run plan check + history query in parallel (was sequential, ~150ms savings)
  const [planTier, messages] = await Promise.all([
    getUserPlanTier(userId),
    prisma.chatMessage.findMany({
      where: {
        userId,
        ...(mode ? { mode } : {}),
        // When schoolId is supplied (SOP studio), scope strictly to that school.
        // When omitted, return only non-school-scoped messages so general chats
        // don't include per-school SOP exchanges.
        ...(supportsSchoolScope
          ? schoolId
            ? { schoolId }
            : { schoolId: null }
          : {}),
      },
      // Only the fields the client uses — skips the implicit userId column
      // and avoids serializing fields the UI never reads.
      select: {
        id: true,
        role: true,
        content: true,
        mode: true,
        ...(supportsSchoolScope ? { schoolId: true } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  if (!planTier || planTier === "FREE") {
    return NextResponse.json(
      {
        code: "PLAN_UPGRADE_REQUIRED",
        feature: "assistant",
        error: "AI assistant is available on PLUS and PRO plans.",
      },
      { status: 402 },
    );
  }

  // Allow short-term browser caching — chat history is per-user and changes
  // infrequently between page navigations. React Query's 30s staleTime pairs
  // with this so a back-and-forth navigation never re-hits the database.
  return ok(messages, {
    headers: { "Cache-Control": "private, max-age=10, must-revalidate" },
  });
});

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
  const supportsSchoolScope = chatSupportsSchoolScope();
  const wantStream = parsed.data.stream;

  // --- Streaming path ---
  if (wantStream) {
    const prior = await prisma.chatMessage.findMany({
      where: {
        userId,
        mode,
        ...(supportsSchoolScope
          ? schoolId
            ? { schoolId }
            : { schoolId: null }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    const history: { role: "user" | "assistant"; content: string }[] = [];
    for (let i = prior.length - 1; i >= 0; i--) {
      const msg = prior[i];
      history.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

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
      ...(supportsSchoolScope
        ? schoolId
          ? { schoolId }
          : { schoolId: null }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const history: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = prior.length - 1; i >= 0; i--) {
    const msg = prior[i];
    history.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

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

export const stats = withAuth(async (_req, { userId }) => {
  const now = new Date();
  const ms = (days: number) => 1000 * 60 * 60 * 24 * days;
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const today = startOfDay(now);
  const since30 = new Date(today.getTime() - ms(29));
  const since7 = new Date(today.getTime() - ms(6));

  // Pull recent user messages once and partition client-side. Capped at 1000
  // rows because anything beyond that would dwarf the dashboard purpose and
  // we don't paginate this response.
  const recent = await prisma.chatMessage.findMany({
    where: {
      userId,
      role: "user",
      createdAt: { gte: since30 },
    },
    select: { id: true, content: true, createdAt: true, mode: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  // All-time mode distribution (cheap groupBy).
  const groups = await prisma.chatMessage.groupBy({
    by: ["mode"],
    where: { userId },
    _count: { _all: true },
  });
  const totalsByMode: Record<string, number> = {};
  for (const g of groups) {
    const key = g.mode ?? "general";
    totalsByMode[key] = (totalsByMode[key] ?? 0) + g._count._all;
  }

  // 7-day and 30-day partitions.
  const last7 = recent.filter((m) => m.createdAt >= since7);
  const userMessages30d = recent.length;
  const userMessages7d = last7.length;

  // Word count for the last 7 days.
  const words7d = last7.reduce((sum, m) => sum + countWords(m.content), 0);

  // Per-day buckets for the last 7 days (oldest → newest).
  const days7d: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today.getTime() - ms(i));
    const dayKey = isoDate(day);
    days7d.push({ date: dayKey, count: 0 });
  }
  const indexByDate = new Map(days7d.map((d, i) => [d.date, i]));
  for (const m of last7) {
    const idx = indexByDate.get(isoDate(startOfDay(m.createdAt)));
    if (idx !== undefined) days7d[idx]!.count++;
  }

  // Consecutive day streak (looks at the last 60 days max). Counts today only
  // if there was activity, otherwise starts from yesterday.
  const activeDates = new Set(
    recent.map((m) => isoDate(startOfDay(m.createdAt))),
  );
  let dayStreak = 0;
  for (let i = 0; i < 60; i++) {
    const day = isoDate(new Date(today.getTime() - ms(i)));
    if (activeDates.has(day)) dayStreak++;
    else if (i === 0) {
      // No activity today — measure the streak ending yesterday instead.
      continue;
    } else {
      break;
    }
  }

  return ok({
    totalsByMode,
    userMessages7d,
    userMessages30d,
    words7d,
    days7d,
    dayStreak,
  });
});

function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
