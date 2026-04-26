import { NextResponse } from "next/server";

import { type ChatMode, runAssistantChat } from "@/lib/ai";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";
import { assertChatPostAllowedForUser } from "@/lib/upstash-rate-limit";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";
import { withPlanGate } from "../_with-plan-gate";

import { sendMessageSchema } from "./schemas";

export const history = withPlanGate("assistant", async (req, { userId }) => {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const schoolId = url.searchParams.get("schoolId");

  const messages = await prisma.chatMessage.findMany({
    where: {
      userId,
      ...(mode ? { mode } : {}),
      // When schoolId is supplied (SOP studio), scope strictly to that school.
      // When omitted, return only non-school-scoped messages so general chats
      // don't include per-school SOP exchanges.
      ...(schoolId ? { schoolId } : { schoolId: null }),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return ok(messages);
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

  const mode = parsed.data.mode as ChatMode;
  const message = parsed.data.message;
  const schoolId = parsed.data.schoolId ?? null;

  const [profile, prior] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
    }),
    prisma.chatMessage.findMany({
      where: {
        userId,
        mode,
        ...(schoolId ? { schoolId } : { schoolId: null }),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

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
      userId,
      schoolId,
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
      userId,
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
        userId,
        role: "user",
        content: message,
        mode,
        schoolId,
      },
    }),
    prisma.chatMessage.create({
      data: {
        userId,
        role: "assistant",
        content: reply,
        mode,
        schoolId,
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
