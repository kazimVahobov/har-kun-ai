# Architecture Decision Records

Decisions taken on this project: what was decided, what it was chosen over, and what it costs.

## Why separate from the plan

The plan answers "what are we building"; an ADR answers "why this way and not another". Different
questions, different lifespans: a plan goes stale once the work is done, while a decision keeps
explaining the code months later.

The assignment grades judgement separately — "what you noticed in the assignment and how you
argued your decisions". A decision stated together with the alternative it beat and the price it
carries is that answer in written form. For the README, these files are the draft of the
"key decisions and why" section.

## Rules

- One file per decision, named `NNNN-slug.md`, numbered continuously.
- Format: **Context** (what forced a decision) → **Decision** → **Consequences** (including the
  bad ones).
- An accepted ADR is not rewritten. If we change our minds, a new ADR references the old one and
  the old one gets a back-reference. Erasing the history of decisions means losing it.
- A "Consequences" section without a single downside means the cost was not thought through,
  not that there is none.

### Statuses and relations

Both lists are closed: the words mean different things and must not be mixed.

**Status of a decision:**

| Status | Meaning |
|---|---|
| accepted | in force |
| superseded | no longer in force, another ADR replaces it |
| withdrawn | no longer in force, nothing replaces it |

**Relation to another ADR** — forward in the new file, back in the old one:

| In the new | In the old | What happened |
|---|---|---|
| supersedes | superseded by | the earlier decision is withdrawn entirely |
| refines | refined by | the decision stands; a detail inside it changed |
| extends | extended by | the decision stands untouched; a new dimension was added |

The difference between "refines" and "extends" is practical: in the first case the old file
describes something that no longer exists and cannot be read without the new one; in the second
the old file is correct in full, on its own.

## Register

| № | Decision | Status | Relations |
|---|---|---|---|
| [0001](0001-project-name.md) | Project name — har kun ai | accepted | |
| [0002](0002-api-key-on-server.md) | The OpenRouter key lives only on the server, via env | accepted | |
| [0003](0003-mock-first.md) | Mock data first, the live model last | accepted | |
| [0004](0004-single-dark-theme.md) | One theme — Nocturne dark, no toggle | accepted | |
| [0005](0005-no-localization.md) | No localisation; the interface is Russian | accepted | |
| [0006](0006-responsive-layout.md) | Responsive from 320px, mobile-first | accepted | |
| [0007](0007-custom-focus-ring.md) | Our own focus ring instead of the browser's — the pushback | accepted | |
| [0008](0008-session-storage-history.md) | Conversation history in sessionStorage | accepted | refined by [0011](0011-background-generation.md) |
| [0009](0009-normalized-sse.md) | Our own SSE shape instead of piping the upstream | accepted | |
| [0010](0010-deployment.md) | Deployment — an optional last step | accepted | |
| [0011](0011-background-generation.md) | Several chats; generation continues in the background | accepted | refines [0008](0008-session-storage-history.md), extended by [0012](0012-chat-sidebar-scope.md) |
| [0012](0012-chat-sidebar-scope.md) | The sidebar is beyond the assignment — built last | accepted | extends [0011](0011-background-generation.md) |
| [0013](0013-typography.md) | A Cyrillic type set instead of Inter | accepted | refines the design-system doc |
| [0014](0014-opens-on-the-day.md) | The empty screen opens on the day | accepted | |

Nothing has been superseded or withdrawn so far: 0011 and 0012 cancel nothing, they layer.
