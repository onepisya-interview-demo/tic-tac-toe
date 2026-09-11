# Multi-user stats — future work (DO NOT implement)

> **Status: placeholder. DO NOT implement until a future plan explicitly
> scopes this as its own deliverable.** This file documents a candidate
> shape change that the user mentioned in chat during plan
> `.omo/plans/stats-server-authoritative-delta.md` drafting, and was
> explicitly deferred because it is a product-shape change that should not
> be lumped into a bug-fix plan.

## Context (user's original mention)

While discussing the stats-server-authoritative-delta bug, the user raised
a related but separate direction: per-user accounts so two people on
different devices can share one scoreboard, plus a periodic reset (3 days)
so the scoreboard does not grow stale. The user did not request
implementation in this plan; the orchestrator recorded it here for future
reference.

## Deferred rationale — 4 open questions to resolve before implementation

1. **Identity layer.** Anonymous device tokens, signed cookies, or a real
   auth provider (Clerk / NextAuth / Vercel Identity)? Each option
   changes deployment shape and pull in a new dependency. AGENTS.md
   §本项目反模式 forbids new npm deps without explicit approval.
2. **Schema change.** Adding a `users` table and a per-user `game_stats`
   row breaks the existing single-row UPSERT in `lib/db.ts:saveStats`.
   Migration path for existing deployed instances is required; the
   current row at id=1 is implicitly the global tally.
3. **Cron / scheduling.** A 3-day reset needs a scheduler (Vercel Cron,
   GitHub Actions, external cron job). Each option has a different
   trigger surface and ownership boundary.
4. **Dep budget.** (1) and (3) almost certainly add at least one runtime
   dependency or platform setting. AGENTS.md §本项目反模式 says
   "不要引入 UI、路由、动画、数据访问或表单库" — these do not directly
   include auth providers, but the spirit applies: any new dep needs an
   explicit "why" + cost/benefit in a dedicated plan.

## "DO NOT implement" notice

This placeholder exists only so that future contributors do not silently
fold the above into the wrong plan. **Any commit that implements (1)–(4)
without a separate plan file in `.omo/plans/` referencing this file is
out of scope for stats-server-authoritative-delta and should be reverted.**

## Open questions

- Is the scoreboard meant to be shared across users (one global row per
  user-pair) or per device (each device has its own history)?
- Should the 3-day reset zero all rows, or only rows inactive for 3 days?
- Does the user want stats export / import?
- If identity is anonymous-device-token, what happens on cookie clear?

These are intentionally left open — they are scope-of-next-plan questions,
not blockers for stats-server-authoritative-delta.
