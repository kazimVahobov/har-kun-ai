# Har Kun

A streaming chat with a language model, built as a take-home. React + TypeScript on the front, a
small Express proxy behind it so the OpenRouter key never reaches the browser. The answer appears
as it is written and can be cut off mid-sentence without losing what already arrived.

> The app's own interface is in Russian: the assignment arrived in Russian and will be reviewed in
> Russian ([ADR 0005](docs/adr/0005-no-localization.md)). Everything a developer sees — code,
> comments, commits, docs, this file — is English.

## Running it

Node ≥ 20.19 (built and tested on 22).

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

**It runs with no key at all.** Without `OPENROUTER_API_KEY` the server starts on a mock that
imitates a live model — random length and speed, markdown, ragged frames, and failures on demand.
The whole interface was built against it ([ADR 0003](docs/adr/0003-mock-first.md)), so a reviewer
can see everything working without creating an OpenRouter account.

To talk to a real model:

```bash
cp .env.example .env     # then put your key in OPENROUTER_API_KEY
npm run dev
```

The server picks the mode up from that alone — mock without a key, OpenRouter with one — and says
which on boot:

```
[server] development, OpenRouter, listening on http://localhost:8787
[models] live catalogue: 16 free models, default nvidia/nemotron-3-super-120b-a12b:free
```

`MOCK=1` forces the mock even with a key; `MOCK=0` without a key is a server that refuses to start
and says why, rather than one that looks healthy and fails on the first question.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite on :5173, backend on :8787, `/api` proxied |
| `npm test` | Vitest — 166 tests |
| `npm run build` | typecheck, then build into `dist/` |
| `npm start` | production: one server serves `dist/` and `/api` |
| `npm run typecheck` | types only, client and server |

Everything configurable is documented in [`.env.example`](.env.example).

## What it does

- **Streaming** over SSE, with the text appearing as it is generated.
- **Stop** — the button or `Esc`. The received part stays in the history and the interface stays
  alive; the next message sends immediately.
- **Every failure ends in a state you can read** — 429 with a countdown when the upstream names
  one, timeouts, a dropped connection, an error mid-answer. No permanent spinner, and a partial
  answer is never thrown away.
- **History for the session**, restored on reload.
- **Keyboard throughout** — Tab, Enter sends, Shift+Enter breaks a line, Esc stops, a skip link,
  semantic markup, one polite live region.
- **Markdown** in answers, rendered live, with unterminated code fences closed before parsing.
- **A free model picker**, filled from OpenRouter's live catalogue filtered to `:free`.

## Key decisions

Sixteen decisions are written up in [`docs/adr/`](docs/adr/) with their context and their cost.
The ones that shaped the code most:

**The key lives only on the server** ([ADR 0002](docs/adr/0002-api-key-on-server.md)). It is read
from `process.env` inside `server/` and never leaves it. The browser only ever talks to its own
origin. Worth naming the trap avoided: Vite's `import.meta.env` with a `VITE_` prefix is one line
away and **inlines the value into the bundle** — that is, into exactly the place the assignment
says to keep it out of. `grep` over the built `dist/` finds neither `openrouter` nor `Bearer`.

**Our own SSE shape rather than piping the upstream** ([ADR 0009](docs/adr/0009-normalized-sse.md)).
HTTP cannot change a status once headers are sent, so an error that happens after the first token
cannot be a 502 — it has to be an event inside a 200. The contract therefore has two error forms,
and the server owns the decision about which one applies. Piping OpenRouter through would have
handed that decision to the client.

**The mock came first and stayed** ([ADR 0003](docs/adr/0003-mock-first.md)). A 429 from a free
model arrives when it arrives; a dropped connection has to be staged. `?simulate=` makes each one
a single URL. The cost is a contract that must be written down and kept in sync between two
implementations — which is why it is in [`docs/plan.md`](docs/plan.md) and not only in the code.

**History survives a reload, and dies with the tab**
([ADR 0008](docs/adr/0008-session-storage-history.md)). The assignment leaves this open, so:
`sessionStorage`. A conversation with a model is contextual — almost all of its value is inside
the session, while someone is working through a problem; a week later it is noise nobody rereads,
sitting in a browser that other people may open. `sessionStorage` puts the boundary where the
user's own mental boundary already is: a stray F5 costs nothing, closing the tab clears
everything, and no "clear history" button has to be designed, explained and remembered.

A message caught mid-stream is restored as **stopped**, never as streaming — otherwise a reload
would show a typing indicator for a stream that no longer exists. Writes are debounced, reads are
wrapped: private mode and a full quota both throw, and a chat must not die because of its history.

**The model list is fetched, not pinned** ([ADR 0016](docs/adr/0016-free-model-catalogue.md)). The
catalogue read while building this had 460 models, 16 of them `:free`, and not one of the sixteen
is promised to still be free next month. A hard-coded list would be wrong by the time anyone else
runs this, and its failure mode is the worst kind: the picker looks fine while every model in it
returns 404.

**Everything visual comes from tokens** ([ADR 0004](docs/adr/0004-single-dark-theme.md),
[`docs/design-system.md`](docs/design-system.md)) — one dark theme, no toggle, no hex and no pixel
value outside the scale. Errors carry no colour of their own: an icon, a heading and text, which
is what survives colour blindness and a screen reader.

## The pushback: `outline`

The assignment asks for two things that cannot both be taken literally.

> Accessibility: the interface can be used entirely from the keyboard — Tab through elements,
> Enter sends, Esc stops generation.

> Remove the browser's default focus outline (`outline`) from buttons and the input field — it
> looks inconsistent across browsers and spoils a tidy look.

The focus ring is the only thing that shows where you are during keyboard navigation. Remove it
and Tab moves blind: pressing Enter submits something you cannot see. The second requirement,
followed to the letter, deletes the first.

The diagnosis behind it is correct, though — the default ring genuinely does differ in every
browser. The problem is the proposed cure.

**So the intent was satisfied rather than the letter.** The browser outline is gone; every
interactive element carries its own ring instead, identical everywhere, defined by the design
system:

```css
:focus         { outline: none; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
```

`:focus-visible` is exactly the distinction the requirement's wording was missing: no ring on a
mouse click, a ring on keyboard navigation. The tidy look is preserved for the mouse path and the
keyboard path is not broken. The composer highlights its border instead of taking a second ring —
the field is already framed.

Full reasoning in [ADR 0007](docs/adr/0007-custom-focus-ring.md). It is stated here rather than
left to be discovered, because a reviewer reading the requirement literally would otherwise mark
it unmet.

## Trying the edge cases

The mock reproduces on demand what a free model only produces by luck. Outside production,
`POST /api/chat` accepts `?simulate=`:

| Value | What happens |
|---|---|
| `429` | rate-limited before the stream starts, with `Retry-After` |
| `timeout` | the connection stays open and no first token arrives |
| `drop` | the connection dies mid-stream, with no `done` |
| `mid-error` | part of the answer, then an `error` event |
| `slow` | 300–800 ms between chunks |

```bash
curl -sN -X POST 'localhost:8787/api/chat?simulate=mid-error' \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

The first-token guard defaults to 30 s; shorten it to watch it fire:
`TIMEOUT_FIRST_TOKEN_MS=2000 npm run dev:server`.

Against a real key the same states arrive on their own. All sixteen free models were probed with
one question: five answered in about a second, three were rate-limited on a shared upstream pool,
two were gated to particular apps, one was unavailable and one returned headers but never a token.

## The AI log

Written by Claude Opus 5 in Claude Code, driven by a human review loop, over roughly a day of
elapsed time across 73 commits. The browser checks were done with Claude's Chrome automation;
there is no other tooling here.

The honest version of "how it went" is in [`docs/progress/`](docs/progress/) — fifteen reports,
one per task, each with a mandatory section on what the AI got wrong. They were written as the
work happened, because none of it can be reconstructed afterwards. What follows is the summary;
the files have the detail.

### Where it went wrong, and how that surfaced

**Confident code that only fails under load.** `runChatStream` trusted `fetch` to tear down the
response body when the abort signal fired. It does not, reliably. Four tests hung to their
timeout — the suite went from 120 ms to 20 s — which is how it was noticed. Fixed by cancelling
the reader explicitly. The same lesson was then *applied* rather than relearned when the
OpenRouter adapter was written ([0010](docs/progress/0010-chat-streaming.md),
[0014](docs/progress/0014-openrouter.md)).

**One utility, three defects, one root.** `.visually-hidden` used the usual `position: absolute`
recipe. It escaped the scrolled log and gave the window its own scrollbar; it was selectable, so
copying an answer pasted the hidden author label "Модель" into the next question; and as an inline
`<label>` it ignored `height` and quietly padded the composer. Each was found separately, by eye,
in a browser. "Hide visually, keep it available" is not one property but a set of constraints, and
each one surfaces in its own context ([0011](docs/progress/0011-styled-ui.md),
[0013](docs/progress/0013-ui-refinement.md)).

**An API used on a wrong mental model.** The contents rail tracked the current question with an
`IntersectionObserver`, which reports *changes* in intersection — so with a long answer filling
the screen nothing intersected the band and the rail kept pointing at the first question while the
sixth was visible. Replaced with direct measurement. The first replacement was throttled through
`requestAnimationFrame`, which stopped it working in a background tab, where rAF does not run
([0013](docs/progress/0013-ui-refinement.md)).

**Test expectations written from what I wanted to see.** Four times — twice on `\r` handling in
the SSE parser, once on a recency-sort helper with a hardcoded time, once on where `summarise`
puts a word boundary. Every time the code was right and the expectation was wrong. It is the most
repeated mistake in the log ([0007](docs/progress/0007-sse-parser.md),
[0008](docs/progress/0008-chat-reducer.md), [0013](docs/progress/0013-ui-refinement.md)).

**A test that encoded the same wrong belief as the code.** 401 and 403 were mapped to one branch —
"the key is broken" — with a unit test asserting it. OpenRouter also answers 403 for a model gated
to particular apps, where the key is fine, so the interface told the user the server was
misconfigured and gave them nothing to do. The test could not catch it; only probing all sixteen
free models with a real key produced an actual 403
([0014](docs/progress/0014-openrouter.md)).

**Chased a bug that did not exist.** A retry appeared to fire on its own, twice. I seeded a clean
state, could not reproduce it, and said so rather than inventing an explanation. The answer came
when the owner asked what happens on clicking retry: the browser was theirs, and they had been
clicking it. The lesson is not "check for user input" — it is that an unreproducible anomaly
deserves *no* story until it reproduces ([0013](docs/progress/0013-ui-refinement.md)).

**Treated a symptom twice before seeing the cause.** "Enter — отправить" sat beside the send
button and vanished on narrow screens. First it was moved left and pinned against shrinking; only
when the whole row was restructured did it become clear the hint never belonged inside that row.
Needing `flex: 0 0 auto` to stop an element being crushed is a sign it is in the wrong container,
not a sign it needs a stronger rule ([0015](docs/progress/0015-ui-fixes.md)).

**Nearly wrote the free-model list from memory.** The plan said, in bold, to read the catalogue at
implementation time. Reading it returned 460 models and 16 free ones — and none of the ids I would
have written from memory was among them ([0014](docs/progress/0014-openrouter.md)).

**And the one that was not a code bug at all.** The picker kept showing mock models while the boot
log said `OpenRouter`. A single process cannot do both — and that contradiction was the whole
diagnosis: two `npm run dev` stacks were running, and the older one, started before `.env` reading
was added to the script, had taken the port. Listing the processes answered it; re-reading the
handler would not have ([0014](docs/progress/0014-openrouter.md)).

### What the AI was good at, honestly

Writing the SSE parser against chunk boundaries, and the tests that cut a frame at every byte
position. Keeping a contract in two implementations in sync. Producing decision records with their
costs. What it needed a human for, repeatedly, was **looking at the screen** — most of the defects
above were invisible to the type checker and the test suite, and every one of them was found by a
person pointing at something and saying that is wrong.

## What's next, given another day

In the order I would actually do them:

1. **Verify 320px properly.** This is the one requirement I cannot claim. The browser automation
   reports a successful resize while the viewport stays at 1512, so the responsive layout has only
   ever been reviewed by reading CSS and by narrowing containers — which tests flex behaviour, not
   media queries. It needs a real device or a driver that resizes.
2. **Component tests for the states that keep breaking.** The reducer, the parser and the stream
   runner are well covered; everything the review loop caught lives in the render layer and is
   covered by nothing. A handful of tests around the message states and the composer would have
   caught at least the blank-answer block.
3. **Unify two border colours.** `--color-divider` is translucent, so the same token renders
   differently on the answer and on the composer, which sit on different grounds; and the error
   card draws its edge with `--shadow-sm`, an elevation token doing a divider's job. Both are known
   and deliberately left, not overlooked.
4. **The chat sidebar.** Several conversations with switching between them, generation continuing
   in the background. Designed and deliberately deferred — `TASK.md` never asks for more than one
   chat, and building it would have been scope I chose for the reviewer rather than work they asked
   for ([ADR 0012](docs/adr/0012-chat-sidebar-scope.md)).
5. **Deploy it** ([ADR 0010](docs/adr/0010-deployment.md)). There is a domain waiting; the server
   is already a single process serving `dist/` and `/api`.

Smaller, listed for honesty: `Esc — остановить` is shown in the key map even when nothing is
streaming; retry is offered only on the last message, so an identical error card earlier in the
conversation has no button; and [ADR 0008](docs/adr/0008-session-storage-history.md) names a
storage key the code has since changed.

## Documentation

| File | About |
|---|---|
| [`docs/plan.md`](docs/plan.md) | the phased plan and the `/api/chat` contract |
| [`docs/ui-structure.md`](docs/ui-structure.md) | screen layout, states, keyboard map |
| [`docs/design-system.md`](docs/design-system.md) | the Nocturne design system: tokens and how they map on |
| [`docs/adr/`](docs/adr/) | 16 decisions, with context and cost |
| [`docs/progress/`](docs/progress/) | 15 per-task reports — the source of the AI log above |
| [`CLAUDE.md`](CLAUDE.md) | the instructions the AI agents worked under |

## Licence

[MIT](LICENSE)
