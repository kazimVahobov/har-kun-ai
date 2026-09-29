# 0015 — Fixing the interface where a live model showed it up

- **Date:** 2026-09-30
- **Branch:** `fix/ui`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code, driven by review in Chrome against the live model

## Task

A round of corrections raised by the owner from the running app. Nothing here comes from `TASK.md`
directly; all of it comes from what a real model does that the mock never did — chiefly, making
the interface wait.

## What was done

Nine commits.

- **An answer stopped before its first character now says so.** It rendered as an empty block:
  with a Retry button if it was the last one, with nothing at all further up the conversation.
- **«Модель печатает» no longer appears before the model has typed.** «Ждём ответ» holds until the
  first character.
- **«Генерация остановлена» is gone from the status chip.** The other states are untouched.
- **The composer has room to write in** — two lines at rest, with distance between the field and
  the model picker.
- **A key map and a caveat under the frame**, centred: Esc / Enter / Shift+Enter as a list, and
  the line about answers being worth checking.

166 tests, unchanged: none of this is covered by them.

## Decisions taken

- **The waiting state needed no new state.** An assistant message with empty content while
  streaming *is* the wait. Adding a flag to the reducer for it would have been a second source of
  truth for something already unambiguous.
- **The blank-answer note is ours, not the model's** — italic, muted, 13px. At the answer's own
  15px it read as a very short answer, which is exactly the confusion it exists to remove.
- **Only the `stopped` chip goes.** «Ответ получен» and «Ошибка при генерации» are news — the
  person was not necessarily watching — while stopping is something they just did. The row keeps
  its reserved height so nothing shifts when the chip clears.
- **Esc is now listed even when nothing is streaming.** As a key map that is normal, but it does
  name a key that does nothing at that moment. Raised with the owner; left as asked.
- **The list marker is drawn, not typed.** A `•` in `content` gets read aloud, and the `<ul>`
  already tells a screen reader what these are.
- **Shift+Enter is the only hint that drops.** Not for width alone: a touch keyboard has no Shift
  to hold, so on exactly the screens where room runs out it names a key that is not there.

## Where the AI got it wrong

- **Fixed the same hint twice before fixing its cause.** «Enter — отправить» sat on the right,
  beside the send button, and vanished below 480px. First I moved it left and pinned it against
  shrinking; then the owner asked for the whole thing restructured and it became obvious that the
  hint never belonged inside that row at all — it was competing with the picker and the button for
  the one part of the composer that runs out of room first. Two commits of rescuing a thing from a
  place it should not have been. The tell was there the first time: needing `flex: 0 0 auto` to
  stop an element being crushed is a sign it is in the wrong container, not a sign it needs a
  stronger rule.

- **Left a comment describing a layout that no longer existed.** After moving the hints out of the
  frame, the footnote's font-size still said "below the hint size used inside the frame". Caught by
  grepping for the old class name before committing — which found the comment, not code. Comments
  do not fail a build, so they rot exactly where the code around them changed most.

- **Wrote a browser check that could not survive its own reload.** Seeding three chip states in one
  script meant calling `location.reload()` inside the evaluation, which kills the context the
  script is running in. It failed with "Inspected target navigated or closed" rather than a wrong
  answer, so it cost a minute rather than a false conclusion — but it is the second time a
  verification harness has been built without asking what it does to the thing it is measuring.

- **Wrote the previous report and never listed it.** `0014-openrouter.md` was committed without a
  row in this directory's index, and it stayed missing until this file needed one of its own. The
  index is how the README gets assembled in phase 4, so a report that is not in it is a report that
  does not exist for the only purpose it has. Both rows are added here.

- **Nearly did not measure the spacing at all.** The send button sat 6px from the last hint while
  the two hints kept 11px from each other; by eye it just looked slightly off. Measuring named it
  in one number. This is the round's one clear win for checking a layout with `getBoundingClientRect`
  instead of a screenshot.

## What's left

- **The 860px breakpoint is unverified on a real narrow viewport.** The resize tool reports success
  while the viewport stays at 1512 — unchanged since [0011](0011-styled-ui.md). What was checked
  instead: the rule compiles and targets the right hashed class
  (`._hintExtra_… { display: none }` inside `(max-width: 860px)`), which rules out a typo in the
  class name and nothing more. Narrowing the container tests the flex behaviour, not the media
  query. The same gap still covers 320px generally.
- **Esc listed while idle** — see above; the owner's call stands, noted in case it grates later.
- Carried over: the two border-colour questions from [0013](0013-ui-refinement.md).
- Phase 4, the README, and then the sidebar.

## How to check

```bash
npm test && npm run build    # 166 tests
npm run dev                  # :5173
```

The waiting status needs a live model to be visible at all — on the mock the first token arrives
too fast. With a key in `.env`, send a message and watch the chip: **Ждём ответ** → **Модель
печатает** → **Ответ получен**.

For the blank-answer note, stop an answer with `Esc` within the first moment, then send another
message so the interrupted one is no longer last: both blocks should read *Генерация прервана*,
and only the last one should offer Повторить.

Under the composer, at any width: the key list and the caveat centred on the frame's axis.
