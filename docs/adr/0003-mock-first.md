# 0003 — Mock data first, the live model last

- **Status:** accepted
- **Date:** 2026-09-29

## Context

The first grading criterion in the assignment is that it works and handles edges: a 429 from a
free model, a timeout, a dropped connection. Those states are **not reproducible on demand**
against a live free model: a 429 arrives when it arrives, and a dropped connection has to be
staged by hand.

Separately: developing the UI against a live model burns free quota and tokens on every page
reload. Across a few hours of work on the composer and the streaming, that is hundreds of requests,
not one of which is needed on the merits — while debugging layout, the model's answer does not
matter, only the fact of a stream does.

## Decision

The mock server is built first, fully imitating the model, and the UI is closed **entirely**
against it. The real OpenRouter is wired up last, behind the same contract.

The mock serves lorem ipsum: random length, random speed, sometimes markdown. Failures come from
a `?simulate=429|timeout|drop|mid-error|slow` parameter, active only outside production. SSE frames
are deliberately split mid-event, so that the client parser is exercised straight away under the
conditions that TCP chunk boundaries create in production.

The mock stays in the project after the live model arrives — the error states remain reproducible
there.

## Consequences

- Every error state is reachable by a single URL instead of by waiting for luck.
- Phases 1 and 2 run **with no key at all**. A reviewer can start the project and look at the UI
  without creating an OpenRouter account.
- No tokens and no quota are spent debugging layout.
- The cost: the contract has to be written down before both implementations and kept in sync.
  A contract that has drifted only surfaces when the live model is wired up, which is late.
  Hence the rule in `CLAUDE.md`: changing the contract means changing the mock, the adapter and
  the document in one commit.
- A second cost: the mock has habits of its own, and something specific to OpenRouter will only
  surface in phase 3. Mitigated by having the mock imitate the upstream's *observable* behaviour —
  keepalive comments, ragged frames, an error mid-stream.
