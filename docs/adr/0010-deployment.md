# 0010 — Deployment: an optional last step

- **Status:** accepted
- **Date:** 2026-09-29

## Context

The assignment does not ask for a deployment: submission is a public GitHub repository, review
happens locally, and the README is required to explain how to run it in five minutes.

At the same time the author owns **har-kun.uz** ([0001](0001-project-name.md)), and a live link
noticeably lowers the barrier for a reviewer: looking at a working chat is easier than cloning a
repository and obtaining an OpenRouter key.

The assignment's budget is 2–6 hours. Deployment, a domain and HTTPS are not in that budget and
easily eat an hour better spent on edge handling.

## Decision

Deployment happens **last, and only if time is left**. Its priority is below everything else: a
working local run matters more than a live link, because the local run is what the assignment
actually requires.

If the step happens:

- build with `npm run build`, static files served by the same Express server that holds `/api`
  (a separate static host is impossible: the key lives on the server, see
  [0002](0002-api-key-on-server.md));
- `OPENROUTER_API_KEY` comes from the server's environment, not from a file in the repository;
- a public deployment requires rate limiting and a cap on history length: an open proxy to an LLM
  without them is somebody else's free API at the key owner's expense;
- the `?simulate=` fault injection is off — it only works when `NODE_ENV !== 'production'`.

If the step does not happen, the README says so in words, as the assignment permits.

## Consequences

- The main work does not depend on infrastructure: missing the deployment does not hurt the
  submission.
- A live link, if it exists, is a bonus rather than an obligation.
- A public deployment means public quota spending. Rate limiting is therefore not a "what's next"
  item but a precondition for shipping: without it, do not ship.
- Until there is a deployment, the only way to see the project is to run it locally. Mitigated by
  phases 1 and 2 running without a key at all ([0003](0003-mock-first.md)): `npm install &&
  npm run dev` is enough.
