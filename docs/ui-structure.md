# Screen structure

The phase 2 specification. Styling and tokens are in `docs/design-system.md`, the stream contract
in `docs/plan.md`.

> **Order of work.** The chat sidebar goes **beyond the assignment** — in `TASK.md` the
> conversation is singular throughout. It is therefore built **last in phase 2**, after streaming,
> cancellation, edge handling and accessibility. The data shape is multi-chat from the start so
> nothing needs rearchitecting under time pressure. Reasoning in
> [ADR 0012](adr/0012-chat-sidebar-scope.md).
>
> Until the sidebar exists, the screen behaves as single-chat: same store, one chat in the list,
> no `<aside>` at all.

Interface copy below is quoted in Russian on purpose — everything a person sees in the running app
stays Russian, per the language rule in `CLAUDE.md`.

## One page

There is no router. Everything that happens is a state of one screen. Switching chats changes
which conversation is rendered and does not change the URL: URL state would drag in navigation
history and a back button, which in a chat means something unobvious.

## Frame

Full height, `100dvh`. Only the conversation scrolls; header, sidebar and composer are fixed.

```
┌──────────────────────────────────────────────────────┐
│ Har Kun   вторник, 29 сентября                       │  navbar: mark and date
├──────┬───────────────────────────────────────────────┤
│  00 ┤│                                               │
│     ┤│        ▍A model answer, no fill,              │
│  06 ┤│         accent mark on the left               │
│     ┤│                                               │
│     ┤│                    ┌──────────────────┐       │
│  12 ┤│                    │ A question, card │       │
│     ┤│                    └──────────────────┘       │
│──17:15                                               │
│  18 ┤│        ● ● ●  Модель печатает                 │
│     ┤│       ┌──────────────────────────────────┐    │
│     ┤│       │ Спросите что-нибудь              │    │
│     ┤│       │ [ модель ▾ ]               [ ↑ ] │    │
│     ┤│       └──────────────────────────────────┘    │
└──────┴───────────────────────────────────────────────┘
   day scale          centred conversation
```

The sidebar, when it arrives, takes the left margin and the day scale moves into the empty
state's column.

There are no rules between areas — not under the navbar, not between the sidebar and the
conversation. Nocturne has no dividers at all: areas are separated by air from the spacing scale.
The sidebar and the conversation sit on the same `--color-bg`; only position and the active item's
fill tell them apart.

The conversation column is centred. Nocturne's direction is content hugging the left edge, and on a
wide monitor that put it in a corner; the asymmetry now lives in the left margin instead, where the
day scale sits.

Semantics: `<header>` → a wrapper holding `<aside>` and `<main>` → inside `<main>` the `<ol>`
conversation and the composer `<form>`. First in the DOM is a skip link to the input: in a long
conversation every answer carries a copy button, and without it reaching the composer would mean
tabbing through the whole history.

## Navbar

The `Har Kun` mark in the display face, and today's date beside it. A daily assistant should know
what day it is and say so without being asked — and the navbar is the one place that stays true
once a conversation has started and the empty state is gone. Below 480px there is no room for both
and the mark wins.

No bottom border, no shadow, no background differing from the page — `.nav` already ships with
`border-bottom: none`.

Nothing else lives there: there are no settings, the model picker is in the composer, chat
management is in the sidebar. On a narrow screen a hamburger appears to the left of the mark.

## Sidebar

> Built last in phase 2 — see the note at the top and
> [ADR 0012](adr/0012-chat-sidebar-scope.md).

An `<aside>` with an invisible label (`aria-label="Чаты"`), 240px wide.

- At the top, a full-width `.btn-secondary` "+ Новый чат".
- Below it a `<ul>` of chats, newest first, sorted by last activity.
- A chat item is a `<button>` with a single-line title, truncated with `text-overflow: ellipsis`.
  The title comes from the first user message (about 40 characters); before that, "Новый чат".
- **Active** — a `--color-surface` fill and a solid 2px accent mark on the left, the same device
  the model's message uses.
- **Generating** — a pulsing accent dot to the right of the title. Static under
  `prefers-reduced-motion`.
- **Has an unread answer** (generation finished while the user was in another chat) — the same
  dot, not pulsing. Cleared when the chat is opened.
- Deleting is an icon button that appears on hover and on focus. No confirmation dialog: instead,
  "Чат удалён · Вернуть" sits in the status line for five seconds. A modal on every delete is an
  extra step in a chat this size, and undoing is cheaper than asking.

"+ Новый чат" while an empty chat is already open does not create a second one; it just focuses
the composer. Otherwise the sidebar fills up with empty "Новый чат" entries.

## Conversation and messages

An `<ol>`, each message an `<li>`. `--space-6` between messages, no rules.

**User message** — a `.card` on `--color-surface`, pushed right, at most 75% wide (full width on
a narrow screen).

**Model message** — no fill, full width, with a solid 2px accent spine on the left. Flooding an
answer with the accent is not allowed: in Nocturne the accent is a line and a mark, not a fill. The
difference between roles is fill against outline, the same distinction the system's own buttons
make.

**A thin border closes the block when the answer is finished.** While it is being written the block
stays open and the spine reads like a pen — dim over what is written, bright where words arrive. A
border drawn at both times would say where the answer ends and nothing about whether it has, which
was the actual ambiguity. The border is transparent while streaming rather than absent, so closing
the block costs no layout shift.

Inside an answer, markdown renders with a reduced heading scale (h1→20px, h2→17px, h3→16px, then
15px): the system's 42px is absurd in a chat reply. Code blocks scroll inside themselves.

Under a finished answer sits a row of actions, aligned to its right edge and always visible: copy,
and for the last message in the conversation, retry. It used to fade in on hover, which meant a
complete answer looked exactly like one still being written unless you pointed at it — and nothing
hovers on a touchscreen. The copy icon trails its label, since the row is flush right and the glyph
belongs on the edge.

**Autoscroll** sticks to the bottom until the user scrolls up themselves. After that it switches
off — otherwise you cannot reread the start of an answer while it is being generated — and a
"jump to bottom" button appears to resume following.

## Empty state

Not a separate screen, but what the conversation holds while it is empty. It opens on **today**
rather than describing the app — reasoning in [ADR 0014](adr/0014-opens-on-the-day.md):

- a greeting that follows the hour, set in the display face — "Доброе утро" / "Добрый день" /
  "Добрый вечер" / "Доброй ночи". The date is not repeated here; it lives in the navbar;
- the day scale, horizontal here. Above 1024px it is not: the scale lives in the left margin
  instead, and the column version steps aside so there is never two of it;
- a muted line explaining the name and what the thing does;
- three starters that belong to that hour — what is offered at 8am is not what is offered at 11pm.
  Each is a card on `--color-surface`, carrying a one-word kicker for the kind of work, the request
  itself, and a line saying what comes back — so the choice is legible before the click. Three
  across above 640px, stacked below. Clicking one puts the text in the composer and moves focus
  there, but does **not** send: the user has to be able to change their mind or add to it.

Everything arrives in sequence on load: 8px and 420ms, 70ms apart. Small, because this system is
quiet and a loud entrance would be somebody else's design.

## Contents rail

In the right margin, opposite the day scale, appearing with the first message. One item per **user
question** — answers are long and interchangeable as labels; the question is what someone is looking
for. Reasoning and its cost in [ADR 0015](adr/0015-contents-rail.md).

- **Fixed rhythm, never proportional.** Every item is the same height with the same gap, so a tap
  target does not shrink as the conversation grows. Position means order, not scroll offset — which
  is the one way this rail differs from the day scale it copies.
- **It scrolls when it overflows**, with the fade on the frame rather than the content: on a
  scrolling list the ends belong to the viewport, so the mask follows it.
- **Clicking scrolls the question into view**, smoothly unless motion is reduced. Messages carry
  `scroll-margin-top` so the question does not land flush against the edge.
- **The item in view is marked in the accent** — the rail says where you are, not only where you
  could go. It is derived from the log's scroll position rather than from an `IntersectionObserver`;
  the reason is in the ADR's amendment.
- **Labels are one line, truncated twice.** Whitespace is collapsed and the text is cut on a word
  boundary before it is rendered — a pasted question arrives as several paragraphs, and a label
  built from it would carry the breaks as gaps and stop mid-word. CSS ellipsis then handles
  whatever still does not fit, since the rail's width decides that, not a character count. The full
  question is the accessible name and the hover title.

Below 1024px there is no margin for it and it is absent.

## Status line

Between the conversation and the composer, `role="status" aria-live="polite"`. It carries the
typing indicator (three accent dots), "Генерация остановлена", "Ответ получен",
"Чат удалён · Вернуть".

The live region is here and **not** on the answer text: a region updated on every token turns a
screen reader into a machine gun. The status changes discretely.

The line reflects the **active** chat only. Background generation in another chat announces
nothing — its place is the sidebar, as a dot.

## Composer

A `<form>`, fixed at the bottom. Visually one `.input` frame holding two rows:

```
┌──────────────────────────────────────┐
│ Спросите что-нибудь                  │   textarea, rows=1, grows to 6
│                                      │
│ [ модель ▾ ]                   [ ↑ ] │   select + primary button
└──────────────────────────────────────┘
```

- The `textarea.input` has no border of its own — the wrapper carries it, and focus highlights the
  wrapper's edge in the accent. It grows to about 6 rows, then scrolls internally.
- **The model picker is a native `<select>`** styled as ghost: the `:free` list from
  `GET /api/models`. A native element gives keyboard handling, first-letter search and the system
  picker on mobile for free. The model is remembered per chat, not globally.
- The primary button is `.btn-primary.btn-icon` with an arrow. Disabled while the field is empty.
- **During generation** the button becomes "Стоп" (`.btn-secondary` with a square icon). The field
  stays enabled: typing the next question is allowed, sending is blocked until generation ends.

## Errors

An error belongs to the message it broke and renders **directly beneath it**, not as a toast and
not as a banner at the top: a floating notification in a corner would detach the error from its
cause.

A `.card` with a plain-language explanation, a `.tag-outline` carrying the contract's code, and a
`.btn-primary` retry. The text received so far stays above, untouched.

**Errors are not encoded in colour.** Nocturne has no role for errors; the system is mono and asks
to keep chroma low outside the accent. Meaning is carried by a warning icon, a heading and text —
which is what works both for colour blindness and in a screen reader, where there is no colour at
all. The decision is settled: no `--color-danger`.

## Switching chats during generation

Two things blur together here and are worth separating: **where the stream lives** and **what
storage is for**.

The stream lives in the application's memory — in a store outside the component tree, keyed by
`chatId`: the `AbortController`, the `body.getReader()` reader, and the accumulated text.
Switching chats changes exactly one thing, `activeChatId`, meaning which conversation is rendered.
Components remount; the store and the request do not.

**The decision: generation is not interrupted.** It continues in the background, the chat is
marked with a dot in the sidebar, and the finished answer is there on return.

Interrupting would be worse on the merits: the user has already paid for that answer in waiting
and in free-tier quota, and cancelling it because they glanced at another chat punishes normal
behaviour. "Stop" exists for the case where the answer genuinely is not wanted, and it is pressed
explicitly.

### Why this needs no per-character writes

Per-character persistence would be needed only if rendering read from storage. It reads from
memory. Storage exists for exactly one purpose: surviving a page reload.

And a reload kills the stream regardless — `fetch` dies with the page, the connection breaks, there
is nothing left to append. So per-character writes would preserve the tail of an answer that is
already severed and marked stopped after a reload. The gain is the last few hundred milliseconds
of a dead stream; the cost is serialising the whole store on every token.

Writes therefore stay as they are in [ADR 0008](adr/0008-session-storage-history.md):

- debounced at ~300 ms during streaming — not per token, but not only at the end either;
- flushed immediately on a terminal event: `done`, `stopped`, `error`;
- flushed on `pagehide` and on `visibilitychange` to `hidden`, which closes even that 300 ms.

The loss window is between zero and one debounce of text that already belongs to a severed stream.

### Rules for parallel generation

- Generation is **per chat**; the `AbortController` lives in a map keyed by `chatId`.
  Several chats may stream at once.
- `Esc` and "Стоп" stop **only the active** chat. Stopping a background one means opening it.
- Deleting a chat aborts its stream first, then deletes — otherwise a request is left running with
  nowhere to write.
- There is no hard cap on concurrent streams. The risk is real: free models readily answer 429 to
  parallel requests — but 429 is already fully handled and attached to its own message. A request
  queue goes into "what's next".

### After a reload

A message restored with status `streaming` is moved to `stopped` with a note, "Генерация прервана
перезагрузкой". Otherwise the interface shows a permanent typing indicator for a stream that no
longer exists.

## Storage

`sessionStorage`, one key `har-kun-ai:v1` for the whole store.

```ts
type Stored = {
  version: 1
  activeChatId: string
  chats: Array<{
    id: string
    title: string           // from the first user message, ~40 chars
    createdAt: number
    updatedAt: number
    model: string           // the model is remembered per chat
    messages: Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      status: 'done' | 'stopped' | 'error'   // streaming never reaches storage
      error?: { code: string; message: string }
    }>
  }>
}
```

- Reads and writes are wrapped in `try/catch`: in private mode the call throws, and the app must
  not die because of its history.
- Corrupt data, or data from another version, does not break startup — the store begins empty.
- Cap: 20 chats, oldest evicted by `updatedAt`. On `QuotaExceededError`, drop the oldest chat and
  retry the write once.

## Keyboard and focus

| Key | Action |
|---|---|
| `Enter` | send |
| `Shift+Enter` | newline |
| `Esc` | stop generation in the active chat |
| `Esc` with the mobile sidebar open | **close the sidebar** — this takes precedence |

Order: skip link → hamburger (mobile) → logo → "+ Новый чат" → chat list → conversation →
composer → model picker → send.

- Switching chats moves focus to the composer; otherwise it stays on a sidebar button and the next
  `Enter` switches chats again.
- The mobile sidebar traps focus and returns it to the hamburger on close.
- An example in the empty state fills the composer and focuses it.

## Responsiveness

Mobile-first, breakpoints at 640px and 1024px, lower bound 320px.

- **< 640px** — the sidebar becomes a drawer over the content, opened by the hamburger, closed by
  `Esc`, by a click outside, and by choosing a chat. User messages take full width. The composer
  is pinned to the bottom with `env(safe-area-inset-bottom)`.
- **640–1024px** — the sidebar is still a drawer; the conversation gets its own width.
- **≥ 1024px** — the sidebar is permanently docked, the conversation is `min(760px, 100%)`,
  centred, with the day scale in the left margin.

Height is `100dvh` with a `100vh` fallback. The input's `font-size` is at least 16px, or iOS
Safari zooms the page on focus.

## Screen states

`empty` → `idle` → `streaming` → `done` | `stopped` | `error`, and back to `idle` from the last
three. State belongs to a **chat**, not to the application: one may be streaming while another
sits idle.

## What there isn't

No routing, no settings page, no modals, no toasts, no chat search, no manual renaming, no export.
There is one setting — the model — and it lives in the composer.
