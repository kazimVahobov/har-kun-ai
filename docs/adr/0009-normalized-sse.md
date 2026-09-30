# 0009 — Our own SSE shape instead of piping the upstream

- **Status:** accepted
- **Date:** 2026-09-29

## Context

The server sits between the browser and OpenRouter ([0002](0002-api-key-on-server.md)) and has to
pass the stream along. The simplest thing is to pipe the upstream's response body byte for byte.

One circumstance gets in the way, and it shapes all error handling: **once the first byte of the
body is sent, the HTTP status can no longer change.** And generation breaks mid-stream regularly —
with free models that is routine. A piped stream simply stops at that moment, and the client cannot
tell "the model finished" from "everything fell over".

Plus smaller things that would surface later: OpenRouter sends keepalive comments
`: OPENROUTER PROCESSING`, and the shape of its events is a third party's API shape, leaking into
the frontend and coupling it to one provider.

## Decision

The server parses the upstream stream and emits **its own** normalised SSE — three events:

```
event: delta   data: {"text":"…"}                  an increment, not the accumulated text
event: done    data: {"reason":"stop","chars":812} normal completion
event: error   data: {"code":"…","message":"…"}    terminal error, stream closed after it
```

An error exists in two forms, never both at once: before the stream starts, plain JSON with a
meaningful HTTP status; after it starts, an `error` event. Already-sent `delta` events stand:
a partial answer is a valid result, not garbage.

The full contract is in `docs/plan.md`.

## Consequences

- A mid-generation error gets delivered. Without this decision there would be nothing to deliver
  it with.
- The frontend does not know about OpenRouter: it knows about three events. Swapping providers or
  substituting the mock ([0003](0003-mock-first.md)) is work inside one module.
- The upstream's response shape and its housekeeping fields do not leak outward.
- One SSE parser for client and server — a single tested utility instead of two similar ones.
- The cost: the server has to parse the stream rather than shovel bytes. SSE parsing is an easy
  place to get wrong — TCP chunk boundaries do not line up with event boundaries, and a parser that
  cannot survive that only breaks under load. Hence the tests on split frames, and a mock that
  splits them on purpose.
- A second cost: the contract has to stay in sync across the mock, the real adapter and the
  document. The rule is written into `CLAUDE.md`.
