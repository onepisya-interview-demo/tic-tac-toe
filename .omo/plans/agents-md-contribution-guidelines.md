# Plan: AGENTS.md contribution guidelines + commit-as-prompt anchor

Intent: CLEAR (user asked for AGENTS.md to carry the project's own commit
guide, anchored to the local path, with patterns lifted from well-known
Next.js repos). Review: not required (LIGHT, single-file docs addition).

## What ships
A "Contribution Guidelines" section appended to `AGENTS.md` (below the
auto-emitted nextjs-agent-rules block), plus this plan file. The section
gives a contributor everything they need without leaving the repo: the
commit convention (WHAT/WHY/HOW + lore trailers), the atomic-commit
expectation, PR size guidance, the local path to the commit guide
(`.omo/plans/<slug>.md` referenced via the `Plan:` footer), and pointers
to the upstream Next.js repositories whose conventions this project
mirrors.

## File-by-file

### 1. `AGENTS.md` — append Contribution Guidelines section

Append below the existing `<!-- END:nextjs-agent-rules -->` marker, with
a clear visual separator so next dev's auto-emitter (which only touches
the BEGIN/END block above) doesn't fight the new content.

Sections inside the addition:
- **Commit convention** — Conventional Commits prefix, WHAT/WHY/HOW body
  (commit-as-prompt style), lore trailers (`Constraint:`, `Rejected:`,
  `Confidence:`, `Scope-risk:`, `Directive:`, `Tested:`, `Not-tested:`),
  and the `Plan: .omo/plans/<slug>.md` footer for any non-trivial commit.
- **Atomic commits** — one topic per commit; rebuilds and tests green on
  each; auto-emitted files (`next-env.d.ts`) get their own chore commit.
- **Plan files** — design records live under `.omo/plans/<slug>.md`,
  cited from the commit that ships the work, mirroring the
  `result-stats-reload.md` pattern already on the branch.
- **PR size** — keep PRs under 500 LOC and 10 files (calcom pattern);
  split by layer / feature component / refactor-vs-feature.
- **Repository conventions** — `AGENTS.md` is the AI-agent entry point,
  `CLAUDE.md` is its Claude Code include, and the upstream Next.js
  repos whose layout this mirrors: vercel/next.js, supabase/supabase,
  calcom/cal.com, shadcn-ui/ui.

Acceptance: `AGENTS.md` contains the new section, the upstream patterns
are named with their canonical repo paths, and the `Plan:`
footer convention points at `.omo/plans/<slug>.md`.

### 2. `.omo/plans/agents-md-contribution-guidelines.md` — this file

The decision record for the addition, kept under the same `.omo/plans/`
path every other task on the branch uses. The plan file itself lands in
the same commit as the AGENTS.md update so the audit trail is one click
deep from the shipped file.

## Must-NOT-Have (scope guardrails)
- Do NOT touch the auto-generated nextjs-agent-rules block.
- Do NOT introduce a `CONTRIBUTING.md` — the AGENTS.md addition is the
  contribution entry point on this branch; adding CONTRIBUTING.md would
  split the policy surface and need its own cross-link to avoid drift.
- Do NOT introduce commitlint config in this change — adding it would
  force every existing commit on `feat/ux-polish` (and main) through a
  retroactive lint pass; defer to a follow-up PR that wires it together
  with a husky pre-commit hook.
- Do NOT rewrite earlier commits to retrofit the new convention.

## Commit
- One atomic commit on `feat/ux-polish`:
  `docs(agents): add contribution guidelines and commit-as-prompt anchor`
- Footer `Plan: .omo/plans/agents-md-contribution-guidelines.md`.

## Out-of-scope
- A future iteration can split the section into `AGENTS.md` (AI-agent
  context) + `CONTRIBUTING.md` (human-contributor entry) + commitlint
  config, mirroring the vercel/next.js and shadcn-ui/ui layout
  exactly. That PR will replace this single-file anchor.
