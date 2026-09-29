# 0015 — A contents rail for the conversation

- **Status:** accepted
- **Date:** 2026-09-29
- **Related:** [0014](0014-opens-on-the-day.md) — the day scale it borrows its language from

## Context

Once a conversation runs past a screen or two, the only way back to something asked earlier is
scrolling and reading. The questions are the landmarks — people remember what they asked, not how
the model phrased the reply — and nothing in the interface uses them.

The right margin has been empty since the conversation was centred. The left carries the day scale.
Putting the contents opposite it balances the composition and costs the main column nothing.

**The trap worth naming before writing any of it:** the obvious shape is a proportional minimap, an
editor's scrollbar overview, where an item sits at the position its message occupies in the log.
That fails as the conversation grows. Items bunch, then overlap, then become too small to hit —
exactly when a long conversation is when you need them. A contents list is not a map.

## Decision

A rail in the right margin, one item per **user question**, appearing with the first message.

- **Fixed rhythm, not proportional.** Every item gets the same height and the same gap, so a tap
  target never shrinks no matter how long the conversation runs. Position in the rail means order,
  not offset.
- **The rail scrolls when it overflows**, with the fade moved to the container's edges through a
  mask. Nocturne's rules fade at their ends; on a scrolling list the ends are the viewport's, not
  the content's, so the signature has to follow the frame rather than the items.
- **Questions only, not answers.** Answers are long and interchangeable as labels; the question is
  what someone is looking for.
- **Clicking scrolls the question into view**, smoothly unless motion is reduced, and hands
  following back to the user — the log stops sticking to the bottom the moment it is scrolled away
  from, which is already how autoscroll behaves.
- **The item in view is marked in the accent**, so the rail says where you are and not only where
  you could go.
- **Same visual language as the day scale, different grammar.** Both are a vertical line fading at
  its ends with marks along it. The left is a **scale**: position means time, and the ticks are
  hours. The right is a **list**: position means order. They are deliberately alike to read as one
  system, and this difference is the thing a reader could get wrong.

## Consequences

- A long conversation gains a way back that adds no chrome to the column people are reading.
- The two rails resemble each other and mean different things. Someone may read the right one as a
  position map and be surprised that item spacing does not track scroll distance. Mitigated by the
  right rail carrying text labels while the left carries hours — but it is a real ambiguity, chosen
  deliberately for the sake of one visual language.
- Below 1024px there is no margin to put it in and the rail is absent. Navigating a long
  conversation on a phone stays scrolling-only. Not solved here.
- Every question adds a tab stop between the log and the composer. The skip link already exists for
  exactly this, and it is why it exists.
- Labels are truncated to one line, so three questions beginning "Помоги…" look alike. The full
  text is the accessible name and the hover title; the ambiguity survives for a sighted user
  skimming.
- Tracking the item in view needs an `IntersectionObserver` over the user messages, re-established
  whenever the list changes — one more subscription to tear down, and one more thing that is wrong
  if it leaks.
