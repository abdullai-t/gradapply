# GradApply — Current App Audit (v1)

> Source-of-truth map of every page, button, route, and feature in the **pre-rebuild** app.
> Used as the parity checklist against the v2 ScholarQuest Tactile rebuild — nothing in here may be silently dropped.
> Branch: `ui-rebuild` · Audit date: 2026-04-24

---

## 1. Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14.2.35 (App Router, `src/app/`) |
| Language | TypeScript 5 (strict, `@/*` → `./src/*`) |
| Runtime | Node ≥ 20, pnpm 9.15.9 |
| UI primitives | shadcn-style on Radix (`src/components/ui/*`), `class-variance-authority`, `tailwind-merge` |
| Styling | Tailwind 3.4 (HSL CSS-vars, dark-only via `class="dark"` on `<html>`), `next/font` for DM Sans + Fraunces |
| Icons | `lucide-react` |
| Forms | React Hook Form + Zod |
| DB / ORM | PostgreSQL + Prisma 5.22 |
| Auth | NextAuth 5.0-beta (JWT, Google OAuth + email/password, Prisma adapter) |
| AI | Anthropic, OpenAI, Gemini, Groq, OpenRouter — multi-provider router with circuit-breaker (`src/lib/llm-router.ts`) |
| File storage | AWS S3 + Cloudinary |
| Payments | Paystack (webhook-deduped) |
| Email send | Nodemailer (SMTP) + Gmail OAuth connector |
| Rate limiting | Upstash Redis + `@upstash/ratelimit` |
| Monitoring | Sentry |

---

## 2. Routes — public

| Route | File | Purpose |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing — `HomeLanding` over `GlassScene` |
| `/login` | `src/app/login/page.tsx` | Email/password + Google sign-in |
| `/register` | `src/app/register/page.tsx` | New account |

## 3. Routes — authenticated (`(main)` layout)

The shell is `src/app/(main)/layout.tsx` — sticky `AppSidebar` (md+), `MobileNav` (md-), `ReminderBanner`, `MainShellBackdrop` glass.

| Route | File | Purpose |
|---|---|---|
| `/dashboard` | `src/app/(main)/dashboard/page.tsx` | Hero "Dossier" panel · 3 metric tiles · recent archive · curator insight · critical deadlines · reminder pings · campus spotlight · upgrade CTAs (FREE) |
| `/schools` | `src/app/(main)/schools/page.tsx` | School tracker — collapsible cards with inline edit (term/status/notes/reminder/SOP-tailor) · FAB → `AddSchoolModal` |
| `/timeline` | `src/app/(main)/timeline/page.tsx` | Reminders list · deadlines grouped by month · urgency colors · "Clear reminder" |
| `/emails` | `src/app/(main)/emails/page.tsx` | Two-column "Manuscript" professor outreach: editor + version sidebar + diff + AI draft + reply-analysis + Gmail send · right rail = faculty discovery (URL & by-school) |
| `/assistant` | `src/app/(main)/assistant/page.tsx` | Chat with 5 modes (general / grammar / sop / email / feedback) — auto-routing for "general" |
| `/documents` | `src/app/(main)/documents/page.tsx` | File library with type, size, date · FAB → `AddDocumentModal` · plan-gated |
| `/profile` | `src/app/(main)/profile/page.tsx` | Applicant data form: target degree, focus, GRE (score/V/Q/AWA), undergrad, years, research interests, countries (multi-select max 5), bio |
| `/settings` | `src/app/(main)/settings/page.tsx` | Feature-gated · `BillingSettings` (plan/usage/upgrade/credits) + `ConnectorsSettings` (Gmail / Drive OAuth) |
| `/support` | `src/app/(main)/support/page.tsx` | Support page (conditional) |
| `/admin/*` | `src/app/(main)/admin/...` | ADMIN/SUPERADMIN — overview, users, feature-flags, pricing, settings |

## 4. Sidebar navigation (`src/components/app-sidebar.tsx`)

Order rendered today: Dashboard · Timeline · Schools · Professor emails · AI assistant · Documents · Profile · Support · Settings · Admin (role-gated).

## 5. Buttons & interactive controls — by surface

### Sidebar / shell
- Each nav `<Link>` — active state via `usePathname` (`app-sidebar.tsx:101-120`).
- `UserMenu` avatar dropdown — sign out.
- `ReminderBanner` — sticky top deadline pings, dismiss.
- `BuildVersionBadge` — corner build label.

### Dashboard (`/dashboard`)
- 3 metric tiles (school counts by status group).
- Recent archive table — links to schools/emails.
- Curator insight card.
- Critical deadlines list — links to school detail.
- Campus spotlight CTA — "Build shortlist" / school link.
- Upgrade CTAs (FREE plan) → `/settings` checkout.

### Schools (`/schools`)
- FAB Plus (`fixed bottom-right z-40`) → opens `AddSchoolModal`.
- School card collapsed: edit (Pencil), delete (Trash2).
- Expanded form fields (PATCH on blur):
  - admission term select (FALL / SPRING / SUMMER)
  - status select (PLANNING / APPLIED / WAITING / ACCEPTED / REJECTED / WITHDRAWN)
  - progress bar (auto from status)
  - notes textarea
  - deadline + reminder date inputs
  - reminder note input
  - "Tailor SOP" button → `SopTailorDialog`
  - delete with confirm

#### `AddSchoolModal` (685 lines)
Two tabs:

**Manual** —
- school name input + `Suggest details` (AI infer) `POST /api/schools/infer`
- term, program, degree, country, status selects
- deadline, reminder date, reminder note inputs
- funding notes, portal URL, notes textarea
- Cancel / Save school (`POST /api/schools`)

**From profile (swipe)** —
- "Generate suggestions" → `POST /api/schools/recommend`
- Card swiper: skip / add to list (creates school).

### Timeline (`/timeline`)
- Reminder rows — "Clear reminder" (PATCH unset).
- Deadlines grouped by month with urgency badges (overdue / soon / future).
- Click → school detail.

### Emails (`/emails`)
**Threads sidebar** — search, tap to select, status filters.
**Editor (manuscript)** —
- prof name / email / university / research / profile-URL inputs
- subject + body textareas
- attachments selects (CV / transcript / GRE — `DocumentRow[]`)
- status select (DRAFT / SENT / REPLIED / NO_REPLY / NOT_INTERESTED)
- notes textarea
- AI **Draft** button → `POST /api/prof-emails/:id/draft`
- **Send via Gmail** → `POST /api/prof-emails/:id/send-via-gmail`
- Paste reply + **Analyze reply** → classifies INTERESTED/NEUTRAL/DECLINED/UNKNOWN, suggests follow-up

**Version sidebar** — list, save version, restore, view unified diff.

**Right rail — Find faculty:**
- "Analyse from URL" → `POST /api/prof-emails/from-url`
- "Discover from my schools" (multi-select) → `POST /api/prof-emails/discover-by-schools` returns scored candidates 1-5 with rationale; tap → seeds new email.

### Assistant (`/assistant`)
- 5 mode tabs: general · grammar · sop · email · feedback.
- Message ScrollArea (h-420px) loads last 40 messages on tab change.
- Textarea (Cmd/Ctrl+Enter to send) → `POST /api/chat` returns `{reply, agent: AgentMeta{tabMode, effectiveMode, label, provider, model, routedFromGeneral, creditFallback}}`.
- Per-message agent badge.
- Plan-gated (FREE blocked).

### Documents (`/documents`)
- FAB Plus → `AddDocumentModal` (S3 presigned upload + Cloudinary).
- Doc card: name, type badge, size (`formatBytes`), open link, delete.
- Plan-gated (FREE blocked).

### Profile (`/profile`)
- Selects: target degree · focus area (with `optionsWithFallback`)
- Inputs: years experience · GRE total/verbal/quant/AWA · undergrad school/degree/GPA
- Research interests textarea
- Countries multi-select (Add button, max 5, badge × to remove)
- Bio textarea
- Save changes → `PATCH /api/profile`

### Settings (`/settings`) — `feature_flag(user_settings_page)`-gated
**BillingSettings:**
- Plan card (tier · status · period end · usage bar · bonus credits)
- "Upgrade to Plus" / "Upgrade to Pro" / "Buy credits" → `POST /api/billing/checkout {tier}` redirect
- "Refresh usage" link

**ConnectorsSettings:**
- Gmail OAuth (start / callback / revoke)
- Google Drive OAuth (start / callback / revoke)

### Admin (`/admin/...`)
Role-gated (`ADMIN` / `SUPERADMIN`):
- Overview metrics
- Users panel (role + plan edit, delete)
- Feature flags CRUD
- Pricing config
- Settings editor

---

## 6. API surface (REST)

```
auth          /api/auth/[...nextauth]                         · /api/auth/register
schools       GET POST /api/schools                          · GET PATCH DELETE /api/schools/:id
              POST /api/schools/infer                        · POST /api/schools/recommend
emails        GET POST /api/prof-emails                      · GET PATCH DELETE /api/prof-emails/:id
              POST /api/prof-emails/from-url
              POST /api/prof-emails/discover
              POST /api/prof-emails/discover-by-schools
              POST /api/prof-emails/:id/draft
              POST /api/prof-emails/:id/send-via-gmail
              POST /api/prof-emails/:id/analyze-reply
chat          GET POST /api/chat                             (mode = general/grammar/sop/email/feedback)
profile       GET PATCH /api/profile
documents     GET POST /api/documents                        · DELETE /api/documents/:id
              POST /api/documents/upload
billing       GET /api/billing/status                        · POST /api/billing/checkout
              POST /api/billing/paystack/callback
versions      GET POST /api/content-versions                 · POST /api/content-versions/:id/restore
              PATCH DELETE /api/content-versions/:id
connectors    /api/connectors[/gmail|/google-drive]/{start,callback}     · GET /api/connectors
admin         /api/admin/{overview,users,feature-flags,config}
webhooks      /api/webhooks/paystack
health        /api/health · /api/upload/presign
```

## 7. Prisma models (key)

`User · Profile · School · ProfEmail · ChatMessage · Document · ContentVersion · Connector · FeatureFlag · AppSetting · SopVariant · PaystackEventLog`.

Enums: `Role(USER|ADMIN|SUPERADMIN)` · `PlanTier(FREE|PLUS|PRO)` · `SchoolStatus` · `EmailStatus` · `ReplyIntent` · `AdmissionTerm` · `DocumentKind` · `ContentEntityType` · `ConnectorProvider`.

## 8. Cross-cutting libs (`src/lib/`)

- **LLM**: `llm-provider.ts` (selects), `llm-router.ts` (circuit/queue), `assistant-agents.ts` (5 modes + router), `ai.ts`, `chat-prompts.ts`, `chat-modes.ts`.
- **Billing**: `billing-config.ts`, `billing-allowance.ts`, `billing-credits.ts`, `billing-admin-config.ts`, `paystack-api.ts`, `paystack-fulfillment.ts`, `llm-credits.ts`.
- **Feature gates**: `feature-flags.ts` (DB + 30s cache + env override), `plan-gates.ts`.
- **AI features**: `school-from-name-ai.ts` · `school-recommendations-ai.ts` · `professor-from-url-ai.ts` · `faculty-discovery-ai.ts` · `analyze-prof-reply.ts` · `sop-tailor-generate.ts`.
- **Connectors**: `gmail-connector.ts` · `google-drive-connector.ts` · `google-oauth-tokens.ts` · `oauth-state.ts`.
- **Storage**: `s3.ts` · `cloudinary.ts`.
- **Misc**: `school-progress.ts` · `school-deadline.ts` · `deadline-urgency.ts` · `admission-term.ts` · `grad-options.ts` · `country-options.ts` · `password.ts` · `app-origin.ts`.

## 9. Env-var matrix

Database: `DATABASE_URL`. Auth: `AUTH_SECRET`/`NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`. LLM: `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `AI_PROVIDER`, plus router knobs (`LLM_*`). Storage: `AWS_*`, `S3_BUCKET`, `CLOUDINARY_URL`. SMTP: `SMTP_*`, `EMAIL_FROM`. Paystack: `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, plan codes. Allowances: `BILLING_*_MONTHLY_AI`, `CREDITS_PACK_SIZE`. Rate limit: `UPSTASH_REDIS_REST_URL/TOKEN`. Sentry: `SENTRY_*`. Origin: `APP_ORIGIN`, `NEXT_PUBLIC_APP_ORIGIN`. Flag overrides: `FEATURE_FLAG_*`.

## 10. Notable patterns

- **Multi-provider AI fallback** with circuit-breaker, queue, and load-aware token reduction.
- **Quota-based billing**: monthly allowance + bonus credits, plan-gated features.
- **Content versioning** for SOP / CV / professor email (parent chains, unified diff).
- **AI-powered**: school inference, profile-based recommendations, faculty discovery, email drafting, SOP tailoring, reply intent classification.
- **Always-dark UI** today (`class="dark"` hard-coded on `<html>`).

---

## 11. Functionality that MUST survive the rebuild

This is the parity checklist for v2.

### Surfaces (12 total)
- [x] `/` landing — tactile rebuild shipped (Phase C1)
- [x] `/login` — tactile rebuild shipped (Phase C2)
- [x] `/register` — tactile rebuild shipped (Phase C2)
- [x] `/dashboard` — tactile rebuild shipped (Phase C3 + tuning round 1)
- [x] `/schools` — tactile rebuild shipped (Phase C4); AddSchoolModal + SopTailorDialog restyled in Phase D Buckets A4–A5
- [x] `/timeline` — tactile rebuild shipped (Phase C5)
- [x] `/emails` — tactile rebuild complete (Phase C6 + Phase D Bucket A6); 1560-line surface preserved, all 89 dark-hardcoded class strings swapped to Material 3 tokens; typecheck clean
- [x] `/assistant` — tactile rebuild shipped (Phase C7)
- [x] `/documents` — tactile rebuild shipped (Phase C8 + Phase D Buckets A1, B1, B2); AddDocumentModal restyled, QuickAccess + Category cards added
- [x] `/profile` — tactile rebuild shipped (Phase C9)
- [x] `/settings` — tactile rebuild shipped (Phase C10 + Phase D Buckets A2, A3); BillingSettings + ConnectorsSettings internals fully restyled
- [x] `/admin/*` — out of scope per decision §2.5; admin keeps current dark UI

### Modals & dialogs
- [x] `AddSchoolModal` — manual + AI-swipe tabs (functionality preserved + visual restyle Phase D Bucket A5)
- [x] `AddDocumentModal` — S3 upload (functionality preserved + visual restyle Phase D Bucket A1)
- [x] `AddEmailModal` (legacy; `/emails` page handles thread creation via faculty discovery + URL analyze)
- [x] `SopTailorDialog` (functionality preserved + visual restyle Phase D Bucket A4)
- [x] Reminder banner + dismissal — rebuilt to tactile pill (Phase B)

### Per-page critical actions
- [x] Schools: inline edit on blur · status select · progress bar · reminder · SOP tailor · delete (`SchoolDetailForm` + `SchoolGridCard`)
- [x] Schools: AI suggest details, AI profile-recommendations swipe (existing `AddSchoolModal` preserved)
- [x] Timeline: clear reminder · month grouping · urgency colors (`features/timeline/`)
- [x] Emails: editor · version save/restore/diff · AI draft · paste-reply analysis · attachments · Send via Gmail · faculty discovery (URL + by-school with match scores) — *all preserved; visual restyle complete Phase D Bucket A6*
- [x] Assistant: 5 modes (general/grammar/sop/email/feedback) · agent badge · auto-routing from general (`features/assistant/`)
- [x] Documents: upload · delete · plan gate (`features/documents/` + AddDocumentModal)
- [x] Profile: GRE breakdown · undergrad · countries multi-select (max 5) · research interests · bio · save (full sectioned form)
- [x] Settings — Billing: status fetch · usage bar · upgrade Plus/Pro/credits · Paystack support · refresh (existing `BillingSettings`)
- [x] Settings — Connectors: Gmail + Drive OAuth start/callback/revoke (existing `ConnectorsSettings`)
- [x] Admin: feature flags CRUD · users panel · pricing · overview (out of scope per decision §2.5)

### Cross-cutting
- [x] Auth (Google OAuth + email/password + magic link) preserved — verified in `/login` rebuild
- [x] Plan gates (FREE blocked from assistant + documents) preserved — both pages render full upgrade card
- [x] Feature flags (`user_settings_page`, `homepage_pricing_section`) honored — `/` and `/settings` both gate properly
- [x] Rate limiting (chat) preserved — assistant page does not touch the existing Upstash rate limiter
- [x] Webhooks (Paystack) — signature-verified
- [x] Sentry monitoring untouched — instrumentation hook still loads (build-side issue is pre-existing, not a regression)
- [x] All Prisma models + API routes untouched — this was strictly a UI rebuild
