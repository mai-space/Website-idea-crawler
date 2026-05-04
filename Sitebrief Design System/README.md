# Sitebrief Design System

> Brand and UI system for **Sitebrief** — a multi-site intelligence platform that crawls websites and turns observations into decision-ready pitch briefings.

The name *Sitebrief* is provisional, derived from the product's core artifact: a one-page **brief** about a **site**. The repo this is built from refers to the project as "Website Idea Crawler" / "Multi-Site Intelligence System." Swap the name in `colors_and_type.css` (`--brand-name`) if the team lands on something different.

---

## What Sitebrief is

Sitebrief is a tool for **agencies and in-house teams** who manage many websites and need a steady stream of well-reasoned, prioritized improvements for each one. It crawls the sites it watches, parses and embeds their content, and generates **pitch briefings**: short, decision-ready ideas that include a complexity rating, an hour estimate, a CMS-aware implementation hint, and the source pages the idea came from.

The core unit of value is the **Pitch Card** — a 5-second-readable summary that a non-technical decision maker can accept, reject, or defer.

### Surfaces

| Surface | Audience | Purpose |
| --- | --- | --- |
| **Marketing site** | Agency leads, in-house web teams | Explain the value, show a sample brief, convert to trial |
| **Dashboard app** | Logged-in operators | Manage site fleet, run crawls, triage ideas, export briefings |

### Source materials

- **Repo:** `mai-space/Website-idea-crawler` — single file `project-plan.md` (technical spec, German) — copied to `source/project-plan.md`
- **Codebase:** none provided — UI was inferred from the frontend requirements section of the project plan
- **Figma:** none provided
- **Brand assets:** none provided — logo, palette, and type were authored fresh and are documented as starting points to iterate from

> ⚠️ Because no visual artifacts existed, the entire visual system below is a design direction proposal, not a recreation. Treat it as a v0 to react to.

---

## Index

- `README.md` — this file
- `SKILL.md` — Agent Skill manifest for Claude Code use
- `colors_and_type.css` — CSS custom properties: palette, type scale, semantic tokens
- `source/project-plan.md` — original product spec from the repo
- `assets/` — logo, marks, generic illustrations, placeholder imagery
- `fonts/` — webfont files (Google Fonts, see Type Stack below)
- `preview/` — design-system specimen cards (one HTML per concept, registered in the Design System tab)
- `ui_kits/marketing/` — marketing-site components and a sample landing page
- `ui_kits/dashboard/` — dashboard components and a sample logged-in view
- `slides/` — *(none — no deck template was provided)*
- `SKILL.md` — Agent Skill manifest (already listed above)

---

## Content Fundamentals

Sitebrief writes for **busy agency operators and the decision-makers they pitch to**. The voice is the voice of a senior consultant who has done this many times: confident, plain, never showy. Think *Stripe docs* or *Linear changelog*, not *enterprise SaaS landing page*.

### Voice

- **Direct.** "Crawls 50 sites in parallel" beats "Empowers your team with parallel crawling at scale."
- **Quantified.** Whenever there is a number (hours, sites, pages, percent), use it.
- **Mildly opinionated.** "Most sites have 3 fixable SEO issues. We surface them in priority order."
- **No hype.** Avoid "revolutionary," "powerful," "seamless," "AI-powered." Especially "AI-powered."

### Person and address

- **"You"** — the operator running the tool — is the second person.
- **"We"** — Sitebrief, the product — is used sparingly. Prefer the product name or active verbs without a subject ("Sitebrief generates…" or "Generates…").
- The **end client** of the agency user is "the client" or "the site owner," never "the user."

### Casing

- **Sentence case** for everything: navigation, buttons, headings, card titles. The only Title-Cased words are proper nouns (TYPO3, WordPress, OpenAI) and the product name itself.
- Status labels are **lowercased** (`open`, `accepted`, `deferred`, `rejected`, `done`) to match the database enum and avoid shouting.

### Numbers and units

- Hours: `16h` (no space). Ranges: `8–16h` (en dash).
- Counts: `1,240 pages` (comma thousands separator).
- Percent: `92%` (no space).
- Dates: `3 May 2026` for human reading; ISO `2026-05-03` only inside developer/exported contexts.

### Examples — copy in voice

**Hero**
> Stop guessing what to build next. Sitebrief crawls every site you manage and writes the next 20 things worth doing — with hours, complexity, and a one-paragraph pitch.

**Empty state, no sites**
> No sites yet. Add one to start crawling.

**Empty state, no ideas**
> Crawl finished. Sitebrief is reading 312 pages and will start writing briefs in about 2 minutes.

**Idea card pitch text** (the canonical example from the spec)
> The site has strong product-page traffic but no supporting content. A short blog series on Feature X could lift organic reach and conversion without adding dev work.

**Destructive confirm**
> Delete *acme.example.com*? This removes 312 crawled pages and 28 open briefs. There is no undo.

### What Sitebrief does **not** do, in writing

- No emoji in product copy. (Emoji *are* used as ambient marks in the source repo's READMEs — 🟠🧩 — and are acceptable on developer-facing surfaces only.)
- No exclamation marks except in genuine errors ("Crawl failed!").
- No "AI" as a noun. Prefer "the model," "the brief generator," or describe what it does.
- No product personification ("Sitebrief thinks…"). The product *generates*, *finds*, *flags*. It does not think.

---

## Visual Foundations

The aesthetic target is **calm engineered seriousness**: a tool agency leads can put in front of a client without it looking like a toy. The references are *Linear, Stripe Atlas, Vercel dashboards, classic FT.com* — restrained palette, generous whitespace, editorial serif for impact, and the working text in a precise sans.

### Palette

A four-layer palette: **paper** (warm off-white substrate), **ink** (deep cool charcoal), **accent** (a single saturated mark — TYPO3-adjacent burnt orange, reclaimed as a wink at the German web ecosystem the tool was born in), and **semantic** (calm low-saturation status colors).

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Paper / canvas | `--paper` | `#F7F3EC` | Page background |
| Paper raised | `--paper-2` | `#FFFFFF` | Cards, modals |
| Paper sunken | `--paper-0` | `#EFEAE0` | Section dividers, code blocks |
| Ink primary | `--ink` | `#15171A` | Body text, headings |
| Ink muted | `--ink-2` | `#5B6068` | Secondary text |
| Ink faint | `--ink-3` | `#9099A2` | Captions, placeholders |
| Rule | `--rule` | `#E2DCD0` | Hairlines, borders |
| Accent | `--accent` | `#E2632A` | Single brand mark, primary CTA |
| Accent ink | `--accent-ink` | `#A23E10` | Hover, links on paper |
| Low complexity | `--low` | `#3F8A57` | "low" badge |
| Med complexity | `--med` | `#B8862A` | "medium" badge |
| High complexity | `--high` | `#B23F3F` | "high" badge |

The accent is used **once per screen** wherever possible — on the primary action, the active nav item, or a single editorial flourish. Two accents in one viewport is an error.

### Type stack

Three families, all available on Google Fonts as substitutes for any future bespoke choice:

| Role | Family | Why |
| --- | --- | --- |
| Display / editorial | **Fraunces** | Variable serif with strong opsz; gives the marketing site editorial gravitas without trending toward hipster. (Substitution flag — see below.) |
| UI / body | **Inter** | The neutral pick; near-zero personality, excellent at small sizes, dense numerals. |
| Mono / data | **JetBrains Mono** | For URLs, ID hashes, hour estimates, and any tabular numeric data. |

> **⚠ Substitution note.** No custom fonts were provided with the repo. Fraunces, Inter, and JetBrains Mono are all SIL-OFL on Google Fonts and used here as defensible defaults. The system instruction asked me to flag this — please confirm or replace these choices and I'll wire in the real files.

### Type scale

A modular scale built around `1rem = 16px` with a 1.25 ratio for UI and a 1.333 ratio for editorial display.

| Token | Size | Family | Use |
| --- | --- | --- | --- |
| `--t-display` | 64/68 | Fraunces 400 opsz 144 | Marketing hero |
| `--t-h1` | 40/44 | Fraunces 500 opsz 96 | Page titles, marketing section heads |
| `--t-h2` | 28/32 | Fraunces 500 opsz 48 | Card titles in editorial layouts |
| `--t-h3` | 20/26 | Inter 600 | Dashboard panel headers |
| `--t-body` | 16/24 | Inter 400 | Body text |
| `--t-body-sm` | 14/20 | Inter 400 | Dense lists, table rows |
| `--t-caption` | 12/16 | Inter 500 tracking 0.04em uppercase | Status labels, eyebrows |
| `--t-mono` | 13/20 | JetBrains Mono 400 | URLs, IDs, hour estimates |

### Spacing

8-point grid throughout. Tokens: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`. Layout gutters use 24 (desktop) and 16 (mobile). Card internal padding is 24. Pitch-card vertical rhythm is 12 between caption rows and 24 between blocks.

### Backgrounds

- **Paper-first.** Page background is always `--paper` (warm off-white). Pure white (`--paper-2`) is *only* used for raised surfaces (cards, modal sheets) and is never the canvas.
- **No gradients.** No mesh, no aurora, no purple-to-pink. The single permitted gradient is a 4–8% paper-to-paper-2 vignette behind the marketing hero, used at most once per page.
- **No textured photography behind text.** Photography is reserved for case-study tiles and is treated with a subtle warm grade (see *Imagery* below).
- **Ambient pattern:** an optional thin diagonal-rule pattern (#E2DCD0 hairlines, 32px spacing, 0.4 opacity) for empty-state backgrounds and the marketing footer. Used sparingly.

### Borders, radii, shadows

- **Borders.** `1px solid var(--rule)` is the default hairline. **2px** borders only on focus rings and the active state of pitch cards.
- **Radii.** Tokens `--r-sm: 4px`, `--r-md: 8px`, `--r-lg: 12px`, `--r-xl: 20px`. Buttons use `--r-md`. Cards use `--r-lg`. Modal sheets use `--r-xl`. **Never fully rounded** (no `9999px`) except on avatars and status dots.
- **Shadows.** Two shadows total. `--shadow-1` (resting card) is a single soft warm shadow: `0 1px 2px rgba(21,23,26,0.04), 0 1px 0 rgba(21,23,26,0.02)`. `--shadow-2` (modal/popover) adds a second layer: `0 12px 32px -12px rgba(21,23,26,0.18), 0 2px 6px rgba(21,23,26,0.06)`. **No glow shadows** and no colored shadows.
- Inner shadows are reserved for pressed states on numeric inputs (a 1px inset top hairline).

### Hover, press, focus

- **Hover (interactive surface):** background shifts toward `--paper-0` (about 4% darker). Buttons darken their fill by 6%. Links shift from `--ink` to `--accent-ink` and the underline thickens from `1px` to `2px`.
- **Press:** the element scales `0.98` and shadow drops to none for 80ms. No color change beyond hover.
- **Focus:** a 2px ring in `--accent` at 2px offset, never the browser default. On the accent button itself, the ring becomes `--ink` to maintain contrast.

### Motion

- **Easings.** Two: `--ease-out: cubic-bezier(0.2, 0.7, 0.2, 1)` for most things; `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` for crossfades.
- **Durations.** `--dur-fast: 120ms` (button press, focus ring), `--dur-base: 200ms` (hover, drawer slide), `--dur-slow: 360ms` (modal in, route change crossfade).
- **No bouncing.** No spring overshoots. No "bounce-in" entrances. The product is serious; it does not wiggle.
- **No looping idle animation.** A live data point — queue depth, current crawl URL — animates only when its value actually changes. The dashboard at rest is fully still.

### Transparency, blur

- **Blur** is used in exactly one place: the dashboard modal scrim, which is `rgba(21,23,26,0.36)` over a 6px backdrop blur. Never on text, never on cards.
- **Transparency** for color is restricted to overlays and the rule color at low opacity. Body text is never below 100% alpha.

### Imagery

When photography appears (marketing case studies, About page), it is treated with a warm desaturate: `filter: saturate(0.85) sepia(0.04)` and a 4% paper-tint overlay so it sits in the palette rather than fighting it. **No screenshots floating in 3D space.** No mockup of a laptop on a gradient.

### Layout rules

- **Marketing site.** 1280px max content width. 96px section padding desktop, 64px tablet, 48px mobile. Asymmetric editorial grids preferred over centered hero stacks — the homepage hero is left-anchored with the headline at 60% column width and a single product specimen on the right.
- **Dashboard.** Fixed 240px sidebar (collapsible to 56px), fluid main pane with a 1440px max content width. Content padding 32. Density is "comfortable, not cozy" — table rows are 48px tall, not 32.
- **Fixed elements.** Only the sidebar and the global header are position-fixed. Toasts stack from bottom-right. The command palette (⌘K) is centered on the viewport with a paper-2 sheet.

### Card anatomy

Cards (pitch cards, site tiles, queue panels) all share a single anatomy:

```
┌───────────────────────────────────────┐
│ eyebrow row (caption + meta)          │  ← --ink-3, t-caption
│                                       │
│ Title — t-h2 / t-h3                   │
│ Body — t-body / t-body-sm             │
│                                       │
│ ─────────────────────────────────     │  ← rule
│ footer row (actions + secondary meta) │
└───────────────────────────────────────┘
```

Border `1px solid --rule`, radius `--r-lg`, shadow `--shadow-1`, padding 24. Hover lifts shadow to `--shadow-1` plus a 1px ink-tint border (`--ink-3` at 30%). No card ever uses a colored left border as its only structure — that pattern reads as "AI slop" and is banned.

---

## Iconography

Sitebrief uses **Lucide** (the open-source successor to Feather) for all in-product iconography. Lucide is loaded **from CDN** in the marketing surface (no large local dependency) and **as static SVGs imported per icon** in the dashboard build (smaller bundles).

> **⚠ Substitution note.** No icon set was specified. Lucide was chosen as the closest match to the design's stroke-weight and visual quietness. Heroicons (outline) is the second choice if Lucide ever becomes a problem.

### Rules

- **Stroke weight 1.5px** (Lucide default). Never mix with filled icons.
- **Size grid:** `14 / 16 / 20 / 24`. The 16px size is the working size; 20 is for primary nav; 24 is for marketing-page hero.
- **Color:** `currentColor` always. Icons inherit ink color from their text label. No multi-color icons.
- **No emoji** in product UI. Emoji *are* allowed in developer-facing READMEs (the source repo uses 🟠🧩 as a section marker — a TYPO3 wink — and we keep that convention in `mai-space-de` repo READMEs only).
- **No unicode symbols as icons.** No `→` standing in for a chevron, no `✓` standing in for a check. Use the lucide equivalent so stroke and size match the rest of the system.
- **PNG icons:** never. SVG only.

### Logo and marks

`assets/logo.svg` — the wordmark. `assets/mark.svg` — the standalone mark, used as favicon, app icon, and the fixed corner mark on dense surfaces. The mark is built from a stylized lowercase **`s`** rendered as a single 1.5pt stroke that loops back on itself, evoking both a *crawl* (the loop) and a *brief* (the closed page form). It is reproduced at `assets/mark.svg` and rasterized for favicon use at `assets/favicon.png`.

The logo is **never** placed on the accent color. The mark may be reversed (paper on ink) for footers and dark surfaces.

---

## How to use this system

If you are a designer or agent generating a Sitebrief artifact:

1. Always link or inline `colors_and_type.css` — never hardcode hex values.
2. Use the type tokens (`--t-h1`, `--t-body`, etc.) rather than ad-hoc font-size declarations.
3. Pull components from `ui_kits/marketing/` or `ui_kits/dashboard/` rather than redrawing them — they are intentionally simple.
4. When in doubt about a missing token, choose the calmer option. Sitebrief whispers; it does not shout.

---

## Iteration asks (for the human reviewing this)

1. **Brand name.** "Sitebrief" is provisional. Confirm or replace.
2. **Accent color.** I picked a TYPO3-adjacent burnt orange as a knowing wink. Reasonable alternatives: a deep arrival green (#1F5C4E), a quiet ink blue (#1F3A6B). I can swap globally in 30 seconds.
3. **Display serif.** Fraunces is a defensible default. If the team prefers a sans-only system (more Linear-like, less editorial), I'll re-cut.
4. **Logo.** The mark is a starting sketch. Happy to iterate on 3–5 alternatives.
5. **Source assets.** If there is a real Figma, brand book, or codebase elsewhere, please attach — every stake in the ground here was driven by the project plan alone.
