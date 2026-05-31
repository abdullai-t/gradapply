# Security hardening

Operational checklist for GradApply. Items marked **done** are enforced in code; others are deployment/process.

## Authentication & admin

| Item | Status | Notes |
|------|--------|--------|
| JWT sessions via NextAuth | done | `AUTH_SECRET` required in production |
| Google account linking | done | `allowDangerousEmailAccountLinking` only when `GOOGLE_ALLOW_DANGEROUS_ACCOUNT_LINKING=true` |
| SUPERADMIN bootstrap | done | Requires `ALLOW_SUPERADMIN_BOOTSTRAP=true` **and** `SUPERADMIN_EMAILS`; only when zero superadmins exist |
| Admin routes role-gated | done | `ADMIN` / `SUPERADMIN` via `requireElevatedUser()` |
| CSRF on authenticated mutations | done | `withAuth` + `isTrustedMutationOrigin` |
| CSRF on guest collab comments | done | Same origin check on `POST` comments |

## Collaboration & guest links

| Item | Status | Notes |
|------|--------|--------|
| Guest tokens hashed (pepper) | done | `COLLAB_TOKEN_PEPPER` or `AUTH_SECRET`; production rejects dev-only pepper |
| Default guest link TTL | done | 14 days if `expiresInDays` omitted |
| Guest cookie `Secure` in prod | done | `collab_guest` HttpOnly, SameSite=Lax |
| Cookie max-age tied to invite expiry | done | Capped at 30 days |
| Server-side HTML sanitization (artifacts) | done | `sanitizeArtifactBody` on snapshot create/refresh |
| Client snapshot render | done | DOMPurify via shared `sanitizeRichHtml` |
| Guest comment rate limit | done | `assertGuestCommentAllowed` |
| Revoke guest links | done | Owner revokes via API |

## Data & AI

| Item | Status | Notes |
|------|--------|--------|
| LLM prompt field sanitization | done | `sanitizeField` / `wrapUserContent` |
| Distributed rate limits (prod) | optional | Set `UPSTASH_REDIS_REST_*` |
| Webhook secrets (`CRON_SECRET`, etc.) | deploy | Rotate if leaked |

## Recommended next steps

- **PIN on guest links** — optional second factor before `resolveGuestToken` returns session payload.
- **Short-lived guest tokens** — rotate token on each resolve (more UX friction).
- **CSP headers** — `Content-Security-Policy` on HTML responses to limit inline script (coordinate with PostHog/Sentry).
- **Audit logging** — admin role changes and guest link creation to structured logs.
- **Dependency scanning** — enable Dependabot or Snyk on the repo.

## Environment reference

See `.env.example` and `DEPLOY.md` for:

- `ALLOW_SUPERADMIN_BOOTSTRAP`
- `GOOGLE_ALLOW_DANGEROUS_ACCOUNT_LINKING`
- `COLLAB_TOKEN_PEPPER`
