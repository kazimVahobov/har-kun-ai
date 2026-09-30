# 0003 — Screen structure and background generation

- **Date:** 2026-09-29
- **Branch:** `chore/docs`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code

## Task

Write out the screen layout for phase 2: elements, states, keyboard, responsiveness. Along the way
new requirements arrived — a sidebar with a chat list and switching, an unobtrusive navbar holding
only the logo, and the model picker inside the composer. Plus a separate question from the owner:
what to do with generation if the user switches chats mid-stream.

## What was done

- `docs/ui-structure.md` — the full screen specification.
- `docs/adr/0011-background-generation.md` — the decision on background generation and the storage
  shape.
- Closed the open question from [0002](0002-design-system-and-adr.md): no `--color-danger`.
- The plan, the design-system document and `CLAUDE.md` reconciled with the sidebar: "several
  conversations" left "out of scope", the model picker moved from the header into the composer,
  `streams.ts` was added to the logic layer.

## Decisions taken

- **Generation is not interrupted when switching chats.** The user has already paid for that
  answer in waiting and in quota; cancelling it because they moved to another chat punishes normal
  behaviour. "Stop" stays an explicit action.
- **Errors carry no colour.** Nocturne has no role for errors and the system is mono. Meaning is
  carried by an icon, a heading and text — which works for colour blindness and in a screen
  reader.
- **The stream store lives outside the component tree.** A stream cannot be kept in component
  state: unmounting on a chat switch would kill it. In exchange, cleaning the map is manual.
- **Deleting a chat without a modal** — instead of a confirmation, five seconds of "Вернуть" in
  the status line. Undoing is cheaper than asking on every delete.
- **`Esc` with the mobile sidebar open closes the sidebar** rather than stopping generation.
  Two functions on one key is where surprising behaviour comes from, so the precedence is written
  down explicitly.

## Where the AI got it wrong

- **What it proposed:** the previous draft of the structure stated outright that there would be no
  sidebar with a conversation list, and "several conversations" sat in the plan's out-of-scope
  list.
  **How it was noticed:** the owner said a sidebar was needed.
  **How it was fixed:** the section was rewritten and the plan and ADRs reconciled. Honestly, this
  is not a model error but a narrowing of scope made without asking: I decided "one conversation
  is enough" myself and recorded it as a given, instead of raising it as a question.

- **What was nearly accepted on a false premise:** the owner's question tied background generation
  to having to write every character into `sessionStorage`, and from that it followed that
  background generation was best avoided.
  **How it was noticed:** by checking the premise. Rendering reads from memory, not from storage;
  storage exists only to survive a reload, and a reload kills `fetch` along with the page.
  Per-character writes would preserve the tail of a stream that is severed after a reload anyway.
  **How it was fixed:** background generation was accepted and the write policy left as it was —
  a 300 ms debounce plus a flush on terminal events and on `pagehide`. The analysis is recorded in
  ADR 0011 so nobody has to revisit it.

- **What it did:** while editing the plan, a Chinese character slipped into the Russian text —
  "мапа活ных потоков".
  **How it was noticed:** proofreading the diff before committing.
  **How it was fixed:** corrected before the commit. A small thing, but telling: generating across
  mixed languages occasionally drops stray characters, and a diff has to be read with your eyes
  rather than trusted because the text "looks right".

## What's left

- A tension worth keeping in mind: a chat list looks like something that ought to outlive the tab,
  and `sessionStorage` does not. The decision was deliberately left as it is (the assignment speaks
  of history "within the session", and privacy on a shared computer weighs more), but the README
  will state it.
- No cap is set on concurrent streams. If parallel requests reliably hit 429 against the live
  model, a queue will be needed; for now it is in "what's next".

## How to check

By reading: `docs/ui-structure.md` does not contradict `docs/design-system.md` (no picker in the
header, no colour on errors) or `docs/plan.md` (the sidebar is not listed as out of scope), and the
links between ADR 0008 and 0011 point both ways.
