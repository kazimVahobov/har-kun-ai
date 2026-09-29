# 0008 — Conversation history in sessionStorage

- **Status:** accepted
- **Date:** 2026-09-29
- **Refined by:** [0011](0011-background-generation.md) — with the sidebar, what is stored is a
  list of chats rather than one conversation. The choice of `sessionStorage` and the write policy
  stand.

## Context

The assignment leaves this open and requires the answer to be argued:

> Conversation history within the session. Whether it survives a page reload is up to you —
> write down why.

Three options, each with its own price:

- **memory only** — a stray F5 wipes the conversation entirely;
- **`localStorage`** — the conversation lives forever, including on someone else's or a shared
  computer, accumulating without being asked;
- **`sessionStorage`** — it lives as long as the tab does.

## Decision

`sessionStorage`, key `har-kun-ai:chat`, written with a debounce (around 300 ms) so the history is
not serialised on every streamed token.

The reasoning: a chat with a model is contextual. Almost all of a conversation's value is
concentrated inside the session, while the person is working through a problem. A week later it is
noise nobody rereads — but it is sitting in the browser, visible to whoever opens the tab.

`sessionStorage` draws exactly the right boundary: a stray F5 or an accidental reload costs
nothing, while a closed tab takes the conversation with it. No separate "clear" button has to be
explained and remembered — the boundary falls where the user's own mental boundary already is.

Additionally:

- an unfinished message is restored as `stopped`, not `streaming` — otherwise after a reload the
  interface shows a permanent typing indicator for a stream that no longer exists;
- reads are wrapped in `try/catch`: in private mode and on quota overflow the call throws, and the
  app must not die because of its history;
- corrupt data in storage does not break startup — the conversation begins empty.

## Consequences

- A reload does not lose the conversation; closing the tab does, and that is a deliberate choice
  rather than an omission.
- A new tab is always clean. For a chat that reads as a property rather than a defect:
  "new tab, new conversation" needs no explanation.
- History syncs nowhere and is unavailable from another device. Server-side storage goes into
  "what's next", and it drags authentication along with it.
- A very long conversation would hit the storage quota (usually around 5 MB). Practically
  unreachable in one session of a text chat; the write is wrapped in exception handling regardless.
- The interface does have a "clear conversation" control — not for privacy, but to start over
  without touching the tab.
