# Tic-Tac-Toe

> [中文](README.md) ｜ English

> Applies to: this repo's `main` branch, Node.js 24 (matches `engines` /
> `.nvmrc` / CI), pnpm ≥ 10, Turso CLI ≥ 0.100.

<p align="left">
  <a href="LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://www.typescriptlang.org"><img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6.svg"></a>
  <a href="https://nextjs.org"><img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000.svg"></a>
  <a href="https://react.dev"><img alt="React 19" src="https://img.shields.io/badge/React%2019-149eca.svg"></a>
  <a href="https://eslint.org"><img alt="ESLint" src="https://img.shields.io/badge/code%20style-ESLint-4B32C3.svg"></a>
  <a href="https://vitest.dev"><img alt="Vitest" src="https://img.shields.io/badge/tested%20with-Vitest-6E9F18.svg"></a>
</p>

A two-player, same-device pass-and-play tic-tac-toe game with automatic
score tracking. Web app, desktop-first, with a restrained dark engineer
aesthetic (Linear + Vercel style).

Stack: Next.js 16 (App Router) + React 19 + TypeScript (strict) +
Tailwind v4 + Zustand + Drizzle ORM + @libsql/client (local file: sqlite /
Turso HTTP on Vercel).

## Preview

| Home | Play | Result (win confetti) |
| --- | --- | --- |
| ![Home](docs/screenshots/home.png) | ![Play](docs/screenshots/board.png) | ![Result](docs/screenshots/result.png) |

## Quick start

1. `git clone <this-repo> && cd tic-tac-toe`
2. `pnpm install`
3. `pnpm dev` → http://localhost:3000
4. Done — local development needs no `.env.local` and no env vars; scores
   persist automatically to local sqlite at `data/tic-tac-toe.db`.

## Features

- 🎯 **Pass-and-play**: two players take turns on one device; scores
  persist over the network (see FAQ).
- 💾 **Score persistence**: wins / losses / draws / streaks land in a
  single-row `game_stats` table — file: sqlite locally, Turso HTTP on
  Vercel (@libsql/client).
- 🌒 **Dark-first**: built on Tailwind v4 design tokens; desktop-first,
  mobile works but is not the target.
- ⌨️ **Keyboard-first**: the board uses roving focus — arrow keys move
  focus between cells, Enter/Space places a mark; gameplay needs no mouse.
- 🔇 **Lazy audio**: AudioContext is created only after the first user
  gesture; off by default and persisted.
- ✨ **Accessible confetti**: a no-motion path under
  `prefers-reduced-motion`, stable `data-testid` hooks.
- 🧪 **Gauntlet test stack**: vitest + fast-check (property) + Stryker
  (mutation) + commitlint + commit-audit, enforcing 80% line / 70%
  branch coverage.
- 🚀 **Vercel-ready**: the http(s) branch of `@libsql/client` connects
  straight to Turso on Vercel serverless — zero native modules, zero fs
  dependency.

## Routes

| Route | Description |
| --- | --- |
| `/` | Home: stats card + start game + reset stats |
| `/play` | Game: 3x3 board + current player indicator + restart |
| `/result` | Result: outcome + play again + back home + reset stats |
| `GET /api/stats` | Read stats (Node runtime) |
| `PUT /api/stats` | Write stats seed / admin (@deprecated; clients use POST outcome) |
| `DELETE /api/stats` | Reset stats |
| `POST /api/stats/outcome` | Client submits an outcome: body `{outcome:'X'\|'O'\|'draw'}` → 200 `{stats:GameStats}` |

## Local development

```bash
pnpm install
pnpm dev              # http://localhost:3000
pnpm build && pnpm start
```

Defaults to `DATABASE_URL=file:./data/tic-tac-toe.db`; data lands in
`data/tic-tac-toe.db`. **After a fresh clone you do NOT need to create
`.env.local`** — `lib/db.ts` defaults to the embedded sqlite at
`file:./data/tic-tac-toe.db` (bundled with `@libsql/client`).
`.env.example` is only needed when you switch to Turso or a custom path.
For HTTP deployment see the "Deployment" section below.

Want to hook up a real Turso database locally? See
[the local Turso guide](docs/local-turso-setup.md).

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

Thresholds live in `vitest.config.ts`: lines / functions / statements 80%,
branches 70%.

## Repository layout

```
app/                  App Router routes + API route handlers
  layout.tsx          fonts (Geist / Geist Mono) + dark base
  page.tsx            home (Client)
  play/page.tsx       game page (Client)
  result/page.tsx     result page (Client)
  api/stats/route.ts  /api/stats (GET/PUT/DELETE, awaits lib/db)
  globals.css         @theme tokens, dark base
components/           Board + ui/* (Button/Card/Cell/StatsCard/StatusBar)
db/schema.ts          Drizzle schema (single-row game_stats)
lib/
  game.ts             pure functions: board/winner/legal moves/random first player/score accrual
  game.test.ts        unit + fast-check property tests (co-located)
  db.ts               @libsql/client + Drizzle wrapper (file:/http(s): adaptive)
  store.ts            Zustand store: phase/board/currentPlayer + /api/stats sync
data/                 local SQLite file (gitignored)
reports/mutation/     Stryker html + json reports (gitignored)
coverage/             v8 coverage html report (gitignored)
tests/qa/             Playwright visual + commit audit
public/               static assets (logo / favicon)
```

## Docs index

| Doc | Contents |
| --- | --- |
| [DESIGN.md](DESIGN.md) | Design contract: color / type / spacing / motion / a11y tokens |
| [AGENTS.md](AGENTS.md) | AI agent & contribution spec: commit conventions, gauntlet, verification gates |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commit flow & local quick start |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Contributor Covenant 3.0 |
| [SECURITY.md](SECURITY.md) | Private vulnerability disclosure |
| [docs/testing.md](docs/testing.md) | Testing philosophy: layers, thresholds, RED-first, QA probe design |
| [docs/operations.md](docs/operations.md) | Ops manual: daily commands, DB, QA, commit cheatsheet, troubleshooting |
| [docs/learnings.md](docs/learnings.md) | Learnings: pitfalls & version notes |
| [docs/branching.md](docs/branching.md) | Branching: trunk-based, dual rulesets, collaboration evolution |

## FAQ

**How do I switch to Vercel persistence?** The default
`DATABASE_URL=file:./...` sits on ephemeral fs inside Vercel serverless and
does not persist. Point `DATABASE_URL` at `https://<db>.turso.io` (or
`libsql://<db>.turso.io`) and set
`DATABASE_AUTH_TOKEN=<turso-issued-token>`. `lib/db.ts` automatically takes
the http(s) branch and stops touching the filesystem and native sqlite.
See "Deployment" below.

**Can I play offline?** Moves work (frontend rules need no network), but
recording a score requires `POST /api/stats/outcome`; games finished while
offline lose their score, and later PUT/DELETE calls don't backfill.
Vercel Analytics noise (POSTs to `<vercel-analytics-sandbox-id>/view`)
cannot be suppressed — it is a Vercel-injected beacon.

**How do I clear stats?** The home "reset stats" button calls
`DELETE /api/stats`; the single-row table (id=1) zeroes out. Local UI
state stays correct even without the server response.

**Can I switch dark mode to light?** Not currently. Tailwind v4 design
tokens converge on the `dark` palette; a light theme means repainting the
whole token set and syncing DESIGN.md — out of scope for now.

**Why RED-first tests?** Any behavior change must first ship a failing
test; otherwise commit-audit cannot tell "a real new test" from
"copy-paste" — see `docs/testing.md` §RED-first.

**Stryker / Playwright failing?** Locally, mutation and E2E are not
mandatory beyond CI; PR review relies on vitest + browser QA probes. When
they fail, start with the troubleshooting section of
`docs/operations.md`.

## Deployment

### Single machine / local

Leave `DATABASE_URL` unset or set it to `file:./data/tic-tac-toe.db`; data
lands in `data/tic-tac-toe.db` inside the repo, no token needed.

### Driver layer (deep module)

`lib/db.ts` encapsulates driver selection inside the file: it imports both
`@libsql/client` (native sqlite) and `@libsql/client/web` (HTTP client),
and a `selectDriver(url)` factory picks automatically by `DATABASE_URL`:

| URL shape | Driver | For |
| --- | --- | --- |
| `file:...` | `@libsql/client` native | local / CI / single machine; embedded sqlite, zero config |
| `http://` / `https://` / `libsql://` | `@libsql/client/web` | Vercel serverless / Edge; Turso HTTP, no native binding |

Callers (`app/api/stats/route.ts`, `lib/store.ts`) change **nothing** —
they import `loadStats / saveStats / resetStats / closeDb`; driver choice
stays hidden inside the db module.

### First Vercel + Turso deployment

1. Create a database at [turso.tech](https://turso.tech):
   `turso db create <your-db-name>`.
2. Get the libsql URL: `turso db show <your-db-name> --url`.
3. Get an auth token: `turso db tokens create <your-db-name>` → JWT.
4. Vercel project → Settings → Environment Variables, add two entries:

   | Variable | Value | Note |
   | --- | --- | --- |
   | `DATABASE_URL` | `libsql://<your-db-name>-<your-org>.turso.io` | `lib/db.ts` routes `libsql://` through the HTTP branch |
   | `DATABASE_AUTH_TOKEN` | the JWT from step 3 | Vercel only, never in git |

   > **Configure before the first push** — otherwise the first deployment
   > builds without `DATABASE_URL` and scores land on ephemeral fs.
5. `git push` to Vercel; `/api/stats` persists via the Turso HTTP client
   automatically.

**Rehearse locally before pushing**: put the two env vars into
`.env.local` (gitignored), run `pnpm build && pnpm start`, then
`curl localhost:3000/api/stats` to confirm read/write; push only when it
passes.

Never keep a `file:` URL on Vercel — serverless containers have ephemeral
fs; data does not survive requests.

### Vercel troubleshooting

- **Stats wiped / gone after a while**: a stale `file:` URL on Vercel.
  Serverless fs is ephemeral; gone on restart. Delete the variable or
  switch to `libsql://`.
- **fetch failed**: `DATABASE_URL` is wrong (missing `libsql://` prefix or
  bad domain). Unknown schemes pass through `lib/db.ts` untouched and the
  client raises a protocol error.
- **401 / 403**: `DATABASE_AUTH_TOKEN` missing, expired, or belongs to a
  different database. Re-run
  `turso db tokens create <your-db-name>` and update Vercel.
- **Build fails**: first check both variable names character-for-character
  — `DATABASE_URL` and `DATABASE_AUTH_TOKEN`; case and underscores matter.

- **CLI deploy vs Git auto-deploy (error signal cheat sheet)**:

  This repo supports two deployment paths: Phase 1 manual `vercel --prod`,
  Phase 2 `git push`-triggered. One project may mix both — the error
  signals and where to look differ:

  | Symptom | CLI deploy (`vercel --prod`) | Git auto-deploy (push) |
  | --- | --- | --- |
  | Deploy never starts | terminal errors immediately + non-zero exit | Dashboard still "Queued" after 60s → check the GitHub Webhook |
  | Build failure | failing step + file path in stderr | Dashboard → Deployments → open the deployment's build log |
  | Missing env var | re-check via `vercel env ls production` | Dashboard → Settings → Environment Variables |
  | Deploys but 5xx | curl + `vercel logs <deployment-url>` | Dashboard → Deployments → Runtime Logs |
  | Rollback | Dashboard → Deployments → "Promote to Production" | same (deployments from both paths see each other) |

  Fallback: when the Git auto-deploy path is down, CLI deploys can still
  push production independently — no GitHub Webhook required.

### Production vs development database choice

The same `lib/db.ts` supports both deployment shapes: with `DATABASE_URL`
unset or `file:`, embedded local sqlite (bundled with `@libsql/client`);
with `libsql://` / `http(s)://`, Turso HTTP. Switching changes only the
environment variable — no code changes, no new dependencies.

## License

[MIT](LICENSE) — Copyright (c) 2026 onepisYa.

## Publishing

This is a Next.js application, not a library. The npm package name
`tic-tac-toe` already exists on the npm registry, and there is no plan
to publish this codebase there. Do not run `npm publish` from this repo
without renaming + scoping first (e.g. `@<your-handle>/tic-tac-toe`) to
avoid E409 conflicts on the public registry.

## Related

- [AGENTS.md](AGENTS.md) — AI agent contract & commit spec
- [DESIGN.md](DESIGN.md) — design tokens & accessibility contract
- [docs/testing.md](docs/testing.md) — test layering & probe design
- [docs/branching.md](docs/branching.md) — branching strategy
