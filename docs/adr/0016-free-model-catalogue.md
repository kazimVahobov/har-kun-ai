# 0016 — The model list is fetched from the live catalogue and filtered to `:free`

- **Status:** accepted
- **Date:** 2026-09-29
- **Relations:** extends [0003](0003-mock-first.md)

## Context

The picker in the composer needs a list of models, and the assignment asks for a free one.
The mock supplies four invented profiles, which was the right answer while there was no upstream:
they are deliberately not real ids, they exercise the picker because they genuinely change how the
stream behaves, and inventing them cost nothing ([0003](0003-mock-first.md)).

Against OpenRouter the same question has a worse answer than it looks. The obvious move is to
write down two or three `:free` ids and be done. The catalogue was read on the day this was built:
**460 models, 16 of them `:free`**. Not one of those sixteen is guaranteed to still be free next
month — free tiers are introduced as promotion and withdrawn when the promotion ends, and models
are retired outright.

So a pinned list is not a simple solution with a small risk. It is a list that is **wrong by the
time anyone else runs this**, and its failure mode is the worst kind: the picker looks fine, and
every model in it returns 404.

The opposite extreme is worse still. Showing the whole catalogue means a picker that can quietly
spend money — that is not a picker, it is a trap.

## Decision

`GET /api/models` returns, in live mode, the catalogue fetched from OpenRouter and filtered to ids
ending in `:free`. Cached for five minutes, shared between concurrent requests, and warmed at boot
so the first question does not pay for it.

The default is the first model from a short preference order that the catalogue actually offers,
overridable with `OPENROUTER_MODEL`. That order is not a ranking of the models — **it is what
answered.** All sixteen free models were asked one question with a real key: three replied in about
a second, Google's two and Qwen were rate-limited on a shared upstream pool, two were gated to
particular apps, one timed out and one is a safety classifier rather than an assistant. A default
that greets a first-time visitor with a 429 is a bad default however good the model behind it is,
and contention is the one property of a free tier that can be measured but not reasoned about. When the catalogue cannot be fetched, the last good list is
kept however stale it is, and failing that a three-entry fallback stands in — recorded with the
date it was read, because being out of date is this list's expected state.

Validation follows the same logic. On the mock an unknown id is a real mistake and saying so early
is a kindness, so it is checked against the four profiles. Against OpenRouter the catalogue moves
under us, so the server checks the *shape* of an id and lets the upstream be the authority: its
404 comes back as a `bad_request` naming the model.

The mock keeps its own four, unchanged. It has no catalogue and needs none.

## Consequences

- The list is right on the day it is looked at, which a hard-coded one cannot promise.
- One extra outbound request per five minutes, off the critical path.
- A model can be withdrawn *between* the catalogue load and the question. That surfaces as a
  legible `bad_request` naming the model, and the next load drops it from the picker. This is the
  race the design accepts rather than the one it pretends does not exist.
- Free models are not a stable product surface: they are slow, heavily queued, and 429 often.
  That is the reality the error states were built for, and it is why the mock stays.
- The fallback list will rot, and so will the preference order — today's uncontended model is
  next month's popular one. Both are dated in the source so that a reader knows to distrust them,
  and neither is load-bearing: the order only decides what is *selected* first, and the picker
  still holds every free model the catalogue offers.
- **Nothing here retries a different model on a 429.** It would hide a state the assignment asks
  to handle, and it would answer a question nobody asked — the person can see the error and change
  the model in one click.
- The client already handles a remembered model that has disappeared by falling back to the
  server's default, so switching between mock and live mid-session does not strand a conversation.

## Verification

```bash
curl -s localhost:8787/api/models        # every id ends in :free; default is one of them
```

With a deliberately wrong key the catalogue still loads — it needs no authentication — which also
makes it a clean way to tell "the key is bad" apart from "OpenRouter is down".
