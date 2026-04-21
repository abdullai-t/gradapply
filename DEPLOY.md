# Deploying GradApply (Vercel)

This guide is the production checklist for deploying GradApply on Vercel with PostgreSQL and Prisma migrations.

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

### Observability for LLM traffic

Production logs may include structured lines **`[llm][attempt]`**, **`[llm][oneshot]`**, and **`[chat][response-ai]`** for capacity and provider debugging. Ensure log retention and access policies match your compliance needs.

## 3) Required environment variables

Set these in **Vercel Project → Settings → Environment Variables**:

- `DATABASE_URL` — production Postgres connection string
- `AUTH_SECRET` — random secret (`openssl rand -base64 32`)
- `AUTH_URL` — your public app URL (for example `https://your-app.vercel.app`)
- `NEXTAUTH_URL` — same as `AUTH_URL` (compatibility)

Recommended optional variables:

- AI providers (at least one): `GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`
- `AI_PROVIDER` — optional override for default LLM routing (`anthropic`, `openai`, `gemini`, `openrouter`, `groq`; otherwise auto-selected from available keys)
- Uploads: `CLOUDINARY_URL` (or S3-compatible vars your repo documents for storage)
- Google auth/connectors: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SUPERADMIN_EMAILS` — optional bootstrap allowlist for the first superadmin (see §2)

### Stripe billing (optional)

When `STRIPE_SECRET_KEY` is set, the app enforces **per-user monthly AI allowances** by plan and optional **credit packs**. If `STRIPE_SECRET_KEY` is unset, billing checks are skipped (useful for self-hosted / dev).

**Server env:**

- `STRIPE_SECRET_KEY` — Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` — signing secret from the Stripe webhook endpoint (dashboard → Developers → Webhooks)
- `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PRO_MONTHLY` — recurring Price IDs for Plus / Pro
- `STRIPE_PRICE_CREDITS_PACK` — one-time Price ID for a credit bundle

**Webhook URL (production):** `https://<your-domain>/api/webhooks/stripe` — enable events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`.

**Optional tuning:**

- `BILLING_FREE_MONTHLY_AI` (default `35`), `BILLING_PLUS_MONTHLY_AI` (default `200`), `BILLING_PRO_MONTHLY_AI` (default `600`)
- `STRIPE_CREDITS_PACK_SIZE` — credits granted per successful credit-pack checkout (default `50`)

Users manage plans from **Settings** (checkout + billing portal).

### Paystack billing (optional)

When `PAYSTACK_SECRET_KEY` is set (with or without Stripe), the same **monthly AI allowances** and **credit packs** apply. Checkout uses **Stripe first** when the secret key and price IDs for that product are configured; otherwise it uses Paystack.

**Server env:**

- `PAYSTACK_SECRET_KEY` — Paystack secret key (Dashboard → Settings → API Keys & Webhooks)
- `PAYSTACK_CURRENCY` — ISO code (default `GHS`). Amounts below are in the **smallest currency unit** (pesewas, kobo, etc.).
- `PAYSTACK_PLAN_CODE_PLUS`, `PAYSTACK_PLAN_CODE_PRO` — plan codes from Paystack Plans (for subscriptions)
- `PAYSTACK_AMOUNT_CREDITS_MINOR` — one-time credit-pack amount in minor units (default `5000` = e.g. 50.00 in GHS)

**Webhook URL (production):** `https://<your-domain>/api/webhooks/paystack` — enable **`charge.success`**. Paystack signs payloads; the raw body must match what was sent (already handled in the route handler).

**Callback:** `https://<your-domain>/api/billing/paystack/callback` — set automatically on `POST /api/billing/checkout` for Paystack checkouts (`callback_url`). Users must have an **email** on their account for Paystack checkout.

Optional: `PAYSTACK_CREDITS_PACK_SIZE` aliases the same credit count as `STRIPE_CREDITS_PACK_SIZE` / `CREDITS_PACK_SIZE` (see `billing-config`).

### Rate limits (optional tuning)

Abuse protection uses **in-memory** counters per server instance (see `src/lib/sop-generate-rate-limit.ts` and `src/lib/prof-email-llm-rate-limit.ts`). Defaults are sensible for a single-node or low-traffic deploy; for **multiple Vercel regions / instances**, consider Redis-backed limits later.

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
- Billing: start a test checkout or portal session only from the deployed origin (CSRF); confirm Stripe/Paystack webhooks receive events in provider dashboards
- If connectors enabled: from `/settings` (when available), Gmail/Drive connect without env errors
- If uploads enabled: document upload succeeds

## Notes

- Seed login (`test@gradapply.local` / `password123`) is for local development/testing, not production access.
- Connector tokens are per-user in the `Connector` table; OAuth client ID/secret are app-level server configuration.

