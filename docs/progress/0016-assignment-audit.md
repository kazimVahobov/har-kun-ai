# 0016 — Auditing the repository against the assignment, and closing what it found

- **Date:** 2026-09-30
- **Branch:** `fix/audit`
- **Status:** partial — the repository-level findings are the owner's to close, see "What's left"
- **Tools:** Claude Opus 5 in Claude Code, driven by the repository owner; Chrome automation for
  the one check that needed a screen

## Task

Read `TASK.md` line by line and check the repository against it — code, documentation and git
history — then fix what the check turned up. The owner kept the first four findings, which are
about the repository rather than the code, and asked for the rest to be closed.

## What was done

**A real bug, found by reading `.env.example` against `vite.config.ts`.** Vite does not load `.env`
into `process.env`, so a `PORT` set in that file moved the backend while the dev proxy went on
pointing at 8787 — every `/api` call in development would have failed. `.env.example` promised the
opposite in as many words. Now read through `loadEnv`, with the `PORT` prefix rather than `''`:
the wide form pulls every key in the file, the OpenRouter one included, into the config's scope.

**Two clauses of `CLAUDE.md` that the code could not satisfy.**

- Clause 3 demanded a `:focus-visible` beside every `outline: none`. The composer's textarea has
  neither — its indicator is the accent border the surrounding frame takes, which is the right
  design for a field that is part of a larger control. The rule now asks for a declared
  replacement instead of one specific selector; ADR 0007 says which one the composer uses and why
  it is `:focus-within`; the two CSS rules point at each other.
- Clause 7 demanded `var(--font-*)` for every pixel value, while the system carries no size tokens
  at all and `system.css` is ported with its literals intact. Every stylesheet in the project broke
  it by construction, which makes a rule worth nothing. The sizes below body text — the scale most
  of this interface is actually set in — are now a table in `docs/design-system.md`, along with the
  three sizes deliberately off it, and the clause points there. The one genuine violation, a `#000`
  in the contents rail's mask, became `--mask-opaque`.

**The language rule, applied to the two files that had escaped it.** `.env.example` and
`.gitignore` were the only developer-facing files still in Russian, while the README claims
everything a developer reads is English. While in `.env.example`: `KEEPALIVE_MS` and
`OPENROUTER_BASE_URL`, the two knobs `env.ts` reads and the file did not mention.

**A heading outline.** There was no `h1` anywhere: the empty state opened at `h2`, a message's
author was `h3`, an error's title `h4`, and after the first message the document began at `h3`.
The mark is now the `h1` — the only thing that names the whole screen and, unlike the greeting,
survives the first message. Authors are `h2`, an error's title `h3`. That would have let a `#` in
an answer render a second `h1`, so markdown headings shift down two levels; the rendered sizes are
unchanged.

**Dead code, deleted; deferred code, labelled.** `clearState`, `StateSaver.cancel`, `findChat` and
`streamingMessage` had no caller in the application. The multi-chat actions stay — they are the
shape ADR 0012 kept while deferring the sidebar — and the reducer now says so at the top, so the
next reader can tell deferred surface from rubbish without going to the ADR.

**Smaller:** `@fontsource/inter` removed (nothing imported it after ADR 0013 replaced Inter);
`.claude/` untracked, having landed in an unrelated UI commit; `X-Powered-By` disabled; ADR 0008
corrected to the storage key the code has used since it got a version; the plan corrected to the
branch phase 4 actually shipped on; a comment in `ChatShell` moved onto the element it describes.

## Decisions taken

- **Rules bent to the code, not code to the rules, in both clauses** — because in both the code was
  right. The composer's frame really is the better indicator, and font sizes really have no tokens
  to come from. Inventing a `--font-size-*` scale to satisfy clause 7 would have meant rewriting
  every stylesheet to make a document true. What was given up: the clauses no longer read as
  absolutes, and an absolute is easier to check.
- **Markdown headings shifted rather than left alone** — making the mark an `h1` created the
  collision, so fixing it belongs to the same change. The cost is a stylesheet whose selectors read
  one level off the markdown they style, which is now a comment at the top of that file.
- **`.claude/` untracked rather than kept** — it is agent tooling, not project configuration, and
  the layout section of `CLAUDE.md` never mentions it. It sits with `.idea` and `.vscode` now.
- **The multi-chat reducer surface kept** — deleting it would have quietly reversed ADR 0012, which
  is the owner's decision and not a cleanup.

## Where the AI got it wrong

- **What it proposed:** that the `X-Powered-By` header was gone, on the evidence of a `curl` run
  straight after the fix.
- **How it was noticed:** the header was still there. The port was held by a server started earlier
  in the session, so the process that answered had been running since before the change — which is
  exactly the failure already written up in [0014](0014-openrouter.md), where two `npm run dev`
  stacks fought over a port and the older one won. Knowing a trap is written down is not the same
  as remembering it.
- **How it was fixed:** killed the stale process, reran on a free port, header gone. The lesson is
  narrower than "check the port": a check that passes against a process you did not start is not a
  check.

Two more, both in the audit rather than in the fixing:

- **Counted the wrong thing and published it.** The README says the work took 73 commits; at the
  commit that wrote that line the history held 75. A number nobody will verify is exactly the kind
  that gets written from memory.
- **Nearly repeated a defect while fixing another one.** The link override in `Markdown.tsx`
  spreads its props into the DOM, and react-markdown passes the hast node to every custom
  component — so `node` was going into the markup as an attribute. Found only because the heading
  remapping meant reading how `components` is typed; the type checker is happy either way and
  nothing on screen looks wrong. Fixed by destructuring it away, verified in Chrome.

## What's left

Four findings from the audit are deliberately not in this branch, because they are about the
repository rather than the code and are the owner's to close:

1. **`master` is the default branch and holds only the initial commit.** All nine pull requests
   merged into `dev`. Anyone opening the repository sees a two-line README and a licence. One PR
   from `dev` to `master` closes it, and is also the "merge it like normal team work" the
   assignment asks for.
2. **PR #9 was opened with an empty description**, where the other eight have real ones.
3. **The phase that wrote the README has no report here**, which is why this file is 0016 and not
   0017. Reports are not written after the fact — that rule is in `README.md` next door — so the
   gap stays a gap.
4. **The 2–6 hour budget was not met and the README does not say so.** The assignment treats not
   finishing as a normal outcome and asks for it in words; it does not ask for three times the
   work, and being silent about that reads worse than naming it.

## How to check

```bash
npm run typecheck && npm test        # 164 tests
npm run build && grep -ril "openrouter\|bearer" dist/   # nothing
```

The proxy fix, end to end: set `PORT=9911` in `.env`, run `npm run dev`, and confirm the server
boots on 9911 and `http://localhost:5173/api/health` answers. Before the fix the second half
returns a proxy error.

The heading outline, in the browser console on a conversation with one answer containing a `#`:

```js
[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => h.tagName + ' ' + getComputedStyle(h).fontSize)
```

Expect `H1 18px`, `H2` per turn, then `H3 20px` and `H4 17px` inside the answer — the same sizes
the markdown scale had before the shift. The rendered link should carry `target`, `rel` and no
`node` attribute.

`curl -sI localhost:8787/api/health` should show no `X-Powered-By` — from a server started after
the change, which is the part that caught me out.
