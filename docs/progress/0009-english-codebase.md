# 0009 — Moving the codebase to English

- **Date:** 2026-09-29
- **Branch:** `chore/english-comments`
- **Status:** done
- **Tools:** Claude Opus 5 in Claude Code

## Task

Translate everything a developer reads into English, in three passes and three commits:
documentation (plus the language rule for agents), then code comments, then server logs and test
names. Strings a person sees in the running app stay Russian.

## What was done

- **Pass 1** (`cd8b3b0`) — 28 files: `CLAUDE.md`, `README.md`, `docs/plan.md`,
  `docs/ui-structure.md`, `docs/design-system.md`, all twelve ADRs and both registers, all eight
  progress reports and the template.
- **Pass 2** (`75d0869`) — comments across `shared/`, `server/`, `src/` and `vite.config.ts`.
- **Pass 3** (this commit) — the server's startup log, and every `describe`/`it` name plus the
  test fixtures.

`TASK.md` untouched: it is the assignment as received.

## Decisions taken

- **The language rule went into `CLAUDE.md` as a table, in pass 1.** One sweep is not enough:
  while the instructions said "documentation, code comments and conversation in Russian", the next
  agent would write Russian comments again and the cleanup would come apart within two commits.
  The rule now states, line by line, what is English and what is Russian.
- **User-facing strings stay Russian, and the reason is recorded in
  [ADR 0005](../adr/0005-no-localization.md)** — the assignment arrived in Russian and will be
  reviewed in Russian. That ADR now carries the whole project's language rule, not just "no i18n
  library".
- **What counts as user-facing was decided explicitly**, because the boundary is not obvious:
  the `message` field of every contract error (it is meant for display), the mock's model names
  (they appear in the picker), and the markdown the mock generates (it is the model's answer).
  Everything else — including the server's startup log — is developer-facing and English.
- **One deliberately non-ASCII test fixture was kept** in the SSE parser tests, with a comment
  saying why: the payload travels as UTF-8 and has to survive intact. Translating every fixture
  would have quietly removed that check.
- **One report for three commits.** The rule is one file per task, not per commit, and this was
  one task.

## Where the AI got it wrong

- **What it did:** performed the comment replacements with a script, and one replacement dropped
  the opening `/**` of a block comment in `server/env.ts`. The file stopped being valid
  TypeScript — the comment body became code.
  **How it was noticed:** reading the edited file back, before running anything.
  **How it was fixed:** the opening line restored, `typecheck` confirmed. The lesson about
  scripted edits: a replacement whose "before" spans several lines has to include the block's
  boundaries, or the boundary is what gets lost.

- **What it did:** the first pass over the test files missed one comment — the explanation of the
  trailing `\r` inside a test body.
  **How it was noticed:** a `grep` for Cyrillic in comment lines across the whole tree, run before
  committing rather than after.
  **How it was fixed:** translated. Worth keeping as a habit: the audit is what closes a sweep
  like this, not the belief that every file was visited.

- **What it did not do, and should have earlier:** the instruction for this task said
  "пользовательские надписи оставляем **на английском**", which contradicts itself — those strings
  are currently Russian. Two readings were possible, and one of them would have invalidated ADR
  0005 and the whole first pass. Rather than guessing, the question was asked before any file was
  touched. Recorded here because the opposite habit is what produced the scope mistakes in
  [0003](0003-ui-structure.md) and [0004](0004-sidebar-scope-check.md).

## What's left

- Nothing for this task. Next: `storage.ts`, then `useChat`, then the bare page.
- One judgement call worth revisiting at README time: the README is now in English, while the
  reviewer reads the assignment in Russian. The decisions and the AI log they will read are
  English. That is deliberate, but it is the one document where the audience argument cuts the
  other way.

## How to check

```bash
npm run typecheck
npm test            # 50 tests, all names in English
npm run dev:server  # [server] development, mock, listening on http://localhost:8787
```

The audit that closes the sweep:

```bash
# no Russian comment lines anywhere
grep -rnP '^\s*(//|\*|/\*).*[А-Яа-яЁё]' --include='*.ts' --include='*.tsx' shared server src

# what Russian remains, and it should all be user-facing
grep -rnP '[А-Яа-яЁё]' --include='*.ts' --include='*.tsx' shared server src vite.config.ts
```

The second command's output was reviewed line by line: contract error messages, the page copy, the
mock's model names and generated markdown, and the deliberate UTF-8 fixtures. Nothing else.
