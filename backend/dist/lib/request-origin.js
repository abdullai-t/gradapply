// @ts-nocheck
import { appOrigin } from "@/lib/app-origin";
function normalizeOrigin(value) {
    return value.trim().toLowerCase().replace(/\/$/, "");
}
function originFromUrl(url) {
    try {
        return normalizeOrigin(new URL(url).origin);
    }
    catch {
        return null;
    }
}
/** Require same-origin browser mutation for sensitive routes. */
export function isTrustedMutationOrigin(req) {
    const trustedOrigins = new Set();
    const configured = originFromUrl(appOrigin());
    if (configured)
        trustedOrigins.add(configured);
    const origin = req.headers.get("origin");
    if (origin) {
        return trustedOrigins.has(normalizeOrigin(origin));
    }
    const referer = req.headers.get("referer");
    if (referer) {
        const refOrigin = originFromUrl(referer);
        return Boolean(refOrigin && trustedOrigins.has(refOrigin));
    }
    // Non-browser or stripped-header fallback: allow only same-origin/none hints.
    const secFetchSite = req.headers.get("sec-fetch-site");
    if (secFetchSite === "same-origin" || secFetchSite === "none") {
        return true;
    }
    return false;
}
