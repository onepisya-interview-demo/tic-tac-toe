import * as nativeClient from '@libsql/client';
import { type Client, type Config } from '@libsql/client';
import * as webClient from '@libsql/client/web';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from '../db/schema';
import { gameStats } from '../db/schema';
import { emptyStats, recordOutcome, type GameStats } from './game';

/**
 * ## Service layer (lib/db.ts) — 纯函数 / 传输层薄壳 强制分离契约
 *
 * 本文件是 service 层：所有「读 / 改 / 写战绩」的业务逻辑都收敛为纯函数（无
 * HTTP 上下文、无 NextResponse、无 status code 知识）。调用方是 lib/store.ts
 * （浏览器端）或 app/api/{...}/route.ts（Node runtime 端）。
 *
 * ### 强约束（自 W1 ulw-one-game-two-versions 起，W2 起传输层必须遵守）
 *
 * 1. service 函数返回值必须是「数据 + 状态标记」的纯数据形式：
 *    - 命中：返回 `GameStats`（或 `{ stats, ... }` 等纯对象）；
 *    - 缺失：返回明确的 `null` 或具名 `not-found` 标记字符串；
 *    - 异常：抛 `Error`（调用方 try/catch 后翻译成 problem+json）。
 *    **禁止**返回 `Response` / `NextResponse` / `{ status: 404 }` 等传输层
 *    对象 — 让传输层（route handler）唯一决定 status code。
 *
 * 2. service 函数不读 `Request` / `headers` / `URL.searchParams`：
 *    解析工作归传输层；service 只接 typed primitive 入参。
 *
 * 3. service 函数不写日志、不打 console：调用方负责 observability。
 *
 * 4. 任意 transport（RESTful route / GraphQL resolver / gRPC handler）只应：
 *    - 解析入参 → 调用 service → 把 service 返回值映射到自己的 status code /
 *      problem+json / GraphQL error / gRPC status。
 *    - 不得在 transport 里再写一份「read → mutate → upsert」的业务规则。
 *
 * W2 落地：app/api/players/{name}/stats/{...,outcomes,sync}/route.ts 与
 * lib/game-net.ts 的薄壳。GraphQL 双兼容仅需新增 schema + resolver，service
 * 函数零改动。
 *
 * ## 行为契约
 *
 * - 每个 service 函数在 Node 单进程内是串行的（load → mutate → upsert 三步
 *   在同一进程串行执行），不会交错。多实例（Vercel + Turso HTTP）的竞态超出
 *   本文件范围。
 * - 行不存在时返回明确信号（`null` / `not-found` 字符串），不静默建档。
 * - 行存在的累加是纯函数 `recordOutcome(current, outcome)`（lib/game.ts）。
 *
 * ## W1 退役
 *
 * - `/api/stats` 链（route.ts + outcome/route.ts）+ `StatsHydrator` +
 *   `lastWriteAt` 全链路退役：ranked 公共单行（id=1, name=NULL）的全行族
 *   读 / 写 / 累加 / 重置 接口（`loadStats` / `saveStats` / `recordAndSave`
 *   / `resetStats` + `STATS_ROW_ID`）整体删除。
 * - 入口改走 per-name：所有读 / 写 / 累加都按 `name` 维度（`loadRecordByName`
 *   / `upsertRecordByName` / `recordOutcomeForName` / `mergeRecordByName` /
 *   `registerOrLoginName`）。
 */

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'tic-tac-toe.db');

type CreateClientFn = (config: Config) => Client;

/**
 * Pick the @libsql client module to use for the given DATABASE_URL.
 * - `file:` URLs go to the native client (in-process sqlite, needs node runtime).
 * - Anything else (http://, https://, libsql://) goes to /web (HTTP transport,
 *   edge/serverless friendly, smaller serverless bundle).
 * Exported for tests; production callers should not need it.
 */
export function selectDriver(url: string): { createClient: (config: Config) => Client } {
  if (url.startsWith('file:')) return nativeClient;
  return webClient;
}

/** Default factory: pick the driver that matches the URL, then create the client. */
const defaultCreateClient: CreateClientFn = (config) =>
  selectDriver(config.url).createClient(config);

// Test seam — replaced by tests to capture config without hitting a real DB.
let createClientFn: CreateClientFn = defaultCreateClient;

/**
 * Test-only knobs for injecting latency or replacing the client factory.
 * Production code must never call these.
 *
 * Two surfaces so callers can pick the lightest seam:
 *   - `__setCreateClientForTests(fn)` replaces `createClient` wholesale.
 *   - `__setDbOpDelayForTests(ms)`  adds a fixed pre-DB sleep so races that
 *     only manifest under a slow upstream (e.g. Turso HTTP) become
 *     reproducible locally with a local sqlite. Set to 0 / null to clear.
 *
 * Both reset by passing null.
 */
export function __setCreateClientForTests(fn: CreateClientFn | null): void {
  createClientFn = fn ?? defaultCreateClient;
  dbOpDelayMs = 0;
}

export function __setDbOpDelayForTests(ms: number | null): void {
  dbOpDelayMs = ms ?? 0;
}

/**
 * Read DATABASE_URL_SLOW_DELAY_MS so a server can be launched with the
 * variable set (e.g. `DATABASE_URL_SLOW_DELAY_MS=1500 next start`) and
 * every DB op will block for that many ms — reproducing the RSC / store
 * races the production Turso HTTP transport exposes, on local sqlite.
 */
let dbOpDelayMs = 0;

let cachedDb: LibSQLDatabase<typeof schema> | null = null;
let cachedClient: Client | null = null;

/**
 * Resolve DATABASE_URL + DATABASE_AUTH_TOKEN into an @libsql/client Config.
 *
 * - http(s)://... or libsql://...  →  remote Turso client (passes authToken when set)
 * - file:./path/to.db              →  local sqlite file (auto-creates the parent dir)
 * - undefined                      →  file:./data/tic-tac-toe.db under CWD
 *
 * Anything else falls through to the URL as-is so the underlying client can
 * surface its own protocol error.
 */
function resolveDbConfig(): Config {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  if (!url) {
    const dir = path.dirname(DEFAULT_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return { url: `file:${DEFAULT_DB_PATH}` };
  }

  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('libsql:')
  ) {
    return authToken ? { url, authToken } : { url };
  }

  if (url.startsWith('file:')) {
    const filePath = url.slice('file:'.length);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return { url };
  }

  // Unrecognized scheme — pass through. @libsql/client will error with a
  // clear protocol message rather than us silently coercing to a file path.
  return authToken ? { url, authToken } : { url };
}

/**
 * Open the libsql client, bootstrap the game_stats table, and return a
 * Drizzle wrapper. Cached per process; pair every successful `getDb()`
 * with a `closeDb()` in tests.
 */
export async function getDb(): Promise<LibSQLDatabase<typeof schema>> {
  // Test/dev-only latency injection so races that only manifest under a
  // slow upstream become locally reproducible on sqlite. Production never
  // sets DATABASE_URL_SLOW_DELAY_MS; the variable is documented in
  // __setDbOpDelayForTests and consumed at the same seam. Runs before the
  // cache check so EVERY DB op pays the delay — not just the first connect
  // — letting probes reproduce per-op slow-DB interleavings (e.g. two
  // loadStats before either saveStats lands).
  if (dbOpDelayMs > 0) {
    await new Promise((r) => setTimeout(r, dbOpDelayMs));
  }
  if (cachedDb) return cachedDb;
  const config = resolveDbConfig();
  cachedClient = createClientFn(config);
  // Bootstrap table — keeps the app runnable without a manual `db:push`.
  // DDL via the raw client ensures the schema exists before drizzle hits it.
  // Single per-name rows under `name TEXT UNIQUE` since
  // ulw-name-login-one-truth merged the online shared row out (W1
  // ulw-one-game-two-versions retires the /api/stats chain entirely).
  await cachedClient.execute(`
    CREATE TABLE IF NOT EXISTS game_stats (
      id INTEGER PRIMARY KEY,
      total_games INTEGER NOT NULL DEFAULT 0,
      x_wins INTEGER NOT NULL DEFAULT 0,
      o_wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      name TEXT UNIQUE,
      updated_at INTEGER NOT NULL
    );
  `);
  // Reconcile legacy schemas (ulw-hotfix-db-schema-drift W1).
  // Pre-W1 (ulw-name-login-one-truth) bootstrap DDL did not include the
  // `name` column on game_stats and also spawned a separate `solo_records`
  // table. `CREATE TABLE IF NOT EXISTS` is a no-op on an existing legacy
  // table, so without this branch a fresh session would hit
  // `no such column: "name"` on the first SELECT. `pragma_table_info`
  // works identically on the local sqlite (file:) driver and the Turso
  // HTTP (libsql://) driver — both speak SQLite under the hood and the
  // pragma returns the actual columns the table holds. If the column is
  // missing we rebuild the table inside a single transaction (CREATE →
  // INSERT...SELECT shared cols → DROP → RENAME) and retire the orphan
  // `solo_records` table; this is the only `getDb` path that touches the
  // shape of `game_stats`, so the contract (per-name rows under `name`)
  // stays lock-step with `db/schema.ts`.
  // RC-drift §1 P1-1: probe must catch the half-applied state where
  // `name` column exists but no UNIQUE index covers it (someone ran a
  // raw ALTER TABLE ADD COLUMN without an index). Probe is two-step:
  // (a) column present + (b) at least one unique index lists `name` as
  // a column. Both must hold, else rebuild. Fresh DB satisfies both —
  // bootstrap DDL declares `name TEXT UNIQUE`, which creates an internal
  // `sqlite_autoindex_game_stats_<n>` that pragma_index_list surfaces.
  const columnProbe = await cachedClient.execute(
    "SELECT name FROM pragma_table_info('game_stats') WHERE name = 'name'",
  );
  let hasUniqueOnName = false;
  if (columnProbe.rows.length > 0) {
    const indexList = await cachedClient.execute(
      "SELECT name FROM pragma_index_list('game_stats') WHERE [unique] = 1",
    );
    for (const row of indexList.rows) {
      const idxName = String(row.name);
      const info = await cachedClient.execute({
        sql: "SELECT name FROM pragma_index_info(?) WHERE name = 'name' LIMIT 1",
        args: [idxName],
      });
      if (info.rows.length > 0) {
        hasUniqueOnName = true;
        break;
      }
    }
  }
  if (columnProbe.rows.length === 0 || !hasUniqueOnName) {
    // W1 retires the online shared row (id=1, name=NULL) along with
    // /api/stats. The reconcile branch is therefore a structural rebuild
    // — only per-name rows (name IS NOT NULL) carry forward. When the
    // legacy schema lacks the `name` column entirely, the carry-forward
    // SELECT must skip the WHERE filter (referencing a missing column
    // would error). Branch the INSERT statement on the probe result.
    const hasNameColumn = columnProbe.rows.length > 0;
    const carryForwardSql = hasNameColumn
      ? `INSERT INTO game_stats_new (id, total_games, x_wins, o_wins, draws, current_streak, updated_at)
           SELECT id, total_games, x_wins, o_wins, draws, current_streak, updated_at FROM game_stats WHERE name IS NOT NULL`
      : `INSERT INTO game_stats_new (id, total_games, x_wins, o_wins, draws, current_streak, updated_at)
           SELECT id, total_games, x_wins, o_wins, draws, current_streak, updated_at FROM game_stats`;
    await cachedClient.batch(
      [
        `CREATE TABLE game_stats_new (
           id INTEGER PRIMARY KEY,
           total_games INTEGER NOT NULL DEFAULT 0,
           x_wins INTEGER NOT NULL DEFAULT 0,
           o_wins INTEGER NOT NULL DEFAULT 0,
           draws INTEGER NOT NULL DEFAULT 0,
           current_streak INTEGER NOT NULL DEFAULT 0,
           name TEXT UNIQUE,
           updated_at INTEGER NOT NULL
         )`,
        // Carry forward legacy rows (without `name`, which is freshly
        // created as NULL under the new schema; SQLite allows multiple
        // NULLs under TEXT UNIQUE). When the legacy schema had a `name`
        // column, only per-name rows (name IS NOT NULL) carry forward;
        // W1 retires the online shared row (id=1, name=NULL).
        carryForwardSql,
        `DROP TABLE game_stats`,
        `ALTER TABLE game_stats_new RENAME TO game_stats`,
        // Retire the pre-W1 `solo_records` table — solo data was migrated
        // to game_stats under `name` since ulw-name-login-one-truth; W1
        // retires the separate solo_records table entirely.
        `DROP TABLE IF EXISTS solo_records`,
      ],
      'write',
    );
  }
  cachedDb = drizzle(cachedClient, { schema });
  return cachedDb;
}

/**
 * Load a per-player record by name. Returns null when the row is
 * absent so callers (the /api/players/{name}/stats GET handler) can
 * branch on "fresh name" without sentinel values.
 */
export async function loadRecordByName(name: string): Promise<GameStats | null> {
  const db = await getDb();
  const existing = await db
    .select()
    .from(gameStats)
    .where(eq(gameStats.name, name))
    .get();
  if (!existing) return null;
  return {
    totalGames: existing.totalGames,
    xWins: existing.xWins,
    oWins: existing.oWins,
    draws: existing.draws,
    currentStreak: existing.currentStreak,
  };
}

/** Write a per-player record (insert-or-update by name). */
export async function upsertRecordByName(
  name: string,
  stats: GameStats,
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db
    .insert(gameStats)
    .values({
      name,
      totalGames: stats.totalGames,
      xWins: stats.xWins,
      oWins: stats.oWins,
      draws: stats.draws,
      currentStreak: stats.currentStreak,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: gameStats.name,
      set: {
        totalGames: stats.totalGames,
        xWins: stats.xWins,
        oWins: stats.oWins,
        draws: stats.draws,
        currentStreak: stats.currentStreak,
        updatedAt: now,
      },
    })
    .run();
}

/**
 * Close the cached client (used by tests / shutdown).
 */
/**
 * Pure per-field addition for the cross-device merge path
 * (ulw-solo-sync-rebuild.md B-T2). Adds server-side totals and
 * client-supplied totals; currentStreak is summed because the
 * client cannot know the chronological order of two devices’
 * independent sessions and the “服务器是权威累加点” contract
 * says the post-sync row carries every game’s contribution
 * without dropping any (counts stay exact; streak becomes a
 * best-effort signed heuristic — README 边界注 covers it).
 *
 * Lifted to a pure exported function so tests can pin the math
 * without sqlite, and so route handlers can call it after the
 * load step.
 */
export function accumulateMergeStats(
  server: GameStats,
  client: GameStats,
): GameStats {
  return {
    totalGames: server.totalGames + client.totalGames,
    xWins: server.xWins + client.xWins,
    oWins: server.oWins + client.oWins,
    draws: server.draws + client.draws,
    currentStreak: server.currentStreak + client.currentStreak,
  };
}

/**
 * Server-authoritative cross-device merge (ulw-solo-sync-rebuild.md
 * B-T2). Reads the per-name row (or emptyStats when absent), folds
 * the client-supplied totals via the pure accumulateMergeStats,
 * upserts the result, and returns the new row. Mirrors
 * load → mutate → upsert so the
 * caller (POST /api/players/{name}/stats:merge) can adopt the server’s
 * authoritative answer without an extra GET.
 */
export async function mergeRecordByName(
  name: string,
  clientStats: GameStats,
): Promise<GameStats> {
  const server = (await loadRecordByName(name)) ?? emptyStats();
  const next = accumulateMergeStats(server, clientStats);
  await upsertRecordByName(name, next);
  return next;
}

/**
 * Per-name server-authoritative outcome accumulator (W1
 * ulw-one-game-two-versions, AC A9 / A5). Reads the per-name row,
 * applies the pure `recordOutcome` rule (lib/game.ts) to bump the
 * counters, upserts the new full row, and returns the result.
 *
 * Row-existence contract (与传输层约定, A4 前置):
 *  - 行不存在 → 返回 `{ ok: false, reason: 'not-found' }`,
 *    传输层映射成 404 problem+json。
 *    拒绝静默建档 — 一个无名点击路径不该被偷渡成「已注册」。
 *  - 行存在 → 返回 `{ ok: true, stats }`, 传输层映射成 200 + GameStats。
 *
 * 与 loadStats / recordAndSave 全行族（ranked, id=1）的区别：这是 per-name
 * 维度，按 UNIQUE(name) 定位行；ranked 链在 W1 整体退役。
 *
 * 串行保证：单 Node 进程内 load → mutate → upsert 三步串行执行；多实例
 * last-write-wins 由 README 边界注承担。
 */
export type RecordOutcomeResult =
  | { ok: true; stats: GameStats }
  | { ok: false; reason: 'not-found' };

export async function recordOutcomeForName(
  name: string,
  outcome: 'X' | 'O' | 'draw',
): Promise<RecordOutcomeResult> {
  const current = await loadRecordByName(name);
  if (current === null) {
    return { ok: false, reason: 'not-found' };
  }
  const next = recordOutcome(current, outcome);
  await upsertRecordByName(name, next);
  return { ok: true, stats: next };
}

/**
 * Idempotent empty-row bootstrap for "save a name on device A, pick it up
 * on device B" vertical slice (ulw-solo-sync-rebuild.md B-T1). Reads the
 * row; if absent, upserts emptyStats() under the trimmed name and returns
 * the resulting row. Read-before-write so a future race window (two PUTs in flight) still
 * converges on one canonical row, never silently overwrites existing stats. Single Node process serializes callers within an instance;
 * cross-instance last-write-wins is documented in the multi-user-stats
 * future-work note and out of scope here.
 */
export async function ensureRecordByName(name: string): Promise<GameStats> {
  const existing = await loadRecordByName(name);
  if (existing) return existing;
  const zero = emptyStats();
  await upsertRecordByName(name, zero);
  return zero;
}

/**
 * Player-session registration / login primitive for the
 * POST /api/sessions (W2) handler. Reads the per-name row in
 * game_stats; if absent, inserts an emptyStats() row under that name
 * and returns { stats, existed: false }; if the row already exists,
 * returns { stats, existed: true }.
 *
 * Race-safety: a concurrent writer that inserted the row first trips
 * the UNIQUE constraint on game_stats.name. The catch block re-reads
 * the row so the loser surfaces the winner’s stats instead of
 * throwing — callers (the route handler) see the same response shape
 * regardless of timing. Mirrors the load → mutate → upsert shape so
 * the per-name contract is the single source of truth.
 *
 * UNIQUE on name is the server-side guarantee that name is an identity,
 * not a label: there is exactly one row per non-null name, so renaming
 * is structurally impossible (no rename endpoint + UNIQUE doubles the
 * guard).
 */
export async function registerOrLoginName(
  name: string,
): Promise<{ stats: GameStats; existed: boolean }> {
  const existing = await loadRecordByName(name);
  if (existing) return { stats: existing, existed: true };
  const zero = emptyStats();
  try {
    await upsertRecordByName(name, zero);
    return { stats: zero, existed: false };
  } catch (err) {
    // Concurrent writer inserted first: re-read surfaces their row.
    const after = await loadRecordByName(name);
    if (after) return { stats: after, existed: true };
    throw err;
  }
}

export async function closeDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}
