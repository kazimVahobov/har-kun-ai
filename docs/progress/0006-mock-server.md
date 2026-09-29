# 0006 — Mock server

- **Date:** 2026-09-29
- **Branch:** `feat/mock-server`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code

## Task

Phase 1: a mock server fully imitating the model, following the contract in `docs/plan.md`.
No client in this task — verification by `curl`.

## What was done

- `shared/contract.ts` — contract types, error codes and their HTTP statuses. A module shared by
  the server and the client to come; included in both tsconfigs.
- `server/env.ts` — configuration from the environment: port, timeouts, keepalive, the mock flag.
  Failure modes are enabled only outside production.
- `server/sse.ts` — stream headers, frame assembly, writing with backpressure handling.
- `server/mock.ts` — lorem ipsum: random length, markdown, chunking by words. Four mock models
  with different profiles.
- `server/chat.ts` — `POST /api/chat`: body parsing and validation, stall guards, keepalive,
  cancellation, failure modes, deliberately split SSE frames.
- `server/models.ts` — `GET /api/models`.

## Decisions taken

- **The mock models are named honestly:** `mock/lorem:free`, `mock/lorem-slow:free`,
  `mock/lorem-markdown:free`, `mock/lorem-long:free`. Using real `:free` identifiers would mean
  inventing a catalogue that changes. A side benefit: the model picker in the interface becomes
  testable straight away — it genuinely changes how the stream behaves.
- **One stall guard covering two cases.** Before the first token it is longer (30 s — a free model
  can sit in a queue); afterwards it is shorter (20 s) and rearmed on every chunk. Two independent
  timers would have to be kept in sync with each other.
- **The response is assembled in blocks and trimmed only on a paragraph or word boundary.**
  Cutting by character would mean emitting a severed code block or list — broken markdown, which a
  live model does not produce.
- **`simulate=drop` kills the connection with `res.destroy()`**, with no `done` and no `error`.
  That is what a dropped network is: the client has to detect it, not receive a polite notice.
- **`simulate=timeout` has no timer of its own** — it simply stays silent, and the shared stall
  guard fires. That exercises the real code path rather than a separate "for testing" branch.
  Convenient to check with `TIMEOUT_FIRST_TOKEN_MS=2000`.
- **Cancellation writes nothing to the log.** A request the client aborted is normal, not a
  failure; making noise about it trains you to skim your logs.

## Where the AI got it wrong

- **What it did:** in the total-timeout handler it wrote `settle({ ...errorFrame({…}) })` —
  spreading a string into an object. Types would have caught it, but the expression was left over
  from an intermediate edit when `errorFrame` still returned an object.
  **How it was noticed:** proofreading the file right after writing it, before running
  `typecheck`.
  **How it was fixed:** the spread was removed. The same moral as in [0005](0005-scaffold.md):
  reread what you wrote instead of relying on "the compiler will catch it" — it would have, at the
  cost of an extra round trip.

- **What the first draft of `sse.ts` missed:** the wait for `drain` resolved only on `drain`
  itself. On a broken connection that event never arrives, so the promise would hang, and with it
  the generation loop and the timers.
  **How it was noticed:** while working through what happens on a cancellation mid-write.
  **How it was fixed:** the wait now also resolves on `close`, plus an early return if the stream
  is already closed. Verified: after aborting `curl` the log holds neither `EPIPE` nor a
  write-after-close.

## What's left

- There is no client — that is the next task. The `shared/sse.ts` parser arrives with it; for now
  the stream was checked by taking raw chunks apart by hand.
- No tests yet: they target the parser and the reducer, neither of which exists.

## How to check

```bash
npm run dev:server

curl -s localhost:8787/api/models
curl -sN -X POST localhost:8787/api/chat \
  -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"привет"}]}'

# failure modes
curl -s  -D- -X POST 'localhost:8787/api/chat?simulate=429'       -H "$H" -d "$B"
curl -sN     -X POST 'localhost:8787/api/chat?simulate=mid-error' -H "$H" -d "$B"
curl -sN     -X POST 'localhost:8787/api/chat?simulate=drop'      -H "$H" -d "$B"
curl -sN     -X POST 'localhost:8787/api/chat?simulate=slow'      -H "$H" -d "$B"

# timeout — with a shortened threshold, or you wait 30 s
TIMEOUT_FIRST_TOKEN_MS=2000 npm run dev:server
curl -sN -X POST 'localhost:8787/api/chat?simulate=timeout' -H "$H" -d "$B"
```

Verified in fact:

| What | Result |
|---|---|
| normal stream | `delta` events, `done` with `chars` at the end |
| `simulate=429` | `429`, `Retry-After: 12` header, JSON before the stream starts |
| `simulate=mid-error` | part of the text, then an `error` event, stream closed |
| `simulate=drop` | severed with no `done` |
| `simulate=timeout` | with a 2 s threshold — an `error` event at exactly 2.03 s |
| client cancellation | server alive, no write-after-close errors in the log |
| empty `messages` | `400 bad_request` |
| unknown model | `400 bad_request` |
| split frames | 12 of 68 network chunks did not line up with an event boundary |
| `mock/lorem-markdown:free` | the answer contains a heading, a list and a code block |
