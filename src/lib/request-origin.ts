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

/** Public origin for this HTTP request (Workers / reverse proxies). */
export function requestPublicOrigin(req: Request): string | null {
  const forwardedProto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const forwardedHost =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.trim() ||
    "";
  if (!forwardedHost) return null;
  return `${forwardedProto}://${forwardedHost}`;
}

function collectTrustedOrigins(req: Request): Set<string> {
  const trustedOrigins = new Set<string>();
  for (const candidate of [
    appOrigin(),
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ""),
    requestPublicOrigin(req),
  ]) {
    if (!candidate) continue;
    const o = originFromUrl(candidate);
    if (o) trustedOrigins.add(o);
  }
  return trustedOrigins;
}

/** Require same-origin browser mutation for sensitive routes. */
export function isTrustedMutationOrigin(req: Request): boolean {
  const trustedOrigins = collectTrustedOrigins(req);

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
