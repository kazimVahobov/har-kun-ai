# 0002 — Nocturne design system and ADRs

- **Date:** 2026-09-29
- **Branch:** `chore/docs`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code

## Task

Add a `.gitignore`, study the Nocturne design system and write it out into a document the agent
will build the UI from, then record the decisions taken as ADRs.

A separate condition: the `nocturne/` bundle itself must reach neither git nor `.gitignore`.

## What was done

- `.gitignore` — dependencies, build output, secrets, editor files.
- `nocturne/` excluded locally through `.git/info/exclude`. That file lives inside `.git/` and is
  never committed — exactly what was asked for: the bundle appears neither in history nor in the
  list of ignored paths.
- `docs/design-system.md` — Nocturne written out in full: every ramp, the type scale, spacing,
  radii, shadows, states, component classes and how they map onto the chat interface.
- `docs/adr/` — ten decisions and a register.
- The plan and `CLAUDE.md` reconciled with the system: the dark theme moved from "out of scope"
  to being the only theme; rules added about tokens and about `nocturne/`.

## Decisions taken

- **The design-system document stands on its own** — every token value written out literally
  rather than referenced from a bundle file. The reviewer will not have the bundle, and a document
  that cannot be read without it is useless.
- **Extensions to the system are stated explicitly** — Nocturne was built for prototype pages and
  a chat needs four things it lacks: a monospace token (model answers are markdown with code), a
  heading scale inside a message (the system's h1 is 42px, absurd in a chat reply), breakpoints
  (the prototypes have fixed viewports) and motion tokens. All of it goes into its own section of
  the document so it does not later read as drift.
- **The error colour was left an open question.** The system is mono and explicitly asks to keep
  chroma low outside the accent; it has no role for errors. By default an error is carried by an
  icon, text and a card rather than colour; the alternative is a single `--color-danger` at the
  accent's OKLCH lightness. The second path departs from the system's character and deserved
  confirmation rather than being slipped in.
- **ADRs as separate files rather than one list** — each decision's "Consequences" section records
  its price. In a summary table that section simply disappears, and it is exactly what explains
  why the decision is what it is.

## Where the AI got it wrong

- **What it proposed:** at the stack-selection stage — inventing a palette from scratch, down to
  specific values (a warm orange accent `#c4633a` on a light ground) and a focus ring through
  `box-shadow`.
  **How it was noticed:** the owner dropped the finished Nocturne bundle into the project — a dark
  system with its own blurple accent and focus through a real `outline`.
  **How it was fixed:** everything invented was discarded and the document written from the
  system. A concrete lesson: ask about existing design assets **before** proposing tokens, not
  after.

- **What it proposed:** the first draft of the plan put the dark theme in "out of scope", as an
  optional bonus from the assignment.
  **How it was noticed:** while porting Nocturne — it is dark by nature and has no light variant.
  **How it was fixed:** the theme became the only one, with `docs/plan.md` and `CLAUDE.md` fixed
  in the same commit. [ADR 0004](../adr/0004-single-dark-theme.md) was written so the decision does
  not read as an accident.

- **What it nearly did:** the reflex when excluding a directory is to add `nocturne/` to
  `.gitignore`. That is exactly what the owner forbade, and the prohibition is sound: `.gitignore`
  is itself committed, so the bundle's name would have ended up in the repository anyway.
  **How it was fixed:** `.git/info/exclude`. The exclusion works locally and is never published.

## What's left

- Confirm how errors are shown: strictly by the system (no colour) or with a `--color-danger`
  added. Until answered, phase 2's UI follows the first option.
- The font decision is recorded in the document (a `<link>` with `preconnect` instead of
  `@import`) but did not get its own ADR — too small for one, although it is an external request.

## How to check

```bash
git status --short              # nocturne/ does not appear
git check-ignore -v nocturne/   # the source is .git/info/exclude, not .gitignore
grep -r nocturne .gitignore     # empty
```

Plus by reading: the token values in `docs/design-system.md` match `nocturne/project/styles.css`,
and the links between ADRs are not broken.
