## Summary

<!-- One paragraph. What does this PR change and why? -->

## Linked issues

<!-- Closes #<n> if applicable. -->

## Type

<!-- Tick exactly one. -->

- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] test
- [ ] docs
- [ ] chore
- [ ] build
- [ ] ci
- [ ] perf

## Checklist

<!-- Tick only what you have evidence for. -->

- [ ] I followed the commit policy in [AGENTS.md](AGENTS.md) (Conventional
      subject + WHAT/WHY/HOW body + lore trailers + Plan: footer).
- [ ] I read the design contract ([DESIGN.md](DESIGN.md)) and did not break
      tokens, focus ownership, or `prefers-reduced-motion` paths.
- [ ] New or changed behaviour has a RED-first test or QA probe.
- [ ] `pnpm vitest run` passes (paste tail below or link to run).
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build` passes (or PR is docs-only and I noted it).
- [ ] Browser UI changes: relevant `tests/qa/*.mjs` probe ran PASS.
- [ ] I did **not** introduce a new npm dependency.
- [ ] I did **not** bypass `commit-msg` hook with `--no-verify`.

## Verification evidence

<!-- Paste or link to the actual output. "looks correct" is not evidence. -->

```
$ pnpm vitest run
…
$ pnpm build
…
```

## Risk & rollback

<!-- One paragraph. What could break? How do we revert? -->
