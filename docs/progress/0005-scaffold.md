# 0005 — Project scaffold

- **Date:** 2026-09-29
- **Branch:** `chore/scaffold`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code

## Task

Stand up the scaffold: a placeholder page and `/api/health`. No API work — it just has to run.

## What was done

- One `package.json`, Node ≥ 20.19. Scripts: `dev`, `build`, `start`, `typecheck`.
- Vite + React 19 + TypeScript, strict, with `noUncheckedIndexedAccess` and
  `verbatimModuleSyntax`.
- `server/index.ts` — Express 5 on `tsx`: `GET /api/health`, a JSON 404 for unknown routes under
  `/api`, static serving of `dist/` and an SPA fallback in production.
- Vite proxies `/api` to :8787 — the browser talks only to its own origin from the very start.
- `.env.example`, and a run section in the README.

## Decisions taken

- **Two tsconfigs, no project references.** One for `src`, one for `server` and `vite.config.ts`;
  `typecheck` runs both. References would have required `composite` and build-info file juggling
  for a project of two directories.
- **Production runs through `tsx`, not through compiled JS.** Building the server for one file is
  an extra link in the chain with nothing to justify it at this size.
- **The 404 under `/api` is served before the SPA fallback.** Otherwise a typo in an API path
  would return HTML with status 200, and the error would surface while parsing the response, far
  from its cause.
- **No styles at all.** The Nocturne tokens are the first item of phase 2; putting them in the
  scaffold would mean starting phase 2 inside a scaffold commit.

## Where the AI got it wrong

- **What it proposed:** an SPA fallback as `app.get('*', …)` — the familiar Express 4 form.
  **How it was noticed:** before running it, while checking against the version — `package.json`
  pins Express 5, which parses paths through path-to-regexp v8, where a bare `*` is no longer
  valid and throws at startup.
  **How it was fixed:** the fallback became ordinary middleware at the end of the chain — valid in
  both 4 and 5.

- **What it did:** the first production check did not wait for the server to start — the wait loop
  spun with no delay and finished instantly, so `curl` got nothing. It looked like the server had
  failed to come up.
  **How it was noticed:** the server log contained no error at all — meaning the problem was not
  the server but the check.
  **How it was fixed:** `curl --retry --retry-connrefused`. A lesson for later: before fixing
  something that "does not work", make sure the broken thing is it and not the check.

## What's left

Nothing for this task. Next: phase 1, the mock server.

## How to check

```bash
npm install
npm run dev          # :5173 shows that /api/health answers
curl -s localhost:5173/api/health   # {"status":"ok","uptime":…} — through the Vite proxy
npm run preview      # build and production mode on :8787
```

Verified: `npm run build` passes, both modes start, `/api/health` answers directly and through the
proxy, an unknown `/api` route returns a JSON 404, and in production `/` serves `index.html`.
