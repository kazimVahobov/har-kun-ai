# 0017 — The README, written late and reported later still

- **Date of the work:** 2026-09-30 · **Date of this report:** 2026-09-30, after [0016](0016-assignment-audit.md)
- **Branch:** `chore/docs` (PR #9)
- **Status:** done — the phase; late — the report
- **Tools:** Claude Opus 5 in Claude Code, driven by the repository owner

> **This report breaks the rule next door.** `README.md` in this directory says a file is not
> written after the fact, because a reconstruction is not a record. The audit in
> [0016](0016-assignment-audit.md) found this phase had no report and left the gap alone for
> exactly that reason; the owner asked for it to be filled anyway. So it is filled — and labelled.
>
> What follows is reconstructed from commit `ec54379`, its message and its diff, not from the
> session that produced it. The "what was done" and "decisions" sections are reliable, because they
> are visible in the diff. The mistakes section is the one that suffers: it holds what can be
> proven from the repository, and whatever went wrong in the room and was fixed within the hour is
> gone. That is the cost the rule exists to prevent, and this file is what it looks like.

## Task

Phase 4 of [`docs/plan.md`](../plan.md): the README the assignment asks for — running it locally in
five minutes, the key decisions and why, the `outline` pushback, the AI log assembled from the
progress reports, and what would come next given another day.

The README at that point was two phases out of date. It still opened with "Work in progress. The
mock server and the streaming core are in; the UI is next" and told the reader no OpenRouter key
was needed because the live model was not wired up yet — by then it had been for two phases.

## What was done

One commit, 248 lines added against 25 removed. The file went from a stub to the document the
assignment grades:

- **Running it**, in both modes, with the boot log quoted so a reviewer can tell which mode they
  are in. The point made early and plainly: it runs with no key at all, so nobody has to create an
  OpenRouter account to see the thing work.
- **Key decisions**, five of them, each pointing at the ADR that carries its cost rather than
  repeating it. The key on the server, our own SSE shape, the mock, `sessionStorage`, the fetched
  model catalogue.
- **The reload question answered and argued.** The assignment leaves it open and asks for a
  reason; `sessionStorage` gets a paragraph rather than a mention.
- **The pushback on `outline`** stated in full, as its own section with both quoted requirements
  and the CSS that settles them — because a reviewer reading that requirement literally would
  otherwise mark it unmet.
- **The AI log**, assembled from the reports that existed: the mistakes worth generalising, each
  linked to the report holding the detail, plus what the model was good at and what it needed a
  human for.
- **What's next**, leading with the one requirement that could not be claimed — 320px has never
  been checked on a real viewport.

## Decisions taken

- **The AI log summarises rather than concatenates** — each entry is a mistake generalised to the
  lesson, with a link to the report that has the specifics. Given up: a reader who wants the blow
  by blow has to follow a link.
- **The pushback gets its own section, not a line in a list** — it is one of the five things the
  assignment says it grades, and burying it inside "decisions" would have been the wrong weight.
- **"What's next" opens with the unverified requirement rather than the best idea.** An honest list
  starts with what is missing, not with what would be nice.

## Where the AI got it wrong

Three, all of them found later by the audit in [0016](0016-assignment-audit.md) rather than during
this phase — which is itself the finding:

- **What it proposed:** that the work took 73 commits, and that everything configurable was
  documented in `.env.example`.
- **How it was noticed:** the audit counted. The history held 75 commits at the moment that line
  was written, and `env.ts` read two settings — `KEEPALIVE_MS` and `OPENROUTER_BASE_URL` — that
  `.env.example` never mentioned. Both are the same failure: a claim about the repository written
  from memory instead of from the repository, in the one document whose whole value is that it can
  be trusted.
- **How it was fixed:** counted and corrected in 0016, and the two settings documented.

- **What it proposed:** finishing the phase at the commit.
- **How it was noticed:** nothing noticed it. PR #9 went up with an empty description, and no
  report was written — in the phase whose entire subject is that the process should be legible.
  The audit found both, a day later and by reading the pull request list.
- **How it was fixed:** the description is the owner's to add; the report is this file, and it is
  worth less than it would have been.

## What's left

- The 2–6 hour budget went unmentioned in the README when it should have been named there. Added in
  this branch, alongside this report — see the "time budget" section.
- PR #9 still has no description. Not something a commit can fix.

## How to check

```bash
git show ec54379 --stat        # the phase, in one commit
```

Every relative link in the README resolves — the ADRs it cites exist under `docs/adr/`, and the
report links under `docs/progress/`. The focus CSS quoted in the pushback section still matches
`src/styles/system.css`. `npm run build && grep -ril "openrouter\|bearer" dist/` finds nothing,
which is the claim that section makes.
