# Deploying GradApply (Vercel)

This guide is the production checklist for deploying GradApply on Vercel with PostgreSQL and Prisma migrations.

### DevOps quick reference

| Task | Command |
|------|---------|
| **Release gate** (generate + lint + typecheck + `next build`) | `pnpm run predeploy` or `make predeploy` |
| **Fast gate** (same checks as CI + Prisma generate; skips full Next build) | `pnpm run ops:release-check` or `make ops-check` |
| **Apply migrations** against the DB in `DATABASE_URL` | `pnpm run db:migrate` or `make migrate` |
| **Environment template** (copy to `.env`, never commit secrets) | copy **`.env.example`** or `make env` |

**Runtime probes:** **`GET /api/health`** (JSON, 503 if DB down) · **`/status`** · **`/support`** (needs **`NEXT_PUBLIC_SUPPORT_EMAIL`** for a visible address).

**Platform:** Configure Vercel env vars (§3), GitHub branch protection + **Lint and typecheck**, optional Vercel **Deployment Checks**, external uptime monitoring → **`/api/health`**.

## 1) Prerequisites

- A Vercel account connected to this GitHub repo
- A production PostgreSQL database (Neon/Supabase/Railway/RDS/etc.)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` only if you want Google sign-in and connectors

## 2) Release preparation (DevOps)

Use this checklist before promoting a build to production or tagging a release.

### Verify build health

Run the same gates as CI (already enforced on `main` / PRs via `.github/workflows/ci.yml`). Shortcut:

```bash
pnpm install --frozen-lockfile
pnpm run predeploy
```

Equivalent explicit steps:

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run build
```

The production build script runs `prisma generate` then `next build`; a successful local `pnpm run build` matches what Vercel compiles.

### Apply database migrations

This release ships Prisma migrations for **user roles** (`UserRole`), **feature flags** (`FeatureFlag`), and **admin config** (`AppSetting`). Production must run:

```bash
pnpm prisma migrate deploy
```

against the **same** database as `DATABASE_URL` (before the new code serves traffic, or via build-time migrate—see §5). Never use `prisma db push` for production.

If multiple deploys can overlap, prefer a single migration step (manual job or serialized deploys) to avoid migration races.

### Trust boundaries: `AUTH_URL` / `NEXTAUTH_URL` and CSRF

Browser mutations (billing checkout/portal, connector deletes, admin writes) validate `Origin` / `Referer` against the configured app URL derived from **`AUTH_URL` / `NEXTAUTH_URL`**. Set these to the **canonical HTTPS origin** users use (no trailing slash), e.g. `https://app.example.com`. A mismatch causes **403** on POST/DELETE from the real site.

### `AUTH_SECRET` and encrypted admin settings

Secrets stored in **`AppSetting`** (admin pricing/API keys) are encrypted with a key derived from **`AUTH_SECRET`** (or `NEXTAUTH_SECRET`). Rotating `AUTH_SECRET` **without** re-entering settings in the admin UI will make existing encrypted values unreadable. Plan rotations with a maintenance window or re-save of billing secrets.

### Bootstrap the admin portal

- **`SUPERADMIN_EMAILS`** (optional): comma-separated, lowercased emails. If **no** `SUPERADMIN` exists yet, the first **verified** sign-in whose email appears in this list is promoted to **`SUPERADMIN`** once (see `src/lib/admin-auth.ts`). Use this for the initial production operator, then manage roles from **Admin → Users**.
- **`ADMIN`** / **`SUPERADMIN`** roles are stored on `User`; ensure migrations ran before relying on `/admin`.

### Feature flags

Some UI is gated by DB-backed flags (for example key `user_settings_page` for `/settings` and related navigation). Defaults apply when a flag row is missing; enable or create flags under **`/admin/feature-flags`** after at least one elevated user exists.

- **`homepage_pricing_section`** — when enabled, the marketing homepage shows the **Pricing** section and footer/nav links to `#pricing`. Default is **off** until the flag exists and is enabled (or set env **`FEATURE_FLAG_HOMEPAGE_PRICING_SECTION=true`** for an emergency override without DB).
- **`support_tab`** — when enabled, the in-app **Support** tab appears in desktop and mobile navigation. Default is **off** until the flag exists and is enabled (or set env **`FEATURE_FLAG_SUPPORT_TAB=true`**).

### Observability for LLM traffic

Production logs may include structured lines **`[llm][attempt]`**, **`[llm][oneshot]`**, and **`[chat][response-ai]`** for capacity and provider debugging. Ensure log retention and access policies match your compliance needs.

### Sentry error reporting (optional)

The app includes `@sentry/nextjs` behind environment variables. Without a DSN, Sentry stays uninitialized and adds no runtime noise.

**Environment variables:**

- `SENTRY_DSN` — server and edge initialization (recommended for secrets)
- `NEXT_PUBLIC_SENTRY_DSN` — browser/client initialization (required for client-side events; often the same DSN value as public project DSN in Sentry)

Set at least one DSN for your target surfaces. SDK initialization is skipped when no DSN is set, so local runs stay quiet. For **client-side** reporting, expose `NEXT_PUBLIC_SENTRY_DSN` at **build time** as well as runtime so the browser bundle initializes correctly on Vercel. Source map upload is disabled in config by default; add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` later if you want upload-enabled releases.

## 3) Required environment variables

Set these in **Vercel Project → Settings → Environment Variables**:

- `DATABASE_URL` — production Postgres connection string
- `AUTH_SECRET` — random secret (`openssl rand -base64 32`)
- `AUTH_URL` — your public app URL (for example `https://your-app.vercel.app`)
- `NEXTAUTH_URL` — same as `AUTH_URL` (compatibility)

Recommended optional variables:

- AI providers (at least one): `OPENROUTER_API_KEY`, `GROQ_API_KEY`
- `AI_PROVIDER` — optional override (`openrouter` or `groq`). If both keys are set, **OpenRouter is preferred** unless you force `AI_PROVIDER=groq`.
- Uploads: `CLOUDINARY_URL` (or S3-compatible vars your repo documents for storage)
- Google auth/connectors: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SUPERADMIN_EMAILS` — optional bootstrap allowlist for the first superadmin (see §2)
- **`NEXT_PUBLIC_SUPPORT_EMAIL`** — optional; shown on **`/support`**, sidebar “Support”, and marketing footer so users can reach you (rebuild after changing)
- **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** — optional; together they enable **distributed** API rate limits across Vercel instances (see **Distributed rate limiting** under §2)

### Paystack billing (optional)

When `PAYSTACK_SECRET_KEY` is set, the app enforces **per-user monthly AI allowances** by plan and optional **credit packs**. If it is unset, billing quota checks are skipped (useful for self-hosted / dev).

**Server env:**

- `PAYSTACK_SECRET_KEY` — Paystack secret key (Dashboard → Settings → API Keys & Webhooks)
- `PAYSTACK_CURRENCY` — ISO code (default `GHS`). Amounts below are in the **smallest currency unit** (pesewas, kobo, etc.) where applicable.
- `PAYSTACK_PLAN_CODE_PLUS`, `PAYSTACK_PLAN_CODE_PRO` — plan codes from Paystack Plans (for subscription renewals and webhook fulfillment)
- `PAYSTACK_AMOUNT_CREDITS_MINOR` — legacy reference amount in minor units (default `5000`); per-credit checkout uses `BILLING_CREDIT_UNIT_PRICE_GHS` and pack size from admin settings / `CREDITS_PACK_SIZE`
- Display and renewal prices: `BILLING_DISPLAY_PRO_GHS`, `BILLING_DISPLAY_PLUS_GHS`, `BILLING_DISPLAY_PRO_RENEWAL_GHS`, `BILLING_DISPLAY_PLUS_RENEWAL_GHS`, `BILLING_CREDIT_UNIT_PRICE_GHS` (see `billing-admin-config`)

**Webhook URL (production):** `https://<your-domain>/api/webhooks/paystack` — enable **`charge.success`**. Paystack signs payloads; the raw body must match what was sent (already handled in the route handler).

**Callback:** `https://<your-domain>/api/billing/paystack/callback` — set automatically on `POST /api/billing/checkout` for Paystack checkouts (`callback_url`). Users must have an **email** on their account for Paystack checkout.

Optional: `PAYSTACK_CREDITS_PACK_SIZE` or `CREDITS_PACK_SIZE` — credits granted per successful credit-pack checkout (default `50`).

### Transactional email (recommended for production)

Outbound mail uses [`src/lib/mail.ts`](src/lib/mail.ts) (Nodemailer). Configure **one** transport:

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend HTTP API for app mail (recommended; avoids blocked SMTP port 587) |
| `EMAIL_FROM` | Sender address (e.g. `GradApply <hello@yourdomain.com>`) |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` | Alternative SMTP |
| `EMAIL_SERVER` | Full Nodemailer connection URL |

**Emails sent:**

- Welcome (registration / first OAuth sign-up)
- Email verification (HTML layout)
- Plus / Pro subscription confirmation (Paystack fulfillment)
- AI credits pack purchase confirmation
- School deadline (**30 days before**, per user time zone on Profile)
- Custom **Remind me on** date (same cron)

**User time zone:** Profile → **Notifications** → Time zone (IANA). Defaults to browser time zone on first load.

**Scheduled job:** `GET` or `POST` `/api/cron/notifications` with header `Authorization: Bearer <CRON_SECRET>`.

| Variable | Purpose |
| --- | --- |
| `CRON_SECRET` | Shared secret for the cron route (generate with `openssl rand -base64 32`) |

Run **hourly** (recommended) so deadline/reminder emails align with each user’s local calendar day:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/notifications"
```

**Cloudflare Workers:** add a [Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/) that `fetch`es the URL above, or use an external scheduler (GitHub Actions, cron-job.org).

**Test transport:** `pnpm mail:test you@example.com` (see `scripts/test-email.ts`).

### Distributed rate limiting (recommended for production)

For a **public** deployment on Vercel with multiple regions or instances, configure **Upstash Redis** so API rate limits are **shared across all lambdas**. Create a Redis database in the [Upstash console](https://console.upstash.com/) and add the REST credentials to the project environment.

**Environment variables:**

| Variable | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | REST API URL from Upstash (required together with token for distributed limits) |
| `UPSTASH_REDIS_REST_TOKEN` | REST token from Upstash |

When **both** are set:

- **`POST /api/auth/register`** — sliding window per **client IP** (Vercel sets `x-forwarded-for` / `x-real-ip` so the app can read the first hop).
- **SOP + professor-email LLM routes** — interval, post-success cooldown, and **UTC daily** success counts use Redis keys (same `utcDayKey` behavior as before), with tunable thresholds below.
- **`POST /api/chat`** — sliding window per **authenticated user** (see `RATE_LIMIT_CHAT_PER_USER_PER_MINUTE`).

If either Upstash variable is missing, the app **does not crash**: SOP/prof-email fall back to **in-memory** guards (per-instance), registration uses a **small in-memory** IP map with pruning, and chat skips the extra user limit so users are not double-penalized versus billing/LLM routing.

**Additional tuning (optional):**

| Variable | Default | Notes |
| --- | --- | --- |
| `RATE_LIMIT_REGISTER_PER_IP_PER_HOUR` | `5` | Registration attempts per IP per hour (Upstash sliding window, or in-memory fallback) |
| `RATE_LIMIT_CHAT_PER_USER_PER_MINUTE` | `30` | Chat POST messages per user per minute; only enforced when Upstash is configured |

**SOP generation** (`POST /api/sop/variants`):

- `SOP_GENERATE_MIN_INTERVAL_MS` — default `20000`
- `SOP_GENERATE_COOLDOWN_MS` — default `60000`
- `SOP_GENERATE_DAILY_MAX` — default `30`

**Professor-email AI** (`from-url`, `discover`, `discover-by-schools`, draft, analyze-reply):

- `PROF_EMAIL_LLM_MIN_INTERVAL_MS` — default `8000`
- `PROF_EMAIL_LLM_COOLDOWN_MS` — default `12000`
- `PROF_EMAIL_LLM_DAILY_MAX` — default `80`

### LLM overload protection (optional tuning)

Runtime request shaping reduces overload on any single LLM backend by using per-provider concurrency caps, circuit breaking, and adaptive token reductions under load.

`AI_QUALITY_MODE=high` tells writing-heavy assistant flows (SOP, professor-email, feedback, and one-shot drafting/analyze paths) to prioritize output quality by disabling adaptive token shedding and aggressive token halving retries.

- `LLM_MAX_INFLIGHT_PER_PROVIDER` — default `6`
- `LLM_QUEUE_MAX` — default `0` (no queue; immediate fallback/reject)
- `LLM_QUEUE_WAIT_MS` — default `1500`
- `LLM_CIRCUIT_FAILURE_THRESHOLD` — default `4`
- `LLM_CIRCUIT_OPEN_MS` — default `45000`
- `LLM_HIGH_LOAD_TOKEN_REDUCTION_PCT` — default `25`

Operational logging includes structured entries (`[llm][attempt]`, `[llm][oneshot]`) with provider, attempt, fallback usage, circuit state, latency, and error class.

## 4) Google OAuth setup (optional)

If you enable Google sign-in, Gmail connector, or Google Drive connector, add these redirect URIs in your Google OAuth client:

- `https://<your-domain>/api/auth/callback/google`
- `https://<your-domain>/api/connectors/gmail/callback`
- `https://<your-domain>/api/connectors/google-drive/callback`

Enable APIs in Google Cloud:

- Gmail API
- Google Drive API

## 5) Migration workflow (safe + repeatable)

Use migrations for deploys (not `db push`).

### Initial production setup

1. Ensure `DATABASE_URL` points to production.
2. Apply migrations:

```bash
pnpm prisma migrate deploy
```

Equivalent npm script: **`pnpm run db:migrate`**.

### Ongoing deploys

1. Create schema change locally.
2. Generate migration locally:

```bash
npx prisma migrate dev --name <short-change-name>
```

3. Commit both:

   - `prisma/schema.prisma`
   - `prisma/migrations/...`

4. Deploy app.
5. Run migrations against production (same `DATABASE_URL` as Vercel):

```bash
pnpm prisma migrate deploy
```

You can run step 5 from CI or manually before/after Vercel deployment.

#### Optional: run migrations during Vercel build

To apply migrations automatically on each production build (no separate shell step), set **Build Command** to:

```bash
pnpm exec prisma migrate deploy && pnpm run build
```

Requirements: production `DATABASE_URL` must be available at build time (normal on Vercel). Caveat: overlapping production deploys can race on migrations—usually acceptable if deploys are serialized; otherwise keep manual `migrate deploy` or a dedicated migration job.

## 6) Vercel deployment steps

1. Import repo on [Vercel](https://vercel.com/new).
2. Confirm framework is Next.js and **Install Command** is `pnpm install` (or leave default if the project uses `packageManager` in `package.json`).
3. Node: use **20.x** or newer (see `engines` in `package.json` and `.nvmrc`).
4. Add environment variables.
5. Deploy.
6. Unless build runs `prisma migrate deploy` (see above), run `pnpm prisma migrate deploy` against the production DB after deploy.
7. Open app URL and verify login + dashboard.

### GitHub Actions

CI runs `pnpm lint` and `pnpm typecheck` on pushes and pull requests to `main` / `master` (see `.github/workflows/ci.yml`). Fix failures before merging to avoid broken production builds.

### Stop production when CI fails

This repo’s workflow is **`CI`** with a required job named **`Lint and typecheck`**. Wire it up in two places so failing lint/typecheck cannot ship to users:

**1. GitHub (merge gate)** — Settings → **Branches** → branch protection rule for `main` (and `master` if you use it):

- Enable **Require status checks to pass before merging**.
- Add the required check **`Lint and typecheck`** (it appears under the **`CI`** workflow after at least one successful run).

This blocks merging broken commits into the default branch.

**2. Vercel (production domain gate)** — Project → **Settings** → **Deployment Checks** → **Add Checks**:

- Choose **GitHub** and select the same check (**`Lint and typecheck`** / **`CI`**), per [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks).

Vercel may still **build** the deployment, but it will **not assign your production domain** until that GitHub check passes. Admins can **Force Promote** in Vercel only if you explicitly bypass (avoid for routine deploys).

**Preview deployments** from pull requests are not replaced by this alone; the merge gate + production checks cover the usual “don’t ship bad `main`” path. To avoid preview builds entirely until CI passes, you would need a custom flow (for example deploy only from a GitHub Action after CI).

## 7) Post-deploy smoke test

- Can open `/login`
- Can sign in (local seed user is dev-only; create real users in prod)
- `/dashboard`, `/schools`, `/emails`, `/assistant`, `/documents` load
- **`/settings`**: if feature flag `user_settings_page` is off or unset, expect redirect to `/dashboard`; if enabled, settings and billing flows load
- **`/admin`**: reachable only as `ADMIN` / `SUPERADMIN`; verify overview, users, feature flags, pricing/settings after bootstrap
- Billing: start a test checkout only from the deployed origin (CSRF); confirm the Paystack webhook receives events in the provider dashboard
- If connectors enabled: from `/settings` (when available), Gmail/Drive connect without env errors
- If uploads enabled: document upload succeeds
- **`/status`** — public status page (reflects `/api/health`); **`/api/health`** returns JSON for monitors
- **`/support`** — contact page (requires **`NEXT_PUBLIC_SUPPORT_EMAIL`** for a visible support address)

## 8) Operations (Phase 3): uptime, database recovery, migration discipline

Target audience: **public launch** operators. This section is process + platform configuration; the app exposes probes you can wire to external tools.

### Health probes

| Endpoint | Use |
| --- | --- |
| **`GET /api/health`** | Machine-readable probe: **`200`** JSON `{ ok: true, version }` when the database responds; **`503`** `{ ok: false, error: "database" }` when not. Use for load balancers, synthetic monitors, and status aggregators. |
| **`/status`** | Human-readable page for users and support; polls `/api/health` every 30s and allows manual refresh. |

Configure an **external uptime monitor** (Better Stack, Checkly, UptimeRobot, Pingdom, etc.) to request **`https://<your-domain>/api/health`** on a **1–5 minute** interval. Alert on **non-200**, timeouts, or SSL failures. Keep the check in the **same region** as most users if you care about regional routing; otherwise a single global probe is fine for “is the app up.”

### Neon / Postgres backups and recovery

Neon and most managed Postgres providers offer **continuous archiving / point-in-time recovery (PITR)** on paid tiers. Before going public:

1. In the provider console, confirm **backup / PITR** is enabled for production and note the **retention window** (your effective **RPO**).
2. **Restore drill (quarterly):** create a **branch** or **fork** from a backup / timestamp (Neon: branch from history), connect with a temporary `DATABASE_URL`, and verify the app can run read-only smoke queries or `pnpm prisma migrate status`. Document who ran it and the outcome.
3. Store **runbook steps** for “restore production from backup” (even if the final step is “open a support ticket with the provider”). Include **who approves** production writes after a restore.

For non-Neon Postgres, substitute your vendor’s backup and PITR documentation; the drill concept is the same.

### Migration discipline (avoid races)

`pnpm prisma migrate deploy` is safe when **one migration run finishes** before another starts against the same database. Risks:

- **Concurrent production deploys** both running migrate at build time — two builds can overlap.
- **Manual + automatic** migrate (CI and Vercel build) at the same time.

**Mitigations:**

- Prefer **one** migration path: e.g. only **`pnpm exec prisma migrate deploy && pnpm run build`** on Vercel **or** only a **GitHub Action** that deploys after migrate, not both blindly.
- Turn off **parallel production deployments** in Vercel if your team frequently ships twice at once, **or** run migrations in a **single predeploy job** that completes before traffic shifts.
- For high-churn teams, use a **dedicated migration step** (protected environment, manual approval) before promoting the release.

### Incident pointers

- **Db down:** `/api/health` goes **503**; alerts should fire from your uptime tool and from **Sentry** / logs if configured.
- **Rollback:** redeploy the previous **Vercel deployment**; migrations already applied **forward-only** — do not delete migration rows manually unless you understand Prisma’s migration table.

## Notes

- Seed login (`test@gradapply.local` / `password123`) is for local development/testing, not production access.
- Connector tokens are per-user in the `Connector` table; OAuth client ID/secret are app-level server configuration.

