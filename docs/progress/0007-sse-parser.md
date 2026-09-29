# 0007 — SSE parser

- **Date:** 2026-09-29
- **Branch:** `feat/mock-server`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code

## Task

An incremental `text/event-stream` parser — one for client and server, with tests on split frames.
Plus mapping frames onto the contract's events.

## What was done

- `shared/sse.ts` — `createSseParser()`: strings in, completed frames out. Plus `toStreamEvent()`,
  turning a frame into a typed contract event.
- `shared/sse.test.ts` — 26 tests.
- Vitest added, with `test` and `test:watch` scripts.
- `docs/plan.md` corrected: the parser lives in `shared/`, not in `src/lib/`.

## Decisions taken

- **The parser knows nothing about `fetch` or streams.** Strings in, frames out. Two consequences:
  it tests without a network, and the same code serves the client (our server's stream) and the
  server (OpenRouter's, in phase 3).
- **Unknown events and broken JSON are skipped rather than failing the stream.** An upstream can
  send anything beyond the contract — `usage`, its own housekeeping fields; dying on that is not an
  option.
- **Parsed to the specification, not "to our format".** Three line-terminator forms, exactly one
  space stripped after the colon, a field with no colon, multi-line `data`, no dispatch without a
  `data` field. Our own server sends a narrow subset, but in phase 3 the parser meets somebody
  else's stream.
- **`shared/` instead of `src/lib/`** — the directory is in both tsconfigs, so importing from the
  server does not drag DOM types along, and importing from the client does not drag Node's.

## Where the AI got it wrong

- **What it did:** wrote a test `feed(['data: c\r\r'])` expecting a completed frame. The test
  failed.
  **How it was noticed:** `vitest` — which is what tests are for.
  **How it was fixed:** the mistake was **in the test, not the parser**. A trailing `\r` is the
  last byte of the chunk, and the parser must hold it: the next chunk may begin with `\n`, making
  it a single `\r\n` terminator rather than two. Rushing there means dispatching a spurious empty
  frame on every `\r\n` split across chunks. That is exactly the behaviour I built into `takeLine`
  and then contradicted in the expectation.

- **What it did next:** fixing that same test, it got it wrong again — expecting the frame on the
  third chunk, when `\r` and `\n` merge into one terminator and the frame emerges on the second.
  **How it was noticed:** the second test run.
  **How it was fixed:** by walking the buffer state step by step by hand rather than eyeballing it.
  The lesson: where the logic is character by character, intuition does not work — the state has to
  be spelled out at each step.

  Both mistakes are in the same place and both in tests. The upside: the test that twice caught a
  wrong expectation about `\r` now documents that behaviour explicitly, with the reasoning for why
  holding is correct.

## What's left

- Reading the stream out of `fetch` does not exist yet — that is client-side and arrives with
  `useChat`.
- The chat reducer and its tests are the next task.

## How to check

```bash
npm test        # 26 tests
```

Beyond the obvious, what is covered: feeding one character at a time matches feeding the whole
stream; splitting at **every** position in the stream (by exhaustive loop) matches too; our
server's keepalive comments and `: OPENROUTER PROCESSING` are skipped; a comment in the middle of
a frame does not reset what has accumulated.

End-to-end against the live mock: the parser received 36 network chunks, assembled 28 `delta`
events from them, the joined text length (595) matched the `chars` field of the `done` event, and
the markdown was intact. The mock's deliberately split frames reassemble without loss.
