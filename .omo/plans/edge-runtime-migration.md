# Edge Runtime Migration — /api/stats

## Context
- User: "希望是 vercel 上线的时候是 边缘部署的" (production should deploy to Edge runtime)
- Current: `app/api/stats/route.ts` declares `runtime = 'nodejs'` because `lib/db.ts` imports `node:path`, `node:fs`, `@libsql/client` (native) at module top
- Edge runtime on Vercel doesn't have Node fs/path; native libsql sqlite bindings can't bundle

## Goal
- `runtime = 'edge'` for `/api/stats`
- `lib/db.ts` Edge-safe: no top-level Node-only imports
- File: URL branch still works for local dev / Node tests (lazy-loaded on demand)
- Production (Turso HTTP) is unaffected

## Approach
Lazy-load Node-only modules inside the file: branch. Top-level imports stay Edge-safe:
- Top: `@libsql/client/web`, types from `@libsql/client`, drizzle, schema
- Lazy: `node:path`, `node:fs`, `@libsql/client` (native) — loaded only when URL starts with `file:`

Both drivers expose `createClient(config) → Promise<Client>` (unified async shape), so the production route doesn't care which branch it hits.

## Files
- `lib/db.ts` — refactor; `selectDriver` returns async wrapper for file: branch; `resolveDbConfig` async; `createClientFn` async
- `app/api/stats/route.ts` — flip `runtime = 'nodejs'` to `runtime = 'edge'`
- `tests/db/db.test.ts` — update `__setCreateClientForTests` callbacks to async; update selectDriver identity test for file: branch (now a lazy wrapper, no longer identity-equal to native.createClient)
- `.omo/plans/edge-runtime-migration.md` — this plan
- `docs/operations.md` — note Edge runtime + alias reattach requirement
- `.vercel/project.json` — unchanged (CLI tracks deployment automatically)

## Verify
- `pnpm typecheck` 0 errors
- `pnpm lint` 0 errors
- `pnpm vitest run` 88+ tests pass (existing 88 + new Edge-shape assertions)
- `pnpm build` succeeds; Edge bundle output appears in `.next/server/app/api/stats/`
- `vercel --prod --yes` deploys; new deployment URL serves `/api/stats`
- 4-step curl round-trip on production URL: 200/200/200/200/200
- `vercel inspect <deployment>` shows `runtime: edge`
- HTTP response header includes `x-vercel-region: <edge-region>` or similar evidence of Edge execution
- Re-attach `3t-tic-tac-toe.vercel.app` after deploy (deployment-level alias)

## Risks
- Lazy import of `@libsql/client` may still be picked up by Turbopack bundler even though it's dynamic — Edge bundle might fail. Mitigation: keep the path minimal and let it fall through.
- Existing tests rely on `Object.is(driver.createClient, nativeClient.createClient)` for file: branch — assertion must change to behavioral.
- Web favicon.ico etc. unaffected — only `/api/stats` route gets Edge.

## Out of scope
- Custom domain (still optional, user can decide later)
- Phase 2 (GitHub push-to-deploy) — still blocked on GitHub repo creation
- Refactoring drizzle/schema (already Edge-safe — pure TS + SQL strings)
