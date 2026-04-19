# GradApply

Graduate school application companion: track schools, draft outreach and statements with AI, manage documents, and connect optional Google services (Gmail / Drive). Built with [Next.js](https://nextjs.org/) (App Router), [Prisma](https://www.prisma.io/), and [NextAuth](https://next-auth.js.org/).

## Prerequisites

- **Node.js** 18+ (20 LTS recommended)
- **pnpm** (`npm install -g pnpm`) — this repo uses `pnpm-lock.yaml`
- **PostgreSQL** for local or hosted database

## Quick start (Make)

```bash
make setup          # install deps + copy .env.example → .env if missing
# Edit .env: set DATABASE_URL and AUTH_SECRET (see Environment below)

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

## Test login (seed user)

After **`make db-seed`** or **`pnpm db:seed`**, sign in at **`/login`** with:

| Field    | Value                 |
| -------- | --------------------- |
| Email    | `test@gradapply.local` |
| Password | `password123`          |

These values are defined in [`prisma/seed.ts`](prisma/seed.ts). The seed script **upserts** this user and logs the same pair to your terminal when it runs.

**Who should use this:** developers and testers only. Change or remove the seed for production deployments.

## Environment variables

All keys and comments live in **[`.env.example`](.env.example)**. Copy it to `.env` and fill in at minimum:

| Variable        | Purpose |
| --------------- | ------- |
| `DATABASE_URL`  | PostgreSQL connection string |
| `AUTH_SECRET`   | Session encryption — generate e.g. `openssl rand -base64 32` |
| `AUTH_URL` / `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |

Optional but needed for features:

- **Google sign-in & connectors:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (see comments in `.env.example` for redirect URIs and APIs to enable).
- **LLM (assistant, drafts, school infer):** at least one of `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY`.
- **File uploads:** `CLOUDINARY_URL` or S3-style variables documented in `.env.example`.

**Where to look:** never commit real secrets — only `.env` (gitignored) and the template `.env.example`.

## Database

- **Local / first-time:** `make db-push` or `pnpm db:push` syncs the Prisma schema.
- **Migrations (deploy / CI):** `make migrate` or `pnpm prisma migrate deploy` applies SQL under `prisma/migrations/`.
- **Inspect data:** `make db-studio` or `pnpm db:studio`.

## Project map — where things live

| Area | Location |
| ---- | -------- |
| App routes | `src/app/` — e.g. `(main)/dashboard`, `schools`, `emails`, `assistant`, `documents`, `profile`, `settings`, `login` |
| API routes | `src/app/api/` — `auth`, `chat`, `schools`, `documents`, `connectors`, `prof-emails`, etc. |
| UI components | `src/components/` |
| Auth & Prisma | `src/auth.ts`, `src/auth.config.ts`, `prisma/schema.prisma` |
| AI / LLM helpers | `src/lib/ai.ts`, `src/lib/llm-*.ts`, `src/lib/assistant-agents.ts` |
| Connectors (Gmail / Drive OAuth) | `src/lib/gmail-connector.ts`, `google-drive-connector.ts`, `src/app/api/connectors/` |

Main pages after login (sidebar):

- **Dashboard** — `/dashboard`
- **Schools** — `/schools`
- **Professor emails** — `/emails`
- **AI assistant** — `/assistant`
- **Documents** — `/documents`
- **Profile** — `/profile`
- **Settings** (connectors) — `/settings`

## Scripts (package.json)

| Script | Command |
| ------ | ------- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Prisma schema push |
| `pnpm db:seed` | Run seed (test user) |
| `pnpm db:studio` | Prisma Studio |

## Makefile targets

Run **`make help`** for a short description of each target (`install`, `dev`, `build`, `env`, `db-push`, `db-seed`, `db-studio`, `migrate`, `setup`, etc.).

## Deploying

Use any Node host that supports Next.js 14; set environment variables from `.env.example`, run `pnpm prisma migrate deploy`, `pnpm build`, and `pnpm start`. Point `AUTH_URL` / `NEXTAUTH_URL` at your public URL and add the same origin to Google OAuth redirect URIs if you use Google sign-in or connectors.
