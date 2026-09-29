# 0014 — The empty screen opens on the day

- **Status:** accepted
- **Date:** 2026-09-29

## Context

The assignment asks explicitly what a person sees before the first message: "Пустое состояние:
продумайте, что человек видит до первого сообщения." What they saw was a heading reading
"Чат с языковой моделью" and three prompts about Server-Sent Events and `AbortController` — a
description of the category, and a developer demo at that. Nothing in it belonged to this product
rather than any other.

The product is called **har kun** — Uzbek for "every day" — and is meant to be an everyday
assistant. That was stated in a subtitle and expressed nowhere.

The project's design guidance asks the harder question: what makes this memorable, and what is the
one thing someone will recall afterwards. A subtitle is not an answer.

## Decision

The empty screen shows **today** instead of explaining the app.

- **A greeting that follows the hour** — morning, afternoon, evening, night — and the date written
  out in Russian.
- **Starters that belong to that hour.** What the screen offers at 8am (collect the day's tasks,
  prepare for a meeting) is not what it offers at 11pm (explain this simply, note this down before
  I forget). This is the load-bearing part: it turns "assistant for every day" from a claim into
  behaviour the interface performs.
- **The day drawn as one line** — Nocturne's fading rule used for what it actually means, with a
  solid accent mark placed by the real local clock. The system's own grammar says freestanding
  rules fade while short accent marks stay solid, so the device is the system's, not an import.
  Return an hour later and the mark has moved.
- **One rule, two placements.** Vertical down the right margin where there is margin to spare,
  horizontal in the column where there is not — never both. On a wide screen this also gives the
  asymmetric empty right side a reason to exist instead of reading as an unfinished layout.

`src/lib/daytime.ts` is a pure function of a `Date`; the clock is read in a hook. That keeps the
boundaries — midnight, 05:00, noon, 18:00, 23:00 — testable without faking time.

## Consequences

- The screen is this product's and not a template's, and it is different at 8am and at 11pm, which
  is the point.
- The interface now depends on the clock. That brings real costs: a re-render every minute, and a
  wrong or deliberately shifted system clock makes the mark and the greeting lie. Neither is worth
  defending against here — the failure is cosmetic and the user's own machine caused it.
- The starters are a fixed editorial set of twelve lines. They will age, and they are Russian-only
  by construction ([ADR 0005](0005-no-localization.md)). Rotating them from the model's own
  suggestions would be better and is not worth a request on an empty screen.
- **The day rule is decorative and hidden from assistive technology.** A blind user gets the
  greeting and the date as text and nothing else — which is the correct trade, since a line whose
  whole content is its position cannot be read aloud usefully. It does mean the screen is quieter
  for them than it looks.
- Time-of-day logic is one more thing a reviewer must trust is correct at the boundaries. Covered
  by 16 tests for exactly that reason.
