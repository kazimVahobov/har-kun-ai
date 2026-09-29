# 0012 — The chat sidebar goes beyond the assignment and is built last

- **Status:** accepted
- **Date:** 2026-09-29
- **Extends:** [0011](0011-background-generation.md)

## Context

A sidebar with a chat list and switching entered the screen specification
([`docs/ui-structure.md`](../ui-structure.md)) as an interface requirement. Afterwards the
assignment was reread to find where that requirement came from.

**There are no multiple chats in the assignment.** It is singular throughout:

| Where | Wording |
|---|---|
| What we're building | "Одностраничный веб-чат с языковой моделью: пользователь пишет сообщение — модель отвечает" |
| Requirement 1 | "**Диалог** с моделью через OpenRouter" |
| Requirement 3 | "уже полученный кусок ответа остаётся **в истории**" |
| Requirement 5 | "**История диалога** в рамках сессии. Переживает ли **она** перезагрузку страницы" |
| UI wishes | "Пустое состояние: что человек видит до **первого сообщения**" |

No list, no switching, no plural "chats" anywhere. Requirement 5 is the only place that mentions
storage at all, and it says "the conversation's history… it".

Nor is it forbidden: "Дизайн, структура проекта и стек — на ваш вкус; вкус мы тоже оцениваем."
So a sidebar is permissible — but entirely beyond the requirements.

The cost, meanwhile, is not cosmetic. Switching chats is a component; everything else follows:
a stream map keyed by `chatId` outside the component tree, a mobile drawer with a focus trap,
resolving `Esc` precedence, indicators for background generation and unread answers, deletion with
undo, chat eviction on quota. Roughly one and a half to two hours out of a 2–6 hour budget.

And they are spent on something that falls into none of the first four grading criteria:
works and handles edges → engineering decisions → process → judgement → taste. The sidebar lands
only in the fifth. It also works against the first: parallel streams on a free model mean more
429s and more ways to break in exactly the area graded most strictly.

## Decision

The sidebar stays in scope but is **built as the last item of phase 2** — after streaming,
cancellation, edge handling and accessibility work and have been checked.

At the same time the **data shape is multi-chat from the start**: the store is
`{ version, activeChatId, chats[] }` and streams live in a map keyed by `chatId`. That costs
almost nothing up front and removes the main risk — rearchitecting at the end, under time
pressure.

Order within phase 2: logic and tests → composer and streaming → error states → accessibility and
responsiveness → polish → **sidebar**.

If time runs out, the README says so in words, exactly as the assignment allows: "Что не успели —
опишите в README словами, это нормальный исход".

## Consequences

- The budget is spent in the order the work is graded in. If time runs out, it runs out on the
  optional part rather than on a requirement.
- No rearchitecting when the sidebar's turn comes: the data is already the right shape. The cost
  is that a multi-chat structure lives for a while with only one chat in it — slightly more
  complex than the moment needs.
- There is a flip side worth naming honestly: the "judgement" criterion grades how the assignment
  was interpreted, and a deliberately added sidebar explained in the README is more likely a plus
  than a minus. We are not dropping it, only moving it in the queue.
- The divergence goes into the README as its own paragraph, next to the `outline` pushback
  ([0007](0007-custom-focus-ring.md)). The difference between them is worth stating: there we
  departed from the letter in order to meet a requirement's intent; here we added something that
  was not asked for. Neither should be left unmentioned.
