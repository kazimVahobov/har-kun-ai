# 0010 — Storage, the stream runner, the hook and a bare page

- **Date:** 2026-09-29
- **Branch:** `feat/chat-streaming`
- **Status:** done, with the hook and page unverified in a browser
- **Tools:** Claude Opus 5 in Claude Code

## Task

Everything between the mock server and a visible chat: persistence, reading the stream on the
client, the registry of running generations, the hook that wires them together, and a page with
correct semantics and no styling.

## What was done

- `src/lib/storage.ts` — `sessionStorage` with validation, eviction and a debounced saver.
- `src/lib/chatStream.ts` — reading one generation from `POST /api/chat`: SSE parsing, the two
  error forms from the contract, client-side stall guards, cancellation.
- `src/lib/streams.ts` — `AbortController`s keyed by `chatId`, outside the React tree.
- `src/hooks/useChat.ts` — the wiring, and everything impure the reducer refuses to do.
- `src/App.tsx` — the chat page: `<header>`, `<ol>` of messages, status line with `aria-live`,
  a `<form>` composer with a label, the model picker and Enter/Shift+Enter/Esc.
- 45 new tests; 94 in the project.

## Decisions taken

- **`Storage` is injected, not reached for globally.** The module tests without a DOM, and a test
  can make `setItem` throw — the one failure path that actually matters here.
- **Stored data is validated rather than trusted**, and an invalid chat is dropped on its own.
  One hand-edited entry should not cost the user every other conversation.
- **A quota error drops the oldest chat and retries once; any other error gives up.** Dropping
  data would not help an unrelated failure.
- **The active chat is never evicted**, even when it is the oldest. Evicting what the user is
  looking at is worse than storing one over the limit.
- **Keepalives do not rearm the stall guard.** They keep the connection alive, not the
  generation; a stream sending nothing else has stalled.
- **Client guards sit above the server's** (35 s / 25 s against 30 s / 20 s), so a live server's
  own timeout — which carries a better message — wins, and the client's only fires when nothing
  is coming back at all.
- **Writes are debounced while streaming and flushed the moment nothing is**, plus on `pagehide`.
  Storage only has to survive a reload, so it never needs to keep up per token.
- **History omits empty messages.** An assistant entry with no text is either the placeholder for
  the answer being generated or one that failed before producing anything. Neither is context.
- **A chat's remembered model falls back to the server default when it is unknown.** Catalogues
  change; sending a stale id would earn a 400 instead of an answer.
- **`Esc` lives in the page, not the hook.** Once the sidebar exists, `Esc` has to close that
  first, and precedence logic inside a hook that knows nothing about the sidebar is a trap.
- **The page has no styles at all.** Nocturne's tokens are the next step; mixing them in here
  would hide whether the markup stands up on its own.

## Where the AI got it wrong

- **What it did:** `runChatStream` relied on `fetch` tearing down the response body when the
  signal aborts. A real `fetch` does exactly that, so the code looked right.
  **How it was noticed:** four tests hung to their 5-second timeout, and the suite went from
  120 ms to 20 seconds. Cancellation and both stall guards never resolved.
  **How it was fixed:** the reader is now cancelled explicitly on abort. The reasoning matters
  more than the fix: depending on the body to react to the signal means a body that does not
  leaves the function hanging forever — and it takes the stall guard with it, the one mechanism
  whose entire job is to prevent hanging. A guard that can hang is not a guard.

  This also surfaced a consequence worth naming: a severed connection, a cancellation and a fired
  guard all look identical to the reader — the body simply ends. So the reason is now derived
  from flags rather than from the shape of the failure.

- **What it did:** tried to verify the page by setting the textarea through the automation's
  `form_input`, which writes the DOM value directly. React's `draft` stayed empty, the submit
  button stayed disabled, and nothing was sent.
  **How it was noticed:** the empty state was still on screen after the click.
  **How it was fixed:** switched to real keystrokes. Worth recording because it is a
  false-negative generator: the app was fine, the check was wrong — the same shape of mistake as
  the wait loop in [0005](0005-scaffold.md).

- **What could not be finished:** the second attempt, with real keystrokes, also produced no
  message, and before that could be distinguished from an actual defect the browser extension
  disconnected. Whether the app has a focus problem or the extension was already failing is
  **unknown**, not resolved.

## What's left

- **The hook and the page have no automated coverage and no completed browser check.** Everything
  underneath them is tested; the wiring is not. This is the honest status, not a formality:
  the browser session ended mid-check.
- A decision is pending on how to close that: reconnect the extension and finish by hand, or add
  `jsdom` and `@testing-library/react` and cover the wiring with tests. The latter is two new
  dependencies, which `CLAUDE.md` requires justifying — the justification exists (hooks and
  components cannot be checked otherwise), but the call is the owner's.
- Markdown rendering, the empty state's example prompts and the sidebar all belong to the styled
  UI phase.

## How to check

```bash
npm test          # 94 tests
npm run dev       # :5173

# the edge cases, once the UI is driven by hand
curl -sN -X POST 'localhost:8787/api/chat?simulate=mid-error' \
  -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"hi"}]}'
```

What a browser pass still needs to confirm: text arrives progressively; Esc and Stop leave the
received chunk in the history and the interface alive; `?simulate=` states render legibly; F5
restores the conversation with an unfinished answer marked stopped rather than spinning forever.
