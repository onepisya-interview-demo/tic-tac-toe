# GitHub Copilot Instructions

This repository ships its AI-agent contract in [AGENTS.md](../AGENTS.md).
Copilot does not consume `AGENTS.md` natively; this file is the bridge so
Copilot picks up the same contract as Codex / Claude Code / Cursor.

## Required reading before any change

- [AGENTS.md](../AGENTS.md) — the binding contract for commits, branches,
  verification gates, doc layering, and anti-patterns. **Read the
  `<!-- BEGIN:project-contribution-guidelines -->` block first.**
- [CONTRIBUTING.md](../CONTRIBUTING.md) — the thin entry point.
- [DESIGN.md](../DESIGN.md) — only touch if the task explicitly modifies
  the visual or accessibility contract.

## Project at a glance

- Two-player pass-and-play tic-tac-toe on a single device. Stats persist
  via SQLite (file:) locally or Turso HTTP (libsql://) on Vercel, both through
  @libsql/client + Drizzle.
- Tech: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4
  design tokens, Zustand store, Drizzle ORM, @libsql/client.
- Single-row game_stats table; PUT/DELETE idempotent.

## Hard rules

- **Never** modify `lib/`, `app/`, `components/`, `db/` unless the user
  asks for that scope. Refactor / style work goes elsewhere.
- **Never** introduce a new npm dependency — **except** LSP server
  tooling (`typescript-language-server`, `bash-language-server`,
  `yaml-language-server`) as `devDependencies`. These are local developer
  tooling that never enters the Next.js runtime bundle; they exist to give
  Codex harness's `lsp.*` MCP tools version alignment with the project's
  TypeScript compiler (the Gauntlet doesn't ship an LSP). The on-disk LSP
  config is `.codex/lsp-client.json`. See AGENTS.md §本项目反模式 for the
  matching rationale and §验证门禁 on-demand rule for related verification.
- **Never** add `'use client'` to a file unless it actually needs it.
- **Never** add a UI / state / form / animation / data library — the
  project explicitly excludes them (see AGENTS.md §反模式).
- **Never** read `localStorage` on the SSR first frame.
- **Never** use emoji icons, inline hex colours, or component-level focus
  rings; use the design tokens in `app/globals.css`.
- **Never** use `git commit --no-verify`. The commit-msg hook enforces the
  lore trailer + Plan: footer.

## Verification gate

Every PR must leave these passing locally:

```
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm build
```

UI changes additionally require the relevant `tests/qa/*.mjs` probe to
PASS. See [AGENTS.md](../AGENTS.md) §验证门禁.

## Plan files

Non-trivial changes ship a design record at
`.omo/plans/<kebab-case-slug>.md` before the implementation commits.
Reference it from the commit footer with `Plan: .omo/plans/<slug>.md`.
