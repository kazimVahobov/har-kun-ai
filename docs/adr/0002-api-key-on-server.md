# 0002 — The OpenRouter key lives only on the server, through environment variables

- **Status:** accepted
- **Date:** 2026-09-29

## Context

The assignment states it outright: the key must not reach the browser — not in the bundle, not in
requests from the page — and this will be checked with the Network tab.

The requirement is not ceremonial. A key in the frontend is a key for anyone who opens DevTools;
on a paid account that is someone else's spending, on a free one it is a burned quota.

One temptation is worth naming: Vite has `import.meta.env`, and a variable prefixed with `VITE_`
is substituted into the code with a single move. It is **inlined into the bundle** — that is,
it lands in exactly the place it must not.

## Decision

The key lives in `OPENROUTER_API_KEY`, is read from `process.env` in `server/env.ts`, and never
leaves the `server/` directory. The browser only talks to its own origin: `POST /api/chat`,
`GET /api/models`.

- The `VITE_` prefix is never used for secrets.
- `.env` is in `.gitignore`; the repository holds only `.env.example` with a placeholder.
- The key does not appear in API responses, error bodies, or logs. What goes out is a
  human-readable message with no upstream detail.
- `server/env.ts` checks the key at boot: in live mode, without a key the server does not start,
  with a legible message, rather than failing on a user's first request.

## Consequences

- Without a running server the frontend is useless — a purely static deployment is impossible.
  Acceptable: that is the point of the requirement.
- Every request takes an extra network hop through our own server. On a stream that shows up only
  as connection setup latency.
- The server is obliged to proxy the stream and the abort correctly, and that logic is not free
  (see [0009](0009-normalized-sse.md)).
- An upside nobody asked for: the server is the natural place for rate limiting and for
  substituting a model, should either become necessary.

## Verification

Network tab: no requests to `openrouter.ai` from the page, no `Authorization` header on requests
to our own API. `grep` over the built `dist/` does not find the key.
