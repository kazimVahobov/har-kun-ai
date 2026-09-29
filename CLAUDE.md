# CLAUDE.md

Instructions for AI agents working in this repository.

## What this is

A single-page web chat with a language model. A take-home assignment for a frontend role.

**`TASK.md` is the source of truth for requirements.** It outranks this file, the plan, and any
summary of either. If you find a discrepancy, `TASK.md` wins — and the discrepancy gets stated,
not quietly smoothed over.

`TASK.md` is written in Russian. Do not translate it and do not edit it: it is the assignment
text as received.

Read before writing code:

- `docs/plan.md` — phased plan and the API contract.
- `docs/ui-structure.md` — screen layout, elements, states, keyboard map.
- `docs/design-system.md` — the Nocturne design system: tokens, components, how they map on.
- `docs/adr/` — decisions with their context and their cost.

## Stack

One `package.json` for the whole project.

| Layer | What |
|---|---|
| Front | Vite + React + TypeScript |
| Styling | plain CSS + CSS Modules, CSS custom properties |
| Back | Express, run through `tsx` |
| Tests | Vitest |

Layout:

```
shared/     platform-neutral code: the contract, the SSE parser. In both tsconfigs
server/     the proxy: /api/chat (SSE), /api/models. The key lives here and nowhere else
src/        the React app
  lib/      pure logic: chat reducer, storage — tests live next to it
docs/       plan, decisions, progress reports
```

## Language

This is the rule that drifts, so it is spelled out:

| What | Language |
|---|---|
| Code, identifiers, comments | English |
| Commit messages | English, short, imperative |
| Test names and descriptions | English |
| Server logs, developer-facing output | English |
| Documentation, README, this file | English |
| **Strings a person sees in the running app** — UI copy, error text | **Russian** |
| Conversation with the repository owner | Russian |

The exception is deliberate, not an oversight: the assignment arrived in Russian and will be
reviewed in Russian, so everything a human sees in the app stays Russian
([ADR 0005](docs/adr/0005-no-localization.md)). Everything a developer sees is English.

## Hard rules

Not style preferences — each of these breaks the assignment when violated.

1. **`OPENROUTER_API_KEY` never leaves `server/`.** Not in the bundle, not in `import.meta.env`,
   not in API responses, not in logs, not in error messages. The assignment is checked with the
   Network tab: the browser only ever talks to its own origin.
2. **`.env` is never committed.** The repository holds only `.env.example` with placeholders.
3. **`outline: none` without a matching `:focus-visible` is forbidden.** The assignment asks to
   remove the browser focus ring and, in the same document, requires full keyboard use. We satisfy
   the intent: the default ring goes, every interactive element gets its own visible ring.
   See [ADR 0007](docs/adr/0007-custom-focus-ring.md).
4. **The mock and the real adapter sit behind one contract**, described in `docs/plan.md`.
   Change the contract and you change both implementations and the document, in one commit.
   A contract that has drifted only surfaces when the live model is wired up — too late.
5. **No spinner is ever permanent, and a partial answer is never lost.** Every outcome — success,
   stop, error, timeout, dropped connection — moves the message to a terminal state and keeps the
   text received so far.
6. **Markup is semantic.** `<main>`, `<ol>`/`<li>`, `<form>`, `<label>`, `<button>`.
   Not a `div` with an `onClick`.
7. **No values outside the tokens.** No hex, no font name, no pixel value the Nocturne scale
   already carries — only `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`,
   `var(--font-*)`. A missing token is a reason to add a documented extension in
   `docs/design-system.md`, not a reason to inline a number.
8. **Never commit `nocturne/`.** It is a local design-system bundle excluded through
   `.git/info/exclude`. **Do not add it to `.gitignore` either** — `.gitignore` is committed.
   The source of truth for tokens in code is `docs/design-system.md`, which stands on its own
   without the bundle.

## Process

- **A branch per phase**, named like `feat/mock-server`, `feat/ui`, `docs/readme`.
- **Commit as you go, in meaningful steps.** One `done` commit for a whole phase is a red flag
  the assignment names explicitly.
- **The repository owner opens and merges pull requests. Agents do not.**
  Do not run `gh pr create`, `gh pr merge`, or push to `master`. Not even when a phase is clearly
  finished. An agent's job ends at commits on a branch.

## Reporting

When a task is done, write a report in `docs/progress/` following `_template.md`. The rules are
in `docs/progress/README.md`.

This is not paperwork. The assignment requires an honest AI log in the README: which tools were
used, **where the AI got it wrong, and how that was noticed and fixed**. None of that can be
reconstructed afterwards — it is either written down while it is fresh or it is lost. The README
section gets assembled from these files in the final phase.

Write honestly, dead ends included. A report saying everything went smoothly, about work where
something had to be redone, is worse than no report: it lies.

## Do not

- Do not edit `TASK.md`. It is the assignment as received.
- Do not add dependencies without need. Each new one is a decision to justify in a report.
  The assignment grades taste, not the ability to install packages.
- Do not change scope silently. Something worth doing beyond the task goes into "what's next",
  not into the diff.
- Do not present unfinished work as done. Running out of time is an acceptable outcome by the
  assignment's own terms — say so.
