import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { requireNonFreeForFeature } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import { runAssistantChat, type ChatMode } from "@/lib/ai";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { assertChatPostAllowedForUser } from "@/lib/upstash-rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  message: z.string().min(1),
  mode: z
    .enum(["grammar", "sop", "email", "feedback", "general"])
    .optional()
    .default("general"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "assistant");
  if (locked) return locked;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const chatCap = await assertChatPostAllowedForUser(session.user.id);
  if (!chatCap.ok) {
    return NextResponse.json(
      { error: "Too many assistant messages. Please wait and try again." },
      {
        status: 429,
        headers: { RetryAfter: String(chatCap.retryAfterSec) },
      },
    );
  }

  const quota = await billingPrecheckResponse(session.user.id);
  if (quota) return quota;

  const mode = parsed.data.mode as ChatMode;
  const message = parsed.data.message;

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  const prior = await prisma.chatMessage.findMany({
    where: { userId: session.user.id, mode },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const history = prior
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  let reply: string;
  let agent: {
    tabMode: string;
    effectiveMode: string;
    label: string;
    provider: string;
    model: string | null;
    routedFromGeneral: boolean;
    creditFallback: boolean;
  };

  try {
    const result = await runAssistantChat({
      mode,
      message,
      history,
      profile,
      userId: session.user.id,
    });
    reply = result.reply;
    agent = {
      tabMode: result.routing.tabMode,
      effectiveMode: result.routing.effectiveMode,
      label: result.routing.agentLabel,
      provider: result.routing.provider,
      model: result.routing.model ?? null,
      routedFromGeneral: result.routing.routedFromGeneral,
      creditFallback: result.routing.creditFallback ?? false,
    };
    console.info("[chat][response-ai]", {
      userId: session.user.id,
      mode,
      provider: agent.provider,
      model: agent.model,
      effectiveMode: agent.effectiveMode,
      routedFromGeneral: agent.routedFromGeneral,
      creditFallback: agent.creditFallback,
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
        userId: session.user.id,
        role: "user",
        content: message,
        mode,
      },
    }),
    prisma.chatMessage.create({
      data: {
        userId: session.user.id,
        role: "assistant",
        content: reply,
        mode,
      },
    }),
  ]);

  await finalizeAiConsumption(session.user.id);

  return NextResponse.json({ reply, agent });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "assistant");
  if (locked) return locked;

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  const messages = await prisma.chatMessage.findMany({
    where: {
      userId: session.user.id,
      ...(mode ? { mode } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json(messages);
}
