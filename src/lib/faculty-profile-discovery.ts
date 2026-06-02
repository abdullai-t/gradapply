import { log } from "@/lib/logger";
import {
  assertHttpUrlFetchAllowed,
  fetchProfilePagePlainText,
} from "@/lib/profile-page-fetch";
import { formatPageFetchError } from "@/lib/page-fetch-errors";

function decodeDuckDuckGoRedirect(href: string): string | null {
  try {
    let h = href.trim();
    if (h.startsWith("//")) h = `https:${h}`;
    const u = new URL(h);
    const uddg = u.searchParams.get("uddg");
    if (uddg) {
      const decoded = decodeURIComponent(uddg);
      new URL(decoded);
      return decoded;
    }
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    /* */
  }
  return null;
}

function scoreCandidateUrl(url: string): number {
  const u = url.toLowerCase();
  let s = 0;
  if (/\.edu(\/|$)|\.ac\.uk(\/|$)|\.gov(\/|$)/.test(u)) s += 6;
  if (/faculty|people|directory|profile|staff|research|\.php\?/.test(u)) s += 4;
  if (/linkedin|facebook|twitter|x\.com|youtube|instagram|wikipedia|arxiv\.org\/pdf/.test(u))
    s -= 25;
  if (/\.pdf(\?|$)/i.test(u)) s -= 8;
  return s;
}

async function duckDuckGoResultUrls(query: string): Promise<string[]> {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
      "User-Agent":
        "Mozilla/5.0 (compatible; GradApply/1.0; faculty profile discovery; +https://gradapply.app)",
    },
    body: new URLSearchParams({ q: query }).toString(),
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      "We couldn't look up that professor online right now. Add a direct profile URL and try again.",
    );
  }

  const html = await res.text();
  const urls: string[] = [];
  const re = /class="result__a"[^>]*href="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const decoded = decodeDuckDuckGoRedirect(m[1]);
    if (!decoded) continue;
    try {
      await assertHttpUrlFetchAllowed(new URL(decoded));
    } catch {
      continue;
    }
    if (!urls.includes(decoded)) urls.push(decoded);
  }
  return urls;
}

/**
 * Uses a lightweight HTML search to find candidate faculty URLs, then fetches
 * pages until one yields enough plain text for the audit LLM.
 */
export async function discoverAndFetchFacultyPage(
  profName: string,
  university: string,
): Promise<{ url: string; text: string }> {
  const safeName = profName.replace(/"/g, "").trim();
  const safeUni = university.replace(/"/g, "").trim();
  if (!safeName || !safeUni) {
    throw new Error("Professor name and university are required for automatic page lookup.");
  }

  const primaryQuery = `"${safeName}" "${safeUni}" (faculty OR professor) (site:.edu OR site:.ac.uk OR site:.org)`;
  const fallbackQuery = `"${safeName}" "${safeUni}" faculty profile`;

  let urls = await duckDuckGoResultUrls(primaryQuery);
  if (urls.length === 0) {
    urls = await duckDuckGoResultUrls(fallbackQuery);
  }

  urls.sort((a, b) => scoreCandidateUrl(b) - scoreCandidateUrl(a));

  if (urls.length === 0) {
    throw new Error(
      "No candidate faculty pages were found from name and university. Add a direct profile URL.",
    );
  }

  const errors: string[] = [];
  for (const candidate of urls.slice(0, 12)) {
    try {
      const out = await fetchProfilePagePlainText(candidate);
      log.info("prof-emails/audit.discovery-fetch-ok", {
        candidate,
        textChars: out.text.length,
      });
      return out;
    } catch (e) {
      errors.push(formatPageFetchError(e));
    }
  }

  log.warn("prof-emails/audit.discovery-all-candidates-failed", {
    tried: Math.min(12, urls.length),
    firstError: errors[0] ?? null,
  });

  throw new Error(
    errors[0] ??
      "Could not load a readable faculty page from search results. Add a profile URL.",
  );
}
