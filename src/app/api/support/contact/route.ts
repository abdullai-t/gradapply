import { NextResponse } from "next/server";
import { z } from "zod";

import { sendMail } from "@/lib/mail";
import {
  contactTopicLabel,
  getSupportInboxEmail,
  type ContactTopic,
} from "@/lib/support";
import { getClientIpFromRequest } from "@/lib/upstash-rate-limit";

export const runtime = "nodejs";

const contactSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(254),
  topic: z.enum(["suggestion", "complaint", "bug", "billing", "other"]),
  message: z.string().trim().min(20).max(5000),
  website: z.string().optional(),
});

const contactMemory = new Map<
  string,
  { count: number; windowEnd: number }
>();
const CONTACT_WINDOW_MS = 60 * 60 * 1000;
const CONTACT_MAX_PER_HOUR = 5;

function assertContactAllowed(ip: string): { ok: true } | { ok: false } {
  const now = Date.now();
  const row = contactMemory.get(ip);
  if (!row || now > row.windowEnd) {
    contactMemory.set(ip, { count: 1, windowEnd: now + CONTACT_WINDOW_MS });
    return { ok: true };
  }
  if (row.count >= CONTACT_MAX_PER_HOUR) return { ok: false };
  row.count += 1;
  return { ok: true };
}

export async function POST(req: Request) {
  const inbox = getSupportInboxEmail();
  if (!inbox) {
    return NextResponse.json(
      { error: "Contact is not configured on this server." },
      { status: 503 },
    );
  }

  const ip = getClientIpFromRequest(req);
  if (!assertContactAllowed(ip).ok) {
    return NextResponse.json(
      { error: "Too many messages. Please try again in about an hour." },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check your entries and try again." },
      { status: 400 },
    );
  }

  if (parsed.data.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const { name, email, topic, message } = parsed.data;
  const topicLabel = contactTopicLabel(topic as ContactTopic);
  const subject = `[GradApply] ${topicLabel} — ${email}`;
  const text = [
    "New contact form message",
    "",
    `Topic: ${topicLabel}`,
    `From: ${name?.trim() ? `${name.trim()} <${email}>` : email}`,
    `Reply-To: ${email}`,
    `IP: ${ip}`,
    "",
    "Message:",
    message,
  ].join("\n");

  const result = await sendMail({
    to: inbox,
    subject,
    text,
    replyTo: email,
  });

  if (!result.sent) {
    return NextResponse.json(
      { error: result.error ?? "Could not send your message. Try again later." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
