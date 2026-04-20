import type { Profile, ReplyIntent } from "@prisma/client";

import { completeOneShotLlm } from "@/lib/ai";

export type AnalyzeReplyResult = {
  intent: ReplyIntent;
  rationale: string;
  suggestedReply: string;
};

function stripJsonFence(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  const withoutOpen = t.replace(/^```(?:json)?\s*\n?/i, "");
  const end = withoutOpen.lastIndexOf("```");
  if (end === -1) return withoutOpen.trim();
  return withoutOpen.slice(0, end).trim();
}

const INTENT_VALUES = new Set([
  "INTERESTED",
  "NEUTRAL",
  "DECLINED",
  "UNKNOWN",
]);

function coerceIntent(raw: unknown): ReplyIntent {
  return typeof raw === "string" &&
    INTENT_VALUES.has(raw.trim().toUpperCase())
    ? (raw.trim().toUpperCase() as ReplyIntent)
    : "UNKNOWN";
}

export async function analyzeProfessorReplyEmail({
  profile,
  originalSubject,
  originalBody,
  replyText,
  professorName,
  university,
  userId,
}: {
  profile?: Profile | null;
  originalSubject: string | null;
  originalBody: string | null;
  replyText: string;
  professorName: string | null;
  university: string | null;
  userId?: string;
}): Promise<AnalyzeReplyResult> {
  const applicantHint = profile
    ? [
        profile.targetDegree && `Applicant degree goal: ${profile.targetDegree}`,
        profile.focusArea && `Focus: ${profile.focusArea}`,
        profile.researchInterests &&
          `Research interests: ${profile.researchInterests}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "Applicant profile not detailed — still classify based on reply text alone.";

  const userMessage = [
    applicantHint,
    "",
    `Professor: ${professorName ?? "Unknown"}`,
    `Institution: ${university ?? "Unknown"}`,
    "",
    "Original outreach subject (from applicant):",
    originalSubject?.trim() || "(none)",
    "",
    "Original outreach body (from applicant):",
    originalBody?.trim() || "(none)",
    "",
    "--- Faculty reply email (paste) ---",
    replyText.trim(),
    "--- end ---",
    "",
    'Classify how the professor seems to feel about engaging further.',
    "",
    'Respond with ONLY valid JSON (no markdown fences) with keys:',
    'intent — one of: INTERESTED, NEUTRAL, DECLINED, UNKNOWN',
    "rationale — 2-5 short sentences explaining cues from the reply (quote sparingly)",
    'suggestedReply — a polite, concise draft reply the applicant could send next (plain text; under ~220 words)',
  ].join("\n");

  const raw =
    (
      await completeOneShotLlm({
        system:
          "You help graduate-school applicants interpret faculty email replies and draft polite follow-ups. Never invent quotes not present in the pasted reply; if unclear, use intent UNKNOWN. Output JSON only.",
        user: userMessage,
        maxTokens: 2048,
        userId,
      })
    ).trim() || "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
  } catch {
    throw new Error("Could not parse AI response as JSON.");
  }

  const intent = coerceIntent(parsed.intent);

  const rationale =
    typeof parsed.rationale === "string" && parsed.rationale.trim()
      ? parsed.rationale.trim()
      : "No rationale returned.";

  const suggestedReply =
    typeof parsed.suggestedReply === "string" && parsed.suggestedReply.trim()
      ? parsed.suggestedReply.trim()
      : "Thank you for your reply. I appreciate your time and guidance.";

  return { intent, rationale, suggestedReply };
}
