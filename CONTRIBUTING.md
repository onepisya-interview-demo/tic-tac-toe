# Contributing

Thanks for your interest in this project. This document is a thin entry
point; **the authoritative contract lives in [AGENTS.md](AGENTS.md)**, which
governs commits, branches, verification gates, AI agent behaviour and
documentation layering. Read it before opening a Pull Request.

## Quick start

```bash
pnpm install
pnpm dev               # http://localhost:3000
pnpm build && pnpm start
pnpm test              # vitest
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint
```

The full toolchain and command reference is in `docs/operations.md`.

## Reporting bugs and proposing features

- Use the **Bug report** or **Feature request** issue templates — they
  capture the project context (Node version, pnpm version, browser, repro
  steps, expected vs. actual) that we need to triage.
- For security issues, **do not** open a public issue. Follow
  [SECURITY.md](SECURITY.md).

## Pull Requests

1. Fork and create a topic branch (`fix/<slug>`, `feat/<slug>`, etc.).
2. Make atomic commits — one topic per commit, each independently builds
   and tests green. See AGENTS.md §"原子提交" for the rules.
3. Match the existing code style: ESLint flat config (antfu-influenced),
   Tailwind v4 design tokens from `app/globals.css`, no inline hex,
   no emoji icons.
4. Fill in the PR template checklist. Don't tick boxes you can't back up
   with evidence.
5. Push and open the PR; CI (`.github/workflows/ci.yml`) will run lint,
   typecheck, test and build.

## Code of Conduct

By participating you agree to the
[Contributor Covenant 3.0](CODE_OF_CONDUCT.md). Enforcement contact is in
the CoC file.

## License

By submitting a contribution you agree your work is released under the
project's [MIT License](LICENSE).
