import { httpStatusUserMessage } from "@/lib/page-fetch-errors";

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

/** True if `dotted` is an IPv4 literal that must not be fetched (private, loopback, link-local). */
function isBlockedIpv4Literal(dotted: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(dotted)) return false;
  const parts = dotted.split(".").map(Number);
  if (parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  /** Link-local IPv4 (includes cloud metadata 169.254.169.254). */
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h.endsWith(".localhost")) return true;
  if (h === "::1") return true;
  if (h.startsWith("::ffff:")) {
    const v4 = h.slice("::ffff:".length);
    if (isBlockedIpv4Literal(v4)) return true;
  }
  if (isBlockedIpv4Literal(h)) return true;
  return false;
}

/**
 * Ensures a resolved URL is safe to fetch (after redirects). Call on both the user-supplied URL
 * and the final response URL — open redirects must not bypass SSRF checks.
 */
export function assertHttpUrlFetchAllowed(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only web links starting with http:// or https:// are supported.");
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error(
      "That link can't be loaded from here. Use a public university profile page.",
    );
  }
}

export function htmlToPlainText(html: string): string {
  const noScript = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const stripped = noScript.replace(/<[^>]+>/g, " ");
  return stripped.replace(/\s+/g, " ").trim();
}

/** Same-host links for faculty discovery (directory / profile pages). */
export function extractSameHostFacultyLinks(
  html: string,
  pageUrl: string,
  max = 55,
): { url: string; label: string }[] {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const raw: { url: string; label: string; score: number }[] = [];
  const re =
    /<a\s+[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1]?.trim();
    if (
      !href ||
      href.startsWith("#") ||
      href.toLowerCase().startsWith("javascript:") ||
      href.toLowerCase().startsWith("mailto:")
    )
      continue;
    let abs: string;
    try {
      abs = new URL(href, base).toString();
    } catch {
      continue;
    }
    let u: URL;
    try {
      u = new URL(abs);
    } catch {
      continue;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    if (u.hostname.toLowerCase() !== base.hostname.toLowerCase()) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);

    const inner = htmlToPlainText(m[2] ?? "").slice(0, 220).trim();
    const path = u.pathname.toLowerCase();
    let score = 0;
    if (/faculty|people|profile|directory|research|labs|\/~\w|staff/i.test(path))
      score += 6;
    if (/about|news|contact|calendar|events|login|privacy|cookie/i.test(path))
      score -= 4;
    if (inner.length >= 3) score += 1;

    raw.push({
      url: abs,
      label: inner.length >= 2 ? inner : u.pathname,
      score,
    });
  }

  raw.sort((a, b) => b.score - a.score);
  return raw.slice(0, max).map(({ url, label }) => ({ url, label }));
}

async function fetchProfileHtml(rawUrl: string): Promise<{ finalUrl: URL; html: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("That doesn't look like a valid web address. Check the link and try again.");
  }

  assertHttpUrlFetchAllowed(url);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);

  try {
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "GradApplyBot/1.0 (+https://gradapply.local; faculty profile summarization)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("The page took too long to load. Check the URL or try again.");
      }
      throw new Error(
        "We couldn't reach that website. Check your connection and that the URL is correct.",
      );
    }

    let finalUrl: URL;
    try {
      finalUrl = new URL(res.url || url.toString());
    } catch {
      throw new Error(
        "The link redirected to an invalid address. Try a direct faculty profile URL.",
      );
    }
    assertHttpUrlFetchAllowed(finalUrl);

    if (!res.ok) {
      throw new Error(httpStatusUserMessage(res.status));
    }

    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
      throw new Error(
        "That link doesn't point to a web page. Use a faculty profile or department page URL.",
      );
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      throw new Error(
        "That page is too large to process. Try a shorter faculty profile URL.",
      );
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

    return { finalUrl, html };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchProfilePagePlainText(
  rawUrl: string,
): Promise<{ url: string; text: string }> {
  const { finalUrl, html } = await fetchProfileHtml(rawUrl);

  let text = htmlToPlainText(html);
  if (text.length > MAX_TEXT_CHARS) {
    text = `${text.slice(0, MAX_TEXT_CHARS)}\n\n[…truncated for length]`;
  }

  if (text.length < 80) {
    throw new Error(
      "Could not extract enough text from the page (it may require JavaScript). Try a simpler profile or directory URL.",
    );
  }

  return { url: finalUrl.toString(), text };
}

/** Plain text + same-site links for AI faculty matching. */
export async function fetchProfilePageForDiscovery(
  rawUrl: string,
): Promise<{ url: string; text: string; links: { url: string; label: string }[] }> {
  const { finalUrl, html } = await fetchProfileHtml(rawUrl);
  const links = extractSameHostFacultyLinks(html, finalUrl.toString());

  let text = htmlToPlainText(html);
  if (text.length > MAX_TEXT_CHARS) {
    text = `${text.slice(0, MAX_TEXT_CHARS)}\n\n[…truncated for length]`;
  }

  if (text.length < 80) {
    throw new Error(
      "Could not extract enough text from the page (it may require JavaScript). Try a simpler profile or directory URL.",
    );
  }

  return { url: finalUrl.toString(), text, links };
}
