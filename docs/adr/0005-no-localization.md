# 0005 — No localisation; the interface is in Russian

- **Status:** accepted
- **Date:** 2026-09-29

## Context

The assignment arrived in Russian and will be reviewed in Russian. Exactly one interface language
is needed.

Localisation infrastructure — a library, dictionaries, keys instead of strings, a switcher,
number and plural handling — is a noticeable amount of work and a noticeable complication in every
component. For a single language it returns exactly nothing.

Separately: "laying the groundwork for i18n" without a second language is the most reliable way to
end up with a dictionary nobody has checked and keys like `chat.error.title` that read worse than
the text they replace.

## Decision

The interface is in Russian, with strings written directly in components. No localisation library,
no dictionaries, no keys.

This decision governs the whole project's language rule: **everything a person sees in the running
app is Russian; everything a developer sees — code, comments, tests, logs, documentation — is
English.** The rule is written out in `CLAUDE.md`.

Constraints we keep so this does not become a trap later:

- `<html lang="ru">`;
- no sentences assembled from fragments — a phrase lives whole, in one place;
- nothing depends on text length or direction; the layout survives longer strings.

The model answers in whatever language it was asked in — that is its business, not the
interface's.

## Consequences

- Less code, fewer dependencies, strings readable at the point of use.
- A second language would require a pass over every component. That is the honest price of the
  decision, it is known in advance, and trying to discount it now would cost more.
- Goes into the README under "what's next".
