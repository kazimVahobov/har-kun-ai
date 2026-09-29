# Design system: Nocturne

The UI is built on **Nocturne** — a quiet, compact dark interface.

> **This document is the source of truth for the repository.** The original Nocturne bundle sits
> locally in `nocturne/` and **never enters git** (excluded through `.git/info/exclude`, not
> through `.gitignore`). Every token value is therefore written out here in full, rather than
> referenced from a file the reviewer will not have. If code and this document disagree, the code
> gets fixed, then the document.

## Character of the system

The things that must not be lost in translation:

- **A dark, desaturated ground.** Contrast comes from the tonal ramps, not from saturation.
- **One accent**, and it works as **a line and a glow, never a flood**. The scheme is mono:
  there is no second accent.
- **Buttons are outlined.** The primary action is an accent border on transparent, never a fill.
- **There are no dividers.** Sections are separated by whitespace from the spacing scale, not by
  rules or boxes. `.hr` exists, but the system asks you to avoid it.
- **It is dense.** Density 0.7× — the spacing is deliberately tighter than usual.
- **Headings are never bolder than 500.** Hierarchy here is size and space, not weight.
- **No pure black, no pure white.** Everything comes from the ramps. The exception is shadows:
  there, black is a shadow, not a colour.
- **Left-aligned, asymmetric layout.** Headings flush left, content hugs the left edge, whitespace
  stays on the right.

## Tokens

They go into `src/styles/tokens.css` and are imported once at the entry point. No hard-coded
colour, font, spacing or radius in components — only `var(--…)`.

### Colour

```css
--color-bg:      #161826;   /* the ground */
--color-surface: #232532;   /* a raised surface: cards, inputs */
--color-text:    #e9e9ed;
--color-accent:  #9184d9;   /* the only accent, a blurple */
--color-accent-2:#a7a1db;   /* mono scheme: reads as the accent, carries no separate role */
--color-divider: color-mix(in srgb, #e9e9ed 16%, transparent);
```

Tonal ramps run 100 (lightest) to 900 (darkest), generated in OKLCH on one shared lightness scale:
the same step of any role carries the same visual weight.

```css
--color-neutral-100: #f3f5fe;  --color-accent-100: #f5f4ff;  --color-accent-2-100: #f5f4ff;
--color-neutral-200: #e4e7f5;  --color-accent-200: #e7e5fe;  --color-accent-2-200: #e7e5fe;
--color-neutral-300: #cfd3e5;  --color-accent-300: #d2cefd;  --color-accent-2-300: #d2cefd;
--color-neutral-400: #b2b6ca;  --color-accent-400: #b5abfc;  --color-accent-2-400: #b5afe8;
--color-neutral-500: #9397ab;  --color-accent-500: #968ae0;  --color-accent-2-500: #9690c9;
--color-neutral-600: #75798c;  --color-accent-600: #796cbf;  --color-accent-2-600: #7972a9;
--color-neutral-700: #595d6c;  --color-accent-700: #5d5294;  --color-accent-2-700: #5c5783;
--color-neutral-800: #3f424d;  --color-accent-800: #423a6a;  --color-accent-2-800: #423e5d;
--color-neutral-900: #292b31;  --color-accent-900: #2b2741;  --color-accent-2-900: #2b293a;
```

How to use them on a dark ground:

| Steps | For |
|---|---|
| 700–900 | tinted fills, hovers, quiet borders |
| 500 | the role's base |
| 100–300 | text on those tints, pressed states |

Prefer ramp steps over an eyeballed `color-mix()`.

**An important limit:** the accent-to-ground pair is tuned to 3:1 — enough for icons, large text
and interface chrome, but **not for paragraph text**. Paragraph-size text in the accent uses
`--color-accent-300` instead.

The bundle's `--color-section*` tokens are for slides and landing pages, not interface colours;
this project does not use them.

### Type

```css
--font-heading: "Inter", system-ui, sans-serif;
--font-heading-weight: 500;
--font-body:    "Inter", system-ui, sans-serif;
```

Body text: `15px / 1.55`, weight 400. Headings: `line-height: 1.12`,
`letter-spacing: -0.015em`.

| Tag | Size | Note |
|---|---|---|
| h1 | 42px | |
| h2 | 32px | |
| h3 | 25px | |
| h4 | 20px | |
| h5 | 16px | |
| h6 | 13px | `uppercase`, `letter-spacing: 0.08em` |

Muted text is `color-mix(in srgb, var(--color-text) 55%, transparent)`.

### Spacing, radii, elevation

A 4px × 0.7 scale. Steps 5 and 7 do not exist in the system — do not invent them.

```css
--space-1: 2.8px;  --space-2: 5.6px;  --space-3: 8.4px;
--space-4: 11.2px; --space-6: 16.8px; --space-8: 22.4px;

--radius-sm: 4px; --radius-md: 8px; --radius-lg: 14px;

--shadow-sm: 0 0 0 1px #3f424d;
--shadow-md: 0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,0.55);
--shadow-lg: 0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,0.65);
```

On a dark ground, elevation is **an edge plus ambient darkness**, not a stack of shadows.
Do not layer them.

### States

All themed; no browser defaults anywhere:

```css
:focus         { outline: none; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
::selection    { background: color-mix(in srgb, var(--color-accent) 30%, transparent); }
[disabled]     { opacity: 0.45; cursor: not-allowed; }
```

This is exactly what settles the assignment's pushback: the browser ring is gone, but focus stays
visible and comes from the system rather than the browser. See
[ADR 0007](adr/0007-custom-focus-ring.md).

Hover and pressed states come from the accent ramp: on a dark ground, one step past the base is
`--color-accent-400`; outlined and ghost variants tint through `color-mix()`.

## The system's components

These classes port over as they are; do not invent parallel ones.

| Class | What | How the chat uses it |
|---|---|---|
| `.btn` + `.btn-primary` | accent outline, not a fill | "Отправить", "Повторить" |
| `.btn-secondary` | outlined in `--color-divider` | "Стоп", examples in the empty state |
| `.btn-ghost` | accent text, no border | deleting a chat, actions under an answer |
| `.btn-icon` | 36×36 | icon actions; `aria-label` required |
| `.btn-block` | full width | "+ Новый чат", buttons on mobile |
| `.input` | a field on the native element | the composer `textarea`, the model `select` |
| `.field` + `label` | label above the field, 12px | the composer wrapper |
| `.card` + `.card-*` | a surface-filled card | user message, error banner, active chat in the sidebar |
| `.tag` + `.tag-accent`/`-outline`/`-neutral` | small labels | model, status, error code |
| `.nav` + `.nav-brand` | the header | the "har kun ai" logo only, no bottom border |
| `.elev-sm/md/lg` | elevation utilities | |
| `.hr`, `.table`, `.dialog`, `.lighten` | — | not needed |

Buttons, fields, radios and the segmented control are built on native elements with no script:
focus, arrow keys and checked state work on their own. Do not replace them with `div`s — that
breaks both accessibility and the assignment's requirement for semantic markup.

### Icons

Phosphor (phosphoricons.com), inline SVG: `viewBox="0 0 256 256"`, `fill="currentColor"`, 14px in
a button with text, 16px in an icon button. We do not install the package — only a handful of
icons are needed (send, stop, copy, clear, warning, chevron), and they live in
`src/components/icons/` as small React components.

## Mapping onto the chat

Translated into a live interface, not copied from the prototype. The full screen layout is in
`docs/ui-structure.md`; only what concerns the system is here.

- **Header** — `.nav`: just `.nav-brand` "har kun ai" in lowercase. No bottom border, no shadow:
  `.nav` already ships with `border-bottom: none`.
- **Chat sidebar** — on the same `--color-bg` as the conversation, with no rule between them.
  The active chat gets a `--color-surface` fill and a solid 2px accent mark on the left.
- **User message** — a `.card` on `--color-surface`, pushed right, at most 75% wide.
- **Model message** — **no fill**, straight on the ground, with a solid 2px accent mark on the
  left. This is the system's own idiom: rules fade at their ends, while short accent marks stay
  solid. Flooding an answer with the accent is not allowed — the accent is not a fill.
- **Composer** — one `.input` frame holding a `textarea` that grows to ~6 rows, with a row beneath
  it carrying the native model `select` on the left and the primary button on the right. During
  generation "Отправить" is replaced by "Стоп" (`.btn-secondary` + icon).
- **Empty state** — left-aligned: an h3, a muted line beneath it, three example prompts as
  `.btn-secondary`.
- **Typing indicator** — three `--color-accent` dots, pulsing; under `prefers-reduced-motion` it
  becomes static text.
- **Error** — a `.card` with a plain-language line, a `.tag-outline` carrying the code, and a
  `.btn-primary` retry.
- **Separate messages with air** (`--space-6`), not with rules — the system has no dividers.

## Extensions to the system

Nocturne was built for prototype pages and lacks a few things a chat needs. We add them
**explicitly and here**, so they do not later read as freelancing and drift.

1. **`--font-mono`** — the system has no monospace token, and model answers render as markdown
   with code. We add `ui-monospace, "SF Mono", Menlo, monospace` — exactly what the bundle's demo
   pages use. A code block is `--color-surface` + `--radius-md` + `--shadow-sm`, scrolling
   horizontally inside itself rather than on the page.

2. **Markdown scale inside a message.** The system's h1 is 42px; in a chat reply that is absurd.
   Inside a message the scale drops: h1→20px, h2→17px, h3→16px, then 15px, weight still 500.
   The tokens are untouched; the override is local.

3. **Breakpoints.** The prototypes have fixed viewports; the system carries no responsiveness.
   We add two: `640px` and `1024px`. The conversation container is `min(760px, 100%)`, aligned
   left per the system's direction. The lower support bound is 320px.

4. **Motion tokens** — also absent. `--dur-fast: 120ms`, `--dur-base: 200ms`,
   `--ease: cubic-bezier(0.2, 0, 0, 1)`; globally disabled under `prefers-reduced-motion: reduce`.

5. **No error colour — decided.** The system is mono and explicitly asks to keep chroma low
   outside the accent; it carries no role for errors, and we do not add a `--color-danger`.
   An error is carried by a warning icon, a heading, text and a `.card` — which is what works for
   colour blindness and in a screen reader, where there is no colour at all. Colour should never
   be the sole carrier of meaning; here it carries none.

## Font

The bundle pulls Inter through an `@import` from Google Fonts. We self-host it instead, through
`@fontsource/inter`, importing the two weights the system actually uses — 400 for body and 500 for
headings, since Nocturne forbids going bolder.

The reason is specific to this assignment rather than general: it says the Network tab will be
checked. A `<link>` to a font CDN fills that tab with third-party requests — not a violation, but
noise in exactly the check being run. Self-hosting leaves only own-origin requests there. It also
removes a render-blocking external request and stops handing the user's address to Google.

The cost is one dependency, which `CLAUDE.md` asks to justify; the above is the justification.

The `system-ui` fallback is already in the token: if Inter fails to load, the interface does not
fall apart.

## Do not

- Do not flood large areas with the accent. The accent is a line, a mark, a glow.
- Do not invent values outside the tokens: no hex, no pixel the scale already carries.
- Do not draw a rule where whitespace will do.
- Do not push headings past weight 500.
- Do not stack shadows.
- Do not use the accent for paragraph text — use `--color-accent-300`.
