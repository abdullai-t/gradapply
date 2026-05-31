import { appOrigin } from "@/lib/app-origin";

function normalizeOrigin(value: string): string {
  return value.trim().toLowerCase().replace(/\/$/, "");
}

function originFromUrl(url: string): string | null {
  try {
    return normalizeOrigin(new URL(url).origin);
  } catch {
    return null;
  }
}

/** Require same-origin browser mutation for sensitive routes. */
export function isTrustedMutationOrigin(req: Request): boolean {
  const trustedOrigins = new Set<string>();
  const configured = originFromUrl(appOrigin());
  if (configured) trustedOrigins.add(configured);

  const origin = req.headers.get("origin");
  if (origin) {
    return trustedOrigins.has(normalizeOrigin(origin));
  }

  const referer = req.headers.get("referer");
  if (referer) {
    const refOrigin = originFromUrl(referer);
    return Boolean(refOrigin && trustedOrigins.has(refOrigin));
  }

  // Non-browser clients without Origin/Referer: allow same-origin hint only.
  // Do not trust sec-fetch-site "none" in production (CSRF bypass risk).
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin") return true;
  if (
    secFetchSite === "none" &&
    process.env.NODE_ENV !== "production"
  ) {
    return true;
  }
  return false;
}
