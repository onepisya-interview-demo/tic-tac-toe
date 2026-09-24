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
 * ### 强约束（自 W1 ulw-one-game-two-versions 起，传输层必须遵守）
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
 * ## 行为契约
 *
 * - 每个写 service（`recordOutcomeForRoom` / `mergeRecordByRoom` /
 *   `resetRecordByRoom`）在 Node 单进程内通过 `withWriteLock` 把所有
 *   load → mutate → upsert 三步整体串行化（promise 链，每条链附
 *   带 catch 防止单次失败毒化后续排队），并在 drizzle 的
 *   `db.transaction()` 包裹内执行（其内部转调 `@libsql/client`
 *   `client.transaction('write')` 真锁 API — E5 实证）。
 *   **修复前**这三步在两 await 点之间可被并发请求交错，单进程双
 *   并发 100% 丢更新（E1 实验 60/60 丢，地图 ulw-rooms-race-map
 *   T-A）；**修复后**实测零丢失零持续。
 * - 多实例（Vercel + Turso HTTP）的跨进程竞态由本仓 README 边界
 *   注承担，不在本服务实现承诺内；E7 实测揭示失败回滚会泄漏文件
 *   级写锁，需客户端 close 回收（运维事实）。本仓只承诺单进程互
 *   斥 + 事务包裹。
 * - 行不存在时返回明确信号（`null` / `not-found` 字符串），不静默建档。
 * - 行存在的累加是纯函数 `recordOutcome(current, outcome)`（lib/game.ts）。
 *
 * ## W1（ulw-room-migration-home-landing）— `name` → `room`
 *
 * - 服务函数全部 rename：loadRecordByName / upsertRecordByName /
 *   recordOutcomeForName / mergeRecordByName / ensureRecordByName /
 *   registerOrLoginName → `*ByRoom`。实现体逻辑零变化；只改符号。
 * - DB 列 `name TEXT UNIQUE` → `room TEXT UNIQUE`（db/schema.ts）。
 * - getDb() reconcile 收敛为单一规则：列集与 drizzle schema 期望不符 →
 *   DROP 重建（D-4 决议：数据不保留；当前部署无人使用）。
 * - 趁势删 W1（W1 of one-game-two-versions）历史多分支迁移逻辑：half-migrated
 *   + `WHERE name IS NOT NULL` carry-forward + solo_records 退役分支。
 *   reconcile 只剩「列集相等？否则重建」一条路径。
 *   列集探测本身仍是红线（无探测的旧库启动即 `no such column` 炸服）。
 */

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'tic-tac-toe.db');

type CreateClientFn = (config: Config) => Client;

/**
 * The expected physical column set for game_stats, in the canonical
 * ordinal order db/schema.ts declares. Used by getDb()'s reconcile
 * probe so the shape stays lock-step with the schema declaration —
 * the source-of-truth is db/schema.ts but its string-column
 * representation is also referenced verbatim in
 * tests/db/db.test.ts, so any drift breaks at compile or test time.
 */
const EXPECTED_COLUMNS = [
  'id',
  'total_games',
  'x_wins',
  'o_wins',
  'draws',
  'current_streak',
  'room',
  'updated_at',
] as const;

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
  // __setDbOpDelayForTests and consumed at the same seam.
  if (dbOpDelayMs > 0) {
    await new Promise((r) => setTimeout(r, dbOpDelayMs));
  }
  if (cachedDb) return cachedDb;
  const config = resolveDbConfig();
  cachedClient = createClientFn(config);
  // Bootstrap table — keeps the app runnable without a manual `db:push`.
  // DDL via the raw client ensures the schema exists before drizzle hits it.
  // The column set is the source-of-truth for the reconcile probe below;
  // any drift between this DDL and `EXPECTED_COLUMNS` breaks the
  // reconcile test suite (tests/db/db.test.ts: D1-D4).
  await cachedClient.execute(`
    CREATE TABLE IF NOT EXISTS game_stats (
      id INTEGER PRIMARY KEY,
      total_games INTEGER NOT NULL DEFAULT 0,
      x_wins INTEGER NOT NULL DEFAULT 0,
      o_wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      room TEXT UNIQUE,
      updated_at INTEGER NOT NULL
    );
  `);
  // Reconcile legacy schemas (W1 ulw-room-migration-home-landing, plan
  // §2.4 D-4: data not retained).
  //
  // Pre-W1 (ulw-name-login-one-truth) bootstrap DDL did not include the
  // `name` column on game_stats and also spawned a separate
  // `solo_records` table. `CREATE TABLE IF NOT EXISTS` is a no-op on an
  // existing legacy table, so without this branch a fresh session would
  // hit `no such column: "room"` on the first SELECT. W1 retires the
  // legacy shapes by collapsing reconcile to a single rule:
  // "column set on disk ≠ expected column set → DROP + rebuild".
  //
  // W1 dropped the multi-branch INSERT SELECT carry-forward path
  // (the old code branched on whether the legacy schema had a `name`
  // column and conditionally filtered carry-forward rows). D-4 grants
  // permission to clear data; the rebuild is therefore structural
  // rather than data-preserving. The probe itself is the contract:
  // no probe, no recovery from `no such column`.
  const columnProbe = await cachedClient.execute(
    "SELECT name FROM pragma_table_info('game_stats') ORDER BY cid",
  );
  const actualColumns = columnProbe.rows.map((row) => String(row.name));
  const columnsMatch =
    actualColumns.length === EXPECTED_COLUMNS.length &&
    actualColumns.every((col, idx) => col === EXPECTED_COLUMNS[idx]);
  if (!columnsMatch) {
    // Structural rebuild. No INSERT SELECT carry-forward (D-4 clears
    // data). Pre-W1 `solo_records` table — if it ever existed —
    // vanishes with the surrounding DROP TABLE IF EXISTS step (sqlite
    // has no orphan table outside of game_stats, but the DROP IF
    // EXISTS is defensive against older deployments that survived
    // through the half-migrated phases).
    await cachedClient.batch(
      [
        `DROP TABLE IF EXISTS game_stats`,
        `CREATE TABLE game_stats (
           id INTEGER PRIMARY KEY,
           total_games INTEGER NOT NULL DEFAULT 0,
           x_wins INTEGER NOT NULL DEFAULT 0,
           o_wins INTEGER NOT NULL DEFAULT 0,
           draws INTEGER NOT NULL DEFAULT 0,
           current_streak INTEGER NOT NULL DEFAULT 0,
           room TEXT UNIQUE,
           updated_at INTEGER NOT NULL
         )`,
        `DROP TABLE IF EXISTS solo_records`,
      ],
      'write',
    );
  }
  cachedDb = drizzle(cachedClient, { schema });
  return cachedDb;
}

/**
 * Load a per-room record by room name. Returns null when the row is
 * absent so callers (the /api/rooms/{room}/stats GET handler) can
 * branch on "fresh room" without sentinel values.
 */
export async function loadRecordByRoom(room: string): Promise<GameStats | null> {
  const db = await getDb();
  const existing = await db
    .select()
    .from(gameStats)
    .where(eq(gameStats.room, room))
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

/**
 * Per-process writers chain (D9 lost-update fix).
 *
 * Every write that reads-then-decides-then-writes
 * (`recordOutcomeForRoom` / `mergeRecordByRoom` /
 * `resetRecordByRoom`) is funneled through `withWriteLock` so the
 * JS-layer load → mutate → upsert three steps cannot interleave
 * between concurrent callers in the same Node instance. Each
 * `withWriteLock(fn)` call ALSO runs `fn` inside a drizzle
 * `db.transaction()`, which delegates to `@libsql/client`
 * `client.transaction('write')` — the official lock-aware API
 * (E5 实证 BUSY, E2/E4 证伪裸 BEGIN/COMMIT 经 `execute()`).
 *
 * Failure-isolation: a rejected `fn` must NOT poison the chain.
 * We re-anchor `writeChain` on the resolved side of `run`, so
 * subsequent callers always queue onto a live chain even after a
 * previous call rejected. (Bare `chain.then(fn)` would attach the
 * rejection to the chain tail and turn it into a permanently
 * rejected promise — every later caller would hang on the
 * `.then(fn)` step. The `then(_, fn)` form schedules `fn`
 * regardless of the previous step's state.)
 *
 * Out of scope: multi-process (Vercel + Turso HTTP) race
 * semantics. See README「多实例 last-write-wins」boundary note.
 * E7 proved that failed rollbacks leak file-level write locks that
 * only recover after `client.close()` on the offending peer — that
 * operational fact is recorded here, not mitigated inside the
 * service.
 */
let writeChain: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  // `then(fn, fn)` — both fulfillment & rejection of the previous
  // call schedule `fn` next; the chain never stalls on a rejection.
  const run = writeChain.then(fn, fn);
  // Re-anchor chain on the resolved side of `run` so a rejection
  // does NOT propagate to the next `.then(fn)` consumer. A bare
  // `chain = run` would let unhandled rejections poison later steps.
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

/** Write a per-room record (insert-or-update by room). */
export async function upsertRecordByRoom(
  room: string,
  stats: GameStats,
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db
    .insert(gameStats)
    .values({
      room,
      totalGames: stats.totalGames,
      xWins: stats.xWins,
      oWins: stats.oWins,
      draws: stats.draws,
      currentStreak: stats.currentStreak,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: gameStats.room,
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
 * Pure per-field addition for the cross-device merge path. Adds
 * server-side totals and client-supplied totals; currentStreak is
 * summed because the client cannot know the chronological order of
 * two devices' independent sessions and the "服务器是权威累加点"
 * contract says the post-sync row carries every game's contribution
 * without dropping any (counts stay exact; streak becomes a
 * best-effort signed heuristic — the resulting currentStreak is the
 * sum of two independent sequences, NOT a chronologically ordered
 * run). W-RV P2 #1 dismiss: real-life scenario is a single user with
 * the same X/O symbol across two devices (no interleaving opponents),
 * so the signed-sum rarely produces a confusing streak; if a future
 * product surface ever crosses symbols (multi-user / ranked play) the
 * fix is to track per-game history in a sibling table and merge by
 * timestamp, not to patch this function.
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
 * Server-authoritative cross-device merge. Reads the per-room row
 * (or emptyStats when absent), folds the client-supplied totals via
 * the pure accumulateMergeStats, upserts the result, and returns the
 * new row. Mirrors load → mutate → upsert so the caller
 * (POST /api/rooms/{room}/stats/merge) can adopt the server's
 * authoritative answer without an extra GET.
 */
export async function mergeRecordByRoom(
  room: string,
  clientStats: GameStats,
): Promise<GameStats> {
  return withWriteLock(async () => {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(gameStats)
        .where(eq(gameStats.room, room))
        .get();
      const server: GameStats = existing
        ? {
            totalGames: existing.totalGames,
            xWins: existing.xWins,
            oWins: existing.oWins,
            draws: existing.draws,
            currentStreak: existing.currentStreak,
          }
        : emptyStats();
      const next = accumulateMergeStats(server, clientStats);
      await tx
        .insert(gameStats)
        .values({
          room,
          totalGames: next.totalGames,
          xWins: next.xWins,
          oWins: next.oWins,
          draws: next.draws,
          currentStreak: next.currentStreak,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: gameStats.room,
          set: {
            totalGames: next.totalGames,
            xWins: next.xWins,
            oWins: next.oWins,
            draws: next.draws,
            currentStreak: next.currentStreak,
            updatedAt: new Date(),
          },
        })
        .run();
      return next;
    });
  });
}

/**
 * Per-room server-authoritative outcome accumulator. Reads the
 * per-room row, applies the pure `recordOutcome` rule (lib/game.ts)
 * to bump the counters, upserts the new full row, and returns the
 * result.
 *
 * Row-existence contract (与传输层约定):
 *  - 行不存在 → 返回 `{ ok: false, reason: 'not-found' }`,
 *    传输层映射成 404 problem+json。
 *    拒绝静默建档 — 一个匿名点击路径不该被偷渡成「已注册房间」。
 *  - 行存在 → 返回 `{ ok: true, stats }`, 传输层映射成 200 + GameStats。
 *
 * Concurrency (T-C / D9 修复形态): funneled through `withWriteLock`
 * + drizzle `db.transaction()`. 同进程并发记录不会丢失更新；E6 实
 * 测零丢失零持续。多实例 last-write-wins 由 README 边界注承担。
 */
export type RecordOutcomeResult =
  | { ok: true; stats: GameStats }
  | { ok: false; reason: 'not-found' };

export async function recordOutcomeForRoom(
  room: string,
  outcome: 'X' | 'O' | 'draw',
): Promise<RecordOutcomeResult> {
  return withWriteLock(async () => {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(gameStats)
        .where(eq(gameStats.room, room))
        .get();
      if (!existing) {
        return { ok: false, reason: 'not-found' } as const;
      }
      const current: GameStats = {
        totalGames: existing.totalGames,
        xWins: existing.xWins,
        oWins: existing.oWins,
        draws: existing.draws,
        currentStreak: existing.currentStreak,
      };
      const next = recordOutcome(current, outcome);
      await tx
        .insert(gameStats)
        .values({
          room,
          totalGames: next.totalGames,
          xWins: next.xWins,
          oWins: next.oWins,
          draws: next.draws,
          currentStreak: next.currentStreak,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: gameStats.room,
          set: {
            totalGames: next.totalGames,
            xWins: next.xWins,
            oWins: next.oWins,
            draws: next.draws,
            currentStreak: next.currentStreak,
            updatedAt: new Date(),
          },
        })
        .run();
      return { ok: true, stats: next } as const;
    });
  });
}

/**
 * Per-room ledger reset (W-R, ulw-online-reset-and-result-fresh D-1).
 *
 * 清空 = 清零保留房间身份。load → 命中则 upsert `emptyStats()`（全零
 * 行，room 身份原样保留）并返回 `{ ok: true, stats }`；缺失则返回
 * `{ ok: false, reason: 'not-found' }` — 与 recordOutcomeForRoom 同款
 * 具名结果（防静默建档：reset 一个不存在的房间不许偷渡成建档复活）。
 *
 * 为什么否决 DELETE：room 行是身份（`game_stats.room TEXT UNIQUE`，
 * registerOrLoginRoom 的幂等进入依赖它）。DELETE 之后下一局
 * recordOutcomeForRoom 必 404，记账闭环断裂；「清空战绩」的语义是清
 * 计数，不是销户。
 *
 * 与 offline `resetOfflineStats`（清 localStorage key）的表面不对称
 * 是有意的：本地账本清 key 即归零，key 本身不承载身份；服务端账本的
 * row 就是跨设备身份，清 row 等价于销户 — 所以服务端只清零字段、
 * 保留行，客户端才允许清 key。
 */
export type ResetRecordResult =
  | { ok: true; stats: GameStats }
  | { ok: false; reason: 'not-found' };

export async function resetRecordByRoom(
  room: string,
): Promise<ResetRecordResult> {
  return withWriteLock(async () => {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(gameStats)
        .where(eq(gameStats.room, room))
        .get();
      if (!existing) {
        return { ok: false, reason: 'not-found' } as const;
      }
      const zero = emptyStats();
      await tx
        .insert(gameStats)
        .values({
          room,
          totalGames: zero.totalGames,
          xWins: zero.xWins,
          oWins: zero.oWins,
          draws: zero.draws,
          currentStreak: zero.currentStreak,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: gameStats.room,
          set: {
            totalGames: zero.totalGames,
            xWins: zero.xWins,
            oWins: zero.oWins,
            draws: zero.draws,
            currentStreak: zero.currentStreak,
            updatedAt: new Date(),
          },
        })
        .run();
      return { ok: true, stats: zero } as const;
    });
  });
}

/**
 * Idempotent empty-row bootstrap for "create a room on device A, pick
 * it up on device B" vertical slice. Reads the row; if absent,
 * upserts emptyStats() under the trimmed room and returns the
 * resulting row. Read-before-write so a future race window (two
 * PUTs in flight) still converges on one canonical row, never
 * silently overwrites existing stats.
 */
export async function ensureRecordByRoom(room: string): Promise<GameStats> {
  const existing = await loadRecordByRoom(room);
  if (existing) return existing;
  const zero = emptyStats();
  await upsertRecordByRoom(room, zero);
  return zero;
}

/**
 * Room-session registration / login primitive for the POST
 * /api/rooms (W1) handler. Reads the per-room row in game_stats; if
 * absent, inserts an emptyStats() row under that room and returns
 * { stats, existed: false }; if the row already exists, returns
 * { stats, existed: true }.
 *
 * Race-safety: a concurrent writer that inserted the row first trips
 * the UNIQUE constraint on game_stats.room. The catch block re-reads
 * the row so the loser surfaces the winner's stats instead of
 * throwing — callers (the route handler) see the same response shape
 * regardless of timing. Mirrors the load → mutate → upsert shape so
 * the per-room contract is the single source of truth.
 *
 * UNIQUE on room is the server-side guarantee that room is an
 * identity, not a label: there is exactly one row per non-null room,
 * so renaming is structurally impossible (no rename endpoint +
 * UNIQUE doubles the guard).
 */
export async function registerOrLoginRoom(
  room: string,
): Promise<{ stats: GameStats; existed: boolean }> {
  const existing = await loadRecordByRoom(room);
  if (existing) return { stats: existing, existed: true };
  const zero = emptyStats();
  try {
    await upsertRecordByRoom(room, zero);
    return { stats: zero, existed: false };
  } catch (err) {
    // Concurrent writer inserted first: re-read surfaces their row.
    const after = await loadRecordByRoom(room);
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
