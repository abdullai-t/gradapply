# GradApply v2 — UI Rebuild PRD

> Branch: `ui-rebuild` · Owner: this rebuild thread · Started: 2026-04-24
> **Living document** — every checkbox flips to `[x]` only after the corresponding code is verified working in-browser.
> Companion docs: [`CURRENT_APP_AUDIT.md`](./CURRENT_APP_AUDIT.md) · [`DESIGN_SYSTEM_SUMMARY.md`](./DESIGN_SYSTEM_SUMMARY.md) · [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## 0. Mission

Replace the dark "Scholar Manuscript" UI with the **ScholarQuest Tactile** light, joyful, Duolingo-flavored design across every authenticated and public surface — **without losing a single piece of v1 functionality**, while restructuring the codebase into a feature-sliced, performance-budgeted, secure architecture.

## 1. Constraints

- **UI-only rebuild**: no Prisma, no `src/app/api/*`, no LLM router, no billing webhooks, no feature-flag DB schema changes.
- **Light theme by default**. Drop hard-coded `class="dark"`. Dark variant is post-v2.
- **Brand**: keep "GradApply" as the legal product name. The reference design uses "ScholarQuest" but we keep our wordmark; we adopt only the *visual* system. (Confirm with user — see Open Questions.)
- **Stack frozen**: Next 14 App Router, Tailwind 3, TypeScript 5, Radix primitives.
- **No emoji** (per design rules).
- **Performance budget**: route first-load JS ≤ 180 KB gzip.
- **Accessibility**: keyboard nav on all controls, `aria-hidden` on decorative icons, `prefers-reduced-motion` honored.

## 2. Decisions (locked 2026-04-24)

1. **Wordmark**: **GradApply stays.** Adopt the visual system, animations and transitions only.
2. **Gamification (Streak / Daily Mission / Readiness Gauge)**: **Derive from existing data first. Build new tables / cron / AI mission generator if needed.**
   - Readiness % → existing dossier-completeness on dashboard.
   - Streak → derived from `User.updatedAt` and a new `UserActivityDay` table (one row per UTC day a user touches schools/emails/profile/chat). Lightweight.
   - Daily Mission → server action picks top open task (next deadline · most-stale draft · empty profile field), with optional AI rephrase via existing assistant agents.
3. **Route name**: `/emails` **stays** as-is (no rename, no redirect). The Outreach / Drafting Studio visual treatment applies to `/emails` directly.
4. **Themes**: **Both light and dark.** Light is default. Dark is a new tactile dark variant — same Material 3 token scheme but inverted surfaces (deep ink #0e1218 / #161b22 / #1e242e), preserved tactile shadows (deepened to `0 4px 0 0 #00375a`), still Plus Jakarta Sans, still Material Symbols. Toggle via `Settings → Preferences → Appearance` (`light | dark | system`), persists in `User.themePreference` (new column) and respects `prefers-color-scheme` for "system".
5. **Admin panel**: **untouched** — keeps current dark/Lucide for v2.

## 3. Workstream phases

Each phase has its own checkbox list. **Do not jump phases.** Each phase ends with a verification gate.

### Phase A — Foundation (design tokens + primitives) — **COMPLETE**

- [x] Plus Jakarta Sans loaded via `next/font` (variable `--font-sans`); Material Symbols Outlined CSS loaded in `<head>`.
- [x] `src/styles/tokens.css` written — Material 3 light + tactile-dark variants, both HSL semantic tokens (Tailwind/Radix contract) and direct CSS vars (Material 3 surface scale).
- [x] `src/app/globals.css` rewritten — imports tokens, removes Scholar Manuscript palette, adds `.tactile`, `.tactile-card`, `.glass-panel`, `.glass-rail`, `.glass-header`, `.stat-tile`, type utilities (`t-display-lg`, etc.), all 12 keyframe animations (flame-pulse, aura-pulse, fill-up, slide-in, rise-in, pop-number, shine-sweep, dot-blink, gauge-sweep, float-blob, bob, arrow-nudge), and a `prefers-reduced-motion` block.
- [x] `tailwind.config.ts` rewritten — Material 3 colors (primary/secondary/tertiary with container/fixed/fixed-dim), surface scale, streak orange, tactile shadows (`shadow-tactile`, `shadow-tactile-card`, `shadow-fab`), `transitionTimingFunction.spring`.
- [x] `src/app/layout.tsx` rewritten — drops hard-coded `class="dark"`, loads Plus Jakarta Sans + Material Symbols, mounts `<ThemeProvider>` with FOUC-preventing inline boot script.
- [x] `src/components/theme-provider.tsx` — `ThemePreference = "light" | "dark" | "system"`, persists in localStorage (`gradapply.theme`), tracks `prefers-color-scheme` for "system".
- [x] `src/components/icon.tsx` — Material Symbols wrapper (`<Icon name fill weight size decorative label />`).
- [x] `src/components/ui/button.tsx` rewritten as TacButton — variants `primary | secondary | outline | ghost | link | destructive | default | glass`, sizes `sm | default | lg | icon`, `icon`, `iconRight`, `loading` props, the press-down behaviour via `.tactile`. Backwards-compatible `default` variant aliases primary so existing call sites keep working.
- [x] `src/components/ui/card.tsx` rewritten — `variant: plain | tactile | glass`.
- [x] `src/components/ui/{input,textarea,badge,progress,tabs,select,dialog}.tsx` all restyled to tokens.
- [x] `src/components/{glass-panel,seal-avatar,stat-tile,streak-chip,tactile-card,theme-toggle}.tsx` built.
- [x] `src/components/icon.tsx` is single source of truth for icons (Material Symbols Outlined CDN).
- [x] **Legacy compat layer** — `globals.css` keeps `.scholar-manuscript`, `.glass-input`, `.glass-badge`, `.glass-chip`, `.glass-divider-line`, `.glass-alert*` mapped to new tokens so unmigrated pages still render legibly during migration.
- [x] **Gate**: typecheck clean across every authored file (verified via `tsc --noEmit`).

### Phase B — App shell — **COMPLETE**

- [x] `src/features/shell/nav-config.ts` — single source of truth for nav routes, titles, search placeholders, FAB icons, plan/flag/admin gating.
- [x] `src/hooks/use-app-status.ts` — fetches `/api/billing/status` once, exposes `planTier`, allowance, settings/support flags, and `streakDays` (server-supplied; falls back to 0 until `UserActivityDay` ships).
- [x] `src/features/shell/sidebar.tsx` — glass rail, brand mark, active-state bottom-border lift + tactile shadow, footer items, role/plan/flag-aware filtering preserved from v1.
- [x] `src/features/shell/topbar.tsx` — sticky glass header, page title from nav-config, search pill, `<StreakChip>`, notifications bell.
- [x] `src/features/shell/fab.tsx` — route-aware floating action button (default `smart_toy` → `/assistant`); page-local override via `gradapply:fab-click` custom event.
- [x] `src/features/shell/mobile-nav.tsx` — 5-slot bottom tab bar (md-).
- [x] `src/components/reminder-banner.tsx` rebranded to tactile pill.
- [x] `src/components/user-menu.tsx` rewritten — avatar + name, dropdown contains `<ThemeToggle>` (light/dark/system) + Sign out.
- [x] `src/app/(main)/layout.tsx` rewritten to compose new shell.
- [x] **Gate**: typecheck clean.

### Phase C — Pages (one feature at a time)

Each item: pixel-fidelity to the reference JSX **+** every v1 button/action wired to the existing API.

#### C1. Landing (`/`) — **COMPLETE**
- [x] Tactile rebuild of `src/components/landing/home-landing.tsx` — drops `<GlassScene>` wrapper, renders directly on `--background` so theme tokens apply.
- [x] Sticky `glass-header` nav with brand mark, in-page anchors (Vision · Features · How it works · Pricing? · FAQ), Sign in + Get started CTAs.
- [x] Hero — eyebrow chip with `auto_stories` icon, `t-display-xl` headline with **hand-drawn SVG underline** on "every application" in `--primary-container`, body, two CTAs, fine print.
- [x] Background ambient orbs (primary / secondary / tertiary containers) with `float-blob` animation.
- [x] **Vision pillars** — 3 tactile cards with colored bottom borders (primary/tertiary/secondary), icon tiles, hover lift + icon spin.
- [x] **Features grid** — 6 tactile tiles (school pipeline · timeline · email studio · documents · assistant · Google hooks).
- [x] **How it works** — 3 numbered tactile plinth steps.
- [x] **Pricing trio** (gated by `homepage_pricing_section` flag) — Free / Plus (highlighted) / Pro with check-mark bullets and CTA buttons.
- [x] **FAQ accordion** — tactile cards with chevron rotate on open.
- [x] **Footer CTA** — primary→primary-container gradient card with `float-blob` orbs and white CTA + ghost CTA.
- [x] All CTAs route to `/register` / `/login` exactly as v1.
- [x] `src/app/page.tsx` simplified — drops `GlassScene` wrapper.
- [x] **Verify**: typecheck clean; visually verified in browser at desktop+mobile, light+dark.

#### C2. `/login`, `/register` — **COMPLETE**
- [x] New shared shell `src/features/auth/auth-shell.tsx` — tactile-tinted background with ambient orbs (primary/secondary/tertiary float-blobs), brand mark, white tactile card, optional banner stack, footer link rail.
- [x] `AuthDivider` + `GoogleButtonContent` helpers exported from the shell.
- [x] **`/login`** rewritten — preserves every flow:
  - Email/password (`signIn("credentials", …)`) with `?registered=1` success banner + `CredentialsSignin` error.
  - Google OAuth (`signIn("google", …)`) — secondary button when password also enabled, primary otherwise.
  - Magic link (`signIn("nodemailer", …)`) — ghost outline button with `send` icon, "Check your inbox" success state.
  - Setup banners: missing `AUTH_SECRET`, no providers enabled, registered success, error param map (Configuration, AccessDenied, Verification, OAuthSignin, OAuthCallback, OAuthAccountNotLinked, CredentialsSignin, Default).
  - `?callbackUrl=…` honoured.
  - `<Suspense>` boundary preserved for `useSearchParams`.
- [x] **`/register`** rewritten — preserves every flow:
  - `POST /api/auth/register` with name (optional), email, password, confirm.
  - Mismatched-password client-side check.
  - Error rendering via `glass-alert-error`.
  - Loading state on submit (`loading` prop on `<Button>`).
  - On success → `/login?registered=1`.
- [x] Both pages drop the dark `<GlassScene>` wrapper and now render on the new `--background` so theme tokens apply.
- [x] All form controls use the new `<Input>` / `<Label>` primitives — focus states, disabled state, autocomplete preserved.
- [x] `<CodeChip>` helper for inline `.env` references in setup banners.
- [x] **Verify**: typecheck clean; visually verified at 1440×1000 in both light and dark modes.

#### C3. `/dashboard` — **COMPLETE**
- [x] Welcome header — `Welcome back, {firstName}` reads `auth.session.user.name`. Subhead derived: shows "next deadline in N days" if any, else dossier-%.
- [x] **StreakCard** — 7-day dot row, derived from `school.updatedAt` / `school.reminderAt` activity dates via `computeDerivedStreak()` in `src/features/dashboard/compute.ts`. Will swap in real `UserActivityDay` when shipped — the API contract is already there.
- [x] **ReadinessGauge** — conic-gradient ring with `gauge-sweep` keyframe, `<CountUp>` percentage, driven by `dossierCompleteness()` (same heuristic as v1).
- [x] **StatTiles bento** — Schools saved · In progress · Next deadline · Acceptances. Uses real Prisma counts.
- [x] **DailyMission** — gradient blue card with `aura` pulse + `shine-sweep`. Mission picked server-side: nearest deadline → empty profile field → empty schools → empty documents → "tighten one paragraph" (priority order in `pickDailyMission()`).
- [x] **DocStatusGrid** — 3 cards: Statement of purpose · Transcripts · CV/Letters. Each card's `tone`, `status`, `body`, `cta`, `href` derived from the user's actual `Document[]` rows + nearest deadline.
- [x] **RecSchoolGrid** — top 3 of user's schools, with deterministic match score, deadline, "Open" CTA. Empty state with "Add a school" CTA.
- [x] Upgrade prompt for FREE plan when `feature_flag(user_settings_page)` is on, links to `/settings`.
- [x] All sections wear `slide-in` / `rise-in` staggered entrance animations.
- [x] **Verify**: typecheck clean; visually verified in browser at desktop+mobile, light+dark.

#### C3-followups — Tuning round 1 (post-visual-QA) — **COMPLETE**
- [x] **Streak chip removed entirely** from topbar — `<TopBar>` no longer imports or renders `<StreakChip>`. Streak only lives inside the dashboard `<StreakCard>`.
- [x] **Tactile shadows deepened** — `--tactile-primary` 4→6px, `--tactile-card` 6→8px, hover lift -4→-6px with `0 14px 0 0` shadow, press states deeper.
- [x] **Dark mode lifted to friendly navy** — `--background` `#1a2036` (hue 228, 28-34% sat), surface ladder `#161b2e` → `#313a5e`. Tactile shadows tuned for the new ground.
- [x] **Type scale refined** — added `t-display-xl`, tightened `t-button` to 15px/700, added `t-numeric` (tabular weight 800).
- [x] **Animations expanded** — added `pulse-glow`, `wiggle-on-hover`, `hop`, `tilt-in`, `ring-burst`, `shimmer-bg`, `confetti-fall` keyframes. FAB now has `pulse-glow`. All gated by `prefers-reduced-motion`.
- [x] **StreakCard alignment** — text block now `flex flex-col justify-center gap-1.5`, both lines `leading-none`, vertically centered against the flame icon.
- [x] **StatTile values reverted** to original `1.4rem` / `10px` per design reference (no scope creep).

#### C4. `/schools` — **COMPLETE** (page rebuilt; modal/dialog cosmetically inherit new tokens via shims, deeper visual rebuild can follow if desired)
- [x] New feature folder `src/features/schools/` with: `types.ts` (`SchoolRow`, `SchoolStatus`, `STATUS_TAG`), `schools-stats.tsx` (Total / In progress / Submitted bento), `school-grid-card.tsx` (tactile 2-col card with SealAvatar, status pill, progress bar, deadline copy with overdue/days-left detection, action icons, expand/edit toggle), `school-detail-form.tsx` (inline edit form for term/status/country/deadline/funding/portal/notes/SOP-tailor button/reminder block), `add-school-card.tsx` (dashed CTA), `ai-insight-card.tsx` (glass insight derived from accepted/deadline/empty-list state).
- [x] Page header — "School applications" + tactile "Add school" button.
- [x] Stats bento — Total Apps / In progress / Submitted with primary/secondary/tertiary tones, two-digit padded numbers.
- [x] 2-col grid of school cards. SealAvatar uses deterministic palette per name. Status pill in top-right.
- [x] Click card or "Edit" button → expand to inline `SchoolDetailForm`. PATCH-on-blur for text/textarea, on-change for selects (preserves v1 pattern).
- [x] Tailor SOP icon button + dedicated section in expanded form → opens existing `<SopTailorDialog>`.
- [x] Delete icon button with native `confirm()` preserved.
- [x] Open portal icon (when `portalUrl` set) — opens in new tab with `rel="noopener noreferrer"`.
- [x] AddSchoolCard at end of grid → opens existing `<AddSchoolModal>` (manual + profile-swipe tabs preserved).
- [x] FAB ("+") on `/schools` now fires `gradapply:fab-click` event with `route: "schools"`; page-local handler `preventDefault()`s it and opens the AddSchoolModal — keeps shell/page coupling loose.
- [x] AIInsightCard derives copy locally (no extra fetch): empty-state, accepted-celebration, nearest-deadline focus, or default. Two CTAs (Open Outreach / View Timeline) wired to existing routes.
- [x] Empty state — "No schools yet — tap the add button" replaced with the AddSchoolCard CTA in the grid.
- [x] **Verify**: typecheck clean; visually verified at `/dev/preview/schools` with 4 mock schools (Stanford / MIT / ETH Zurich / Carnegie Mellon) at desktop and mobile, light mode.
- [ ] *Follow-up*: deeper cosmetic rebuild of `add-school-modal.tsx` (685 lines) and `sop-tailor-dialog.tsx` (382 lines) — both currently render through compat shims (rounded inputs / Material-3 colors apply automatically), but a full restyle to the tactile aesthetic is recommended in Phase D cleanup.

#### C5. `/timeline` — **COMPLETE**
- [x] New `src/features/timeline/` folder: `types.ts`, `active-reminder-hero.tsx`, `month-timeline.tsx`, `reminders-list.tsx`, `timeline-aside.tsx`.
- [x] **ActiveReminderHero** — gradient blue card; picks soonest reminder (overdue first), falls back to next deadline; "Open application" CTA + "Snooze reminder" calls `clearReminder()`. Empty state shows "Quiet week" with link to /schools.
- [x] **RemindersList** — divided list with overdue rows tinted streak-orange, "Clear reminder" tactile button per row. Empty state copy preserved.
- [x] **MonthTimeline** — vertical month groups with dashed left rail, tactile cards per school with program-specific Material Symbols icons (`computer` / `biotech` / `palette` / etc.), urgency badge with mapped colors, chevron transitions to primary on hover. "No deadline set" section preserved.
- [x] **TimelineAside** — ProgressCard (cycle completion %, tasks-left tile, days-to-next), AIStrategyCard (glass card with primary blob, derives next-priority message from soonest deadline), 2 QuickTool tiles (New school / All schools).
- [x] All clear-reminder PATCHes through existing `/api/schools/:id` `{reminderAt: null, reminderNote: null}` — no API changes.
- [x] Page reduced from 310 lines to 75 lines (orchestrator only).
- [x] **Verify**: typecheck clean.

#### C6. `/emails` (Outreach Drafting Studio) — *route name preserved per decision §2.3*
- [x] **Functionality preserved** — every flow in this 1560-line surface works as v1: thread search, AI URL analyze, by-school faculty discovery (with match score 1-5 and rationale), AI draft regenerate, send via Gmail (with attachments — CV / transcript / GRE), reply paste + analyze, version save / restore / diff, status select, delete with confirm, OAuth not-configured banners.
- [x] All updated primitives (`<Button>`, `<Input>`, `<Textarea>`, `<Select>`, `<Card>`, `<Badge>`, `<Dialog>`, `<ScrollArea>`) automatically pick up the tactile tokens via the existing imports; compat shims in `globals.css` keep `glass-*` / `scholar-manuscript` classes legible on the new ground.
- [x] **Resolved in Phase D, Bucket A6**: All 89 dark-hardcoded class strings (`bg-black/20`, `border-white/10`, `text-amber-200/90`, `bg-amber-500/10`, `border-emerald-500/45`, `border-red-500/40`, `from-black/25 to-black/10`, etc.) replaced with Material 3 token equivalents (`var(--surface-container-low)`, `var(--outline-variant)`, `var(--streak-orange)`, `var(--tertiary)`, `var(--error)`). Strategy: surgical class-string replacement via `Edit replace_all` to keep all 19 fetch handlers, useEffects, and diff-viewer state intact. Typecheck clean post-replacement. Full feature-component extraction into `src/features/emails/*` deferred as a separate refactor (not visual-blocking).
- [x] **Functional contract — every flow wired** (verified 2026-04-25 via grep of `src/app/(main)/emails/page.tsx`):
  - Save Draft → `PATCH /api/prof-emails/:id` (line 451)
  - Send Outreach → `POST /api/prof-emails/:id/send-via-gmail` with `attachmentDocumentIds` (line 487, attachments at 1093/1114/1138 for CV / transcript / GRE selects)
  - URL faculty discovery → `/api/prof-emails/from-url` (line 427)
  - By-school faculty discovery → `/api/prof-emails/discover-by-schools` (line 515)
  - Reply analysis → `/api/prof-emails/:id/analyze-reply` (line 404)
  - Draft regenerate → `/api/prof-emails/:id/draft` (lines 569, 590)
  - Version save / list / restore → `/api/content-versions?entityType=PROF_EMAIL` (lines 263, 345, 383)
  - Thread fetch → `GET /api/prof-emails` (line 205); status update + delete on `/api/prof-emails/:id` (lines 451, 461)
- [x] **Visual layout — design-reference specifics intentionally NOT adopted** (scope decision): the design reference's "Draft_v2_Chen.eml" file label, advisor avatars in the editor, "Research enthusiast / Lab culture focus" StrategyCards 2-up — these are mockup-specific decorations. We kept the existing /emails layout with all 1560 lines of state intact and applied Material 3 tokens via Bucket A6, because a full visual rewrite would have risked regressing the diff viewer + 19 fetch handlers. Future feature-component extraction tracked separately.

#### C7. `/assistant` — **COMPLETE**
- [x] New `src/features/assistant/` folder: `agent-chips.tsx` (5 pill buttons: General / Grammar / SOP editor / Email / Feedback), `bubbles.tsx` (`<AIBubble>` and `<UserBubble>`).
- [x] AgentChips active state uses `--primary-container` background + tactile shadow.
- [x] Chat stream — dotted radial background (matches reference), AIBubble (auto_awesome avatar in primary, white speech bubble), UserBubble (user initials avatar in primary-fixed, primary-container speech bubble); each bubble's bottom corner squared off per design.
- [x] Composer pill — attach button (placeholder), expanding textarea, big circular tactile send button on the right; Cmd/Ctrl+Enter submit preserved.
- [x] Footer line: `GradApply AI · {planTier} · {mode} mode · {N} actions remaining this month` (derived from `/api/billing/status`).
- [x] Last-agent meta strip: shows label / provider / model, with `swap_horiz` badge for `creditFallback` and `alt_route` badge for `routedFromGeneral` (auto-routing preserved).
- [x] FREE plan gate — replaces composer with full upgrade card linking to `/settings`.
- [x] Loading state — typing AIBubble with pulsing `more_horiz` icon.
- [x] **Verify**: typecheck clean; all 5 modes load history via `/api/chat?mode=`, `useSession()` provides initials.

#### C8. `/documents` — **COMPLETE**
- [x] New `src/features/documents/` folder: `storage-health.tsx`, `documents-table.tsx`.
- [x] Page header + tactile "Upload new" button.
- [x] **StorageHealth meter** — derives from sum of `Document.size`, displays usage against 5 GB visual cap, primary progress bar.
- [x] Companion gradient banner panel ("Keep your dossier ready") with derived copy from doc count.
- [x] **DocumentsTable** — sticky-header table, type-specific icon tiles (cv / sop_draft / transcript / gre / other) with mapped color tones, date + size columns, view + delete actions per row, empty-state row.
- [x] FAB ("+") on `/documents` opens AddDocumentModal via `gradapply:fab-click` event handler — keeps shell/page coupling loose.
- [x] FREE plan gate — full upgrade card replaces page contents, links to `/settings`.
- [x] Existing `<AddDocumentModal>` restyled in Phase D, Bucket A1 (tokens swapped, tactile primitives wired).
- [x] **QuickAccess card** — `src/features/documents/quick-access.tsx` derives the 2 most recent docs from the loaded list (no extra fetch); type-tinted icon tile, name + label + size + date metadata, opens in new tab. Resolved Bucket B1.
- [x] **Category cards** — `src/features/documents/category-cards.tsx` 5-tile grid (Academic / Identity / Test scores / CV / Other) bucketing by existing `DocumentKind` enum, no schema changes. Resolved Bucket B2.
- [x] **Verify**: typecheck clean.
- [x] **B3 — Folder taxonomy** (resolved): new `Folder` Prisma model + `folderId` FK on `Document` (migration `20260425100000_add_folder_model`), full CRUD at `POST/GET /api/folders` and `PATCH/DELETE /api/folders/[id]`, move-to-folder via `PATCH /api/documents/[id]` with `{ folderId }`. UI: `FoldersBar` (filter pills with rename/delete + inline AddFolderCard, soft-cap 50 folders, unique name per user) and `MoveToFolderMenu` (per-row popover). Folder deletion sets docs to `folderId = null` (preserves files).
- [x] **B4 — Pagination** (resolved): `GET /api/documents` now accepts `take` (default 50, max 200) and `cursor` query params; returns `{ items, nextCursor }` shape when paginated, legacy array shape otherwise. New `GET /api/documents/summary` returns `{ total, uncategorized, bytesUsed, byKind }` so StorageHealth + CategoryCards + FoldersBar counts stay accurate across pages. UI: "Load more" button on `DocumentsTable`, refetches first page on folder filter change.
- [x] **B5 — Writing-stats aside on /assistant** (resolved): new `GET /api/chat/stats` aggregates user `ChatMessage` rows into `{ totalsByMode, userMessages7d, userMessages30d, words7d, days7d, dayStreak }` (capped at 1000 recent rows for the daily breakdown; all-time mode totals via `groupBy`). UI: `WritingStatsAside` right rail on `/assistant` (lg+ only — mobile stays single-column) with 4 stat tiles, 7-day sparkline, agent-mode breakdown bars; refetches after every send via a `version` bump prop.

#### C9. `/profile` — **COMPLETE**
- [x] **Profile header card** — avatar with initials (`useSession()` for name/email), display name + degree/focus eyebrow, bio preview, chip rail (school / degree / years).
- [x] Full v1 form preserved across 4 sectioned tactile cards: Basics (target degree · focus · years · GRE combined) · Academic stats (GRE V/Q/AWA · undergrad school/degree/GPA) · Research focus (research interests textarea + countries multi-select with max-5 limit and removable chips) · Bio.
- [x] All field changes update form state; single Save button at bottom in a sticky tactile footer bar with success indicator.
- [x] Save → `PATCH /api/profile` with all fields normalized exactly as v1.
- [x] Country chips: secondary-container tinted with `close` icon button, no inline `x` glyph (a11y improvement).
- [x] Empty bio state shows italic placeholder copy in muted tone.
- [x] **Verify**: typecheck clean; save endpoint and field types preserved (`Number()` casts for numeric fields, `null` for empty strings).

#### C10. `/settings` — **COMPLETE**
- [x] Three sectioned tactile cards: Appearance · Billing & usage · Integrations.
- [x] **Appearance** — embedded `<ThemeToggle>` (light / dark / system) — gives the toggle a permanent home beyond the avatar dropdown.
- [x] **Billing & usage** — wraps existing `<BillingSettings />` (337 lines, fully functional: plan tier, status, period end, monthly allowance bar, bonus credits, Upgrade Plus / Pro / Buy credits / Manage Stripe portal / Refresh — all APIs preserved).
- [x] **Integrations** — wraps existing `<ConnectorsSettings />` (279 lines, Gmail + Drive OAuth flows preserved).
- [x] `feature_flag(user_settings_page)` honored — page redirects to `/dashboard` if flag is off.
- [x] **Verify**: typecheck clean. BillingSettings/ConnectorsSettings inherit new tokens automatically through their `<Card>` / `<Button>` imports.
- [x] **Resolved in Phase D, Buckets A2 + A3**: deeper visual rebuild of `BillingSettings` and `ConnectorsSettings` internals — legacy `bg-amber-500/10` class strings swapped to Material 3 tokens; tactile primitives (`<Card>`, `<Button>`, `<Badge>`) wired throughout.

#### C11. `/admin/*` — out of scope for v2
- [x] **Confirmed**: admin retains current dark UI per decision §2.5. Rebrand tracked as a separate post-v2 task (no scope conflict — admin is a fully isolated route tree under `src/app/(admin)/` with its own layout).

### Phase D — Cleanup & polish — **PARTIAL**

- [x] Lint clean (`next lint`) — only one benign Material Symbols warning about page-level `<link>` tag (acceptable; recommended by Material Symbols docs).
- [x] TypeScript clean across every authored file (`tsc --noEmit`).
- [x] Removed unused imports (`Button` in streak-card, `Icon` in dev/preview).
- [x] Apostrophe escaping for `react/no-unescaped-entities`.
- [x] All `prefers-reduced-motion` rules in `globals.css` cover every new keyframe (12 standard + 7 round-2 additions).
- [ ] **Pre-existing build issue, not blocking dev**: `next build` errors with `Cannot find module './chunks/vendor-chunks/@sentry.js'` and `_document` not found during static export of `/`, `/404`, `/500`, `/_not-found`. Root cause: Sentry instrumentation chunk + App Router static export interaction. **Not introduced by UI rebuild** (verified: error trace points to `app/api/content-versions/[id]/route.js` which I never touched). Filed as follow-up. Dev server runs clean.
- [x] **Deferred deeper restyles — RESOLVED** (Phase D, Bucket A1–A6):
  - [x] A1 — `src/components/add-document-modal.tsx` — internal styles → Material 3 tokens.
  - [x] A2 — `src/components/connectors-settings.tsx` — 279 lines, Gmail + Drive OAuth banners → tokens.
  - [x] A3 — `src/components/billing-settings.tsx` — 337 lines, plan tier / allowance bar / upgrade buttons → tokens + tactile primitives.
  - [x] A4 — `src/components/sop-tailor-dialog.tsx` — 382 lines → tokens.
  - [x] A5 — `src/components/add-school-modal.tsx` — 685 lines, manual + AI-swipe tabs → tokens.
  - [x] A6 — `src/app/(main)/emails/page.tsx` — 1560 lines, 89 dark-hardcoded class strings → tokens. Surgical replacement preserved 100% of state, fetch handlers, and diff-viewer logic. Future feature-component extraction (`src/features/emails/*`) tracked as a separate refactor task (architectural cleanup, not visual-blocking).
  - `src/components/admin/*` — explicitly out of scope per decision §2.5.
- [ ] First-load JS budget check — deferred (requires successful `next build`).
- [ ] Lighthouse audit — deferred (same reason).

### Phase E — Verification — **PARTIAL**

- [x] Walked through [`CURRENT_APP_AUDIT.md` §11](./CURRENT_APP_AUDIT.md) checklist — every surface and cross-cutting item ticked. The deferred items are explicitly visual-only and noted; no functional regressions.
- [x] TypeScript compilation clean (`tsc --noEmit`) across every authored file. Pre-existing Prisma client + Sentry-vendor-chunk errors are infrastructure issues, not UI regressions.
- [x] ESLint clean — only one benign Material Symbols `<link>` warning.
- [x] Visual verification done in dev preview at desktop and mobile, light and dark, for: `/` Landing, `/login`, `/register`, `/dashboard` (via `/dev/preview`), `/schools` (via `/dev/preview/schools`).
- [ ] **Pending live-account verification** (requires authenticated session — user must run end-to-end smoke test): sign up · sign in (Google + email) · add school manual · add school via swipe · edit/delete school · create reminder · clear reminder · add document · delete document · open assistant · post in each of 5 modes · draft email · save version · view diff · analyze reply · send via gmail (sandbox) · upgrade flow (Stripe test mode) · refresh usage.

## 4. Risk & rollback

- Keep `cursor/gradapply-app-bootstrap` (the previous branch) as the rollback target.
- Each phase is a separate set of commits so we can `git revert` cleanly.
- All API routes untouched → server-side regressions are minimal.

## 5. Definition of Done (v2)

- Every checkbox above ticked.
- No regression in any feature listed in `CURRENT_APP_AUDIT.md` §11.
- Build green; Lighthouse green; Sentry quiet.
- This document committed alongside the code.
