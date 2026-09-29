# Plan

A living document. When a decision changes, this file changes in the same commit as the code.
The source of truth for requirements is `TASK.md`, not this.

## Goal

A single-page chat with a language model through OpenRouter: streamed output, cancellable
generation, legible states on failure, keyboard accessibility, the key on the server.

The order the assignment promises to grade in is also the order of priority when time runs short:

1. It works, and edge cases are handled
2. Engineering decisions: where the key lives, how streaming and cancellation work
3. Process: commits, PRs, README, AI log
4. Judgement: what was noticed in the assignment and how it was argued
5. Taste in the interface

## Mock first

The mock server is built first, and the UI is closed **entirely** against it. OpenRouter is
wired up last.

Why:

- The UI depends on the stream contract, not on OpenRouter. The contract can be fixed before a
  single live request exists.
- The mock makes reproducible what a free model only produces by luck: 429, timeout, a mid-stream
  drop, very slow and very fast generation. Those states are the first grading criterion, and
  "wait until one happens" is not a way to check them.
- Building the UI burns no free quota and needs no key. The project runs and is reviewable with
  no secrets at all.
- By the time the live model's turn comes, exactly one module is unverified: the adapter.

The decision costs one thing: the contract has to be written down before both implementations and
honoured by both. That is why it is below, and why changing it means changing the mock, the
adapter and this section in a single commit.

## The API contract

The browser only ever talks to **its own origin**. No request leaves the page for anywhere else.

### `POST /api/chat`

Request:

```json
{
  "messages": [
    { "role": "user", "content": "Привет" },
    { "role": "assistant", "content": "Здравствуйте" }
  ],
  "model": "vendor/name:free"
}
```

`model` is optional; without it the server's default is used. The client sends the whole history:
the server keeps no state between requests.

A successful response is `200` and `text/event-stream`:

```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

Events:

```
event: delta
data: {"text":"Lorem ipsum "}

event: error
data: {"code":"upstream_error","message":"Модель оборвала генерацию"}

event: done
data: {"reason":"stop","model":"mock/lorem","chars":812}
```

- `delta` — an increment, not the accumulated text: the client joins it itself.
- `done` — normal completion. `reason`: `stop` (the model finished) or `length` (it hit a limit).
- `error` — terminal. The stream closes after it.

Every 15 seconds the server writes a comment line `:` — a keepalive against proxies that cut idle
connections. The client parser must ignore those lines (OpenRouter sends its own
`: OPENROUTER PROCESSING`; the behaviour is the same, which is convenient: the parser gets
exercised against the mock under the same conditions).

Note that `message` text is user-facing and therefore Russian, per the language rule in
`CLAUDE.md`.

### Errors

The rule that shapes all error handling: **once the first byte of the body is sent, the HTTP
status can no longer change.** Hence two forms of error, and never both at once.

Before the stream starts — plain JSON and a meaningful status:

```json
{ "error": { "code": "rate_limited", "message": "Модель занята", "retryAfter": 12 } }
```

| `code` | Status | When |
|---|---|---|
| `bad_request` | 400 | empty `messages`, unknown model |
| `rate_limited` | 429 | the free model's quota is spent; with `retryAfter` when known |
| `upstream_error` | 502 | the upstream answered with an error |
| `upstream_unavailable` | 503 | the upstream could not be reached |
| `timeout` | 504 | no first token within the allotted time |
| `internal` | 500 | everything else |

After the stream starts — an `error` event carrying the same `code` and `message`, then close.
Already-sent `delta` events stand: a partial answer is a valid result, not garbage.

`message` is human-readable text meant for display. It **never** contains upstream details,
headers, or — obviously — the key.

### Cancellation

The client aborts the `fetch` through an `AbortController`. The server sees `close` on the request
before it has sent `done`, and aborts the upstream request.

That last link is mandatory: without it, pressing "Stop" only stops the rendering while generation
keeps burning free quota. Cancellation is not an error: the server does not log it as a failure
and does not try to write anything else into a closed socket.

### `GET /api/models`

```json
{
  "models": [{ "id": "vendor/name:free", "name": "Name", "contextLength": 32768 }],
  "default": "vendor/name:free"
}
```

### Timeouts

| What | Value | Why |
|---|---|---|
| To the first token | 30 s | free models can sit in a queue for a while |
| Between chunks | 20 s | the stream has stalled — treat it as dead |
| Whole request | 120 s | an upper bound |

Values come from the environment; the table shows defaults.

## Phase 1 — the mock server

Branch `feat/mock-server`. **Done.**

Express, routes per the contract, `MOCK` flag (on by default in development). It serves lorem
ipsum.

- **Random response length** — 200–1500 characters, trimmed on a word boundary.
- **Chunks of 1–5 words**, 15–80 ms apart, first-token delay 200–1200 ms. Varying speed so the UI
  is exercised both by "arriving faster than it renders" and by "barely dripping".
- **Sometimes with markdown** — a heading, a list, `**bold**`, a code block. Otherwise markdown
  rendering gets checked by hand once and then breaks silently.
- **SSE frames are sometimes split mid-event** between socket writes. Not mischief: TCP chunk
  boundaries do not line up with event boundaries, and a client parser that cannot survive this
  only breaks in production. The mock catches it immediately.
- **Failure modes** through `?simulate=`:

  | Value | What it does |
  |---|---|
  | `429` | answers `rate_limited` with `retryAfter` before the stream starts |
  | `timeout` | holds the connection and sends no first token |
  | `drop` | kills the connection mid-stream with no `done` |
  | `mid-error` | sends part of the text, then an `error` event |
  | `slow` | 300–800 ms between chunks |

  Only active when `NODE_ENV !== 'production'`.
- **Abort is handled honestly**: on `close`, timers are cleared and generation stops. This
  exercises the same code path that will later tear down the real upstream.

Verified with `curl` across every mode.

## Phase 2 — the UI, entirely on the mock

Branch `feat/ui`. The largest phase; separate commits inside it.

The order within the phase is fixed and mirrors the grading order: logic and tests → composer and
streaming → error states → accessibility and responsiveness → polish → **chat sidebar**. The
sidebar goes beyond the assignment and therefore last ([ADR 0012](adr/0012-chat-sidebar-scope.md));
the data shape is multi-chat from the start so nothing needs rearchitecting under time pressure.
If time runs out, it runs out on the optional part.

**Logic** (pure functions, under test):

- `shared/sse.ts` — the stream parser. One for client and server; it lives in `shared/` because
  that directory is in both tsconfigs. Alongside it `shared/contract.ts` — event types, error
  codes and their statuses. **Done.**
- `src/lib/chatReducer.ts` — chat state. A message goes `streaming` → `done` | `stopped` |
  `error`; state belongs to a chat, not to the app. **Done.**
- `src/lib/storage.ts` — `sessionStorage`, debounced writes, eviction of old chats.
- `src/lib/streams.ts` — a map of live streams by `chatId`, outside the component tree:
  switching chats must not kill generation.

**Streaming and cancellation** (`src/hooks/useChat.ts`): `fetch` + `body.getReader()` (not
`EventSource` — it cannot POST), an `AbortController` in a ref, client-side timers mirroring the
server's.

**Interface** — the screen is laid out in `docs/ui-structure.md`, the design system's tokens in
`docs/design-system.md`. `src/styles/tokens.css` lands first; after that no hard-coded colour,
spacing or radius — only `var(--…)`.

- An empty state before the first message: what this is, what to ask, a couple of clickable
  examples.
- A "model is typing" indicator during generation.
- Stop — both a button and `Esc`. After stopping the interface is alive and the received chunk
  stays in the history.
- The error states from the contract, each with human wording and a retry.
- A `:free` model picker. Not required by the assignment, but directly useful on a 429: switching
  models is the most sensible thing to do at that moment.
- Markdown in model answers. No `rehype-raw`: model output is untrusted input, and raw HTML from
  it does not reach the DOM.
- Responsive from 320 px.

**Accessibility**:

- Semantics: `<main>`, `<ol>`/`<li>`, `<form>`, `<label>`.
- `Enter` sends, `Shift+Enter` inserts a newline, `Esc` stops.
- `aria-live="polite"` on the **status line**, not on the answer text. A live region updated on
  every token turns a screen reader into a machine gun; the status changes discretely instead:
  "typing" → "answer received".
- A visible `:focus-visible` ring on everything interactive (see "Pushback").

**Tests** — aimed at what breaks:

- the SSE parser on frames cut mid-event, and on keepalive comments; **done**
- the reducer on "stopped mid-generation" and "error after partial text": in both cases the
  accumulated text must survive. **Done.**

## Phase 3 — the real OpenRouter

Branch `feat/openrouter`.

An adapter behind the same contract; mock/live switched through the environment, with the mock
staying in place (the error states remain reproducible there).

- `server/env.ts` — validation at boot, fail fast: no key in live mode means the server does not
  start, with a legible message, rather than dying on the first user request. **Done.**
- OpenRouter's SSE parsed by the same `shared/sse.ts`, mapped onto the contract's events. **Done**
  — the transport itself moved out of the mock into `server/stream.ts` first, so there is one copy
  of the keepalive, the stall guards and the settle-once rule.
- The default model comes from the live `GET /api/v1/models` catalogue filtered by `:free`
  **at implementation time** — the list changes and must not be written from memory. A small
  fallback list in code covers the catalogue being unreachable. **Done**, and the catalogue is
  fetched at runtime rather than pinned ([ADR 0016](adr/0016-free-model-catalogue.md)): it was
  460 models and 16 free ones on the day this was built, and none of the sixteen is promised to
  still be free next month.
- `Retry-After` forwarded into `retryAfter` on a 429. **Done**, including the HTTP-date form and
  `X-RateLimit-Reset`.

Verification: the Network tab shows no request to `openrouter.ai` from the page and no
`Authorization` header on requests to our own API; `grep` over `dist/` does not find the key.
**Done** — `grep` over the built `dist/` finds neither `openrouter` nor `Bearer`. The live model
answered, and all sixteen free models were probed with a real key: see
[progress 0014](progress/0014-openrouter.md) for what each one did and the two things that changed
as a result.

## Phase 4 — README and submission

Branch `docs/readme`.

Running locally in five minutes · key decisions and why · the pushback · the AI log assembled from
`docs/progress/` · what would come next given another day.

Pull requests per phase are opened and merged by the repository owner; agents stop at commits on
a branch.

## Decisions taken

| Decision | Why |
|---|---|
| One `package.json` | A real person has to run this in five minutes. Workspaces add ceremony without a payoff at this size |
| Plain CSS + CSS Modules | The assignment explicitly asks for semantic markup, "not a div soup". Utility classes pull the other way. Zero styling dependencies as a bonus |
| Normalised SSE instead of piping the upstream | There is no other way to deliver an error once headers are sent; and the upstream's response shape does not leak outward |
| History in `sessionStorage` | Survives a stray F5 but does not accumulate other people's conversations on a shared computer |
| Mock server before the real model | Edge handling is the first grading criterion, and it is not reproducible against a live free model |
| Cancellation reaches the upstream | Otherwise "Stop" stops only the rendering while quota keeps burning |
| Nocturne for the UI | A finished dark system with considered states and tokens, instead of inventing a palette along the way. Tokens and mapping in `docs/design-system.md` |
| One theme, dark | Nocturne is a dark system; a light variant would have to be invented, and it would not be Nocturne |

Each decision with its context and its cost is an ADR in `docs/adr/`.

## Pushback

The assignment asks not to silently follow a requirement that looks wrong, but to write it up.

> Remove the browser's default focus outline (`outline`) from buttons and the input field.

This conflicts with the accessibility requirement in the same document: "the interface can be used
entirely from the keyboard". Without a visible focus ring, tabbing is blind — it cannot be used.

We satisfy the intent rather than the letter: the default outline goes (cross-browser
inconsistency is a real problem, and clearly the thing they wanted gone), but every interactive
element gets its own ring through `:focus-visible`. It does not appear on a mouse click and does
appear on Tab. Both requirements are met, neither is broken.

## Out of scope

Deliberately not done — not because we cannot, but because it does not fit into 2–6 hours and the
assignment does not ask for it. These go into the README under "what's next": a light theme and a
toggle, server-side history, authentication, localisation, self-hosting the font, chat search and
renaming, a queue for parallel requests, regenerating and editing messages, exporting a
conversation.
