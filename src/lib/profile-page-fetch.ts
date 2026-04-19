/**
 * Fetch a public faculty profile HTML and reduce to plain text for the LLM.
 * Basic SSRF hardening: only http(s), block obvious private hosts.
 */

const MAX_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 100_000;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.goog",
]);

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h.endsWith(".localhost")) return true;
  if (h === "[::1]") return true;
  // IPv4 literals
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const parts = h.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  return false;
}

function htmlToPlainText(html: string): string {
  const noScript = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const stripped = noScript.replace(/<[^>]+>/g, " ");
  return stripped.replace(/\s+/g, " ").trim();
}

export async function fetchProfilePagePlainText(
  rawUrl: string,
): Promise<{ url: string; text: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }

  if (isBlockedHost(url.hostname)) {
    throw new Error("That host is not allowed.");
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "GradApplyBot/1.0 (+https://gradapply.local; faculty profile summarization)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Page returned HTTP ${res.status}.`);
    }

    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
      throw new Error("URL must point to an HTML page.");
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("Page is too large to process.");
    }

    const decoder = new TextDecoder("utf-8", { fatal: false });
    let html = decoder.decode(buf);

    const charset =
      ctype.match(/charset=([^;]+)/i)?.[1]?.trim().replace(/["']/g, "") ??
      html.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i)?.[1];
    if (charset && charset.toLowerCase() !== "utf-8") {
      try {
        html = new TextDecoder(charset, { fatal: false }).decode(buf);
      } catch {
        /* keep utf-8 attempt */
      }
    }

    let text = htmlToPlainText(html);
    if (text.length > MAX_TEXT_CHARS) {
      text = `${text.slice(0, MAX_TEXT_CHARS)}\n\n[…truncated for length]`;
    }

    if (text.length < 80) {
      throw new Error(
        "Could not extract enough text from the page (it may require JavaScript). Try a simpler profile or directory URL.",
      );
    }

    return { url: url.toString(), text };
  } finally {
    clearTimeout(t);
  }
}
