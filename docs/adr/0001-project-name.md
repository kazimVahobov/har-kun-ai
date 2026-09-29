# 0001 — Project name: har kun ai

- **Status:** accepted
- **Date:** 2026-09-29

## Context

The assignment does not care about a name — it is about a chat with a model. But the project lives
in a public repository, and the name is visible before any code is: in the URL, in the interface
header, in the browser tab. An anonymous `llm-chat` or `test-task-chat` announces that this is a
throwaway.

The author owns the domain **har-kun.uz**. "Har kun" is Uzbek for "every day".

## Decision

The project is called **har kun ai**; the repository is `har-kun-ai`.

In the interface it is written lowercase — `har kun ai`, in `.nav-brand`. Lowercase fits
Nocturne's character: a quiet system where hierarchy comes from size and space rather than
emphasis.

## Consequences

- The name is not disposable: there is a domain to deploy it to
  (see [0010](0010-deployment.md)), and the project stops looking like a folder holding a
  take-home task.
- The name is opaque to anyone who does not speak Uzbek: "har kun" says nothing about a chat with
  a model. The empty state's subtitle compensates by explaining what this is outright.
- The domain ties the project to the author's personal infrastructure. For a take-home that is a
  plus; on someone else's project it would be coupling.

## Amendment, 2026-09-29

The decision above stands; one detail inside it does not. It said the mark is set lowercase,
because lowercase suits a system whose hierarchy comes from size and space rather than emphasis.

In the display face that reasoning stopped holding. Unbounded already carries the presence the
lowercase was meant to avoid asking for, and set in lowercase at 15px the mark read as a footnote
rather than as a name. It is now **Har Kun**, capitalised, at 18px.

The capitalised form is used everywhere the name appears, including the empty state's slogan, which
quotes it in order to translate it. Two spellings of one name on one screen would read as an
oversight rather than as a distinction between a product and a phrase.

The record is appended rather than edited, so what was decided and what changed both stay visible.
