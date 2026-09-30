# 0013 — A Cyrillic type set instead of Inter

- **Status:** accepted
- **Date:** 2026-09-29
- **Refines:** the type section of [`docs/design-system.md`](../design-system.md)

## Context

Nocturne is built on Inter, and the token file said so. Two things pushed against keeping it.

The project's own design guidance — `.claude/skills/frontend-design/SKILL.md` — names Inter
explicitly among the fonts to avoid, as a marker of generic, interchangeable interfaces. It also
asks for Cyrillic faces when the project is in Russian, which this one is: everything a person sees
in the app is Russian ([ADR 0005](0005-no-localization.md)).

And the interface had no voice. A dark chat set in Inter is indistinguishable from a dozen others;
nothing about it said *this* product. Inter's Cyrillic is competent and completely anonymous.

The counter-argument is real and worth stating: the type is part of the system we chose, and
changing it means Nocturne is no longer ported whole.

## Decision

Three roles instead of two, all self-hosted through `@fontsource`, all with Cyrillic subsets:

| Role | Face | Where |
|---|---|---|
| `--font-display` | **Unbounded** 400 | the mark, and the greeting on the empty screen |
| `--font-heading` | **Golos Text** 500 | headings, buttons, interface chrome |
| `--font-body` | **Golos Text** 400 | everything else |
| `--font-mono` | **JetBrains Mono** 400 | code in answers, error codes |

Unbounded is wide and loud — an asset in the two or three places an identity has to assert itself,
and wrong everywhere else. It never touches a button or a paragraph. Golos Text is a Cyrillic-first
face with warmth that Inter does not have, and it carries the interface without drawing attention.

**The palette stays.** Nocturne's ramps, elevation, density and accent are untouched: they were
derived in OKLCH on a shared lightness scale, and the blurple is a reasoned accent rather than a
stock gradient. The guidance warns against clichéd purple gradients; this is neither a gradient nor
a cliché, and replacing a considered palette to satisfy the letter of a rule would be worse work.

## Consequences

- The interface has a voice. The mark and the greeting are recognisably this product's and not a
  template's, which is what the "taste" criterion is looking at.
- Cyrillic is now set in faces designed for it rather than in one that merely supports it.
- Nocturne is no longer ported whole. What remains of it — and it is most of it — is the colour,
  the scales, the density, the component vocabulary and the signature devices. The document says
  so plainly rather than pretending otherwise.
- Three font families instead of one is more to download. Mitigated by importing only the four
  weights actually used and by the Cyrillic subsets being separate files that a Latin-only reader
  never fetches.
- One more risk worth naming: a display face this wide is unforgiving of long words. The greeting
  is two words by construction, and the mark is fixed, so both are safe — but `--font-display` must
  not spread beyond them.
