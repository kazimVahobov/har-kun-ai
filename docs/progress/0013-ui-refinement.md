# 0013 — Refining the interface against a real screen

- **Date:** 2026-09-29
- **Branch:** `feat/ui`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code, driven by review in Chrome

## Task

A run of corrections, each prompted by looking at the actual screen rather than at the spec:
composition, the day scale's legibility, a contents rail, and a series of small defects that only
showed up when the pixels were in front of us.

## What was done

Nineteen commits. The substantial ones:

- **The conversation is centred**, and the asymmetry moved to the left margin where the day scale
  lives. Flush left had put the conversation in the corner of a wide monitor.
- **The day scale became readable** — hour ticks, a label every six hours, and the clock beside the
  mark. It was a line showing a position with nothing to read it against.
- **A contents rail** in the right margin, one item per question, with fixed rhythm and its own
  scrolling ([ADR 0015](../adr/0015-contents-rail.md)).
- **The mark is Har Kun**, capitalised and larger; the date sits beside it and nowhere else.
- **The starters became cards** carrying a kind of work, the request, and what comes back.
- **A thin border closes an answer when it finishes** — a state rather than decoration, which is
  the only reason this system tolerates a box.
- **Copy is always visible, on the right**; the retry row matches it.
- **The status became a chip** above the composer instead of loose text beside it.
- **The clock ticks on the minute**, and the retry wait counts down from a moment rather than a
  duration, so it survives a reload.
- **The client's `?simulate=` forwarding is gone.** It was the only thing on the client that
  existed for the mock's sake.

128 tests.

## Decisions taken

- **Centring departs from Nocturne's stated direction, and the docs say so.** The system wants
  content hugging the left edge; on a wide monitor that read as an unfinished layout rather than as
  an opinion. The asymmetry survives where it earns its keep.
- **The contents rail has fixed rhythm, not proportional placement.** A minimap bunches its items
  as a conversation grows and stops being clickable exactly when it becomes useful.
- **The answer's border is drawn only when the answer is complete.** Drawn at both times it would
  say where the answer ends and nothing about whether it has — which was the actual ambiguity.
- **`failedAt` lives on the message, not inside the error.** `ApiError` is the contract's type and
  has no business carrying a client's bookkeeping.
- **Removing the client's mock affordance costs something**, and it is worth stating: error states
  can no longer be triggered through the interface, only with curl against the server.

## Where the AI got it wrong

- **Chased a bug that did not exist.** Twice a retry appeared to fire on its own — a `rate_limited`
  message turned up as `done` with real generated text, and a countdown restarted mid-observation.
  I seeded a clean state, could not reproduce it, and said so rather than inventing an explanation.
  The answer arrived when the owner asked what happens on clicking retry: the browser is theirs,
  and they had been clicking it. The lesson is not "check for user input" — it is that an
  unreproducible anomaly deserves *no* story until it reproduces, and I nearly wrote one.

- **One utility, three defects, one root.** `.visually-hidden` escaped the scrolled log and gave the
  window a scrollbar; then it was selectable, so copying an answer picked up the author label and
  pasted "Модель" into the next question; then, as an inline `<label>`, it ignored `height` and
  rendered 18px tall, quietly padding the composer. Each was found separately and fixed separately
  before the pattern was visible: "hide visually, keep it available" is not one property but a set
  of constraints, and each one surfaces in its own context.

- **Moved the wrong element.** Asked to align the model picker with the placeholder, I dragged the
  picker left by its own inset — which pushed its box outside the frame's padding, hard against the
  border, visible the moment it took focus. The field should have been padded instead. When two
  things need aligning, move the one without a visible edge.

- **The `IntersectionObserver` did not survive contact.** It reports *changes* in intersection, so
  with a long answer filling the screen nothing intersected the band and the rail kept pointing at
  the first question while the sixth was on screen. Recorded in ADR 0015 as an amendment rather
  than an edit, because what happened to it is the useful part. Underneath it, throttling the
  replacement through `requestAnimationFrame` made the rail stop tracking in a background tab —
  rAF does not run there.

- **Wrote a verdict that could not tell two outcomes apart.** A check for the retry countdown
  treated "no wait label" as a regression, when it also means "the wait expired" — and my own tool
  round trips had eaten the remaining seconds. I briefly believed I had broken it. The fix was to
  build the check so the two cases cannot be confused: a deliberately long wait, half of it already
  elapsed.

- **A test expectation wrong again**, in `summarise`: at a 30-character budget the word "потоковая"
  does not fit, so it is dropped whole rather than half-shown — correct behaviour, wrong
  expectation. That is the fourth time; the pattern is writing down what I wanted to see instead of
  deriving it from the inputs.

## What's left

- **320px is still unverified.** Unchanged since [0011](0011-styled-ui.md): the resize tool reports
  success while the viewport stays at 1512.
- **Border colours differ where the token does not.** `--color-divider` is translucent, so the same
  token renders rgb(56,57,70) on the answer and rgb(67,68,80) on the composer, which sit on
  different grounds. The error card draws its edge with `--shadow-sm` — an elevation token used as
  a divider, which is a semantic mix-up worth correcting. Raised with the owner, undecided.
- **Retry appears only on the last message**, so an identical error card earlier in the conversation
  has no button. Deliberate ([ADR 0015](../adr/0015-contents-rail.md) reasoning, via 0012) but it
  reads as an inconsistency.
- Phase 3, the live OpenRouter adapter, is still the outstanding functional requirement.

## How to check

```bash
npm test && npm run build    # 128 tests
npm run dev                  # :5173
```

By eye, the things this round changed: the conversation sits centred with the day scale in the left
margin and the contents rail in the right; an answer closes with a border when it finishes; the
status is a chip above the composer; the model picker and the placeholder start on the same
vertical.

Error states now need the server directly, since the page no longer forwards the flag:

```bash
curl -sN -X POST 'localhost:8787/api/chat?simulate=mid-error' \
  -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"hi"}]}'
```
