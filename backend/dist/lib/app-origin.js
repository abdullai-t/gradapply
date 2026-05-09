// @ts-nocheck
/** Canonical public origin for redirects and OAuth callbacks. */
export function appOrigin() {
    return (process.env.AUTH_URL?.replace(/\/$/, "") ??
        process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
        "http://localhost:3000");
}
