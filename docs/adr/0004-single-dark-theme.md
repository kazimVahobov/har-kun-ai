# 0004 — One theme: Nocturne dark, no toggle

- **Status:** accepted
- **Date:** 2026-09-29

## Context

The assignment calls a dark theme a nice bonus, not a requirement. The UI is built on the
ready-made **Nocturne** design system — and that system is dark by nature, not a "dark variant"
of something light: its contrast comes from tonal ramps, its elevation is an edge plus ambient
darkness, its images blend into the ground through `mix-blend-mode: lighten`.

A light variant of this system does not exist. It would have to be derived — and what came out
would not be Nocturne, but a guess at how it might look on a light ground.

## Decision

One theme, dark. No toggle, no `prefers-color-scheme` handling.

The tokens sit in `:root` with no second set and no `[data-theme]`. The naming does not preclude
adding a theme later: every value already lives in a variable, and no component hard-codes
anything.

## Consequences

- No time spent on a second palette and — more to the point — none spent debugging it. Two token
  sets mean checking contrasts, shadows and states twice.
- The system is ported honestly rather than halfway.
- A user who prefers light gets no choice. That is common behaviour for a chat with a model, but
  it is still a limitation, not a feature.
- Printing a page on a dark ground looks bad. Not addressed: a chat has no printing scenario.
- A light theme goes into the README under "what I'd do next". Thanks to the tokens it is hours of
  work, not a rewrite.
