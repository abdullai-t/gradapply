# GradApply

Graduate school application companion: track schools, draft outreach and statements with AI, manage documents, and connect optional Google services (Gmail / Drive). Built with [Next.js](https://nextjs.org/) (App Router), [Prisma](https://www.prisma.io/), and [Firebase Auth](https://firebase.google.com/docs/auth).

## Prerequisites

- **Node.js** 18+ (20 LTS recommended)
- **pnpm** (`npm install -g pnpm`) — this repo uses `pnpm-lock.yaml`
- **PostgreSQL** for local or hosted database

## Quick start (Make)

```bash
make setup          # install deps + copy .env.example → .env if missing
# Edit .env: set DATABASE_URL, Firebase keys, and AUTH_SECRET (see Environment below)

make db-push        # apply schema to your database (local dev)
make db-seed        # creates test user; prints credentials to the terminal
make dev            # http://localhost:3000
```

Equivalent without Make:

```bash
pnpm install
cp .env.example .env   # then edit .env
pnpm db:push
pnpm db:seed
pnpm dev
```

## Sign-in

- **Scholars:** Google or email magic link at `/login` (Firebase Authentication).
- **Admins:** Email/password at `/login/admin` — create operator accounts in the Firebase Console (Authentication → Users) and set `ADMIN` / `SUPERADMIN` on the matching `User` row in Postgres (or use Firebase custom claims `role`).

The Prisma seed still creates a sample `User` row for local data testing; it does **not** create a Firebase account. Use Firebase Console or your own Google account for end-to-end auth locally.

## Environment variables

All keys and comments live in `**[.env.example](.env.example)`**. Copy it to `.env` and fill in at minimum:


| Variable                    | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`              | PostgreSQL connection string                                 |
| `NEXT_PUBLIC_FIREBASE_*`    | Firebase web app config (see `.env.example`)                 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_*` | Server token verification |
| `AUTH_SECRET`               | Encrypts admin app settings (not Firebase sessions)          |
| `AUTH_URL` / `NEXTAUTH_URL` | Canonical app URL (magic links, CSRF checks)                 |


Optional but needed for features:

- **Google Docs / Gmail connectors:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (separate from Firebase Google sign-in; see `.env.example`).
- **LLM (assistant, drafts, school infer):** at least one of `OPENROUTER_API_KEY` or `GROQ_API_KEY` (both recommended for automatic fallback).
- **File uploads:** `CLOUDINARY_URL` or S3-style variables documented in `.env.example`.

LLM overload protection tuning (optional):

- `LLM_MAX_INFLIGHT_PER_PROVIDER` (default `6`) — per-provider concurrent requests
- `LLM_QUEUE_MAX` (default `0`) — queued requests per provider when saturated
- `LLM_QUEUE_WAIT_MS` (default `1500`) — max wait time for queued request
- `LLM_CIRCUIT_FAILURE_THRESHOLD` (default `4`) — consecutive failures before circuit opens
- `LLM_CIRCUIT_OPEN_MS` (default `45000`) — cooldown when circuit is open
- `LLM_HIGH_LOAD_TOKEN_REDUCTION_PCT` (default `25`) — token reduction when provider load is high

**Where to look:** never commit real secrets — only `.env` (gitignored) and the template `.env.example`.

## Database

- **Local / first-time:** `make db-push` or `pnpm db:push` syncs the Prisma schema.
- **Migrations (deploy / CI):** `make migrate` or `pnpm prisma migrate deploy` applies SQL under `prisma/migrations/`.
- **Inspect data:** `make db-studio` or `pnpm db:studio`.

## Project map — where things live


| Area                             | Location                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| App routes                       | `src/app/` — e.g. `(main)/dashboard`, `schools`, `emails`, `assistant`, `documents`, `profile`, `settings`, `login` |
| API routes                       | `src/app/api/` — `auth`, `chat`, `schools`, `documents`, `connectors`, `prof-emails`, etc.                          |
| UI components                    | `src/components/`                                                                                                   |
| Auth & Prisma                    | `src/auth.ts`, `src/auth.config.ts`, `prisma/schema.prisma`                                                         |
| AI / LLM helpers                 | `src/lib/ai.ts`, `src/lib/llm-*.ts`, `src/lib/assistant-agents.ts`                                                  |
| Connectors (Gmail / Drive OAuth) | `src/lib/gmail-connector.ts`, `google-drive-connector.ts`, `src/app/api/connectors/`                                |


Main pages after login (sidebar):

- **Dashboard** — `/dashboard`
- **Schools** — `/schools`
- **Professor emails** — `/emails`
- **AI assistant** — `/assistant`
- **Documents** — `/documents`
- **Profile** — `/profile`
- **Settings** (connectors) — `/settings`

## Scripts (package.json)


| Script           | Command                 |
| ---------------- | ----------------------- |
| `pnpm dev`       | Development server      |
| `pnpm build`     | Production build        |
| `pnpm start`     | Start production server |
| `pnpm lint`      | ESLint                  |
| `pnpm db:push`   | Prisma schema push      |
| `pnpm db:seed`   | Run seed (test user)    |
| `pnpm db:studio` | Prisma Studio           |


## Makefile targets

Run `**make help`** for a short description of each target (`install`, `dev`, `build`, `env`, `db-push`, `db-seed`, `db-studio`, `migrate`, `setup`, etc.).

## Deploying

Use any Node host that supports Next.js 14; set environment variables from `.env.example`, run `pnpm prisma migrate deploy`, `pnpm build`, and `pnpm start`. Point `AUTH_URL` / `NEXTAUTH_URL` at your public URL and add the same origin to Google OAuth redirect URIs if you use Google sign-in or connectors.

For a full production checklist and repeatable migration workflow, see `[DEPLOY.md](DEPLOY.md)`.