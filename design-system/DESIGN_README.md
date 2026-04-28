# GradApply Design System

**GradApply** — "The calm command center for grad school." A workspace for graduate-school applicants to track programs and deadlines, draft professor outreach emails with AI assistance, version statements of purpose (SOPs) and CVs, and use AI as an editor — "not a replacement for your voice."

The aesthetic is **Scholar Manuscript**: a deep, dark manuscript of navy ink with manuscript‑gold highlights, glassmorphism panels, a quiet serif display face against a clean sans body. The emotional register is "applying is emotional and logistical at once — bring clarity, structure, and momentum until you hit submit."

## Sources

This system was derived from the attached Next.js codebase (mounted as `src/`, read-only).

Key files read:
- `src/app/layout.tsx` — root font loading (`DM_Sans` + `Fraunces` via next/font/google).
- `src/app/globals.css` — all color tokens, glass/panel utility classes, keyframes.
- `src/components/layout/glass-scene.tsx` — full-viewport mesh gradient + orbs, `GlassBrandMark`, `MainShellBackdrop`.
- `src/components/landing/home-landing.tsx` — marketing surface: hero, vision pillars, feature tiles, How-it-works, pricing, FAQ, footer CTA.
- `src/app/(main)/layout.tsx` + `src/components/app-sidebar.tsx` — app shell with sticky 64ch sidebar.
- `src/app/(main)/dashboard/page.tsx` — hero dossier panel, metric strip, recent archive table, critical deadlines, reminder pings, campus spotlight.
- `src/app/(main)/schools/page.tsx` — school tracker with expandable rows, status chips, reminders, deadline fields.
- `src/app/(main)/emails/page.tsx` — "Manuscript" professor outreach with versions, diff, reply analysis.
- `src/app/(main)/assistant/page.tsx` — chat assistant (grammar / SOP / email / feedback / general modes).
- `src/app/(main)/timeline/page.tsx` — deadlines grouped by month, active reminders.
- `src/components/ui/*` — shadcn primitives (button, card, input, badge, progress, dialog, etc.).
- `src/components/brand-logo.tsx` — `/logo.png` mark, graduation‑cap‑with‑check.

Assets copied: `assets/logo.png` (brand mark), `assets/apple-icon.png`, `assets/favicon.ico`. Fonts `fonts/GeistVF.woff` + `fonts/GeistMonoVF.woff` copied (app layout loads Geist only for mono fallback; the actual display + body are DM Sans + Fraunces loaded from Google Fonts).

## Index

- `colors_and_type.css` — foundation tokens and typographic classes. Import at the top of any HTML you build.
- `README.md` — this file.
- `SKILL.md` — cross‑compatible skill entry point.
- `assets/` — logo, app icons, favicons.
- `fonts/` — Geist variable fonts (mono fallback).
- `preview/` — registered cards for the Design System tab (colors, type, spacing, components, brand).
- `ui_kits/webapp/` — React JSX recreations of the marketing site + logged‑in workspace. Open `ui_kits/webapp/index.html`.

## Products represented

One product — a single **Next.js web app** with:
1. **Marketing site** (`/`, `/login`, `/register`) — glass hero, vision pillars, feature tiles, pricing, FAQ.
2. **Logged-in workspace** (`/dashboard`, `/schools`, `/emails`, `/assistant`, `/timeline`, `/documents`, `/profile`, `/settings`) — sidebar shell over `MainShellBackdrop`.

Both share the same Scholar Manuscript theme (the app defaults to `.dark` on `<html>` — dark is the canonical experience; light tokens exist as fallbacks but the product is shown dark).

Substitution note: the app loads **DM Sans** + **Fraunces** via `next/font/google`. Because we don't have the binaries, this system loads both from Google Fonts CDN. Geist Mono is included in `fonts/` for a monospace fallback but is not central to the brand. If you want self‑hosted DM Sans / Fraunces files, please provide them and I'll swap the @import for a local `@font-face`.

## CONTENT FUNDAMENTALS

The voice is **warm, rigorous, faintly literary** — a thoughtful advisor, not a hype app. Copy consistently pushes back against "AI writes for you" tropes in favor of "AI helps you edit your own voice."

### Voice and tone
- **Calm over urgent.** "The calm command center" · "one calm command center for every application you care about." Never hustle‑bro.
- **Second person, direct.** Says **"you"**, never "we" at the user. "Welcome back, {firstName}." "Your application dossier is 60% complete."
- **First person plural only for the product side.** "We fetch context and draft." "We classify intent." Never "I".
- **Acknowledges emotion.** "Applying is emotional and logistical at once." "Make this cycle feel manageable." "panic" vs "prose."
- **Gentle authority.** Tells the user what to do with confidence but never barks. "Keep deadlines and materials moving together." "Verify every name on the official directory before sending."

### Casing
- **Sentence case everywhere** for UI — buttons, headers, nav, section titles. `Start free`, `Create your workspace`, `Critical deadlines`, `Recent archive`.
- **UPPERCASE eyebrows only** with wide tracking (`0.2em`) and primary‑gold color. Used above hero titles: `THE DOSSIER`, `SCHOLAR OUTREACH`.
- Status labels UPPERCASED in badges (`PLANNING`, `APPLIED`, `WAITING`) because they come from the enum; surrounding prose never shouts.

### Punctuation & rhythm
- **Em dashes** and interior semicolons are normal: "Grammar, structure, and strategic feedback — not a replacement for your judgment."
- Generous commas; long, considered sentences; balanced phrases separated by `—`.
- Numbers written out in prose; digits in data contexts (`60%`, `3 acceptances`).
- Ellipsis `…` used in placeholders: `Search archive…`, `Pick a saved version…`.

### Vocabulary — signature words
"Dossier", "manuscript", "curator", "scholar", "archive", "pursuit", "pipeline", "outreach", "momentum", "fit", "clarity", "structure", "calm", "companion". These aren't decorative — they're how the product names its own surfaces (`Manuscript` is the email draft; `The dossier` is the dashboard hero; `Curator insight` is the AI panel; `Campus spotlight`, `Scholar Pursuit Hub` in the sidebar subtitle).

### Examples
- Hero H1: _"One calm command center for every application you care about."_
- Hero sub: _"GradApply exists so you spend less time juggling spreadsheets and inboxes, and more time on research fit, faculty outreach, and stories only you can tell."_
- CTA pair: **Start free** / **I already have an account**
- Empty state: _"No upcoming deadlines. Add schools with dates."_
- FAQ: _"Will AI write my statement of purpose for me?" → "GradApply is built so AI supports editing and structure — you stay the author."_
- Microcopy for AI panel: _"Curator insight — Add research interests on your Profile so your assistant can align outreach and essays with the programs you care about."_

### Emoji
**Never.** No emoji in code, copy, or UI. Icons come from lucide‑react (stroke line icons).

## VISUAL FOUNDATIONS

### Palette & vibe
Ink‑dark navy ground (`hsl(230 35% 7%)`) with multi‑orb gradient lighting — **not** flat black. The dominant color motif is **candlelit manuscript**: warm manuscript‑gold primary (`hsl(43 78% 54%)`), cool plum/violet secondary glow (`hsl(275 55% 45%)` and `hsl(278 85% 62%)`), and a distant sky highlight (`hsl(196 100% 75%)`). Text is a warm off‑white (`hsl(40 20% 96%)`) — not pure white — which pairs with the gold. Muted text is blue‑cool (`hsl(215 18% 68%)`) creating a temperature contrast.

### Backgrounds
Always **layered gradients + blurred orbs + a very faint grid**, never a single solid.
- Base wash: `linear-gradient` diagonal through three navy stops (`230 40 8` → `235 38 10` → `245 32 12`).
- Radial highlights stacked on top (gold from top, violet from bottom‑left, sky from top‑right).
- Two or three `blur-[100px]+` soft orbs animating with `animate-float-slow` / `animate-drift-x`.
- A 40–48px line grid at `0.04` opacity for texture.
- Cards also carry their own tiny `pointer-events-none blur-3xl` orb inside (e.g. dashboard hero has `-right-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl`).

### Typography
- **Display / headings**: `Fraunces` (variable opsz/weight; 400–700 used). Titles go tight (`-0.02em`), balanced (`text-wrap: balance`), 600 weight. Fraunces is used for H1–H3, big numerics on metric tiles, and the brand wordmark.
- **Body / UI**: `DM Sans` 400 / 500 / 600. Everything that isn't a title.
- **Mono**: Geist Mono (from `/fonts`) for diff output, code hints, and small tech labels.
- Eyebrow tracking `0.2em`, lowercase section titles, no all‑caps titles.

### Spacing & rhythm
Tailwind default scale; typical card internal padding `p-5`/`p-6`/`p-8`. Section vertical rhythm: `py-20 md:py-28`. Max content widths: landing `max-w-6xl` (hero `max-w-3xl`), app `max-w-7xl` or `max-w-6xl`. Cards use a 4–6px gap between icon and content, 12px between icon block and text.

### Corner radii
- Inputs, buttons, small chips: `rounded-md` (0.375–0.5rem).
- Cards, glass panels, most surfaces: `rounded-2xl` (1rem) — the signature radius.
- Icon squares (feature bullets, metric tiles): `rounded-xl`.
- Avatar / date boxes: `rounded-lg`.
- Chips, badges, brand glow: `rounded-full`.
Default token `--radius: 0.65rem`.

### Borders & dividers
- Surfaces: `border border-white/10` on dark; occasionally `border-white/15` for frosted inputs.
- Dashed borders for "add / upload / more" slots (`border-dashed border-white/15`).
- Ring accent on hover for focus: `ring-1 ring-primary/25` or `ring-2 ring-primary/30`.
- Row dividers: `divide-y divide-white/[0.06]`.

### Shadows (elevation + glow)
Shadows are either *soft depth* or *glow*, never both.
- Glass depth: `shadow-[0_12px_48px_-12px_rgba(0,0,0,0.45)]` (in `.glass-panel`).
- Hover glow: `shadow-[0_22px_56px_-22px_hsl(var(--primary)/0.55)]` — manuscript‑gold lift.
- CTA button: `shadow-[0_12px_40px_-8px_hsl(var(--primary)/0.55)]`.
- Brand logo ring: `shadow-[0_8px_32px_hsl(var(--primary)/0.45)]`.
- Inner shadow on dark inputs / manuscript cards: `shadow-inner`.

### Transparency & blur
Glass is a first‑class material. `.glass-panel` = `bg-white/[0.07]` + `border-white/15` + `backdrop-blur-2xl` + `ring-1 ring-amber-500/10`. Inputs (`.glass-input`) use `bg-black/25` + `backdrop-blur-sm` + inner shadow. Sticky headers go `bg-[hsl(230_35%_7%/0.72)] backdrop-blur-xl`. Blur is applied at every elevation tier — this is not an accent, it's the whole material language.

### Animation
Tasteful, slow, pervasive but gentle. All under `motion-safe:`.
- `animate-fade-up`: 700ms ease‑out, `translateY(16px) → 0` with opacity. Staggered via `.anim-delay-100 .anim-delay-200 .anim-delay-300 .anim-delay-400`.
- `animate-float-slow`: 8s, translate ±14px + scale 1.03 — for background orbs.
- `animate-drift-x`: 11s, horizontal drift 22px.
- `animate-pulse-glow`: 4.5s, opacity 0.35 ↔ 0.75.
- Card hover: `hover:-translate-y-1` + `duration-300` + gold glow shadow + `hover:border-primary/30`.
- Button hover: `hover:-translate-y-0.5`.
- Disclosure chevrons rotate: `transition-transform duration-200` (90°) or `group-open:rotate-180` (180°).
- **No bounces. No springs. No sliding transitions between pages.** Everything is ease‑out fade.

### Hover / press states
- Text links: `hover:text-foreground` from `text-muted-foreground`, or `hover:underline underline-offset-4` for inline primary links.
- Ghost buttons / nav: `hover:bg-white/[0.06] hover:text-foreground`.
- Primary button: `hover:bg-primary/90` + subtle `-translate-y-0.5`.
- Glass button: `hover:bg-white/[0.12]`.
- Active nav: `bg-primary/15 text-primary ring-1 ring-primary/35`.
- Press: no shrink; rely on default browser + opacity via disabled state.

### Imagery
The product ships with almost no photography — brand expresses through type, gradient, and icon. One exception: the **campus spotlight** card uses a deep navy‑to‑gold gradient background behind a landmark icon watermark (not a real photo), suggesting night‑lit campus architecture. When real imagery is introduced, target warm twilight tones, slightly grainy, never saturated.

### Layout rules
- Sticky translucent header on marketing.
- Sticky `w-64` left sidebar in the app shell, hidden on mobile in favor of a `MobileNav` + top bar.
- Fixed bottom‑right **floating action button** (`rounded-full h-14 w-14 shadow-lg`) — see Schools page for "add school."
- Generous above‑the‑fold breathing room: `pt-12 md:pt-16 pb-20 md:pb-28` in hero.
- Two‑column app content typically `grid gap-6 lg:grid-cols-5 lg:gap-8` with a 3/2 split.

### Cards
The canonical card is `.glass-panel`: rounded‑2xl, white/7 translucent fill, white/15 border, 48px blurred shadow, 1px amber ring. Variants:
- **Manuscript card** (`.scholar-manuscript`) — on email drafts, slightly less translucent (`hsl(232 32% 11% / 0.85)`), with inner shadow suggesting paper.
- **Metric tile** — glass‑panel + 4px left accent border in status tint (`border-l-4 border-l-amber-400/70`, `sky-400/70`, `violet-400/70`).
- **Highlighted pricing card** — adds `border-primary/35 ring-2 ring-primary/25 shadow-[0_20px_60px_-12px_...]`.

### Protection gradients & capsules
Over photographic / gradient backdrops (campus spotlight), text sits in the bottom half with a top‑right radial highlight (`radial-gradient(ellipse_at_top_right, rgba(251,191,36,0.12), transparent 55%)`). No explicit text‑contrast capsules — the glass panel itself provides contrast everywhere else.

## ICONOGRAPHY

**Library**: [`lucide-react`](https://lucide.dev) — exclusively. Used at `h-4 w-4` inline, `h-5 w-5` in feature bullets and metric tiles, `h-12 w-12` inside icon tiles, `h-24 w-24` at 10% opacity as watermarks.

**Style**: 1.5px stroke line icons, rounded caps, outline (never filled). Always colored `text-primary` (manuscript gold) on accent tiles or `text-muted-foreground` in neutral contexts. Sized in rem, never fractional. Always marked `aria-hidden` when decorative.

Icons observed in the codebase (sidebar nav, landing, dashboard, schools, emails):
`LayoutDashboard, CalendarDays, School, Mail, MessageSquare, Upload, UserRound, LifeBuoy, Settings, Shield, ArrowRight, BookOpen, CalendarRange, Check, Compass, FileStack, MessageSquareText, Sparkles, Target, Zap, Bell, CalendarClock, Crown, GraduationCap, Landmark, Plus, Trash2, Pencil, ExternalLink, ChevronRight, Send, Search, History, Loader2, X, AlarmClock, BellOff`.

No emoji. No unicode glyphs as icons (except `▾` in FAQ disclosure arrows and `·` as an interpunct separator). No custom‑drawn SVG icons — everything flows through Lucide.

**Load strategy for HTML artifacts**: use the Lucide CDN and render inline SVGs at runtime:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<i data-lucide="graduation-cap" class="icon"></i>
<script>lucide.createIcons({ attrs: { 'stroke-width': 1.5 } });</script>
```

**Logo**: `assets/logo.png` — a graduation cap paired with a check badge, on a gold radial background. Used at 36–48px with `rounded-xl` / `rounded-2xl`, carrying `shadow-[0_8px_32px_hsl(var(--primary)/0.45)]` and `ring-1 ring-amber-400/30`. Small `apple-icon.png` and `favicon.ico` also copied.
