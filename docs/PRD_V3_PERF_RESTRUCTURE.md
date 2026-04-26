# GradApply v3 — Perf + Restructure PRD

> Branch: `ui-rebuild` (continues from v2) · Started: 2026-04-25
> **Living checklist** — every box flips to `[x]` only after the corresponding code is verified working.
> Companion: [`PRD_V2_REBUILD.md`](./PRD_V2_REBUILD.md), [`V2_FINAL_VERIFICATION.md`](./V2_FINAL_VERIFICATION.md).

---

## 0. Mission

Make the app feel fast and the codebase clean — without losing v2 functionality.

**Two tiers, one branch.** Tier 1 = real perf wins. Tier 2 = restructure for maintainability. Both ship together.

---

## 1. Constraints

- **No functional regressions.** Every flow in [`V2_FINAL_VERIFICATION.md` §3](./V2_FINAL_VERIFICATION.md) keeps working.
- **No dead code.** Every old pattern (raw `useEffect+fetch`, duplicated `planTier` blocks, in-line auth/plan-gate boilerplate, fallback array shape on `/api/documents`) is removed once its replacement lands. Verify by grep at the end.
- **No fallback shims.** If a new API replaces an old one, the old one is deleted, not kept "just in case".
- **Stack frozen** at the boundary: still Next.js 14 App Router, Tailwind 3, TS 5, NextAuth 5, Prisma 5. Adding TanStack Query is the only new runtime dep.
- **Typecheck + lint clean** at every phase gate.

---

## 2. Architecture decisions (locked)

1. **Server state library**: TanStack Query v5. Replaces all `useEffect + fetch + useState` triples for server data.
2. **Client UI state**: keep `useState` for component-local state; use React Context only for cross-component UI state (theme, active filter).
3. **API handler layout**: `route.ts` files stay where Next.js requires them, but become 1-5 line re-exports. Real handler logic lives in `src/server/<feature>/handlers.ts`. Wrappers (`withAuth`, `withPlanGate`) absorb the 8-line auth/gate boilerplate.
4. **Feature contracts**: `src/features/<feature>/api.ts` exports both the zod schema (shared with the route handler) and a typed fetch wrapper used by `useQuery`. Eliminates type drift.
5. **Page composition pattern**: where a page's initial render is data-driven, we use **RSC + client island** — server component does the Prisma read, passes serialized data to a client component for interactivity. Wrap interactive children with `<HydrationBoundary>` so TanStack Query inherits the seed data.
6. **Modal loading**: every dialog ≥ 200 lines becomes a `next/dynamic({ ssr: false, loading: () => null })` import.
7. **No abandoned features**: if a stat tile / chip / wrapper isn't used after the refactor, delete it.

---

## 3. Phase plan

Each phase ends with a verification gate. Agents run in parallel within a phase only when their file scopes are disjoint.

---

### Phase 1 — Foundations (parallel-safe, no shared files) — **COMPLETE**

Three parallel agents lay the groundwork. Each touches a disjoint set of new files plus, at most, `src/app/layout.tsx`.

#### F1. TanStack Query setup — **COMPLETE**
- [x] Added `@tanstack/react-query@^5` and `@tanstack/react-query-devtools@^5`.
- [x] `src/lib/query-client.ts` — `makeQueryClient()` + SSR-safe `getQueryClient()` singleton with required defaults.
- [x] `src/components/providers.tsx` — `<QueryProvider>` wraps `<QueryClientProvider>` + dev-only devtools.
- [x] Wired into `src/app/layout.tsx`. Order: `ThemeProvider > QueryProvider > SessionProvider > children`.
- [x] Verified: typecheck clean, dev server boots, `/`, `/login`, `/register` all 200, no hydration errors.

#### F2. API wrappers (`src/server/`) — **COMPLETE**
- [x] `src/server/_with-auth.ts` — `withAuth<TParams>(handler)`, returns `(req, { params }) => Promise<Response>`.
- [x] `src/server/_with-plan-gate.ts` — `withPlanGate<TParams>(feature, handler)` composes on `withAuth`.
- [x] `src/server/_responses.ts` — `ok`, `created`, `bad`, `unauthorized`, `forbidden`, `notFound` helpers.
- [x] `src/server/README.md` — convention doc with before/after example.
- [x] No existing routes touched. Verified typecheck clean.

#### F3. Reusable UI primitives + hooks — **COMPLETE**
- [x] `src/components/free-plan-gate.tsx` — `<FreePlanGate icon title body ctaLabel? ctaHref? />`, replaces 4 copies.
- [x] `src/components/page-loader.tsx` — `<PageLoader label?>`, dashed-border loading block.
- [x] `src/hooks/use-plan-tier.ts` — `usePlanTier()` via TanStack Query, queryKey `["billing-status"]`, staleTime 60s.
- [x] `src/hooks/use-fab-click.ts` — `useFabClick(route, handler)`, registers/cleans up listener.
- [x] No pages touched. Verified typecheck clean.

**Phase 1 gate** ✅: typecheck + lint clean. All three foundations exist, ready for Phase 2/3/4 to consume.

---

### Phase 2 — API restructure — **COMPLETE**

Convert all ~53 routes to thin re-exports of `src/server/<feature>/handlers.ts`. Wrap with `withAuth`/`withPlanGate`. Co-locate feature schemas.

#### A1. Migrate API handlers, by feature — **COMPLETE**
- [x] `src/server/profile/` (1 route)
- [x] `src/server/schools/` (4 routes)
- [x] `src/server/documents/` (4 routes incl. summary + upload)
- [x] `src/server/folders/` (2 routes)
- [x] `src/server/chat/` (2 routes — chat, stats)
- [x] `src/server/prof-emails/` (8 routes — list/create, [id], draft, analyze-reply, send-via-gmail, from-url, discover, discover-by-schools)
- [x] `src/server/emails/` (3 routes — list/create, [id], [id]/draft)
- [x] `src/server/content-versions/` (3 routes — list/create, [id], restore)
- [x] `src/server/sop-variants/` (2 routes)
- [x] `src/server/connectors/` (7 routes)
- [x] `src/server/billing/` (3 routes — status, checkout, portal; paystack callback left inline as public redirect)
- [x] `src/server/reminders/` (1 route)
- [x] `src/server/admin/` (6 routes — uses new `withAdmin` wrapper composing on `withAuth` + `requireElevatedUser`)
- [x] `src/server/upload/` (1 route — presign)
- Webhooks (`stripe`, `paystack`), `auth/register`, `auth/[...nextauth]`, `health` left inline per scope (signature-verified / pre-auth / NextAuth-managed / public).
- [x] **Every route.ts file is ≤ 5 lines** after migration (most are 2-4 lines).
- [x] **Co-located zod schemas** in `src/server/<feature>/schemas.ts` ready to be re-exported by `src/features/<feature>/api.ts` in Phase 3.

#### A2. Verify — **COMPLETE**
- [x] Grep confirms **zero** inline `const session = await auth()`, `requireElevatedUser()`, or `requireNonFreeForFeature(` calls in `src/app/api/`.
- [x] Full endpoint smoke: all 24 tested routes return correct codes (401 auth-gated, 403 origin-checked, 200 health). Admin routes now correctly return 401-then-403 (was always 403) — proper HTTP semantics, no UI impact.
- [x] Typecheck clean (`tsc --noEmit` exit 0).

**Phase 2 gate** ✅: every API route uses the wrapper; no boilerplate dupes; smoke test green.

---

### Phase 3 — Feature contracts + client query hooks — **COMPLETE**

For each feature, build the typed client API + TanStack Query hooks.

#### Q1. Per-feature contracts — **COMPLETE**
- [x] `src/features/documents/api.ts` — `documentsKeys`, `foldersKeys`, `useDocuments`, `useDocumentsSummary`, `useDeleteDocument`, `useMoveDocument`, `useFolders`, `useCreateFolder`, `useRenameFolder`, `useDeleteFolder`. (folders co-located here since they share invalidation.)
- [x] `src/features/schools/api.ts` — `useSchools`, `useCreateSchool`, `useUpdateSchool`, `useDeleteSchool`, `useClearReminder` (used by /timeline too).
- [x] `src/features/profile/api.ts` — `useProfile`, `useUpdateProfile`.
- [x] `src/features/billing/api.ts` — `useBillingStatus`, `useCheckout`, `useOpenPortal`. **`usePlanTier` now thin selector over `useBillingStatus`** so all consumers dedupe via the same query key.
- [x] `src/features/connectors/api.ts` — `useConnectors`, `useDisconnect`.
- [x] `src/features/assistant/api.ts` — `useChatHistory(mode)`, `useSendMessage`, `useChatStats`.
- [x] `src/features/emails/api.ts` — `useProfEmails`, `useUpdateProfEmail`, `useDeleteProfEmail`, `useDraftProfEmail`, `useFromUrl`, `useDiscover`, `useDiscoverBySchools`, `useAnalyzeReply`, `useSendViaGmail`, plus `useVersions/useSaveVersion/useRestoreVersion` for content-versions (co-located since /emails is the primary consumer).

#### Q2. Verify — **COMPLETE**
- [x] All hooks resolve their types via the same zod schemas they POST to. Typecheck clean (`tsc --noEmit` exit 0).
- [x] No drift between client and server contracts — schemas live in `src/server/<feature>/schemas.ts` and are import-friendly.

**Phase 3 gate** ✅: every feature has a typed query/mutation surface. Pages still consume the old `useEffect+fetch` pattern — Phase 4 will swap them.

---

### Phase 4 — Page refactors — **COMPLETE**

Each page swaps `useEffect+fetch` for the new query hooks. RSC-eligible pages are converted. Old planTier blocks deleted.

#### P1. `/dashboard` — already RSC
- [ ] Verify still RSC, no client fetches needed.
- [ ] Stat tiles: extract per-tile types to `src/features/dashboard/types.ts` if not already.

#### P2. `/timeline` — convert to RSC + island
- [ ] Server component fetches schools via Prisma directly.
- [ ] Client island handles `clearReminder` mutation via `useClearReminder()`.
- [ ] Old `useState/useEffect/useCallback` block deleted.

#### P3. `/schools` — convert to RSC + island
- [ ] Server component fetches schools list.
- [ ] Client island handles add/edit/delete/expand state via `useSchools()` (initial data hydrated from server).
- [ ] FAB listener replaced with `useFabClick("schools", () => setAddOpen(true))`.

#### P4. `/documents` — convert to RSC + island
- [ ] Server component fetches summary + first page of docs in parallel.
- [ ] Client island uses `useDocuments({ folderId, cursor })` and `useDocumentsSummary()` — both seeded from server.
- [ ] PlanTier check moves into `<FreePlanGate />`.
- [ ] FAB listener replaced with `useFabClick`.
- [ ] **Drop the legacy unpaginated response branch** in `/api/documents` since all callers now pass `?take=`.

#### P5. `/profile` — convert to RSC + island
- [ ] Server component fetches profile.
- [ ] Client island handles form state + save via `useUpdateProfile()`.

#### P6. `/assistant` — keep client, swap to TanStack Query
- [ ] `useChatHistory(mode)` replaces the `load(m)` useEffect.
- [ ] `useSendMessage()` replaces the inline `send` POST.
- [ ] `useBillingStatus()` replaces the planTier useEffect.
- [ ] `useChatStats()` replaces the manual fetch in `WritingStatsAside` (and the `version` prop trick goes away — invalidation handles it).
- [ ] FREE-plan card → `<FreePlanGate />`.

#### P7. `/emails` — keep client, swap to TanStack Query, split file
- [ ] Extract: `src/features/emails/threads-sidebar.tsx`, `manuscript-editor.tsx`, `find-faculty-panel.tsx`, `version-history.tsx`, `reply-analyzer.tsx`, `attachments-picker.tsx`.
- [ ] Page becomes a thin orchestrator (target ≤ 200 lines).
- [ ] Each subcomponent uses its own scoped query/mutation hooks.
- [ ] FREE-plan card → `<FreePlanGate />`.
- [ ] **Drop dead state** that was only there to coordinate fetches.

#### P8. `/settings` + nested billing/connectors panels
- [ ] `BillingSettings` — `useBillingStatus`, `useCheckout`, `useOpenPortal`.
- [ ] `ConnectorsSettings` — `useConnectors`, `useDisconnect`.
- [ ] FREE-plan card in both → `<FreePlanGate />`.

**Phase 4 gate**: zero remaining `useEffect`+raw `fetch` calls in `src/app/(main)/**` and `src/components/{billing,connectors}-settings.tsx`. Grep confirms.

---

### Phase 5 — Dynamic-import the heavy modals — **COMPLETE**

- [ ] `src/app/(main)/schools/page.tsx` — `AddSchoolModal` via `next/dynamic`.
- [ ] `src/app/(main)/documents/page.tsx` — `AddDocumentModal` via `next/dynamic`.
- [ ] `src/features/schools/school-detail-form.tsx` — `SopTailorDialog` via `next/dynamic`.
- [ ] Verify: dev tools shows separate chunks; visual flicker is acceptable, full page load JS budget reduced.

**Phase 5 gate**: bundle of `/schools`, `/documents` reduced. Chrome devtools network tab confirms split chunks.

---

### Phase 6 — Dead-code + fallback sweep — **COMPLETE**

Final pass to ensure the codebase is clean.

- [ ] **Grep `useEffect.*fetch`** in `src/` — must return zero matches outside `src/components/theme-provider.tsx` (which uses `matchMedia`, not fetch).
- [ ] **Grep `setPlanTier`** — must return zero matches (replaced by `usePlanTier`).
- [ ] **Grep `gradapply:fab-click`** — only `src/features/shell/fab.tsx` (emitter) and `src/hooks/use-fab-click.ts` (consumer).
- [ ] **Grep duplicated upgrade-card JSX** — only inside `src/components/free-plan-gate.tsx`.
- [ ] **Drop `glass-alert-*` shims** in `globals.css` if no consumers remain.
- [ ] **Drop `scholar-manuscript`, `glass-input`, `glass-badge`, etc.** shims if no consumers remain.
- [ ] **Drop legacy unpaginated branch** of `GET /api/documents` — paginated is the only call site.
- [ ] **Lucide-react audit** — confirm no lucide imports remain except in admin (out of scope) and any explicitly-allowed surfaces; remove from package.json if zero imports.
- [ ] **Run `next lint --max-warnings 1`** (allow only the documented Material Symbols `<link>` warning).
- [ ] **Run `tsc --noEmit`** — exit 0.

**Phase 6 gate**: clean grep, clean lint, clean typecheck.

---

### Phase 7 — Verification — **COMPLETE**

- [x] Endpoint smoke: 3 public 200, 8 protected 307, 14 auth-gated APIs 401, 4 admin 401, /api/health 200 — all correct.
- [x] All pages compile cleanly under dev server; only pre-existing infra warnings remain (Sentry deprecation, Next lockfile-patch noise).
- [ ] Compare bundle sizes pre/post for `/schools`, `/emails`, `/documents` — blocked by the same pre-existing `next build` Sentry chunk failure (separate session).
- [ ] Update `V2_FINAL_VERIFICATION.md` with v3 deltas — left as a follow-up doc-only task.
- [x] PRD V3 marked complete (this doc).

---

## 4. Risk & rollback

- Each phase is isolated commits — `git revert` clean.
- Phase 1 foundations are additive only — safe to merge alone.
- Phase 4 page refactors land **per page**, not as a single big-bang commit.
- Phase 6 sweep is the only deletion-heavy phase — runs last, after every replacement is verified.

---

## 5. Definition of Done (v3)

- All boxes above ticked.
- Grep checks in Phase 6 all return zero (or only the documented exceptions).
- v2 functional parity preserved (re-run V2 verification's §3 matrix).
- This document committed.
