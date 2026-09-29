# 0008 — Chat reducer

- **Date:** 2026-09-29
- **Branch:** `feat/mock-server`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code

## Task

Conversation state as a pure function, with tests on "stopped mid-generation" and "error after
partial text" — the assignment's central invariant.

## What was done

- `src/lib/types.ts` — `Message`, `Chat`, `ChatState`, message statuses.
- `src/lib/chatReducer.ts` — the reducer, state constructors and selectors (`activeChat`,
  `chatsByRecency`, `isStreaming`, `streamingMessage`).
- `src/lib/chatReducer.test.ts` — 24 tests. 50 in the project overall.

## Decisions taken

- **No `Date.now()` and no id generation inside the reducer** — both arrive in the action.
  Otherwise it cannot be checked without faking time, and it has to be checked: this is where the
  requirement "the chunk already received stays in the history" lives.
- **`delta` does not move `updatedAt`; terminal events do.** Otherwise the chat would jump around
  the sidebar on every token.
- **A late `delta` into a finished message is ignored.** Between `abort` and the socket closing,
  an event could already be in flight; without this check the text would come back to life after
  "Stop" was pressed. The same goes for a second terminal event: the first one wins.
- **A retry rebuilds the message from scratch** rather than editing field by field — that
  guarantees both the previous text and the previous error are gone.
- **An action aimed at a missing chat or message returns the same state reference.** A new object
  with no changes is a pointless re-render of the whole tree.
- **Restore normalisation lives in the reducer, not in the storage layer.** That way the rule
  "a restored `streaming` becomes `stopped`" holds regardless of where the state came from, and is
  covered by the same tests as everything else.

## Where the AI got it wrong

- **What it did:** in the test for sorting chats by recency, it used the `sent()` helper with a
  hard-coded timestamp of `2000` while creating the neighbouring chat with `3000`. It expected the
  order `['c1', 'c2']` and got `['c2', 'c1']`.
  **How it was noticed:** `vitest`.
  **How it was fixed:** the mistake was again **in the test, not the code** — the sort behaved
  exactly as designed. The helper gained a time parameter, and the test now checks both the
  initial order and the chat rising to the top after a new message. It ended up more useful than
  originally intended.

  Three failing tests in a row, each pointing at my wrong expectation rather than a defect. What
  they share: I put into the expectation what I wanted to see, instead of deriving the result from
  the inputs. For tests about time and about character-by-character buffers that does not work —
  you have to compute, not guess.

## What's left

- `storage.ts` — serialisation into `sessionStorage`, debouncing, eviction on quota.
- `useChat` — reading the stream from `fetch`, the `AbortController`, the stream store keyed by
  `chatId`.
- The bare page on top of all of it.

## How to check

```bash
npm test
```

What is covered, by substance:

| Check | Why it matters |
|---|---|
| a stop mid-generation keeps the text | a direct requirement of the assignment |
| an error after partial text keeps the text and attaches the error | the same |
| a late `delta` does not revive a stopped message | the race between `abort` and the socket |
| a second terminal event does not overwrite the first | the same race from the other side |
| generation in a background chat keeps accumulating | ADR 0011 |
| a restored `streaming` becomes `stopped` | otherwise a permanent typing indicator after F5 |
| an action for a missing chat returns the same reference | a pointless object is a pointless render |
