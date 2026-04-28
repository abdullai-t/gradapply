# GradApply v2 — Code Architecture

> Folder + module conventions for the `ui-rebuild` branch. Mirrors how a Google-scale frontend platform is organized: **feature-sliced**, **route-thin**, **primitives-pure**.

## Goals

1. **Speed** — pages render fast (RSC where possible, code-split client islands, minimal JS shipped, prefetch critical data).
2. **Performance** — no waterfall data fetches; Tailwind v3 JIT; dynamic imports for heavy modals.
3. **Security** — zero `dangerouslySetInnerHTML`, all input Zod-validated server-side, no client-side env-var leaks, CSRF-safe OAuth via existing `oauth-state.ts`, rate-limit every mutation.
4. **Scalability** — features stand alone; touching `schools` should not recompile `assistant`.
5. **DX** — primitives in one place, no copy-paste of buttons/cards, consistent `@/` import paths.

## Top-level (after rebuild)

```
gradapply/
├── design-system/                # Reference assets (read-only, not shipped)
│   ├── tactile/                  # JSX reference + tokens.css
│   ├── preview/                  # Standalone component galleries
│   └── DESIGN_README.md
├── docs/
│   ├── CURRENT_APP_AUDIT.md
│   ├── DESIGN_SYSTEM_SUMMARY.md
│   ├── ARCHITECTURE.md
│   └── PRD_V2_REBUILD.md
├── prisma/                       # Untouched
├── public/                       # Existing icons + new MS Outlined CSS
├── src/
│   ├── app/                      # Next.js App Router — THIN route shells only
│   │   ├── layout.tsx            # Loads Plus Jakarta Sans + Material Symbols
│   │   ├── page.tsx              # Marketing landing
│   │   ├── login/
│   │   ├── register/
│   │   ├── (main)/               # Authenticated shell (sidebar + topbar)
│   │   │   ├── layout.tsx        # NEW Sidebar + TopBar + FAB host
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── schools/page.tsx
│   │   │   ├── timeline/page.tsx
│   │   │   ├── outreach/page.tsx          # was /emails — renamed
│   │   │   ├── outreach/[id]/page.tsx     # NEW: thread-detail route
│   │   │   ├── assistant/page.tsx
│   │   │   ├── documents/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   ├── support/page.tsx
│   │   │   └── admin/...                  # Untouched
│   │   └── api/                  # Untouched (UI rebuild only)
│   ├── features/                 # NEW — feature-sliced UI
│   │   ├── shell/                # AppSidebar, TopBar, FAB, NavContext
│   │   ├── dashboard/            # WelcomeHeader, StreakCard, ReadinessGauge, DailyMission, DocStatusGrid, RecSchoolGrid
│   │   ├── schools/              # SchoolCard, AddSchoolCard, AddSchoolModal (manual + AI swipe), SchoolStats, AIInsightCard
│   │   ├── timeline/             # ActiveReminderHero, TimelineMonth, TimelineCard, ProgressCard, AIStrategyCard
│   │   ├── outreach/             # ThreadsSidebar, DraftingStudio, EmailEditor, StrategyCards, VersionHistory, ReplyAnalyzer, FacultyDiscovery
│   │   ├── documents/            # StorageHealth, QuickAccess, FolderGrid, AllDocumentsTable, AddDocumentModal
│   │   ├── assistant/            # AgentChips, ChatStream, AIBubble, UserBubble, Composer, WritingStatsAside
│   │   ├── profile/              # ProfileHeaderCard, AcademicStatsCard, ResearchFocusCard, ApplicationTimelineCard
│   │   ├── settings/             # BillingSettings, ConnectorsSettings, AccountSection, PreferencesSection, DangerZone
│   │   ├── landing/              # MarketingHero, Pillars, Pricing, FAQ, Footer
│   │   └── admin/                # Untouched (admin/*)
│   ├── components/
│   │   ├── ui/                   # PRIMITIVES — Radix-on-Tactile rewrites: Button (TacButton), Card, Input, Textarea, Select, Dialog, Tabs, Progress, Badge, ScrollArea, DropdownMenu, Avatar
│   │   ├── icon.tsx              # NEW — Material Symbols wrapper (single source)
│   │   ├── glass-panel.tsx       # NEW — light-glass card shell
│   │   ├── seal-avatar.tsx       # NEW — school initials seal
│   │   ├── tactile-card.tsx      # NEW — tactile-shadow card shell
│   │   ├── streak-chip.tsx
│   │   ├── stat-tile.tsx
│   │   └── reminder-banner.tsx   # Carried over (rebrand only)
│   ├── hooks/                    # NEW — useApi, useDebouncedSave, useToast, useLocalRoute
│   ├── lib/                      # Untouched (server / data layer is stable)
│   ├── styles/
│   │   ├── globals.css           # Replaces existing — imports tokens, Plus Jakarta Sans, Material Symbols
│   │   └── tokens.css            # Mirror of design-system/tactile/tokens.css, scoped to :root + .dark fallback
│   └── auth.ts / auth.config.ts  # Untouched
├── tailwind.config.ts            # Updated palette + font stack
├── postcss.config.js
└── package.json                  # Drop `lucide-react`? — keep for any non-migrated surface (admin) initially
```

## Module rules

1. **`src/app/**/page.tsx` is thin.** No business logic, no UI primitives. Each page calls one feature's exported `<Page>` component (e.g. `<DashboardPage />`).
2. **`src/features/<feature>/`** owns its UI components, hooks, and feature-local types. It imports primitives from `@/components/ui` and data from `@/lib/*` (server actions or fetch helpers). It must NOT import from another feature — share via `@/components` or `@/lib`.
3. **`src/components/ui/`** is the design-system layer. Every component there is **dumb, pure, and prop-driven**. No fetching, no globals.
4. **One Button to rule them all.** `Button` exposes `variant: primary | secondary | ghost | danger`, `size`, `icon`, `iconRight`, `loading`. The press-down behaviour lives there once.
5. **Icons** go through `<Icon name="school" fill />`. No raw `<span class="material-symbols-outlined">`.
6. **Server fetches** stay in `src/lib/*-fetch.ts` (RSC-friendly) or `src/app/api/*` (existing). Client components consume via SWR-like hooks in `src/hooks/`.
7. **Modals are dynamic-imported** — `AddSchoolModal`, `SopTailorDialog`, etc. via `next/dynamic({ ssr: false })` to keep the page payload small.
8. **No barrel index re-exports** that import every sub-component (they hurt tree-shaking). Direct path imports.

## Performance budget

- Each route's first-load JS ≤ **180 KB** gzip (currently `/emails` is 1560 lines + AI panel; we will split into `<DraftingStudio />`, `<ThreadsSidebar />`, `<FacultyDiscovery />`, lazy-loading discovery).
- Sidebar renders as RSC; nav state lives in URL (`pathname`), no client-side router state.
- Dashboard fetches in parallel via `Promise.all` in the RSC, no N+1.
- Animations gated on `prefers-reduced-motion`.

## Security checklist (per-feature)

- All API mutations Zod-validated (existing pattern).
- Plan-gates checked **server-side** — UI hides locked features as a UX nicety, not as the security boundary (existing `requireNonFreeForFeature`).
- Rate-limit chat + AI draft + faculty-discover (existing Upstash).
- No new client-side use of secrets (LLM keys never reach the browser).
- OAuth flows continue to use `oauth-state.ts` for CSRF.
- `target="_blank"` always paired with `rel="noopener noreferrer"`.
- File uploads continue via S3 presigned URLs (no direct upload to our origin).

## What does NOT change

- Prisma schema.
- Every `src/app/api/*` route handler.
- Auth (NextAuth), billing webhooks, LLM router, feature-flag DB.
- Admin panel (out of scope for v2 — keeps lucide + dark surfaces if needed; will rebrand later).

## Naming conventions

- Files: `kebab-case.tsx`. Components: `PascalCase`. Hooks: `useFoo`.
- Test files: co-located `foo.test.tsx`.
- Types: feature-local in `features/<f>/types.ts`; cross-feature shared types in `src/types/`.
