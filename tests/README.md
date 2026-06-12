# GradApply test suite

Pyramid: **Vitest** unit + handler integration (mocked Prisma on every PR), **real Postgres** `*.db.test.ts` nightly, **Playwright** smoke in CI + staging nightly.

## Quick start

```bash
make help                  # all common commands
make test                  # unit + integration (no *.db.test.ts)
make test-db-local         # Docker Postgres + *.db.test.ts

cp tests/env.test.example .env.test   # optional for local DB / E2E

pnpm run test              # unit + integration (no *.db.test.ts)
pnpm run test:coverage     # same + enforce ≥80% on P0 backend scope
pnpm run test:unit
pnpm run test:integration
pnpm run test:db:up            # Docker Postgres on :5433 (recommended)
pnpm run test:integration:db # requires DATABASE_URL_TEST
pnpm run test:integration:db:local  # up + run in one command

pnpm run build && pnpm run test:e2e:smoke   # local smoke (needs DATABASE_URL for PLUS journey)
pnpm run test:e2e:staging                   # STAGING_URL required
```

## Layout

| Path | Purpose |
|------|---------|
| `tests/unit/` | Pure functions, no I/O |
| `tests/integration/` | Handlers + mocked Prisma |
| `tests/integration/*.db.test.ts` | Real Postgres (nightly / `DATABASE_URL_TEST`) |
| `tests/e2e/smoke/` | CI Playwright (mocked LLM; E2E fixture auth) |
| `tests/e2e/staging/` | Nightly against `STAGING_URL` |
| `tests/helpers/` | Prisma mock, auth headers, LLM stream mock |
| `tests/fixtures/` | Sample webhook / payload JSON |

## Environment

See `tests/env.test.example`. Key variables:

- `DATABASE_URL_TEST` — **dedicated** Postgres for `*.db.test.ts` (never your Neon `DATABASE_URL`). Use `pnpm run test:db:up` and port **5433** from `docker-compose.test.yml`.
- `ALLOW_E2E_FIXTURES=1` — enables `e2e:<userId>:<email>` session tokens (CI only)
- `STAGING_URL` — nightly staging Playwright

## CI

| Workflow | Job | What runs |
|----------|-----|-----------|
| `.github/workflows/ci.yml` | `unit-and-handler` | `pnpm test:unit` + `pnpm test:integration` |
| `.github/workflows/ci.yml` | `e2e-smoke` | `pnpm build` + Playwright smoke + Postgres seed |
| `.github/workflows/nightly.yml` | `integration-db` | `pnpm test:integration:db` |
| `.github/workflows/nightly.yml` | `e2e-staging` | Playwright staging (`vars.STAGING_URL`) |

## Coverage

`pnpm run test:coverage` (or `make test-coverage`) measures **P0 backend modules** listed in `vitest.coverage-scope.ts` — auth, billing, Paystack, chat handlers, plan gates, and related API routes. UI pages/components, LLM orchestrator internals, and large document/import modules are excluded (covered by Playwright smoke or nightly jobs instead).

Thresholds (enforced in CI): **80%** lines/statements, **70%** branches, **75%** functions.

## SECURITY.md traceability

| Control | Test file |
|---------|-----------|
| CSRF on session POST | `tests/integration/auth-session.test.ts`, `tests/integration/security-matrix.test.ts` |
| CSRF on authenticated mutations | `tests/integration/chat-handlers.test.ts` |
| Open redirect | `tests/unit/auth-redirect.test.ts`, `tests/integration/security-matrix.test.ts` |
| Paystack webhook HMAC | `tests/integration/paystack-webhook.test.ts`, `tests/integration/security-matrix.test.ts` |
| Idempotent Paystack fulfillment | `tests/integration/paystack-fulfillment.test.ts`, `tests/integration/paystack-race.db.test.ts` |
| Atomic AI debit | `tests/integration/billing-debit.test.ts`, `tests/integration/billing-debit-race.db.test.ts` |
| AI fail-closed in production | `tests/integration/security-matrix.test.ts` |
| Profile URL SSRF | `tests/unit/profile-page-fetch-ssrf.test.ts`, `tests/integration/security-matrix.test.ts` |
| Session POST rate limit | `tests/integration/auth-session.test.ts`, `tests/integration/security-matrix.test.ts` |
| Role from DB only (no JWT elevation) | `tests/integration/auth-me-role.test.ts` |
| School unique `(userId, name, program)` | `tests/integration/school-upsert.db.test.ts` |
| LLM router regex / fallback contracts | `tests/unit/router-prompt.test.ts`, `tests/integration/llm-contracts.test.ts` |
| HTML sanitization | `tests/unit/sanitize-html.test.ts` |

## E2E fixture auth

When `ALLOW_E2E_FIXTURES=1`, session cookies may use tokens `e2e:<firebaseUid>:<email>`. Seed users with `pnpm run test:seed-e2e` before smoke runs that need a PLUS profile.
