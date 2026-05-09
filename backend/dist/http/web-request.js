async function sendFetchResponseToExpress(webRes, res) {
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
export function buildWebRequest(req) {
    const proto = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim() ||
        "http";
    const host = req.headers["x-forwarded-host"]?.split(",")[0]?.trim() ||
        req.headers.host ||
        "localhost";
    const url = new URL(req.originalUrl || req.url, `${proto}://${host}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined)
            continue;
        if (Array.isArray(value))
            headers.set(key, value.join(", "));
        else
            headers.set(key, value);
    }
    const method = (req.method ?? "GET").toUpperCase();
    let body;
    if (method !== "GET" && method !== "HEAD") {
        const buf = req.body;
        if (Buffer.isBuffer(buf) && buf.length > 0) {
            body = new Uint8Array(buf);
        }
        else if (buf !== undefined &&
            buf !== null &&
            typeof buf === "object" &&
            !Buffer.isBuffer(buf)) {
            body = JSON.stringify(buf);
            if (!headers.has("content-type")) {
                headers.set("content-type", "application/json");
            }
        }
    }
    return new Request(url.toString(), { method: req.method, headers, body });
}
/** Adapt an App Router–style handler to Express; merges `req.params` into `params`. */
export function adapt(handler) {
    return async (req, res, next) => {
        try {
            const webReq = buildWebRequest(req);
            const params = { ...req.params };
            const webRes = await handler(webReq, { params });
            await sendFetchResponseToExpress(webRes, res);
        }
        catch (e) {
            next(e);
        }
    };
}
/** Handler that only needs the WHATWG `Request` (webhooks, redirects, auth helpers). */
export function adaptPlain(handler) {
    return async (req, res, next) => {
        try {
            const webReq = buildWebRequest(req);
            const webRes = await handler(webReq);
            await sendFetchResponseToExpress(webRes, res);
        }
        catch (e) {
            next(e);
        }
    };
}
