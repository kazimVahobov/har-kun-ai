# 0007 — Our own focus ring instead of the browser's: the assignment pushback

- **Status:** accepted
- **Date:** 2026-09-29

## Context

The assignment contains two requirements that contradict each other.

> Accessibility: the interface can be used entirely from the keyboard — Tab through elements,
> Enter sends, Esc stops generation.

> Remove the browser's default focus outline (`outline`) from buttons and the input field — it
> looks inconsistent across browsers and spoils a tidy look.

Taking the second one literally kills the first. The focus ring is the only thing showing where
you are during keyboard navigation. Without it, Tab moves blind: pressing Enter submits you don't
know what.

The assignment invites exactly this kind of objection:

> If a requirement seems wrong, harmful, or contradictory to you — don't follow it silently.
> Write in the README what you did differently and why.

The reasoning behind the second requirement is stated honestly: inconsistency across browsers
spoils the look. That is a real problem — the default ring genuinely differs everywhere. The
problem is with the proposed cure, not with the diagnosis.

## Decision

We satisfy the intent rather than the letter: the browser `outline` goes, but every interactive
element gets its own ring, identical across browsers, supplied by the design system.

```css
:focus         { outline: none; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
```

`:focus-visible` is precisely the distinction the requirement's wording lacked: the ring does not
appear on a mouse click and does appear on keyboard navigation. The tidy look is preserved for the
mouse path; the keyboard path is not broken.

This is not a workaround — it is how Nocturne is built in the first place: the system explicitly
requires not leaving the browser's blue ring and defines its own. So nothing here is invented.

Special cases: the input highlights its border instead of taking a ring
(`.input:focus-visible { border-color: var(--color-accent); outline-offset: 0 }`) — the field is
already framed, and a second ring outside it would be noise.

This goes into the README as its own paragraph: what was done differently, and why.

## Consequences

- Both requirements are met, neither is broken. Cross-browser inconsistency is gone — which is
  what was wanted.
- `:focus-visible` is not polyfilled CSS; in very old browsers no ring appears on Tab. The project
  already requires `color-mix()`, `:has()` and `100dvh`, so this decision is not what sets the
  support floor.
- There is a risk a reviewer reads the requirement literally and marks it unmet. Mitigated by
  explaining the divergence in the README rather than leaving it to be guessed — which is what the
  assignment asks for.
