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
