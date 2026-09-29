# Progress reports

One file per task. Written by the AI agent when a task is finished — before moving on to the next.

## Why

The assignment requires an honest AI log in the README: which tools were used, **where the AI got
it wrong, and how that was noticed and fixed**. That cannot be reconstructed afterwards: three
hours into the work nobody remembers that the model first suggested `EventSource` for a POST
request and it only surfaced on the first run.

Either it is written down while it is fresh, or it is lost. In the final phase the README is
assembled from here.

## Rules

- **File name:** `NNNN-slug.md`, numbered continuously, four digits: `0002-mock-server.md`.
- **One file per task**, not per day and not per phase. A phase of three tasks is three files.
- **A file is not rewritten after the fact.** A report records how it was, not how one would like
  it to look in hindsight. A mistake stays written down; the correction goes in the next paragraph
  or the next report.
- **The template is `_template.md`.** Do not drop fields: an empty "where the AI got it wrong" is
  better than a missing one, because it shows the question was asked.
- **Be specific.** "There was a streaming problem, fixed it" is a useless line. "The parser lost an
  event when a chunk broke between `event:` and `data:` — caught by the mock, which splits frames
  on purpose" is what the file exists for.
- **Dead ends and failed approaches are mandatory.** A report saying everything went smoothly,
  about work where something had to be redone, is worse than no report: it lies.

## Contents

| File | Task |
|---|---|
| [0001-docs-setup.md](0001-docs-setup.md) | Agent instructions, work plan, report structure |
| [0002-design-system-and-adr.md](0002-design-system-and-adr.md) | Nocturne design system, `.gitignore`, ADRs |
| [0003-ui-structure.md](0003-ui-structure.md) | Screen structure, sidebar, background generation |
| [0004-sidebar-scope-check.md](0004-sidebar-scope-check.md) | Checking the sidebar against the assignment, moving it last |
| [0005-scaffold.md](0005-scaffold.md) | Scaffold: Vite + React + TS, Express, `/api/health` |
| [0006-mock-server.md](0006-mock-server.md) | Mock server: contract, failures, timeouts, cancellation |
| [0007-sse-parser.md](0007-sse-parser.md) | SSE parser and tests on split frames |
| [0008-chat-reducer.md](0008-chat-reducer.md) | Chat reducer and tests on keeping partial answers |
