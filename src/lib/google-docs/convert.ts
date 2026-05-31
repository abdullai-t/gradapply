import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { bodyToEditorHtml, stripHtmlToPlain } from "@/lib/sop-paragraphs";

export function sanitizeImportedHtml(html: string): string {
  return sanitizeRichHtml(html);
}

/** GradApply storage format (HTML paragraphs) for entity body fields. */
export function toGradApplyHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return sanitizeImportedHtml(bodyToEditorHtml(trimmed));
}

/** HTML suitable for uploading to create/replace a Google Doc. */
export function toGoogleDocHtml(gradApplyBody: string): string {
  const html = bodyToEditorHtml(gradApplyBody.trim());
  if (!html) return "<p></p>";
  return html;
}

/** Plain text title from HTML-ish body. */
export function plainTitleFromBody(body: string, fallback: string): string {
  const plain = stripHtmlToPlain(body).trim();
  if (!plain) return fallback;
  const first = plain.split(/\n+/)[0]?.trim() ?? "";
  return first.slice(0, 120) || fallback;
}
