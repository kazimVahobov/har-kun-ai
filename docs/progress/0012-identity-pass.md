# 0012 — Giving the interface a voice

- **Date:** 2026-09-29
- **Branch:** `feat/ui`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code, verified by hand in Chrome

## Task

Work through `.claude/skills/frontend-design/SKILL.md` and make the interface distinctive rather
than interchangeable — in particular the empty screen, which should say that this is an everyday
assistant instead of announcing that it is a chat.

## What was done

Three commits: the type set · opening on the day · the pen-mark while streaming.

- `src/lib/daytime.ts` (+16 tests) and `src/hooks/useDayContext.ts` — the day as data.
- `src/components/DayRule.tsx` — the day as one line, in two orientations.
- Reworked `EmptyState`, a dateline in the header, the day panel in `ChatShell`.
- Grain over the ground, a pool of accent light under the composer, a staggered entrance.
- The answer's accent mark reads like a pen while the stream runs.
- `docs/adr/0013-typography.md`, `docs/adr/0014-opens-on-the-day.md`, and the type section of
  `docs/design-system.md` rewritten to match.

117 tests in the project.

## Decisions taken

- **The type set changes, the palette does not.** The guidance names Inter among the fonts to
  avoid and asks for Cyrillic faces in a Russian project; it also warns against clichéd purple
  gradients. The first applies squarely — Inter's Cyrillic is anonymous. The second does not:
  Nocturne's blurple was derived in OKLCH on a shared lightness scale and is neither a gradient nor
  a cliché. Swapping a considered palette to satisfy the letter of a rule would be worse work.
  Reasoning in [ADR 0013](../adr/0013-typography.md).
- **The empty screen opens on today.** Greeting by hour, date in words, and starters that belong to
  that hour — which is where "assistant for every day" stops being a slogan.
  [ADR 0014](../adr/0014-opens-on-the-day.md).
- **The day is one line in two placements, never both.** Vertical in the right margin where there
  is margin, horizontal in the column where there is not. This also answers the complaint the
  screenshot made plain: on a wide monitor the empty right half read as an unfinished layout
  rather than as the system's asymmetry.
- **No Lottie.** It is a runtime library plus a JSON asset for something CSS does better here, and
  a canned animation from a library is precisely the generic look the guidance warns about. The
  day rule weighs nothing and belongs to this project. Said plainly rather than quietly skipped.
- **Unbounded never touches a button or a paragraph.** A display face that wide is an asset in two
  places and a liability everywhere else, so it has its own token rather than being wired into
  `--font-heading`.
- **The pen-mark replaces a border with a layer.** A border cannot carry a gradient; the mark
  needed to be dim over written text and bright where words are arriving.

## Where the AI got it wrong

- **What it did:** kept the day panel hidden until a conversation existed, reasoning that showing
  it alongside the empty state's own rule would duplicate the device.
  **How it was noticed:** the first screenshot after the change — the empty screen still had a
  dead right half, which was the specific complaint that started this work. The reasoning was
  sound and the result still failed.
  **How it was fixed:** the panel is always rendered and the column rule steps aside above 1024px,
  in CSS. One device, two placements, no duplication and no dead space. The lesson is the ordinary
  one: a rule that sounds right has to be looked at before it is believed.

- **What it nearly shipped:** a proposal built around the accepted design system without first
  checking it against the guidance it was being judged by. Inter and a purple accent are both on
  the guidance's list, and the system is built on both.
  **How it was noticed:** reading the skill before proposing rather than after.
  **How it was fixed:** the conflict was named up front and split — the font is a real problem and
  changed, the palette is a false positive and kept. Both written down. Had the skill been read
  after the proposal, the likely outcome is either ignoring it or throwing out a good palette to
  satisfy a keyword.

## What's left

- **320px is still unverified.** Unchanged from [0011](0011-styled-ui.md): the resize tool reports
  success while the viewport stays at 1512. The new pieces — the greeting at `clamp(26px, 4vw,
  34px)`, the dateline hidden below 480px, the column rule below 1024px — are reviewed by reading
  only.
- The starters are a fixed editorial set and will age; noted in ADR 0014.
- Phase 3, the live OpenRouter adapter, is still the outstanding functional requirement.

## How to check

```bash
npm test && npm run build    # 117 tests
npm run dev                  # :5173
```

By eye: the greeting and the starters should differ between morning and evening — the quickest way
to see it is to move the system clock. The mark on the day rule should sit where the clock says,
and the answer's accent bar should be brighter at the bottom while a reply streams.
