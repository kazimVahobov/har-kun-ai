# 0004 — Checking the sidebar against the assignment

- **Date:** 2026-09-29
- **Branch:** `chore/docs`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code

## Task

Check whether support for several chats is mentioned in `TASK.md`, and decide what to do with the
sidebar if it is not.

## What was done

- `TASK.md` reread in full. There are no multiple chats in it: everything is singular —
  "одностраничный веб-чат", "диалог с моделью", "история диалога… она", "до первого сообщения".
  Nor is it forbidden — "структура проекта на ваш вкус".
- `docs/adr/0012-chat-sidebar-scope.md` — the sidebar stays, but is built as the last item of
  phase 2; the data shape is multi-chat from the start.
- The order within phase 2 fixed in `docs/plan.md`, a note added to `docs/ui-structure.md`,
  ADR 0011 given a link to 0012.

## Decisions taken

- **Move it rather than drop it.** The sidebar is permissible and lands in the "taste" criterion,
  but in none of the first four. One and a half to two hours out of a 2–6 hour budget spent on the
  fifth criterion is a bad trade if the first one suffers for it.
- **Multi-chat data shape from the start.** It costs almost nothing and removes the main risk of
  such a reordering: rearchitecting at the end, under time pressure.
- **The divergence is stated in the README.** Next to the `outline` pushback, but with the caveat
  that the cases differ: there we departed from the letter to serve the requirement's intent; here
  we added something that was not asked for.

## Where the AI got it wrong

- **What it did:** took "a sidebar for the chat list is needed" as a requirement and laid out the
  whole screen around it, without checking `TASK.md`. The specification grew a stream map, a
  drawer, a focus trap, `Esc` precedence, unread indicators, deletion with undo and quota
  eviction — none of which the assignment requires.
  **How it was noticed:** the owner asked whether the assignment mentions support for several
  chats.
  **How it was fixed:** the check, ADR 0012, and moving it to the end of the phase.

  The same mistake as in [0003](0003-ui-structure.md), with the sign reversed: there I **narrowed**
  scope without asking (deciding there would be no sidebar), here I **widened** it without
  checking the source. The shared root is one: scope changed silently instead of being checked
  against `TASK.md`. `CLAUDE.md` already says `TASK.md` outranks any summary — the rule existed
  and was not applied.

## What's left

- When writing the README, do not forget the paragraph on the divergence: several chats were added
  beyond the assignment, here is what for, and here is why they were built last.

## How to check

By reading: `docs/plan.md`, `docs/ui-structure.md` and ADRs 0011/0012 agree that the sidebar comes
last and that the data shape is multi-chat from the start.
