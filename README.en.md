# Tic-Tac-Toe

> [中文](README.md) ｜ English

> Applies to: this repo's `dev` branch (production: `main`), Node.js 24 (matches `engines` / `.nvmrc` / CI), pnpm ≥ 10, Turso CLI ≥ 0.100.

<p align="left">
  <a href="LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://www.typescriptlang.org"><img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6.svg"></a>
  <a href="https://nextjs.org"><img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000.svg"></a>
  <a href="https://react.dev"><img alt="React 19" src="https://img.shields.io/badge/React-19-149eca.svg"></a>
  <a href="https://eslint.org"><img alt="ESLint" src="https://img.shields.io/badge/code%20style-ESLint-4B32C3.svg"></a>
  <a href="https://vitest.dev"><img alt="Vitest" src="https://img.shields.io/badge/tested%20with-Vitest-6E9F18.svg"></a>
</p>

A two-player, same-device pass-and-play tic-tac-toe game where **the home page is a showcase** and **one game ships in two versions — offline and online** — with automatic score tracking. Web app, desktop-first, restrained dark engineer aesthetic (Linear + Vercel style).

Stack: Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4 + Zustand + Drizzle ORM + @libsql/client (local file: sqlite / Turso HTTP on Vercel).

## Preview

| Showcase page | online board | result | offline board |
| --- | --- | --- | --- |
| ![Home](docs/screenshots/home.png) | ![Play](docs/screenshots/board.png) | ![Result](docs/screenshots/result.png) | ![Solo practice](docs/screenshots/solo.png) |

Filenames are intentionally preserved (`board.png` now corresponds to `/online`; `solo.png` now corresponds to `/offline`) so PR diffs and existing screenshot assets stay aligned. The narrative in this README reflects the renamed routes.

## Quick start

1. `git clone <this-repo> && cd tic-tac-toe`
2. `pnpm install`
3. `pnpm dev` → http://localhost:3000
4. Done — local development needs no `.env.local` and no env vars; scores persist automatically to local sqlite at `data/tic-tac-toe.db`.

## One game, two versions

The product model ([`.omo/plans/ulw-one-game-two-versions.md`](.omo/plans/ulw-one-game-two-versions.md) §0) is "the same game, two versions". The home page is a showcase (hero + dual CTA + identity region + online stats card + merge dialog), and the user picks by intent.

### `offline` (SPA · pure local · solo practice)

- Route: `/offline` (client component, in-page board↔stats view-swap).
- **100% local**: fully offline, browser ledger, never sends a fetch; outcomes land in `localStorage['ttt.offline.stats.v1']`.
- **Anonymous is not recorded**: an anonymous player on `/offline` can move pieces and trigger win/draw animations, but the outcome does not enter the score ledger.
- In-page result: win/draw auto-switches to the stats view + confetti (W3 result-paginated).
- **The only network writes** happen during cross-device merge on the home page via the `HomeDialogMount` dialog (`pendingSyncCount() > declinedSentinel` opens the dialog, otherwise the home page stays silent). Dialog primary CTA "merge and clear" → `POST /api/sessions` + `POST /api/players/{name}/stats/merge`; secondary CTA "keep local" sends zero network writes.

### `online` (RSC · real-time cloud · online versus)

- Route: `/online` → on game end, the navigator pushes `/result?name=<name>`. `/result` is an RSC real-time score sheet (`dynamic='force-dynamic'`, reads `lib/db.ts:loadRecordByName`).
- **Requires a name**: entry gate — `StartGameButton` blocks when `useGameStore.playerName` is empty, dispatches `ttt:player-name-required` so the identity region focuses and shows an inline nudge.
- **Server-authoritative accumulation**: on game end, `POST /api/players/{name}/stats/outcomes` → server-side `recordOutcomeForName` → `/result` renders the up-to-date row.
- Cross-device consistency: server is the single source of truth; client only renders a read-only view.

### Home page = showcase

`app/page.tsx` is the project's landing surface: `<h1>井字棋</h1>` + subline "Two players take turns on one device; scores tracked automatically" + dual CTA (offline "单机练习 · 离线可玩 · 本地记账", online "在线对战 · 战绩实时云端") + `OnlineStatsCard` (per-name read-only) + `PlayerNameForm` (folded register/login) + `HomeDialogMount` (mount effect for the cross-device merge dialog) + `<script type="application/ld+json">` (schema.org `VideoGame` + `WebApplication` + `playMode: MultiPlayer` + `applicationCategory: Game` + `offers(price 0)`). The JSON-LD is the structured-data surface for AI aggregators and search engines; it is readable directly from the home-page source.

## Features

- 🎯 **One game, two versions**: offline (SPA, pure local, only network writes happen during merge) + online (RSC, server-authoritative accumulation, `/result` real-time score sheet); the home page is a showcase (hero + dual CTA).
- 💾 **Score persistence**: online uses the `game_stats` table (per-name, `name TEXT UNIQUE`, file: sqlite locally / Turso HTTP on Vercel); offline uses `localStorage['ttt.offline.stats.v1']`. The two ledgers never mix.
- 🌒 **Dark-first**: built on Tailwind v4 design tokens; desktop-first, mobile works but is not the target.
- ⌨️ **Keyboard-first**: the board uses roving focus — Tab enters the board, arrow keys move focus between cells, Enter/Space places a mark; gameplay needs no mouse.
- 🔇 **Lazy audio**: AudioContext is created only after the first user gesture; off by default and persisted.
- ✨ **Accessible confetti**: a no-motion path under `prefers-reduced-motion`, stable `data-testid` hooks.
- 🎞️ **Page transitions**: navigation across the four routes runs on React 19 `<ViewTransition>` as a bidirectional crossfade; older browsers fall back to no transition automatically.
- 🧪 **Gauntlet test stack**: vitest + fast-check (property) + Stryker (mutation) + commitlint + commit-audit, enforcing 80% line / 70% branch coverage.
- 🚀 **Vercel-ready**: the http(s) branch of `@libsql/client` connects straight to Turso on Vercel serverless — zero native modules, zero fs dependency.

## Routes

| Route | Description |
| --- | --- |
| `/` | Showcase: hero + dual CTA + identity region (folded) + online stats card + merge dialog (mount effect) |
| `/online` | Online versus: 3x3 board + current player indicator + restart; on game end, auto-pushes `/result` |
| `/offline` | Solo practice: 3x3 board + solo stats panel (anonymous-not-recorded, zero network writes, the only network writes happen via the home-page merge dialog) + auto-switch to stats view on win/draw |
| `/result?name={trimmed}` | Real-time score sheet (RSC): reads the `game_stats` row by name, renders StatsGrid + play again + back home |

## RESTful API reference

Four endpoints, modeled after [AIP-136](https://google.aip.dev/136) / [RESTfulAPI.net](https://restfulapi.net/), with unified RFC 9457 `application/problem+json` error responses (`lib/api-problem.ts`).

| Method + path | Body | 2xx response | Errors (problem+json) |
| --- | --- | --- | --- |
| `POST /api/sessions` | `{ name }` | `200 { stats, existed }` — idempotent register/login (`existed:false` creates empty row; `existed:true` returns existing row) | `400 invalid-json` / `422 invalid-request-shape` / `422 invalid-player-name` / `500 db-unavailable` |
| `GET /api/players/{name}/stats` | — | `200 { stats }` — server-authoritative per-name row lookup | `404 stats-not-found` / `422 invalid-player-name` / `500 db-unavailable` |
| `POST /api/players/{name}/stats/merge` | `{ stats }` | `200 { stats }` — server `load → accumulateMergeStats per-field sum → upsert` | `409 player-session-required` (anti-silent-create) / `400 invalid-json` / `422 invalid-request-shape` / `422 invalid-player-name` / `500 db-unavailable` |
| `POST /api/players/{name}/stats/outcomes` | `{ outcome: 'X' \| 'O' \| 'draw' }` | `200 { stats }` — server `load → recordOutcome → upsert` (`lib/db.ts:recordOutcomeForName`) | `404 stats-not-found` (anti-silent-create) / `400 invalid-json` / `422 invalid-request-shape` / `422 invalid-player-name` / `500 db-unavailable` |

### problem+json error shape

All 4xx/5xx responses share one RFC 9457 shape:

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://docs.example.com/probs/player-session-required",
  "title": "Player session required",
  "status": 409,
  "detail": "No row for name \"alice\". Register or log in before merging."
}
```

The `type` field is a stable short-URI (https form) so clients branch on type rather than scraping text. Registered slugs: `stats-not-found` / `player-session-required` / `invalid-player-name` / `invalid-request-shape` / `invalid-json` / `method-not-allowed` / `db-unavailable`.

### Client-side callers

- `lib/game-net.ts` — browser-side HTTP thin shell (4 functions + 8s `AbortController.timeout()` + `{ ok, value } | { ok: false, reason }` contract).
- `PlayerNameForm` → `postSession`
- `OnlineStatsCard` → `fetchPlayerStats` (404 is translated to `{ stats: null }`, so display code branches on a single null sentinel)
- `SyncConfirmDialog` → `postSession` + `postMerge` (merge runs register-or-login first, then merge)
- `lib/store.ts:apiRecordOutcome` → `postOutcome` (the online branch's write action)

### Retired endpoints (historical note)

`/api/stats`, `/api/stats/outcome`, `/api/solo-stats`, `/api/solo-stats/sync`, `/api/player-session` were retired in W1-W2. The `/api/stats` chain (GET/PUT/DELETE full-row) was retired along with the ranked single row (id=1, name=NULL); the `/api/solo-stats/*` chain was superseded by the RESTful four endpoints when the solo by-name path was unified. Historical commit anchors: [`.omo/plans/ulw-one-game-two-versions.md`](.omo/plans/ulw-one-game-two-versions.md) §0 / §2.

## GraphQL dual-transport compatibility (service/transport separation)

`lib/db.ts` is the **service layer**. All "read / mutate / write score" business rules converge on pure functions (no HTTP context, no `NextResponse`, no status-code knowledge). Callers are the browser-side `lib/store.ts` or the Node-runtime `app/api/**/route.ts`.

**Strong constraints** (since W2 — see `ulw-one-game-two-versions.md` §0; every transport must obey):

1. Service functions return pure data + status flag:
   - hit: return `GameStats` (or `{ stats, ... }` plain object);
   - miss: return explicit `null` or a named `not-found` string;
   - exception: throw `Error` (caller try/catch → problem+json).
   **Never** return `Response` / `NextResponse` / `{ status: 404 }`.
2. Service functions don't read `Request` / `headers` / `URL.searchParams`; parsing belongs to the transport layer.
3. Service functions don't log or `console`; observability is the caller's responsibility.
4. Any transport (RESTful route / **GraphQL resolver** / gRPC handler) only:
   - parses input → calls service → maps the result to its own status code / problem+json / GraphQL error / gRPC status;
   - **never** writes its own "read → mutate → upsert" business rule.

**GraphQL compatibility**: introducing a GraphQL endpoint later means *only* adding schema + resolver; service functions stay unchanged. `registerOrLoginName` / `loadRecordByName` / `mergeRecordByName` / `recordOutcomeForName` / `accumulateMergeStats` are already the service-layer single source of truth.

## Vocabulary notes

The repo aligns version names to **schema.org** — `offline` / `online` (the connectivity dimension), not `single` / `multi` (the player-count dimension):

| Dimension | schema.org enumeration | Mapped here | Notes |
| --- | --- | --- | --- |
| Player count | `GamePlayMode: SinglePlayer / MultiPlayer / CoOp` | `MultiPlayer` (two-player same-device pass-and-play) | Single source of truth, orthogonal to connectivity |
| Connectivity | — | `offline` (no network) / `online` (real-time cloud) | The product's binary choice |
| Game type | `@type: VideoGame` + `applicationCategory: Game` + `gamePlatform: Web Browser` | Home-page `<script type="application/ld+json">` | Structured data surface for AI / search engines |
| Price | `offers.price: 0` + `priceCurrency: CNY` | — | Free, no in-app purchases |
| Player count | `numberOfPlayers: { minValue: 1, maxValue: 2 }` | — | Same on desktop / mobile |

**Why not `single / multiplayer`**: in the `GamePlayMode` context, `SinglePlayer` means "one player versus the system" (i.e. versus AI), but this repo's board is two-player same-device pass-and-play — no AI opponent. `MultiPlayer` accurately expresses "two or more players versus each other". The repo's binary choice (offline / online) is **connectivity** (whether the score sheet is real-time cloud), orthogonal to **player count** — so names follow connectivity; schema.org vocabulary is wired through `MultiPlayer` + `VideoGame.playMode`.

**Why `solo / ranked` retired**: the old vocabulary mapped `solo` onto schema.org's `SinglePlayer` (semantic collision with the actual model) and `ranked` implied ranking/ladder semantics (this repo has no ladder or matchmaking — it's a per-name score ledger). W1 swapped them to `offline / online` per plan §1.

## Deprecated localStorage keys

After the W1-W4 cleanup, the old `ttt.solo.*` keys are retired — **no migration** (new and existing users land on the new keys; old key residue is harmless):

| Old key | Replacement | Status |
| --- | --- | --- |
| `ttt.solo.stats.v1` | `ttt.offline.stats.v1` (`lib/offline-stats.ts:OFFLINE_STATS_KEY`) | Retired, no migration |
| `ttt.solo.server.synced.v1` | `ttt.offline.last-merged-local.v1` (W4 F1 baseline model) | Retired, no migration; helpers kept `@deprecated` for the legacy test surface |
| `ttt.solo.sync-declined.v1` | `ttt.offline.sync-declined.v1` (`components/SyncConfirmDialog.tsx:SYNC_DECLINED_KEY`) | Retired, no migration; same sessionStorage sentinel semantics |
| `ttt.player.name.v1` | (preserved) | Only kept key; shares source with `lib/player-name.ts:normalizePlayerName` |

## Local development

```bash
pnpm install
pnpm dev              # http://localhost:3000
pnpm build && pnpm start
```

> **Known issue**: on macOS, a cold-start `pnpm dev` may hit a Watchpack `EMFILE` storm (~668 failures plus a `.next/dev` deleted restart loop). This is upstream [vercel/next.js#93175](https://github.com/vercel/next.js/issues/93175) — still OPEN, not fixed (watchpack per-directory watcher × pnpm directory farm × macOS FSEvents per-process stream ceiling; not an fd exhaustion). Temporary workaround: `WATCHPACK_POLLING=true pnpm dev`. See `AGENTS.md` § Project anti-patterns.

Defaults to `DATABASE_URL=file:./data/tic-tac-toe.db`; data lands in `data/tic-tac-toe.db`. **After a fresh clone you do NOT need to create `.env.local`** — `lib/db.ts` defaults to the embedded sqlite at `file:./data/tic-tac-toe.db` (bundled with `@libsql/client`). `.env.example` is only needed when you switch to Turso or a custom path. For HTTP deployment see the "Deployment" section below.

Want to hook up a real Turso database locally? See [the local Turso guide](docs/local-turso-setup.md).

## Gauntlet toolchain

| Layer | Tool | Command |
| --- | --- | --- |
| Unit / property tests | vitest + fast-check | `pnpm test` |
| Type check | tsc (strict) | `pnpm typecheck` |
| Lint | eslint (next) | `pnpm lint` |
| Coverage | v8 (per-file) | `pnpm test:coverage` |
| Mutation | Stryker (scoped to `lib/` + `db/`) | `pnpm test:mutation` |
| Build | Next.js 16 (Turbopack) | `pnpm build` |
| E2E visual | Playwright (vs `pnpm start`) | `node tests/qa/visual-qa.mjs` |

Thresholds live in `vitest.config.ts`: lines / functions / statements 80%, branches 70%.

## Repository layout

```
app/                  App Router routes + RESTful API handlers
  layout.tsx          fonts (Geist / Geist Mono) + dark base + JSON-LD
  page.tsx            showcase page (Client): hero + dual CTA + identity + stats card + dialog
  online/page.tsx     online versus (Client): on game end, push /result
  offline/page.tsx    solo practice (Client): pure local, board↔stats view-swap
  result/page.tsx     real-time score sheet (RSC): reads game_stats row by ?name=
  api/sessions/route.ts                       POST idempotent register/login {stats,existed}
  api/players/[name]/stats/route.ts           GET per-name row lookup (200/404)
  api/players/[name]/stats/merge/route.ts     POST cross-device per-field merge (200/409)
  api/players/[name]/stats/outcomes/route.ts  POST online per-game accumulation (200/404)
  globals.css         @theme tokens, dark base
components/           Board + dialog/stats client components + ui/* base components
db/schema.ts          Drizzle schema (single-row game_stats, name TEXT UNIQUE)
lib/
  game.ts             pure functions: board/winner/legal moves/random first player/score accrual
  game.test.ts        unit + fast-check property tests (co-located)
  db.ts               service layer: @libsql/client + Drizzle (file:/http(s): adaptive); pure functions, zero HTTP context
  store.ts            Zustand store: phase/board/currentPlayer + game-net sync + mode='online'|'offline'
  game-net.ts         browser HTTP thin shell: postSession/fetchPlayerStats/postMerge/postOutcome (8s AbortController)
  api-problem.ts      RFC 9457 problem+json helper
  offline-stats.ts    localStorage persistence (OfflineStatsPanel data source) + sentinels
  player-name.ts      name whitelist normalizePlayerName (server-side single source of truth)
  home-jsonld.ts      schema.org JSON-LD payload + Next.js 16 XSS-safe serializer
data/                 local SQLite file (gitignored)
reports/mutation/     Stryker html + json reports (gitignored)
coverage/             v8 coverage html report (gitignored)
tests/qa/             Playwright visual + commit audit + one-identity-qa integration probe
public/               static assets (logo / favicon / social-card)
```

## Docs index

| Doc | Contents |
| --- | --- |
| [DESIGN.md](DESIGN.md) | Design contract: color / type / spacing / motion / a11y tokens; §Modes describes the two versions |
| [AGENTS.md](AGENTS.md) | AI agent & contribution spec: commit conventions, gauntlet, verification gates; code map renamed to offline/online |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commit flow & local quick start |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Contributor Covenant 3.0 |
| [SECURITY.md](SECURITY.md) | Private vulnerability disclosure |
| [docs/testing.md](docs/testing.md) | Testing philosophy: layers, thresholds, RED-first, QA probe design |
| [docs/operations.md](docs/operations.md) | Ops manual: daily commands, DB, QA, commit cheatsheet, troubleshooting |
| [docs/learnings.md](docs/learnings.md) | Learnings: pitfalls & version notes |
| [docs/branching.md](docs/branching.md) | Branching: trunk-based, dual rulesets, collaboration evolution |
| [.omo/plans/ulw-one-game-two-versions.md](.omo/plans/ulw-one-game-two-versions.md) | One-game-two-versions + RESTful + schema.org vocabulary alignment plan |

## FAQ

**How do I switch to Vercel persistence?** The default `DATABASE_URL=file:./...` sits on ephemeral fs inside Vercel serverless and does not persist. Point `DATABASE_URL` at `https://<db>.turso.io` (or `libsql://<db>.turso.io`) and set `DATABASE_AUTH_TOKEN=<turso-issued-token>`. `lib/db.ts` automatically takes the http(s) branch and stops touching the filesystem and native sqlite. See "Deployment" below.

**Can I play offline?** Moves work (frontend rules need no network). The offline mode is fully offline with zero network writes; the online mode requires `POST /api/players/{name}/stats/outcomes` per game, so games finished while offline lose their score and later GETs won't backfill. Vercel Analytics noise (POSTs to `<vercel-analytics-sandbox-id>/view`) cannot be suppressed — it is a Vercel-injected beacon.

**How does the online entry gate work?** `StartGameButton`'s `requireName` prop defaults to `true` for the online CTA. With no name set: click → preventDefault → dispatch `ttt:player-name-required` CustomEvent (no `startGame()` call, no `router.push()`); `PlayerNameForm` listens for the event and focuses its input + shows the inline nudge. With a name set: `startGame('online') + router.push('/online')` directly.

**How does offline cross-device sync work?** The player name is the identity. Saving a name hits `POST /api/sessions` (returns `{ stats, existed }` to distinguish the two semantics; `name` is UNIQUE and immutable). After that, every offline game stays purely local — the store never sends a fetch. When local leads server (typical: a few games played on device A without network, then back online), the merge path is explicit: returning to `/` with `pendingSyncCount() > declinedSentinel` opens `SyncConfirmDialog`; "merge and clear" fires `POST /api/sessions` + `POST /api/players/{name}/stats/merge` (server-side per-field merge) and then clears local + writes the `ttt.offline.last-merged-local.v1` baseline sentinel (W4 F1 model); "keep local" sends zero network writes and navigates. Concurrent same-name merges are deliberately last-write-wins — there is no CRDT and no timestamp reconciliation. Over-engineering merge hides simple questions like "why isn't the deletion syncing?".

**Why is `solo / ranked` gone?** See "Vocabulary notes" above. W1 swapped them for `offline / online` per schema.org vocabulary alignment. `solo` collided with schema.org `SinglePlayer` (semantic collision with the actual model), and `ranked` implied ladder semantics that don't exist in this repo.

**How do I clear stats?** Online: delete the corresponding `name` row (admin operation; no frontend UI; or equivalent `DELETE` via curl). Offline: the "clear local stats" button in `OfflineStatsPanel` instantly clears `localStorage['ttt.offline.stats.v1']` and the StatsGrid re-renders.

**Can I switch dark mode to light?** Not currently. Tailwind v4 design tokens converge on the `dark` palette; a light theme means repainting the whole token set and syncing `DESIGN.md` — out of scope for now.

**Why RED-first tests?** Any behavior change must first ship a failing test; otherwise commit-audit cannot tell "a real new test" from "copy-paste" — see `docs/testing.md` §RED-first.

**Stryker / Playwright failing?** Locally, mutation and E2E are not mandatory beyond CI; PR review relies on vitest + browser QA probes. When they fail, start with the troubleshooting section of `docs/operations.md`.

## Deployment

### Single machine / local

Leave `DATABASE_URL` unset or set it to `file:./data/tic-tac-toe.db`; data lands in `data/tic-tac-toe.db` inside the repo, no token needed.

### Driver layer (deep module)

`lib/db.ts` encapsulates driver selection inside the file: it imports both `@libsql/client` (native sqlite) and `@libsql/client/web` (HTTP client), and a `selectDriver(url)` factory picks automatically by `DATABASE_URL`:

| URL shape | Driver | For |
| --- | --- | --- |
| `file:...` | `@libsql/client` native | local / CI / single machine; embedded sqlite, zero config |
| `http://` / `https://` / `libsql://` | `@libsql/client/web` | Vercel serverless / Edge; Turso HTTP, no native binding |

Callers (`app/api/**/route.ts`, `lib/store.ts`, `lib/game-net.ts`) change **nothing** — they import `loadRecordByName` / `upsertRecordByName` / `registerOrLoginName` / `mergeRecordByName` / `recordOutcomeForName` / `accumulateMergeStats` / `closeDb`; driver choice stays hidden inside the db module.

### First Vercel + Turso deployment

1. Create a database at [turso.tech](https://turso.tech): `turso db create <your-db-name>`.
2. Get the libsql URL: `turso db show <your-db-name> --url`.
3. Get an auth token: `turso db tokens create <your-db-name>` → JWT.
4. Vercel project → Settings → Environment Variables, add two entries:

   | Variable | Value | Note |
   | --- | --- | --- |
   | `DATABASE_URL` | `libsql://<your-db-name>-<your-org>.turso.io` | `lib/db.ts` routes `libsql://` through the HTTP branch |
   | `DATABASE_AUTH_TOKEN` | the JWT from step 3 | Vercel only, never in git |

   > **Configure before the first push** — otherwise the first deployment builds without `DATABASE_URL` and scores land on ephemeral fs.
5. `git push` to Vercel; the RESTful four endpoints persist via the Turso HTTP client automatically.

**Rehearse locally before pushing**: put the two env vars into `.env.local` (gitignored), run `pnpm build && pnpm start`, then `curl localhost:3000/api/sessions` to confirm read/write; push only when it passes.

Never keep a `file:` URL on Vercel — serverless containers have ephemeral fs; data does not survive requests.

### Vercel troubleshooting

- **Stats wiped / gone after a while**: a stale `file:` URL on Vercel. Serverless fs is ephemeral; gone on restart. Delete the variable or switch to `libsql://`.
- **fetch failed**: `DATABASE_URL` is wrong (missing `libsql://` prefix or bad domain). Unknown schemes pass through `lib/db.ts` untouched and the client raises a protocol error.
- **401 / 403**: `DATABASE_AUTH_TOKEN` missing, expired, or belongs to a different database. Re-run `turso db tokens create <your-db-name>` and update Vercel.
- **Build fails**: first check both variable names character-for-character — `DATABASE_URL` and `DATABASE_AUTH_TOKEN`; case and underscores matter.

- **CLI deploy vs Git auto-deploy (error signal cheat sheet)**:

  This repo supports two deployment paths: Phase 1 manual `vercel --prod`, Phase 2 `git push`-triggered. One project may mix both — the error signals and where to look differ:

  | Symptom | CLI deploy (`vercel --prod`) | Git auto-deploy (push) |
  | --- | --- | --- |
  | Deploy never starts | terminal errors immediately + non-zero exit | Dashboard still "Queued" after 60s → check the GitHub Webhook |
  | Build failure | failing step + file path in stderr | Dashboard → Deployments → open the deployment's build log |
  | Missing env var | re-check via `vercel env ls production` | Dashboard → Settings → Environment Variables |
  | Deploys but 5xx | curl + `vercel logs <deployment-url>` | Dashboard → Deployments → Runtime Logs |
  | Rollback | Dashboard → Deployments → "Promote to Production" | same (deployments from both paths see each other) |

  Fallback: when the Git auto-deploy path is down, CLI deploys can still push production independently — no GitHub Webhook required.

### Production vs development database choice

The same `lib/db.ts` supports both deployment shapes: with `DATABASE_URL` unset or `file:`, embedded local sqlite (bundled with `@libsql/client`); with `libsql://` / `http(s)://`, Turso HTTP. Switching changes only the environment variable — no code changes, no new dependencies.

## License

[MIT](LICENSE) — Copyright (c) 2026 onepisYa.

## Publishing

This is a Next.js application, not a library. The npm package name `tic-tac-toe` already exists on the npm registry, and there is no plan to publish this codebase there. Do not run `npm publish` from this repo without renaming + scoping first (e.g. `@<your-handle>/tic-tac-toe`) to avoid E409 conflicts on the public registry.

## Related

- [AGENTS.md](AGENTS.md) — AI agent contract & commit spec
- [DESIGN.md](DESIGN.md) — design tokens & accessibility contract
- [docs/testing.md](docs/testing.md) — test layering & probe design
- [.omo/plans/ulw-one-game-two-versions.md](.omo/plans/ulw-one-game-two-versions.md) — one-game-two-versions + RESTful + schema.org plan
