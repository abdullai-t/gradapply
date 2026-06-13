# Changelog

All notable changes to GradApply.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.9.0] - 2026-06-12

### Added

- **Vitest** unit and integration test harness with separate configs for unit/integration (`vitest.config.ts`) and real Postgres (`vitest.config.db.ts`).
- **134+ tests** covering auth, billing, Paystack webhooks, chat handlers, middleware, LLM contracts, security matrix, and school upsert logic.
- **Coverage gates** — ≥80% on P0 backend modules via `vitest.coverage-scope.ts`; enforced in CI with `make test-coverage`.
- **Playwright** smoke specs (health, login gate, assistant gate, chat+) and staging specs (auth, billing).
- **Makefile** targets: `test`, `test-coverage`, `test-unit`, `test-integration`, `test-db-local`, `test-e2e-smoke`, `test-e2e-staging`, and related helpers.
- **Docker Compose** test database (`docker-compose.test.yml`) on port 5433.
- **GitHub Actions**: `test-coverage.yml` on every push; extended `ci.yml` and new `nightly.yml` for DB integration and staging E2E.
- Test helpers (Prisma mock, auth headers, LLM stream mock), fixtures, and `tests/README.md` documentation.
- **`ConfirmProvider` and `useConfirm()`** (`src/components/confirm-dialog.tsx`) — promise-based replacement for `window.confirm`, with destructive, warning, and default variants.
- **`applySchoolInferResponse()` and `syncSchoolInCache()`** — UI updates from TanStack Query cache without waiting on refetch.
- Server-side persist on `POST /api/schools/infer` when `schoolId` is provided; response includes saved `school` object.
- **`inferOnly`** mode in the agent executor skips profile and existing-schools preload for faster infer calls.

### Changed

- **Removed Liveblocks collaboration** (review sessions, guest links, live comments, collab invite emails, `/collaboration` routes); **kept** Google Docs sync for SOPs and professor outreach emails.
- **Hyperdrive** enabled for production Postgres via Wrangler; deploy scripts `prepare-wrangler-hyperdrive.mjs` and `run-with-cf-env.mjs`.
- **Shell hydration** — server session and plan tier seeded from the main layout (`ServerSessionHydrator`, `ShellProvider`).
- **Billing config caching** via `src/lib/billing/build-status.ts`.
- Firebase auth provider: improved session sync, token refresh, and `/api/auth/me` role resolution.
- **Deletes are pessimistic**: rows stay visible with a spinner until the API succeeds; cache updates via `setQueryData` in `onSuccess`.
- Confirmation modal wired for school, document, folder, prof-email delete, connector disconnect, and application-tracker removals.
- Reduced `school-intel` token budget for quicker infer responses.
- `DialogContent` accepts optional `hideCloseButton` for confirmation flows.

### Removed

- Collaboration feature surface: pages, API routes, Liveblocks auth, Prisma models, nav entries, and SOP studio share-review UI.
- `@liveblocks/*` dependencies.

### Fixed

- Cloudflare `cf:deploy` Hyperdrive local env wiring.
- Reminder banner hydration edge cases after server-side shell seeding.
- School AI infer: loader no longer stops before the UI reflects saved requirements.
- Edge JWT verification helper expanded for test coverage (`verify-token-edge.ts`).

### Migration & deploy

- Run `pnpm exec prisma migrate deploy` for collaboration table removal migration.
- Local tests: `make test` (unit/integration), `make test-db-local` (Postgres); see `tests/README.md`.
- CI runs `make test-coverage` on every push; nightly runs DB tests and staging Playwright.

---

## [1.8.0] - 2026-06-02

Firebase authentication and security hardening release.

- Firebase auth replacing NextAuth (magic link, Google, admin password, session cookies)
- Paystack insert-first idempotency, atomic AI billing debits, CSRF on session/AI routes
- SSRF hardening, safe login redirects, query caps across major list endpoints
- School import upsert with unique `(userId, name, program)`
- Onboarding: searchable country picker and optional research interests
- Migration `20260602120000_school_user_name_program_unique`

---

[1.9.0]: https://github.com/abdullai-t/gradapply/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/abdullai-t/gradapply/releases/tag/v1.8.0
