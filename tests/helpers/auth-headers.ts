const DEFAULT_ORIGIN =
  process.env.AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export function trustedOriginHeaders(
  origin: string = DEFAULT_ORIGIN,
): Record<string, string> {
  return {
    Origin: origin,
    Referer: `${origin}/`,
    "sec-fetch-site": "same-origin",
  };
}

export function buildJsonRequest(
  url: string,
  init: Omit<RequestInit, "body"> & { json?: unknown } = {},
): Request {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (!headers.has("Content-Type") && json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  for (const [k, v] of Object.entries(trustedOriginHeaders())) {
    if (!headers.has(k)) headers.set(k, v);
  }
  const body = json !== undefined ? JSON.stringify(json) : undefined;
  return new Request(url, { ...rest, headers, body });
}

export function e2eSessionToken(
  userId: string,
  email = "e2e@test.local",
): string {
  return `e2e:${userId}:${email}`;
}
