# 0014 — The live model, everything up to the token

- **Date:** 2026-09-29
- **Branch:** `feat/openrouter`
- **Status:** done, verified against a real key
- **Tools:** Claude Opus 5 in Claude Code

## Task

Phase 3: stream from OpenRouter behind the contract the mock already speaks. This was the last
outstanding functional requirement of the assignment — until now `MOCK=0` answered honestly that
the live model would arrive in phase 3.

The owner holds the key, so the work was scoped to everything that does not need it.

## What was done

Three commits.

**The transport moved out of the mock** (`server/stream.ts`). Keepalive, the two stall guards,
backpressure and the settle-once rule are identical whatever produces the text, and they are the
part that is easy to get subtly wrong. The mock became a producer; the adapter is another one.

The shape follows from one fact about HTTP: a status cannot change once headers are sent. So a
producer runs in two acts — `connect`, which can still fail with a real status code, and the pump,
which can only report failure as an event inside a 200. That is the same reasoning as
[ADR 0009](../adr/0009-normalized-sse.md), now expressed in the types rather than in a comment.

**Configuration and fail-fast boot.** The key, base URL, default model and attribution headers
live in `config`; `assertConfigured()` runs before anything binds a port. `MOCK=0` with an empty
key is now a server that does not start and says why. The mode itself is inferred: mock unless a
key is present, with `MOCK` overriding either way — someone who has not set a key wants the mock,
and making them say so twice is only a way to get it wrong. Node reads `.env` through
`--env-file-if-exists`, so there is no `dotenv` dependency and no import-order trap.

**The adapter** (`server/openrouter.ts`). OpenRouter speaks the OpenAI streaming shape — `data:`
frames with no `event:` field, ended by `data: [DONE]` — so the framing is handled by the same
parser the client uses on our own stream, and only the payload reading is new. That part is a pure
function, which is why it can be tested on the shapes OpenRouter actually sends rather than on a
mock of itself.

**The catalogue** (`server/models.ts`), fetched live and filtered to `:free`, cached five minutes,
warmed at boot, with a dated fallback ([ADR 0016](../adr/0016-free-model-catalogue.md)).

165 tests, up from 128.

## Decisions taken

- **The upstream's wording never reaches the browser.** A 401 from OpenRouter says "No auth
  credentials found". A visitor can do nothing with that, and it says more about our configuration
  than they need to know — so statuses are translated into our codes and our own Russian, and the
  upstream's text goes to the log. This is [ADR 0002](../adr/0002-api-key-on-server.md) taken
  literally: "no upstream detail" is not only about the key string.
- **A 402 is a rate limit, not an internal error.** Credit exhausted on a free tier means the same
  thing to the person waiting as a 429 does: not now, try later or switch model.
- **A 401 is `internal`, not `bad_request`.** Nobody at the browser can fix a key. Framing our
  misconfiguration as their mistake would be a lie with a wrong call to action attached.
- **A body that ends with neither `[DONE]` nor a `finish_reason` is not a finished answer.** It is
  reported as `upstream_error` — but the text that arrived stays on screen, which is the one thing
  the assignment names outright.
- **`?simulate=` is off against a live model.** It belongs to the mock; a manufactured failure from
  a real upstream would mean nothing. It was already off in production.
- **`Retry-After` is parsed in all three forms it arrives in** — seconds, an HTTP date, and
  `X-RateLimit-Reset` — and dropped when it does not resolve to a sensible future wait. The
  interface renders a countdown, and a wrong countdown is worse than none.
- **The adapter cancels the reader explicitly on abort.** The client learned this the hard way in
  phase 2: `fetch` does not reliably tear down a body when the signal fires, and a `read()` that
  never settles holds the request open for as long as the process lives. Applying the lesson
  before being bitten by it again is the only reason it is worth having.

## Where the AI got it wrong

- **Wrote a fake `this`.** The first test recorder collected emitted text through `this.text`, but
  the pump destructures its context (`{ emit, signal }`), so `emit` is called detached and `this`
  is undefined. Caught while re-reading, not by a failing test — it would have thrown at run time
  with a message about a property of undefined, and I would have gone looking in the adapter.
  Rewritten as a closure.
- **Nearly wrote the free-model list from memory.** The plan said in bold to read the catalogue at
  implementation time, and the pull toward "I know a few free model ids" was real. Reading it
  produced 460 models and 16 free ones, and none of the ids I would have written was among them.
  The plan's instruction was worth more than the knowledge it overrode — see
  [ADR 0016](../adr/0016-free-model-catalogue.md).
- **Asserted the wrong error mapping, and tested it into place.** 401 and 403 went into one branch
  as "the key is wrong", with a unit test stating it confidently. OpenRouter answers 403 for a
  model gated to particular apps, where the key is fine — so the interface told the user the server
  was misconfigured and gave them nothing to do about it. The test did not catch it because the
  test encoded the same assumption; only a live sweep across all sixteen models produced a real
  403. A test written from the same belief as the code checks that the code says what I thought,
  not that it is true.
- **Registered a close handler that could not clean up.** Splitting the runner into connect and
  stream phases meant `res.on('close')` was registered before the timers it needed to clear
  existed, so a client disconnect would have leaked a keepalive interval per request. Found by
  re-reading the original against the replacement rather than by a test — nothing fails visibly,
  the process just accumulates intervals.

## Against a real key

The owner supplied the key and reported the picker still showing mock models. It was not the code:
**two `npm run dev` stacks were running.** The older one had been started the previous afternoon,
before `--env-file-if-exists` was added to the script, so it never read `.env`, considered itself a
mock, and — having started first — held port 8787. The newer one read the key, logged `OpenRouter`
and the catalogue, and lost the port. Both Vite instances proxied to 8787, so whichever page was
open got the mock.

Worth writing down because the symptom pointed straight at the new code and the cause was an
environment older than the change: the boot log said `OpenRouter` while `/api/models` said `mock`,
and a single process cannot do both. That contradiction was the whole diagnosis — two servers, one
port — and I reached it by listing the processes rather than by re-reading the handler.

Then all sixteen free models were asked one question. Every branch fired on real data:

| Outcome | Models |
|---|---|
| answered, ~1s | Nemotron 3 Super, Ling 3.0 Flash, Laguna XS, North Mini Code, LFM 2.5 |
| `rate_limited` (429) | both Gemmas, Qwen3.8 — a shared upstream pool, not our quota |
| `bad_request` (403) | both Inkling models — gated to particular apps |
| `upstream_unavailable` | Nemotron 3 Nano Omni |
| `timeout` | Nemotron 3.5 Lightning — headers came back, tokens never did; the stall guard settled it |

Two things changed as a result, and both are in the last commit.

- **A 403 was being reported as our misconfiguration.** It is lumped with 401 in most APIs, but
  OpenRouter also answers 403 for a model restricted to certain apps — the key is fine, that model
  is not. "Сервер не настроен для работы с моделью" was then both false and useless: it blamed us
  and offered nothing to do. It now reads like a 404: pick another model. Caught only because the
  live sweep produced a 403 at all; the unit tests asserted the wrong behaviour confidently.
- **The default model was chosen by taste and was rate-limited.** `google/gemma-4-31b-it:free`
  looked like the sensible general-purpose pick and returns 429 on a shared pool. The order is now
  what answered, dated, with the reasoning in [ADR 0016](../adr/0016-free-model-catalogue.md).

Not changed: OpenRouter sends no `Retry-After` on these 429s, so no countdown appears. That is the
intended behaviour — a wait is shown only when the upstream names one.

## What's left

- The client is unchanged and needs no change: it already falls back to the server's default when
  a remembered model is not in the list, which is exactly what switching from mock to live does.
- **Long answers and markdown have not been exercised against a live model** — the probe asked for
  one word. The mock covers that ground, but a real model's chunking is its own.
- Carried over from [0013](0013-ui-refinement.md), untouched: 320px unverified, and the two
  border-colour questions still open with the owner.
- Phase 4 — the README — and then the sidebar.

## How to check

```bash
npm test && npm run build            # 165 tests
npm run dev                          # the mock, no key needed
```

With a key in `.env` the server logs `OpenRouter` instead of `mock` and loads the catalogue at
boot. Without one, everything below still holds:

```bash
# refuses to start, and says why
MOCK=0 npx tsx server/index.ts

# the catalogue needs no authentication — every id ends in :free
OPENROUTER_API_KEY=not-a-key npx tsx server/index.ts &
curl -s localhost:8787/api/models

# a bad key comes back in our words, not OpenRouter's
curl -s -D - -X POST localhost:8787/api/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"привет"}]}'
# 500 · {"error":{"code":"internal","message":"Сервер не настроен для работы с моделью."}}
# and the log, not the response, holds: 401 Unauthorized: {"error":{"message":"User not found."}}
```
