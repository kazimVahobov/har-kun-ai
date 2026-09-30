# 0001 — Agent instructions, work plan, report structure

- **Date:** 2026-09-29
- **Branch:** `chore/docs`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code

## Task

The repository was empty: one commit holding `LICENSE`, a three-line `README.md` and `TASK.md`.
Before any code, the documentation that agents would work from had to be fixed: working rules, a
phased plan, and a report format.

There is deliberately no code in this task.

## What was done

- `CLAUDE.md` — agent instructions: stack, structure, hard rules (the key never leaves `server/`,
  `.env` is never committed, `outline: none` without `:focus-visible` is forbidden, mock and real
  adapter behind one contract), process, the requirement to write a report.
- `docs/plan.md` — a four-phase plan and the API contract: SSE event shapes, two forms of error,
  cancellation behaviour, timeouts. Plus a table of decisions taken, the assignment pushback, and
  an explicit out-of-scope list.
- `docs/progress/` — a `README.md` with the rules, `_template.md`, and this report.

## Decisions taken

- **Mock server before the live model** — the first grading criterion is edge handling (429,
  timeout, dropped connection), and against a live free model those states are not reproducible:
  waiting for a 429 to happen on its own is not a check. The mock serves them from a query
  parameter. The cost is that the contract has to be written before both implementations and kept
  in sync; hence its own section in the plan.
- **Normalised SSE instead of piping the upstream** — once headers are sent the HTTP status cannot
  change, and an error mid-generation happens regularly. Our own `error` event in the stream is the
  only way to deliver it.
- **The contract lives in the plan, not in a separate document** — at this size a third file to
  keep in sync would drift sooner than it would help.
- **A mandatory "where the AI got it wrong" field in the report template** — the assignment
  requires an honest AI log, and it cannot be reconstructed afterwards. A field that cannot be
  dropped forces recall while it is fresh.
- **Reports are not rewritten after the fact** — otherwise by the end of the work they would
  describe how nicely everything turned out, and the AI log would lose its point.

## Where the AI got it wrong

- **What it proposed:** the first plan went straight at the live OpenRouter — the UI would have
  been written against a real stream, and error states checked whenever they happened to appear.
  **How it was noticed:** the owner reversed the order of work.
  **How it was fixed:** the plan was rewritten mock-first, with the contract moved ahead of both
  implementations. A side effect emerged: the project then runs with no key at all — which is
  stronger than the original, not merely different.

- **What it proposed:** the plan assumed all phases would be implemented in one go.
  **How it was noticed:** the owner asked whether I intended to build everything at once.
  **How it was fixed:** the work was split into phases with checkpoints; this session's scope
  narrowed to documentation.

- **What it proposed:** among the styling options I showed an example with a dark theme, although
  the owner had excluded a dark theme from the bonus scope.
  **How it was noticed:** while reconciling the selected options against what was going into the
  plan.
  **How it was fixed:** the dark theme moved into "out of scope" and into the README's
  "what's next".

## What's left

- The default `:free` model in phase 3 gets chosen from the live OpenRouter catalogue at
  implementation time. It must not be written from memory: the free-model catalogue changes, and a
  stale id returns a 404 instead of an answer.
- `OPENROUTER_API_KEY` is only needed by phase 3. Phases 1 and 2 run without secrets.
- The repository has no `.gitignore` yet (`node_modules`, `dist`, `.env`, `.idea`) — it arrives
  with the project scaffold in phase 1.

## How to check

There is no code, so checking means reading:

- `CLAUDE.md` does not contradict `TASK.md`; the rules are phrased so that breaking them is
  visible.
- The contract in `docs/plan.md` is described well enough for the mock and the real adapter to be
  written against it independently.
- `_template.md` can be filled in without guessing.
- No secrets in any file.
