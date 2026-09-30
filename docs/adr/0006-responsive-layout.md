# 0006 — Responsive from 320px, mobile-first

- **Status:** accepted
- **Date:** 2026-09-29

## Context

From the assignment: "comfortable to use on a phone, nothing overflows". For a chat this is not
cosmetic — messaging a model from a phone is a normal scenario, not an exception.

Nocturne, meanwhile, carries no responsiveness: the bundle's prototypes are laid out for fixed
viewports and the system has no breakpoints. They have to be introduced here, as a documented
extension rather than freelancing.

Mobile chats break in predictable places, and those are worth naming before any markup: the
on-screen keyboard eats half the height, `100vh` lies in mobile browsers, and long links and code
blocks in model answers push the page sideways.

## Decision

Mobile-first: base styles target a narrow screen, breakpoints only go up.

- Two breakpoints: **640px** and **1024px**. Lower support bound: **320px**.
- The conversation container is `min(760px, 100%)`, aligned left per the system's direction.
- Height uses `100dvh`, not `100vh`: the dynamic unit accounts for a collapsed browser bar, the
  static one leaves the composer underneath it.
- The composer is pinned to the bottom, with safe insets through `env(safe-area-inset-bottom)`.
- A message is at most 75% wide on a wide screen and full width on a narrow one.
- Anything that could push the page sideways scrolls **inside itself**: code blocks get
  `overflow-x: auto`, long words and links get `overflow-wrap: anywhere`. The page never scrolls
  horizontally.
- Tap targets are at least 40px and the input's `font-size` is at least 16px — otherwise iOS
  Safari zooms the page on focus.

## Consequences

- Checking now means three widths instead of one; a 320px pass is on the phase 2 checklist.
- Nocturne's density (0.7×) is in places too tight for a finger on a phone. We allow exactly one
  deviation: enlarged tap targets on the composer buttons, through padding rather than a new font
  size.
- `100dvh` is unsupported in very old browsers. The `100vh` fallback before it is one line.
