import type { NextFunction, Request, Response } from "express";

function formatMs(start: number): string {
  return (performance.now() - start).toFixed(1);
}

type TimedRequest = Request & { _requestStartedAt?: number };

/** Logs every request: line when the request arrives + line when the response finishes (status + duration). */
export function requestLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = performance.now();
    (req as TimedRequest)._requestStartedAt = start;
    const method = req.method ?? "GET";
    const url = req.originalUrl ?? req.url ?? "";

    // Always use console.log so nothing is hidden by log-level filtering in terminals / tooling.
    console.log(`[backend] → ${method} ${url}`);

    const logFinish = (status: number): void => {
      const ms = formatMs(start);
      const line = `[backend] ← ${method} ${url} ${status} ${ms}ms`;
      if (status >= 500) {
        console.error(line);
      } else if (status >= 400) {
        console.warn(line);
      } else {
        console.log(line);
      }
    };

    res.on("finish", () => {
      logFinish(res.statusCode);
    });

    res.on("close", () => {
      if (res.writableEnded || res.writableFinished) return;
      const ms = formatMs(start);
      console.warn(`[backend] ✕ ${method} ${url} closed before finish ${ms}ms`);
    });

    next();
  };
}

/** Logs errors passed to `next(err)` and returns JSON 500 if headers not sent. */
export function errorLoggingMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const msg = err instanceof Error ? err.message : String(err);
  const started = (req as TimedRequest)._requestStartedAt;
  const timing =
    typeof started === "number" ? ` ${formatMs(started)}ms` : "";

  console.error(
    `[backend] ERROR ${req.method ?? "?"} ${req.originalUrl ?? req.url ?? ""}${timing} — ${msg}`,
  );
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "production"
        ? undefined
        : msg,
  });
}
