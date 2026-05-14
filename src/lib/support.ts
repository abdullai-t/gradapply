/**
 * Product support email shown on `/support` and nav when configured.
 * Set `NEXT_PUBLIC_SUPPORT_EMAIL` (Vercel env, rebuild after change).
 */
export function getSupportEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return raw || null;
}

/** Inbox for inbound contact form (server). Falls back to public support email. */
export function getSupportInboxEmail(): string | null {
  return (
    process.env.SUPPORT_INBOX_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
    null
  );
}

export const CONTACT_TOPICS = [
  { value: "suggestion", label: "Suggestion" },
  { value: "complaint", label: "Complaint" },
  { value: "bug", label: "Bug report" },
  { value: "billing", label: "Billing" },
  { value: "other", label: "Other" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

export function contactTopicLabel(topic: ContactTopic): string {
  return CONTACT_TOPICS.find((t) => t.value === topic)?.label ?? "Contact";
}
