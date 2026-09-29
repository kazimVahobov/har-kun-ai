# 0011 — Several chats, and generation continues in the background on switch

- **Status:** accepted
- **Date:** 2026-09-29
- **Refines:** [0008](0008-session-storage-history.md) — the storage shape, not the choice of
  `sessionStorage`
- **Extended by:** [0012](0012-chat-sidebar-scope.md) — several chats go beyond the assignment,
  so the sidebar is built last in phase 2. The decisions below stand; only the ordering changes.

## Context

The interface gained a sidebar with a chat list and switching between chats. That raises a
question that did not exist with a single conversation: what happens to generation when the user
leaves for another chat while the model is answering.

Next to it stood a second question, which sounded like a consequence of the first: if generation
continues in the background and is written to storage, will it have to be written on every
character?

The second question turned out to be false, and it is worth resolving before the decision —
otherwise one might choose to interrupt the stream purely out of fear of per-character writes.

## Decision

**Generation is not interrupted on switch.** It continues in the background, the chat is marked
with a dot in the sidebar, and the finished answer is there on return.

Interrupting is worse on the merits: the user has already paid for that answer in waiting and in
free-tier quota. Cancelling it because they got distracted punishes normal behaviour. "Stop"
exists for the case where the answer is genuinely unwanted, and it is pressed explicitly.

**Per-character writes are not required.** The stream lives in the application's memory — in a
store outside the component tree, keyed by `chatId`: the `AbortController`, the reader, and the
accumulated text. Switching chats changes only `activeChatId`, that is, what is rendered; it does
not touch the store or the request.

Rendering reads from memory, not from storage. Storage exists for exactly one purpose: surviving a
reload. And a reload kills the stream regardless — `fetch` dies with the page. So per-character
writes would preserve the tail of an answer that after a reload is severed and marked stopped
anyway. The gain is the last few hundred milliseconds of a dead stream; the cost is serialising
the whole store on every token.

Writes therefore stay as they were: debounced at ~300 ms, flushed immediately on `done` /
`stopped` / `error` and on `pagehide`. The loss window is up to one debounce of text that already
belongs to a severed stream.

**Parallel streams are allowed.** One `AbortController` per chat. `Esc` and "Stop" stop only the
active chat. Deleting a chat aborts its stream first, then deletes.

The storage shape changes from a single conversation to
`{ version, activeChatId, chats[] }`, key `har-kun-ai:v1`; the cap is 20 chats, evicted by
`updatedAt`.

## Consequences

- An answer is not lost to a switch — the "ask, go read another chat, come back" flow works the
  way people expect it to.
- The stream store lives outside React. That is a deliberate exit from the component tree: keep a
  stream in component state and unmounting on a chat switch kills it. In exchange, cleaning the
  map on completion and on deletion becomes a manual responsibility.
- Several simultaneous streams mean several simultaneous requests to a free model, and it readily
  answers 429. We set no hard cap: 429 is already fully handled and attached to its own message.
  A request queue goes into "what's next".
- Background completion announces nothing through `aria-live`: the live region reflects only the
  active chat, or a screen reader would interrupt the current reading with news from elsewhere.
  The cost is that a blind user learns a background answer is ready only by opening it.
- The sidebar sharpens a tension in [0008](0008-session-storage-history.md): a chat list looks
  like something that ought to outlive the tab, and `sessionStorage` does not. We keep the
  decision — the assignment speaks of history "within the session", and privacy on a shared
  computer weighs more — but the tension is real, and the README states it alongside the
  reasoning.
