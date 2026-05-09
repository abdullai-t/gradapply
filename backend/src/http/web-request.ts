import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";

export type RouteParams = Record<string, string | undefined>;

export type AppHandler<TParams extends RouteParams = RouteParams> = (
  req: Request,
  routeCtx: { params: TParams },
) => Promise<Response> | Response;

async function sendFetchResponseToExpress(
  webRes: Response,
  res: ExpressResponse,
): Promise<void> {
  res.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await webRes.arrayBuffer());
  res.end(buf);
}

/**
 * Build a WHATWG `Request` from Express so Next-auth JWT + handlers using
 * `req.url` / `req.json()` / `req.formData()` behave like App Router routes.
 */
export function buildWebRequest(req: ExpressRequest): Request {
  const proto =
    (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() ||
    "http";
  const host =
    (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() ||
    req.headers.host ||
    "localhost";
  const url = new URL(req.originalUrl || req.url, `${proto}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else headers.set(key, value);
  }

  const method = (req.method ?? "GET").toUpperCase();
  let body: BodyInit | undefined;

  if (method !== "GET" && method !== "HEAD") {
    const buf = req.body;
    if (Buffer.isBuffer(buf) && buf.length > 0) {
      body = new Uint8Array(buf);
    } else if (
      buf !== undefined &&
      buf !== null &&
      typeof buf === "object" &&
      !Buffer.isBuffer(buf)
    ) {
      body = JSON.stringify(buf);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }
  }

  return new Request(url.toString(), { method: req.method, headers, body });
}

/** Adapt an App Router–style handler to Express; merges `req.params` into `params`. */
export function adapt<TParams extends RouteParams = RouteParams>(
  handler: AppHandler<TParams>,
): (
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction,
) => Promise<void> {
  return async (req, res, next) => {
    try {
      const webReq = buildWebRequest(req);
      const params = { ...req.params } as TParams;
      const webRes = await handler(webReq, { params });
      await sendFetchResponseToExpress(webRes, res);
    } catch (e) {
      next(e);
    }
  };
}

/** Handler that only needs the WHATWG `Request` (webhooks, redirects, auth helpers). */
export function adaptPlain(
  handler: (req: Request) => Promise<Response> | Response,
): (
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction,
) => Promise<void> {
  return async (req, res, next) => {
    try {
      const webReq = buildWebRequest(req);
      const webRes = await handler(webReq);
      await sendFetchResponseToExpress(webRes, res);
    } catch (e) {
      next(e);
    }
  };
}
