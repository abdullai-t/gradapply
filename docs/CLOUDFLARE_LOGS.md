# Streaming Cloudflare Worker logs (gradapply)

Worker name: **`mygradapply`** (see [`wrangler.jsonc`](../wrangler.jsonc)).

## 1. Live tail in your terminal (fastest)

Requires [Wrangler](https://developers.cloudflare.com/workers/wrangler/) logged in (`pnpm exec wrangler login`).

```bash
# All production logs (live stream)
pnpm run cf:tail

# App structured logs only ([gradapply][tag] from src/lib/logger.ts)
pnpm run cf:tail:app

# Errors and failed requests
pnpm run cf:tail:errors

# Filter by path (example)
pnpm exec wrangler tail mygradapply --search "/api/auth"
```

Use **`--format pretty`** (default in our scripts) or **`--format json`** for piping to `jq`.

**Tip:** In production, set `LOG_LEVEL=info` or `LOG_LEVEL=debug` on the Worker to see more `[gradapply][…]` lines (default prod level in code is `warn`).

## 2. Grafana (persistent stream — already in wrangler config)

[`wrangler.jsonc`](../wrangler.jsonc) enables:

- Logs → destination `grafana-logs`
- Traces → destination `grafana-traces`

**One-time dashboard setup:**

1. Cloudflare dashboard → **Workers & Pages** → **Observability** → **Destinations**.
2. Add a **Grafana** destination (name must match: `grafana-logs`, `grafana-traces`), with your Grafana Cloud stack URL and API token.
3. Redeploy: `pnpm run cf:deploy` (config is applied on deploy).

After that, logs and traces stream continuously to Grafana (not just live tail).

Docs: [Workers Observability](https://developers.cloudflare.com/workers/observability/).

## 3. Cloudflare dashboard

**Workers & Pages** → **mygradapply** → **Logs** (real-time tab) or **Observability** → **Invocations**.

Good for quick checks without Wrangler.

## 4. What this app logs

Structured logs use `src/lib/logger.ts`:

```text
[gradapply][auth.me.provision_failed] { uid, error }
[gradapply][auth/session] …
```

Search tail with:

```bash
pnpm exec wrangler tail mygradapply --search "gradapply"
```

Next.js / OpenNext also emit request timing lines in Workers logs (e.g. `GET /dashboard 200`).

## 5. “Worker hung” / canceled requests

If logs show:

```text
The Workers runtime canceled this request because it detected that your Worker's code had hung
```

on `/api/folders`, `/api/documents/summary`, etc., the Worker is waiting on **Postgres**. Fix:

1. Add **Hyperdrive** (see [DEPLOY.md](../DEPLOY.md) Cloudflare section).
2. Redeploy.
3. Confirm `GET /api/health` returns `{ ok: true }`.

## 6. Auth / login debugging

```bash
pnpm exec wrangler tail mygradapply --search "auth"
```

Watch for `auth.me.provision_failed` (database) or `403` on `/api/auth/session` (origin / CSRF).
