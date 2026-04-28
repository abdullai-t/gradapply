# ScholarQuest Tactile — Design System Summary

> Distilled from `design-system/tactile/tokens.css` + the 8 reference JSX screens (`design-system/tactile/*.jsx`) + `design-system/CHAT_TRANSCRIPT.md`.
> This is a **major brand pivot** away from the dark "Scholar Manuscript" look.

## Aesthetic intent (from chat)

> "Modern, aesthetic, engaging UI for graduate students. **More joyful / celebratory (rooting for the student).** Like Duolingo or Notion. Animated 3D objects. Avoid commonly known colors and AI designs."

Final landing: **Material 3 Light + Plus Jakarta Sans + Tactile (Duolingo-style) hard offset shadows**.

## Tokens (`design-system/tactile/tokens.css`)

### Palette — Material 3 Light
| Token | Hex |
|---|---|
| `--primary` | `#00629d` (deep blue) |
| `--primary-container` | `#00a3ff` |
| `--secondary` | `#006c4f` (emerald) |
| `--secondary-container` | `#53fac2` |
| `--tertiary` | `#2b6c00` (green) |
| `--tertiary-container` | `#4cb200` |
| `--error` | `#ba1a1a` |
| `--background` / `--surface` | `#f7f9ff` (off-white) |
| `--surface-container-lowest..highest` | `#ffffff` → `#dfe3ea` |
| `--on-surface` | `#171c22` |
| `--outline` | `#6f7883` · `--outline-variant` `#bec7d4` |
| `--streak-orange` | `#FF9600` (gamification flame) |

### Type — Plus Jakarta Sans
- Loaded via Google Fonts (weights 400–900).
- Utility classes `t-display-lg` (48/800) · `t-headline-lg` (32/700) · `t-headline-md` (24/700) · `t-body-lg/md` · `t-label-lg` (uppercase tracked) · `t-button` (16/700).
- Material Symbols Outlined for icons (variable axis FILL, wght).

### Signature — tactile shadow + spring transition
```css
--tactile-primary: 0 4px 0 0 #004a77;       /* hard offset shadow */
--tactile-primary-active: 0 1px 0 0 #004a77;/* press state */
--tactile-card: 0 6px 0 0 #e2e8f0;
.tactile { transition: transform/box-shadow 0.12s cubic-bezier(0.34, 1.56, 0.64, 1); }
.tactile:active { transform: translateY(3px); }
```
Buttons "press down" 3px on click — the Duolingo physical-button feel. **This is the brand's defining moment**, applied to FAB, primary CTAs, sidebar active nav, school cards on hover.

### Radii
`0.5rem` · `12px` (default) · `20px` · `1.5rem` · `2rem` · `9999px`. Cards use `20–32px`. Pills `999px`.

### Spacing
`xs 4 · base 8 · sm 12 · md 24 · gutter 24 · margin 32 · lg 40 · xl 64`.

### Animations
| Class | Effect |
|---|---|
| `flame` | flame pulse + rotate (streak indicator) |
| `aura` | concentric pulse ring on Daily Mission |
| `fill-up` | scale-in (streak day dots) |
| `slide-in` | translateY(12px) → 0 (page entry) |
| `rise-in` | translateY(24px)+scale(.98) staggered (dashboard cards) |
| `pop-number` | numeric pop-in |
| `shine-sweep` | diagonal gradient sweep over Mission card |
| `dot-blink` | "on-air" status indicator |
| `gauge-sweep` | conic-gradient draws ring on load (CSS `@property`) |
| `float-blob` | ambient blurred orb drift |
| `bob` | gentle vertical bob |
| `arrow-nudge` | CTA arrow micro-bounce |
| `stat-tile:hover` | translateY(-3px) + shadow |
| `tactile-card:hover` | translateY(-4px) + shadow expand to `0 10px 0 0` |

All wrapped in `@media (prefers-reduced-motion: reduce)` → animations off.

## Surfaces — 8 reference screens

All under a single `Page` shell (`tactile/Shell.jsx`):
- **Sidebar** — fixed left, 256px, glass white/.75, active nav has bottom-border + lift.
- **TopBar** — sticky, glass, page title + search pill + **streak chip** (`12 Day Streak`, orange) + notifications + avatar.
- **FAB** — fixed bottom-right, primary blue with hard shadow, `smart_toy` icon (AI assistant) on most pages.

| Page | Distinctive blocks |
|---|---|
| `Dashboard.jsx` | Welcome header · **StreakCard** (7-day dots) · **ReadinessGauge** (conic 82%) + **StatTiles** bento (Schools / LORs / Next deadline / Essays) · **DailyMission** card (gradient + shine) · DocStatus cards · RecSchool cards (CountUp) |
| `Schools.jsx` | Stats bento (Total / In Progress / Submitted) · School cards 2-col grid with progress bar, status pill, seal · `AddSchoolCard` (dashed) · **AIInsightCard** (glass with blob highlights) |
| `Timeline.jsx` | Active-reminder hero (gradient + icon watermark) · vertical month-grouped timeline with dashed left rail and dot · ProgressCard + AIStrategyCard + QuickTool grid aside |
| `Outreach.jsx` | Threads sidebar (320px) · **Drafting Studio** with Strategy options 2-up · email-window card with red/yellow/green dots, subject row, body with inline AI tip + highlighted span, format toolbar, "3 advisors reviewed" avatars |
| `Documents.jsx` | StorageHealth meter · QuickAccess (recent files) · Folder/Category cards (5-up) + AddFolder dashed · AllDocumentsTable with status pills (Verified/Pending/Expired) and pagination |
| `Assistant.jsx` | Agent chips bar (General / Grammar / SOP Editor / Research) · chat with dotted bg, AIBubble + chips, UserBubble · composer pill with attach + send · **Writing Statistics** aside (Readability, Tone Consistency, Lexical Density gauge, Optimization Tips) · "SOP_Draft_V2.pdf" footer card |
| `Pages.jsx → Profile` | Profile card (avatar + bio + chips) · Academic Stats (GPA + GRE Q/V) · Research Focus chips · Application Timeline vertical · AI Advisor Tip gradient card |
| `Pages.jsx → Settings` | Account · Preferences (toggles) · Integrations (connected pills) · Danger zone (red border) |

## Component patterns to extract

1. **`<TacButton variant=primary|secondary|ghost|danger icon iconRight>`** — single source of truth for buttons with the press-down behaviour.
2. **`<TactileCard>`** — `tactile-card` shell with hover lift.
3. **`<StatBento>`** / **`<StatTile>`** — used across Dashboard, Schools, Assistant.
4. **`<Bubble.AI>` / `<Bubble.User>`** — chat bubbles with chip suggestions.
5. **`<TimelineMonth>`** + **`<TimelineCard>`** — dashed-rail vertical timeline.
6. **`<StreakRow>`** + **`<StreakDay>`** — gamification (only show if data exists).
7. **`<SealAvatar>`** — school logo placeholder (initials over color block).
8. **`<GlassPanel>`** — light glassmorphism (`rgba(255,255,255,0.7)` + `blur(20px)`).
9. **`<Icon name="…" fill?>`** — Material Symbols wrapper (replaces lucide).
10. **`<FAB icon>`** — bottom-right floating action.

## Light vs dark — decision needed

The new system is **light-first** (`#f7f9ff` background, dark text). The old app is `class="dark"` hard-coded. The migration plan **drops dark-only mode** and ships light by default. A future `prefers-color-scheme` dark variant can be derived but is not in scope for v1 of the rebuild.
