# Security hardening

Operational checklist for GradApply. Items marked **done** are enforced in code; others are deployment/process.

## Authentication & admin

| Item | Status | Notes |
|------|--------|--------|
| Firebase Auth + HttpOnly session cookie | done | Client signs in with Firebase; `POST /api/auth/session` mints a Firebase **session cookie** (or legacy ID token fallback) in `__gradapply_session` |
| Admin role in Postgres only | done | JWT custom claims do **not** elevate `User.role`; use `scripts/set-firebase-admin-claims.mjs` + DB for operators |
| Admin routes role-gated | done | `ADMIN` / `SUPERADMIN` via `requireElevatedUser()` |
| CSRF on authenticated mutations | done | `withAuth` + `isTrustedMutationOrigin`; also `POST /api/auth/session`, `/api/ai/*`, Liveblocks auth |
| CSRF on guest collab comments | done | Same origin check on `POST` comments |
| Session POST rate limit | done | Per-IP cap via Upstash (`RATE_LIMIT_SESSION_POST_PER_IP_PER_HOUR`) or in-memory fallback |
| Open redirect hardening | done | `isSafeAuthRedirectPath` on login, admin login, email-link, `/auth/continue` |

## Billing & Paystack

| Item | Status | Notes |
|------|--------|--------|
| Paystack webhook HMAC | done | `x-paystack-signature` verified before fulfillment |
| Idempotent fulfillment | done | `PaystackEventLog` insert-first; duplicate `reference` → no-op |
| Callback route display-only | done | Browser redirect does not grant credits; webhook fulfills |
| AI billing fail-closed in production | done | Missing Paystack config blocks AI in `NODE_ENV=production` |
| Atomic AI debit | done | Conditional `updateMany` in `finalizeAiConsumptionForAction`; throws on 0 rows |

## Google Docs sync

| Item | Status | Notes |
|------|--------|--------|
| Entity-scoped links (SOP, prof email) | done | `GoogleDocLink` unique per `(entityType, entityId)` |
| OAuth via user Google Drive connector | done | Requires connected Drive; no cross-user file access |
| Server-side HTML sanitization on import | done | `sanitizeRichHtml` when applying doc content to entities |

## Data & AI

| Item | Status | Notes |
|------|--------|--------|
| LLM prompt field sanitization | done | `sanitizeField` / `wrapUserContent` |
| Profile URL SSRF checks | done | Block private/decimal IPs; DNS resolve-then-block on fetch |
| Profile URL validation at write | done | `assertHttpUrlFetchAllowedSync` on prof-email schemas |
| Upload MIME allowlist on presign | done | PDF, Office, text, common images only |
| Distributed rate limits (prod) | optional | Set `UPSTASH_REDIS_REST_*` (chat, session, contact, register) |
| Webhook secrets (`CRON_SECRET`, etc.) | deploy | Rotate if leaked |

## Recommended next steps

- **PIN on guest links** — optional second factor before `resolveGuestToken` returns session payload.
- **Short-lived guest tokens** — rotate token on each resolve (more UX friction).
- **CSP headers** — `Content-Security-Policy` on HTML responses to limit inline script (coordinate with PostHog/Sentry).
- **Audit logging** — admin role changes and guest link creation to structured logs.
- **Dependency scanning** — enable Dependabot or Snyk on the repo.
- **Middleware JWT verify** — optional edge verification of session cookie for stricter route gating.

## Environment reference

See `.env.example` and `DEPLOY.md` for:

- `ALLOW_SUPERADMIN_BOOTSTRAP`
- `FIREBASE_*` / `NEXT_PUBLIC_FIREBASE_*`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `PAYSTACK_SECRET_KEY` / `PAYSTACK_WEBHOOK_SECRET`
