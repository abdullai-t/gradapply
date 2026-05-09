/**
 * Use this instead of `fetch` for `/api/*` routes so the UI can target a remote API
 * (Express / Cloud Run) while the UI stays on another origin.
 *
 * Prefer **`BACKEND_PROXY_URL`** in `next.config.mjs` for local dev (same-origin :3000 →
 * Express); LLM keys then live only on the backend. Otherwise set `NEXT_PUBLIC_API_URL`.
 *
 * When both are unset, requests stay same-origin to Next’s `/api/*` handlers.
 */
export function apiFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  if (typeof input === "string") {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "").trim() ?? "";
    const url =
      base && input.startsWith("/api") ? `${base}${input}` : input;
    return fetch(url, { credentials: "include", ...init });
  }
  return fetch(input, init);
}
