# 0011 — The styled UI

- **Date:** 2026-09-29
- **Branch:** `feat/ui`
- **Status:** done, except a 320px pass that the tooling would not allow
- **Tools:** Claude Opus 5 in Claude Code, verified by hand in Chrome

## Task

Turn the bare markup into the interface `docs/ui-structure.md` describes, styled with the Nocturne
tokens from `docs/design-system.md`. Verified by hand against the mock server rather than with
component tests — the assignment grades working behaviour, and the mock produces every edge on
demand.

The chat sidebar is deliberately not here: it goes beyond the assignment and ships separately
([ADR 0012](../adr/0012-chat-sidebar-scope.md)).

## What was done

Eight commits: tokens and the system layer · the shell · messages · the empty state · streaming
feedback · error states · markdown · accessibility.

- `src/styles/tokens.css` and `system.css` — every Nocturne value, its component classes, and the
  documented extensions (`--font-mono`, motion tokens).
- `src/components/` — `ChatShell`, `Composer`, `Message`, `Markdown`, `EmptyState`, `StatusLine`,
  `ErrorNotice`, and six inline icons.
- `src/hooks/useAutoScroll.ts`, `src/lib/markdown.ts` (+7 tests). 101 tests in the project.

## Decisions taken

- **Three styling layers, and the split matters.** Tokens and Nocturne's component classes are
  global, because a design system is a shared vocabulary; positioning goes in a CSS Module next to
  its component, so layout cannot leak.
- **Inter is self-hosted.** The assignment says the Network tab will be checked; a font CDN fills
  it with third-party requests — not a violation, but noise in exactly the check being run. One
  dependency buys an own-origin-only Network tab. `docs/design-system.md` was corrected, since it
  had documented the opposite.
- **Markdown renders live, with open code fences closed before parsing.** An open fence is the one
  destructive case: until its closing ``` arrives, the rest of the answer sits inside the code
  block, so the reader watches their answer get swallowed as tokens come in. Rendering plain text
  until `done` was the alternative, and it makes the whole message reflow at the end — which reads
  as a glitch.
- **No `rehype-raw`.** Model output is untrusted; raw HTML from it never reaches the DOM.
- **The follow scroll is instant, the jump-to-bottom is smooth.** A smooth scroll cannot keep up
  with tokens arriving every few dozen milliseconds and ends up permanently behind. The deliberate
  jump is the only place smoothness belongs, and it honours `prefers-reduced-motion`.
- **`role="region"` on the log, not `role="log"`.** The latter carries an implicit live region and
  would announce every token. The status line is the one place on the page that speaks.
- **Retry lives on the message that failed**, and only on the last one: retrying an earlier answer
  would rewrite history the conversation has already built on. While `Retry-After` has not
  elapsed the button is disabled and counting down — letting it through early just spends another
  request on the same refusal.
- **`?simulate=` on the page URL is forwarded to the API**, so the mock's failure modes can be
  exercised through the interface. Verified inert in production.

## Where the AI got it wrong

- **What it did:** the `.visually-hidden` utility used `position: absolute`, the usual recipe.
  With no positioned ancestor, each hidden author label was laid out against the page rather than
  its scrolled container — so labels for messages further down the log landed at y=1457 and
  y=1662, stretching the document to 1663px inside a 771px viewport and giving the window its own
  scrollbar. The rule "only the log scrolls" was quietly broken.
  **How it was noticed:** a stray window scrollbar in a screenshot, then measuring
  `document.scrollHeight` against `innerHeight` instead of guessing.
  **How it was fixed:** the utility stays in flow at 1×1 with a negative margin, which cannot
  escape anything. This is exactly the class of defect the manual pass exists for: types, tests
  and review would all have passed it.

- **What it did:** gave the floating jump-to-bottom button no ground of its own. Nocturne's
  buttons are transparent by design, so the conversation read straight through it.
  **How it was noticed:** it looked like a rendering artifact in a screenshot.
  **How it was fixed:** whatever floats above the log now carries a surface and the system's
  elevation.

- **What it did:** the first empty state opened with an `har kun ai` heading directly beneath the
  `har kun ai` logo, and its subtitle repeated the composer's placeholder word for word.
  **How it was noticed:** seeing it rendered.
  **How it was fixed:** the heading now says what the app is, the lede explains the name, and the
  examples are about the app's own subject so they double as an explanation.

- **What it got wrong about its own verification, repeatedly:** several times a message "failed to
  send" and each time the app was fine. The cause was found only at the end: the tab being driven
  had `document.visibilityState === 'hidden'`, so synthetic keystrokes went to whichever tab was
  actually visible. Before finding that, I also declared that a dropped connection left a
  permanent spinner — it did not; the screenshot was simply taken before the error landed, and the
  stored state already said `error`.

  Two lessons, both already learned once in [0005](0005-scaffold.md) and not applied: check
  whether the *check* is broken before concluding the code is, and read state rather than
  inferring it from a screenshot's timing. Driving the controlled input through a React-style
  `input` event removed the dependency on window focus entirely and should have been the first
  move, not the last.

## What's left

- **320px was not verified in a browser.** The resize tool reported success while the viewport
  stayed at 1512, twice. The breakpoints, the full-width message below 640px, the self-scrolling
  code blocks and the hint that hides below 480px are all in the CSS and reviewed by reading —
  but not seen. This is the one item of the plan's verification table that is unconfirmed.
- The sidebar, and phase 3's live OpenRouter adapter.

## How to check

```bash
npm test && npm run build     # 101 tests
npm run dev                   # :5173
```

Verified by hand in Chrome:

| Check | Result |
|---|---|
| streaming | text appears progressively, not in one lump |
| stop by `Esc` and by button | partial text stays, interface alive, next message sends |
| `?simulate=429` | error card, `Retry-After` counting down, retry disabled until then |
| `?simulate=mid-error` | partial text stays above, error card beneath it |
| `?simulate=drop` | no permanent spinner; surfaced through the idle guard (see below) |
| `?simulate=timeout` | with a 3 s server threshold, the card appeared at 3.7 s |
| markdown | headings, lists, inline code, links and code blocks; nothing breaks mid-stream |
| reload mid-stream | conversation restored, unfinished answer `stopped` with its text, no indicator |
| tab order | skip link → log → in-answer actions → jump to bottom → composer → model picker |
| skip link | appears on focus with the accent ring |
| Network | 55 resources, every one from the page's own origin |
| production | server serves `dist`, `?simulate=` ignored, no key or foreign host in the bundle |

One finding worth keeping: through the Vite dev proxy, `?simulate=drop` surfaces as a stall caught
by the client's idle guard rather than as an immediate connection error, because the proxy holds
the browser connection open after the upstream dies. Against the server directly, `curl` sees the
connection severed at once. The user-visible outcome is correct either way; only the code and the
delay differ.
