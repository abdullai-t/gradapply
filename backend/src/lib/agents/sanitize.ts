// @ts-nocheck
/**
 * Prompt-injection sanitization utilities.
 *
 * Two functions for different field types:
 * - sanitizeField() — short structured fields (names, URLs, etc.)
 * - wrapUserContent() — long-form content (SOP body, email body, etc.)
 */

/**
 * Sanitize a short structured field (profName, university, URL, etc.).
 * Strips newlines and ASCII control characters, trims, and truncates.
 */
export function sanitizeField(
  input: string | null | undefined,
  maxLen = 300,
): string {
  if (!input) return "";
  // Replace \r, \n, and ASCII control chars (0x00-0x1F) except space (0x20) with a space.
  // Tabs (0x09) are also replaced to keep fields single-line.
  const cleaned = input.replace(/[\x00-\x1f]/g, " ");
  const trimmed = cleaned.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen);
}

/**
 * Wrap long-form user content in XML-style delimiters that signal to the LLM
 * that the enclosed text is DATA, not instructions.
 */
export function wrapUserContent(
  label: string,
  content: string | null | undefined,
  maxLen = 15_000,
): string {
  if (!content) return "";
  const truncated =
    content.length > maxLen ? content.slice(0, maxLen) : content;
  return `<user_data field="${label}">\n"""\n${truncated}\n"""\n</user_data>`;
}
