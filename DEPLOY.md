# Deploying GradApply (Vercel)

This guide is the production checklist for deploying GradApply on Vercel with PostgreSQL and Prisma migrations.

## 1) Prerequisites

- A Vercel account connected to this GitHub repo
- A production PostgreSQL database (Neon/Supabase/Railway/RDS/etc.)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` only if you want Google sign-in and connectors

## 2) Required environment variables

Set these in **Vercel Project → Settings → Environment Variables**:

- `DATABASE_URL` — production Postgres connection string
- `AUTH_SECRET` — random secret (`openssl rand -base64 32`)
- `AUTH_URL` — your public app URL (for example `https://your-app.vercel.app`)
- `NEXTAUTH_URL` — same as `AUTH_URL` (compatibility)

Recommended optional variables:

- AI providers (at least one): `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`
- Uploads: `CLOUDINARY_URL` (or S3-compatible vars from `.env.example`)
- Google auth/connectors: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## 3) Google OAuth setup (optional)

If you enable Google sign-in, Gmail connector, or Google Drive connector, add these redirect URIs in your Google OAuth client:

- `https://<your-domain>/api/auth/callback/google`
- `https://<your-domain>/api/connectors/gmail/callback`
- `https://<your-domain>/api/connectors/google-drive/callback`

Enable APIs in Google Cloud:

- Gmail API
- Google Drive API

## 4) Migration workflow (safe + repeatable)

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
5. Run:

```bash
pnpm prisma migrate deploy
```

You can run step 5 from CI or manually before/after Vercel deployment, but always against the same production `DATABASE_URL`.

## 5) Vercel deployment steps

1. Import repo on [Vercel](https://vercel.com/new).
2. Confirm framework is Next.js.
3. Add environment variables.
4. Deploy.
5. Run `pnpm prisma migrate deploy` against production DB.
6. Open app URL and verify login + dashboard.

## 6) Post-deploy smoke test

- Can open `/login`
- Can sign in (local seed user is dev-only; create real users in prod)
- `/dashboard`, `/schools`, `/emails`, `/assistant`, `/documents`, `/settings` load
- If connectors enabled: `/settings` can connect Gmail/Drive without env errors
- If uploads enabled: document upload succeeds

## Notes

- Seed login (`test@gradapply.local` / `password123`) is for local development/testing, not production access.
- Connector tokens are per-user in the `Connector` table; OAuth client ID/secret are app-level server configuration.
