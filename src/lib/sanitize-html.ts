import sanitizeHtmlLib from "sanitize-html";

/** Tags allowed in SOP/email/collaboration artifact HTML. */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "a",
  "span",
  "div",
] as const;

const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["class"],
    div: ["class"],
    p: ["class"],
  },
  allowProtocolRelative: false,
};

/** Server- and client-safe HTML sanitizer for user-authored rich text. */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtmlLib(html, SANITIZE_OPTIONS);
}

/** Sanitize artifact body when it contains HTML; leave plain text unchanged. */
export function sanitizeArtifactBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (/<[a-z!/]/i.test(trimmed)) {
    return sanitizeRichHtml(trimmed);
  }
  return body;
}
