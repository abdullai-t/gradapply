---
name: gradapply-design
description: Use this skill to generate well-branded interfaces and assets for GradApply, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick cheatsheet

- **Palette**: deep midnight navy `hsl(230 35% 7%)` surfaces; warm **gold** primary `hsl(43 78% 54%)`; plum / sky accents. Always dark mode first.
- **Type**: **Fraunces** (display, 600 weight, editorial serif, balanced wrapping) + **DM Sans** (body 400/500) + Geist Mono. Eyebrows are DM Sans 600, 0.2em tracking, primary gold.
- **Tone**: editorial, quietly confident. "Scholar pursuit hub." Short sentences. Em-dashes. Near-zero emoji. Uses second person ("you"). Nouns like *dossier, archive, manuscript, curator*.
- **Signature element**: `.glass-panel` — rgba(255,255,255,.07) bg, 1px white/15 border, `backdrop-filter: blur(24px)`, 16px radius, soft shadow `0 12px 48px -12px rgba(0,0,0,.45)`, often with a blurred gold orb in a corner.
- **Buttons**: 36–40px tall, radius 6px, primary = gold w/ gold-glow shadow (`0 8px 28px -8px hsl(primary/.45)`). Glass variant for secondary CTAs.
- **Icons**: Lucide, stroke 1.5, frequently placed in a 40–44px rounded-xl primary/15 tile.
- **Motion**: 200ms ease-out transitions; ambient `float-slow` (8s) and `pulse-glow` (4.5s); entry `fade-up-slow` (1.6s).
- **Never use**: purple-blue gradients, emoji UI, left-accent rounded cards with colored border only, Inter/Roboto, generic SaaS illustrations.

Full tokens in `colors_and_type.css`. Component patterns in `preview/` (each card is a live, styled snippet).
