/**
 * Paragraph utilities for SOP studio — split plain text, emit editor HTML,
 * and normalize legacy single-block drafts into `<p>` blocks.
 */

const BLOCK_HTML_RE = /<\s*(p|h[1-6]|ul|ol|li|blockquote|div)\b/i;

/** True when the string already looks like HTML block markup. */
export function isBlockHtml(text: string): boolean {
  return BLOCK_HTML_RE.test(text);
}

/**
 * Split plain text into logical paragraphs. Honors explicit breaks first,
 * then heuristics for LLM output that omits blank lines.
 */
export function splitParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const byDoubleNewline = trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (byDoubleNewline.length > 1) return byDoubleNewline;

  const bySingleNewline = trimmed
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (bySingleNewline.length > 1) return bySingleNewline;

  if (byDoubleNewline.length === 1 && byDoubleNewline[0].length > 320) {
    const split = splitWallOfText(byDoubleNewline[0]);
    if (split.length > 1) return split;
  }

  return byDoubleNewline.length ? byDoubleNewline : [trimmed];
}

/** Split a long single block on common SOP paragraph openers after sentence ends. */
function splitWallOfText(text: string): string[] {
  const thematic =
    /(?<=[.!?])\s+(?=(?:During|My |I |At |After |When |As |The |In |Upon |Having |While |With |Although|However|Therefore|Additionally|Furthermore|Specifically|Ultimately)\b)/gi;
  const parts = text
    .split(thematic)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length > 1) return parts;

  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [text];
  if (sentences.length <= 2) return [text];

  const paragraphs: string[] = [];
  let current = "";
  const targetChars = 520;

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    const next = current ? `${current} ${s}` : s;
    if (current.length >= 180 && next.length > targetChars) {
      paragraphs.push(current.trim());
      current = s;
    } else {
      current = next;
    }
  }
  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs.length > 1 ? paragraphs : [text];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Plain-text paragraphs → minimal HTML for Tiptap. */
export function paragraphsToHtml(paragraphs: string[]): string {
  if (paragraphs.length === 0) return "";
  return paragraphs
    .map(
      (p) =>
        `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
}

/**
 * Normalize stored variant body (plain or HTML) into paragraph HTML for the editor.
 */
export function bodyToEditorHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";

  if (isBlockHtml(trimmed)) {
    if (/<\s*p\b/i.test(trimmed)) return trimmed;
    const text = stripHtmlToPlain(trimmed);
    return paragraphsToHtml(splitParagraphs(text));
  }

  return paragraphsToHtml(splitParagraphs(trimmed));
}

/** Strip HTML to plain text with blank lines between former blocks. */
export function stripHtmlToPlain(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
