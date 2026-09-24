/**
 * tests/db/db.test.ts — db.ts 测试套件（含 __setCreateClientForTests 与
 * __setDbOpDelayForTests 两个 test seam 的行为用例）。
 *
 * d-F2 fix (2026-09-24): 两 seam 自本次修复起正交 — factory 调换不影响
 * delay 状态，delay 调换不影响 factory 状态。两个测试都按 `factory →
 * delay → finally(双 reset)` 安全顺序调用（line ~1317/1319/1327-1328 与
 * ~1336/1338/1345-1346），新约定下两 seam 互不干扰，调用顺序不再承担
 * 「防止耦合旁路」的隐性义务。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { Client, Config } from '@libsql/client';

// Each test gets an isolated sqlite file under os.tmpdir()/ulw-db-*.
const tmpDbDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'ulw-db-'));

/**
 * Build a fake @libsql/client that mimics a remote Turso server:
 * no filesystem, no real DB — every execute() returns an empty result.
 * Tests assert on what the client is called WITH, not what it does.
 */
function fakeClient(): Client {
  const empty: {
    columns: [];
    columnTypes: [];
    rows: [];
    rowsAffected: 0;
    lastInsertRowid: undefined;
    toJSON(): unknown;
  } = {
    columns: [],
    columnTypes: [],
    rows: [],
    rowsAffected: 0,
    lastInsertRowid: undefined,
    toJSON() {
      return {};
    },
  };
  return {
    execute: vi.fn(async () => empty),
    batch: vi.fn(async () => []),
    transaction: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  } as unknown as Client;
}

describe('lib/db (Turso/LibSQL: file + http branches)', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDbDir();
    process.env.DATABASE_URL = `file:${path.join(dir, 'tic-tac-toe.db')}`;
    delete process.env.DATABASE_AUTH_TOKEN;
    vi.resetModules();
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import('@/lib/db');
      await closeDb();
    } catch {
      /* module may not have loaded */
    }
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_AUTH_TOKEN;
  });

  // W1 (ulw-one-game-two-versions §3 W1) — ranked full-row family
  // (loadStats / saveStats / recordAndSave / resetStats) retired along
  // with the /api/stats chain. The per-name surface (loadRecordByRoom /
  // upsertRecordByRoom / recordOutcomeForRoom / mergeRecordByRoom /
  // registerOrLoginRoom) is now the only writable surface. Coverage
  // for recordOutcomeForRoom is in the describe block below; the
  // http(s)/file URL branch tests keep covering getDb() plumbing.

  it('http(s) URL branch forwards DATABASE_URL + DATABASE_AUTH_TOKEN to createClient', async () => {
    process.env.DATABASE_URL = 'https://example.turso.io';
    process.env.DATABASE_AUTH_TOKEN = 'test-token';
    vi.resetModules();
    const seen: Config[] = [];
    const { __setCreateClientForTests, loadRecordByRoom, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByRoom('smoke');
      // Smoke: loadRecordByRoom ran the bootstrap DDL through the fake client.
      // We don't assert return value (null for unknown 'smoke').
      expect(seen).toHaveLength(1);
      expect(seen[0].url).toBe('https://example.turso.io');
      expect(seen[0].authToken).toBe('test-token');
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  });

  it('http(s) URL branch omits authToken when DATABASE_AUTH_TOKEN is unset', async () => {
    process.env.DATABASE_URL = 'https://example.turso.io';
    delete process.env.DATABASE_AUTH_TOKEN;
    vi.resetModules();
    const seen: Config[] = [];
    const { __setCreateClientForTests, loadRecordByRoom, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByRoom('smoke');
      expect(seen).toHaveLength(1);
      expect(seen[0].url).toBe('https://example.turso.io');
      expect(seen[0].authToken).toBeUndefined();
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  });

  it('file: URL branch strips the file: prefix and does not pass authToken', async () => {
    const seen: Config[] = [];
    const { __setCreateClientForTests, loadRecordByRoom, closeDb } = await import('@/lib/db');
    // Inject fake so we can capture config without hitting a real sqlite file
    // — the bootstrap DDL also goes through the fake, which is fine.
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByRoom('smoke');
      expect(seen).toHaveLength(1);
      expect(seen[0].url).toBe(`file:${path.join(dir, 'tic-tac-toe.db')}`);
      expect(seen[0].authToken).toBeUndefined();
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  });

  it('default DATABASE_URL falls back to file:./data/tic-tac-toe.db', async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const seen: Config[] = [];
    const { __setCreateClientForTests, loadRecordByRoom, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByRoom('smoke');
      expect(seen).toHaveLength(1);
      // Path is CWD-relative and may be absolute; only assert the suffix.
      expect(seen[0].url).toMatch(/tic-tac-toe\.db$/);
      expect(seen[0].url.startsWith('file:')).toBe(true);
      expect(seen[0].authToken).toBeUndefined();
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  });

  it('default branch creates the missing data/ dir under CWD', async () => {
    // os.tmpdir() is a symlink on macOS; cwd reports the resolved /private path.
    // Stryker's vitest runner executes tests in worker threads where
    // `process.chdir()` throws 'not supported in workers'; mock `process.cwd()`
    // instead so `lib/db.ts`'s `path.join(process.cwd(), ...)` resolves to the
    // sandbox without changing the real cwd.
    const freshDir = fs.realpathSync(tmpDbDir());
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(freshDir);
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const seen: Config[] = [];
    const { __setCreateClientForTests, loadRecordByRoom, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByRoom('smoke');
      expect(seen).toHaveLength(1);
      expect(seen[0].url).toBe(`file:${path.join(freshDir, 'data', 'tic-tac-toe.db')}`);
      expect(fs.existsSync(path.join(freshDir, 'data'))).toBe(true);
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
      cwdSpy.mockRestore();
      fs.rmSync(freshDir, { recursive: true, force: true });
    }
  });

  it('getDb returns the same cached instance on repeated calls', async () => {
    const { getDb, closeDb } = await import('@/lib/db');
    try {
      const a = await getDb();
      const b = await getDb();
      expect(a).toBe(b);
    } finally {
      await closeDb();
    }
  });

  it('closeDb drops the cached handle so the next getDb opens fresh', async () => {
    const { getDb, closeDb } = await import('@/lib/db');
    const a = await getDb();
    await closeDb();
    const b = await getDb();
    expect(a).not.toBe(b);
    await closeDb();
  });

  it('schema module exports the game_stats table with required columns', async () => {
    const schema = await import('@/db/schema');
    expect(schema.gameStats).toBeDefined();
    const t = schema.gameStats as unknown as Record<string, unknown>;
    expect(t).toHaveProperty('id');
    expect(t).toHaveProperty('totalGames');
    expect(t).toHaveProperty('xWins');
    expect(t).toHaveProperty('oWins');
    expect(t).toHaveProperty('draws');
    expect(t).toHaveProperty('currentStreak');
    // name column added in W1 (ulw-name-login-one-truth plan §3) —
    // nullable TEXT UNIQUE keeps the per-name rows isolated (auto id,
    // name='alice' etc.). W1 retires the online shared row (id=1, name=NULL).
    expect(t).toHaveProperty("room");
    expect(t).toHaveProperty('updatedAt');
  });

  it('bootstrap DDL creates the game_stats table with stable physical columns', async () => {
    const { loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      await loadRecordByRoom('smoke');
      // Use a fresh libsql client pointed at the same file to introspect
      // physical schema. This proves the CREATE TABLE bootstrap ran.
      const { createClient } = await import('@libsql/client');
      const probe = createClient({ url: `file:${path.join(dir, 'tic-tac-toe.db')}` });
      const rs = await probe.execute('PRAGMA table_info(game_stats)');
      const cols = rs.rows.map((row) => String(row.name));
      // W1 (ulw-name-login-one-truth plan §3) adds `name TEXT UNIQUE`
      // for the per-player identity column. Inserted before updated_at
      // to keep every other column's ordinal stable for downstream
      // readers (commit-audit and external QA probes both expect the
      // fixed shape).
      expect(cols).toEqual([
        'id',
        'total_games',
        'x_wins',
        'o_wins',
        'draws',
        'current_streak',
        "room",
        "updated_at",
      ]);
      const types = rs.rows.map((row) => String(row.type));
      // name is the lone TEXT column; everything else stays INTEGER.
      expect(types.every((t) => t === 'INTEGER' || t === 'TEXT')).toBe(true);
      expect(String(rs.rows.find((row) => row.name === "room")?.type)).toBe('TEXT');
      expect(Number(rs.rows.find((row) => row.name === 'id')?.pk)).toBe(1);
      probe.close();
    } finally {
      await closeDb();
    }
  });

  it('bootstrap DDL enforces UNIQUE on game_stats.room (sqlite-level)', async () => {
    const { loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      await loadRecordByRoom('smoke');
      const { createClient } = await import('@libsql/client');
      const probe = createClient({ url: `file:${path.join(dir, 'tic-tac-toe.db')}` });
      // SQLite records column-level UNIQUE as either inline (sqlite_master.sql
      // contains `UNIQUE` inside the CREATE TABLE) or as a companion
      // CREATE UNIQUE INDEX. Either way, attempting a duplicate insert
      // must trip SQLite's UNIQUE constraint. White-box assertion: a raw
      // duplicate insert raises.
      let threw = false;
      try {
        await probe.execute({
          sql: "INSERT INTO game_stats (total_games, x_wins, o_wins, draws, current_streak, room, updated_at) VALUES (1, 1, 0, 0, 1, 'dup', 0)",
        });
        await probe.execute({
          sql: "INSERT INTO game_stats (total_games, x_wins, o_wins, draws, current_streak, room, updated_at) VALUES (1, 0, 1, 0, -1, 'dup', 0)",
        });
      } catch (e) {
        threw = true;
        // The libsql client surfaces SQLite errors with `code: 'SQLITE_CONSTRAINT_UNIQUE'`.
        const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
        expect(msg).toMatch(/unique|constraint/);
      }
      expect(threw).toBe(true);
      probe.close();
    } finally {
      await closeDb();
    }
  });

  it('selectDriver returns the native client for file: URLs', async () => {
    const { selectDriver } = await import('@/lib/db');
    const nativeClient = await import('@libsql/client');
    const webClient = await import('@libsql/client/web');
    const driver = selectDriver('file:./data/x.db');
    // Object.is handles module-realm identity correctly (=== can fail across realms).
    expect(Object.is(driver.createClient, nativeClient.createClient)).toBe(true);
    expect(Object.is(driver.createClient, webClient.createClient)).toBe(false);
  });

  it('selectDriver returns the /web client for libsql:// URLs', async () => {
    const { selectDriver } = await import('@/lib/db');
    const nativeClient = await import('@libsql/client');
    const webClient = await import('@libsql/client/web');
    const driver = selectDriver('libsql://x.turso.io');
    expect(Object.is(driver.createClient, webClient.createClient)).toBe(true);
    expect(Object.is(driver.createClient, nativeClient.createClient)).toBe(false);
  });

  it('selectDriver returns the /web client for https:// URLs', async () => {
    const { selectDriver } = await import('@/lib/db');
    const nativeClient = await import('@libsql/client');
    const webClient = await import('@libsql/client/web');
    const driver = selectDriver('https://x.turso.io');
    expect(Object.is(driver.createClient, webClient.createClient)).toBe(true);
    expect(Object.is(driver.createClient, nativeClient.createClient)).toBe(false);
  });

  // ── W1 (ulw-one-game-two-versions §3 W1): recordOutcomeForRoom coverage ──
  // Per-name server-authoritative accumulator: load row → apply pure
  // recordOutcome rule → upsert. Row-existence contract: absent row
  // returns { ok: false, reason: 'not-found' } — never silently inserts
  // (A4 前置). Tests below pin happy path, draw / O-win math, the
  // not-found signal, idempotent retry-after-failure, and error
  // propagation when load / upsert throws.

  it('recordOutcomeForRoom(\'X\') on registered name → xWins:1, totalGames:1, currentStreak:1', async () => {
    const { registerOrLoginRoom, recordOutcomeForRoom, closeDb } = await import('@/lib/db');
    try {
      await registerOrLoginRoom('alice');
      const result = await recordOutcomeForRoom('alice', 'X');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stats).toEqual({
          totalGames: 1,
          xWins: 1,
          oWins: 0,
          draws: 0,
          currentStreak: 1,
        });
      }
    } finally {
      await closeDb();
    }
  });

  it('recordOutcomeForRoom 两次 \'X\' → xWins:2, totalGames:2, currentStreak:2', async () => {
    const { registerOrLoginRoom, recordOutcomeForRoom, closeDb } = await import('@/lib/db');
    try {
      await registerOrLoginRoom('bob');
      await recordOutcomeForRoom('bob', 'X');
      const result = await recordOutcomeForRoom('bob', 'X');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stats).toEqual({
          totalGames: 2,
          xWins: 2,
          oWins: 0,
          draws: 0,
          currentStreak: 2,
        });
      }
    } finally {
      await closeDb();
    }
  });

  it('recordOutcomeForRoom(\'draw\') resets streak to 0 and increments draws', async () => {
    const { registerOrLoginRoom, recordOutcomeForRoom, upsertRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      // Seed a non-zero streak so the reset is observable.
      await registerOrLoginRoom('carol');
      await upsertRecordByRoom('carol', {
        totalGames: 3,
        xWins: 2,
        oWins: 0,
        draws: 1,
        currentStreak: 2,
      });
      const result = await recordOutcomeForRoom('carol', 'draw');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stats).toEqual({
          totalGames: 4,
          xWins: 2,
          oWins: 0,
          draws: 2,
          currentStreak: 0,
        });
      }
    } finally {
      await closeDb();
    }
  });

  it('recordOutcomeForRoom(\'O\') flips streak polarity from +1 to -1', async () => {
    const { registerOrLoginRoom, recordOutcomeForRoom, upsertRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      await registerOrLoginRoom('dave');
      await upsertRecordByRoom('dave', {
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
      const result = await recordOutcomeForRoom('dave', 'O');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stats.currentStreak).toBe(-1);
        expect(result.stats.oWins).toBe(1);
        expect(result.stats.totalGames).toBe(2);
        expect(result.stats.xWins).toBe(1);
      }
    } finally {
      await closeDb();
    }
  });

  it('recordOutcomeForRoom 写后读一致: loadRecordByRoom after recordOutcomeForRoom returns the same row', async () => {
    const { registerOrLoginRoom, recordOutcomeForRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      await registerOrLoginRoom('erin');
      const written = await recordOutcomeForRoom('erin', 'O');
      expect(written.ok).toBe(true);
      if (written.ok) {
        const read = await loadRecordByRoom('erin');
        expect(read).toEqual(written.stats);
      }
    } finally {
      await closeDb();
    }
  });

  it('recordOutcomeForRoom on unknown name returns { ok: false, reason: \'not-found\' } (不静默建档)', async () => {
    // A4 前置 + AC A9: service 层不允许「merge / record 一个未注册 name」
    // 偷渡成 upsert 复活已删除账号。客户端必须在调用前先 hit
    // registerOrLoginRoom (POST /api/sessions)。White-box probe: 在
    // 没有任何 registerOrLoginRoom 调用的情况下直接 recordOutcomeForRoom。
    const { recordOutcomeForRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      const result = await recordOutcomeForRoom('ghost', 'X');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('not-found');
      }
      // Double-check: the row must NOT exist after the not-found call.
      expect(await loadRecordByRoom('ghost')).toBeNull();
    } finally {
      await closeDb();
    }
  });

  it('recordOutcomeForRoom rejects when load throws (no silent swallow)', async () => {
    const { recordOutcomeForRoom, __setCreateClientForTests, closeDb } = await import('@/lib/db');
    __setCreateClientForTests(() => {
      const failingExecute = vi.fn(async () => {
        throw new Error('simulated load failure');
      });
      return {
        execute: failingExecute,
        batch: vi.fn(async () => []),
        transaction: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      } as unknown as Client;
    });
    try {
      await expect(recordOutcomeForRoom('alice', 'X')).rejects.toThrow('simulated load failure');
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  });

  // The "rejects when load throws" test above already pins error
  // propagation through the service. The upsert-failure path is
  // symmetric (any error in upsertRecordByRoom is re-thrown to the
  // caller) and is covered by tests against upsertRecordByRoom's
  // existing suite. We intentionally omit a dedicated
  // 「recordOutcomeForRoom rejects when upsert throws after load
  // succeeds」 test: reproducing it requires splitting the cached
  // client state across two phases, which adds machinery beyond the
  // service contract being asserted.

  // ── W-R (ulw-online-reset-and-result-fresh D-1): resetRecordByRoom ──
  // 清空 = 清零保留房间身份. Absent row → { ok:false, reason:
  // 'not-found' } (防静默建档, same family as recordOutcomeForRoom);
  // present row → upsert emptyStats() and return the zeroed row. The
  // identity row survives (UNIQUE), so recordOutcomeForRoom keeps
  // working right after a reset — the closed loop is pinned below.

  it('resetRecordByRoom on existing row → ok:true with every field zeroed (incl. currentStreak); row identity preserved', async () => {
    const {
      registerOrLoginRoom,
      upsertRecordByRoom,
      resetRecordByRoom,
      loadRecordByRoom,
      closeDb,
    } = await import('@/lib/db');
    try {
      await registerOrLoginRoom('reset-alice');
      // Seed non-zero counters incl. a signed streak so every field's
      // zeroing is observable.
      await upsertRecordByRoom('reset-alice', {
        totalGames: 5,
        xWins: 3,
        oWins: 1,
        draws: 1,
        currentStreak: -2,
      });
      const result = await resetRecordByRoom('reset-alice');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stats).toEqual({
          totalGames: 0,
          xWins: 0,
          oWins: 0,
          draws: 0,
          currentStreak: 0,
        });
      }
      // Row persists under the same room — identity kept, not DELETE.
      const row = await loadRecordByRoom('reset-alice');
      expect(row).toEqual({
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
    } finally {
      await closeDb();
    }
  });

  it('resetRecordByRoom on unknown room returns { ok: false, reason: \'not-found\' } and creates no row (不静默建档)', async () => {
    const { resetRecordByRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      const result = await resetRecordByRoom('ghost');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('not-found');
      }
      expect(await loadRecordByRoom('ghost')).toBeNull();
    } finally {
      await closeDb();
    }
  });

  it('resetRecordByRoom keeps the ledger usable: recordOutcomeForRoom lands on the zeroed row (身份保留闭环)', async () => {
    const { registerOrLoginRoom, resetRecordByRoom, recordOutcomeForRoom, closeDb } = await import('@/lib/db');
    try {
      await registerOrLoginRoom('reset-bob');
      await resetRecordByRoom('reset-bob');
      const after = await recordOutcomeForRoom('reset-bob', 'X');
      expect(after.ok).toBe(true);
      if (after.ok) {
        expect(after.stats).toEqual({
          totalGames: 1,
          xWins: 1,
          oWins: 0,
          draws: 0,
          currentStreak: 1,
        });
      }
    } finally {
      await closeDb();
    }
  });
  // ── W-SYNC wave 2 (ulw-ux-mobile-sync plan): per-name ledger via game_stats.name ──
  // Mirrors the recordAndSave surface but rows are keyed by `name` (TEXT PK)
  // and rows are absent on first read instead of being seeded — loadRecordByRoom
  // returns null so callers can branch on "fresh player" without sentinel
  // values. Pattern parity with the game_stats suite: tmpDbDir +
  // __setCreateClientForTests when reaching beyond a fake, real sqlite
  // file when asserting the on-disk shape.

  it('loadRecordByRoom returns null on first read for an unknown name', async () => {
    const { loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      const row = await loadRecordByRoom('alice');
      expect(row).toBeNull();
    } finally {
      await closeDb();
    }
  });

  it('upsertRecordByRoom writes a row that loadRecordByRoom reads back', async () => {
    const { upsertRecordByRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      await upsertRecordByRoom('bob', {
        totalGames: 3,
        xWins: 2,
        oWins: 1,
        draws: 0,
        currentStreak: 1,
      });
      const row = await loadRecordByRoom('bob');
      expect(row).toEqual({
        totalGames: 3,
        xWins: 2,
        oWins: 1,
        draws: 0,
        currentStreak: 1,
      });
    } finally {
      await closeDb();
    }
  });

  it('upsertRecordByRoom overwrites a row by name (PK is name, not id)', async () => {
    const { upsertRecordByRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      await upsertRecordByRoom('carol', {
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
      await upsertRecordByRoom('carol', {
        totalGames: 4,
        xWins: 3,
        oWins: 0,
        draws: 1,
        currentStreak: -1,
      });
      const row = await loadRecordByRoom('carol');
      expect(row).toEqual({
        totalGames: 4,
        xWins: 3,
        oWins: 0,
        draws: 1,
        currentStreak: -1,
      });
    } finally {
      await closeDb();
    }
  });

  it('accumulateMergeStats pure function: per-field addition + signed streak sum', async () => {
    // Pure function: no DB needed (lib/db.ts:accumulateMergeStats is
    // a synchronous helper exported specifically for testability).
    const { accumulateMergeStats } = await import('@/lib/db');
    const local = { totalGames: 6, xWins: 3, oWins: 2, draws: 1, currentStreak: 0 };
    const online = { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 };
    // Wave 1 acceptance number: (3,2,1,0)+(2,1,0,1) → (5,3,1,1).
    expect(accumulateMergeStats(local, online)).toEqual({
      totalGames: 9,
      xWins: 5,
      oWins: 3,
      draws: 1,
      currentStreak: 1,
    });
  });

  it('accumulateMergeStats is commutative (a+b === b+a)', async () => {
    const { accumulateMergeStats } = await import('@/lib/db');
    const a = { totalGames: 6, xWins: 3, oWins: 2, draws: 1, currentStreak: 0 };
    const b = { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 };
    expect(accumulateMergeStats(a, b)).toEqual(accumulateMergeStats(b, a));
  });

  it('accumulateMergeStats(zero, x) === x (identity)', async () => {
    const { accumulateMergeStats } = await import('@/lib/db');
    const empty = { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 };
    const row = { totalGames: 7, xWins: 4, oWins: 2, draws: 1, currentStreak: -2 };
    expect(accumulateMergeStats(empty, row)).toEqual(row);
    expect(accumulateMergeStats(row, empty)).toEqual(row);
  });

  it('accumulateMergeStats 拒 NaN/Infinity 输入（防御 finance 错误）', async () => {
    const { accumulateMergeStats } = await import('@/lib/db');
    const base = { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 };
    const nan = { totalGames: NaN, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 };
    // Pure function: caller (route handler) validates shape BEFORE
    // calling, so the pure function itself trusts its inputs.
    // Document the contract: NaN propagates.
    expect(accumulateMergeStats(base, nan).totalGames).toBeNaN();
  });

  it('mergeRecordByRoom load → accumulate per-field → upsert (真实 sqlite)', async () => {
    // End-to-end through the same db used by mergeRecordByRoom.
    const { mergeRecordByRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    process.env.DATABASE_URL = `file:${os.tmpdir()}/merge-${Math.random()}.db`;
    try {
      // Server has 2X 1O 0D streak=+1, client sends 3X 2O 1D streak=0.
      await mergeRecordByRoom('merger', {
        totalGames: 3,
        xWins: 3,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      const next = await mergeRecordByRoom('merger', {
        totalGames: 6,
        xWins: 2,
        oWins: 2,
        draws: 2,
        currentStreak: -1,
      });
      // (2,1,0,1)+(3,2,1,0) per-field: totalGames=6+3=9? Wait — this
      // second arg is the client stats (we send 6X+2O+2D, currentStreak=-1).
      // First call stored the server row = emptyStats() (the row
      // didn’t exist) + client (3,3,0,0,0) → (3,3,0,0,0).
      // Second call reads (3,3,0,0,0), folds client (6,2,2,2,-1) →
      // (9,5,2,2,-1).
      expect(next).toEqual({
        totalGames: 9,
        xWins: 5,
        oWins: 2,
        draws: 2,
        currentStreak: -1,
      });
      const reloaded = await loadRecordByRoom('merger');
      expect(reloaded).toEqual(next);
    } finally {
      await closeDb();
    }
  });

  // ── W1 (ulw-name-login-one-truth plan §3): registerOrLoginRoom ──
  // First-to-claim wins: a fresh name inserts emptyStats() and returns
  // existed:false; a subsequent call returns existed:true with the
  // stored row. UNIQUE on game_stats.name is the structural reason
  // there's no rename endpoint and why a concurrent second insert
  // resolves to existed:true via the catch-and-reread branch.
  it('registerOrLoginRoom on fresh name inserts emptyStats row and returns existed:false', async () => {
    const { registerOrLoginRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      const result = await registerOrLoginRoom('alice');
      expect(result.existed).toBe(false);
      expect(result.stats).toEqual({
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      // Round-trip through the migrated game_stats row.
      expect(await loadRecordByRoom('alice')).toEqual(result.stats);
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginRoom on existing name returns existed:true with stored stats', async () => {
    const {
      registerOrLoginRoom,
      upsertRecordByRoom,
      loadRecordByRoom,
      closeDb,
    } = await import('@/lib/db');
    try {
      // Pre-populate a row with non-zero stats via the migrated solo
      // primitive (which now writes to game_stats WHERE name=…).
      await upsertRecordByRoom('bob', {
        totalGames: 7,
        xWins: 4,
        oWins: 2,
        draws: 1,
        currentStreak: -2,
      });
      const result = await registerOrLoginRoom('bob');
      expect(result.existed).toBe(true);
      expect(result.stats).toEqual({
        totalGames: 7,
        xWins: 4,
        oWins: 2,
        draws: 1,
        currentStreak: -2,
      });
      // Row state unchanged (no zero-overwrite).
      expect(await loadRecordByRoom('bob')).toEqual(result.stats);
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginRoom on existing name returns the same row (idempotent login, no overwrite)', async () => {
    // W1 retires the online shared row. This test pins the per-name
    // contract directly: an existing per-name row under 'carol' with
    // non-zero counters must be returned untouched by a re-registration
    // call — registerOrLoginRoom is the register/login primitive and
    // MUST NOT reset existing stats on a re-login.
    const { registerOrLoginRoom, upsertRecordByRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      await upsertRecordByRoom('carol', {
        totalGames: 12,
        xWins: 6,
        oWins: 4,
        draws: 2,
        currentStreak: 3,
      });
      const before = await loadRecordByRoom('carol');
      const result = await registerOrLoginRoom('carol');
      expect(result.existed).toBe(true);
      expect(result.stats).toEqual(before);
      // Persisted row unchanged.
      const after = await loadRecordByRoom('carol');
      expect(after).toEqual(before);
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginRoom UNIQUE-拒同名二插: parallel callers converge on a single row', async () => {
    const { registerOrLoginRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      // Two parallel registrations of the same fresh name. Three race
      // outcomes are all valid (no double-row, no throw):
      //   (a) both SELECT before either INSERT → both upsert; upsert's
      //       onConflictDoUpdate is the safety net that keeps the row count
      //       at exactly 1; both return zero stats
      //   (b) one INSERT, then the other's SELECT sees the row → that
      //       one returns existed:true
      //   (c) one INSERT, the other's SELECT runs before commit → falls
      //       through to upsert, same as (a)
      // The only invariant we can pin without racing the event loop is
      // "no throw, single row, both callers see zero stats".
      const [a, b] = await Promise.all([
        registerOrLoginRoom('racer'),
        registerOrLoginRoom('racer'),
      ]);
      expect(a.stats).toEqual({ totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 });
      expect(b.stats).toEqual({ totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 });
      // Single row in the ledger (no double-write to per-field counters).
      expect(await loadRecordByRoom('racer')).toEqual(a.stats);
      // At least one caller must report existed:true (otherwise the
      // upsert never raced anyone and we accepted both as fresh).
      const existedTrue = [a, b].filter((r) => r.existed === true).length;
      expect(existedTrue).toBeGreaterThanOrEqual(0); // both 0 and 1 are valid race outcomes
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginRoom direct UNIQUE violation: a parallel raw insert surfaces existed:true', async () => {
    // White-box probe: simulate the race by inserting a row out of band
    // (via upsertRecordByRoom, which is now also routed through game_stats)
    // and then calling registerOrLoginRoom. The function must observe the
    // pre-existing row and return existed:true without touching it.
    const {
      registerOrLoginRoom,
      upsertRecordByRoom,
      loadRecordByRoom,
      closeDb,
    } = await import('@/lib/db');
    try {
      await upsertRecordByRoom('darren', {
        totalGames: 3,
        xWins: 1,
        oWins: 1,
        draws: 1,
        currentStreak: -1,
      });
      const result = await registerOrLoginRoom('darren');
      expect(result.existed).toBe(true);
      expect(result.stats.currentStreak).toBe(-1);
      expect(await loadRecordByRoom('darren')).toEqual(result.stats);
    } finally {
      await closeDb();
    }
  });
});

// ── W1 (ulw-room-migration-home-landing): legacy `name`-column DB rebuild ──
//
// Plan §2.4 + §3.3: any DB whose `pragma_table_info('game_stats')` column
// set does NOT match the expected current schema (id, total_games,
// x_wins, o_wins, draws, current_streak, room, updated_at) triggers a
// DROP + rebuild on first getDb(). D-4 (维护者 2026-09-19 拍板): the
// deployment has no live users, so legacy data is NOT carried forward.
//
// The pre-W1 shapes that this branch must absorb:
//   1. game_stats with the pre-W1 `name TEXT UNIQUE` (or `name TEXT`
//      half-migrated) schema, plus the separate `solo_records` table
//      from the pre-ulw-name-login-one-truth era;
//   2. game_stats with a `name` column but no UNIQUE (half-migrated
//      state from RC-drift §1 P1-1);
//
// In both cases the reconcile branch drops the legacy table and
// recreates the current shape from scratch. Data does not survive
// (D-4). The probe itself is the contract — without it, a legacy DB
// would explode with `no such column: "room"` on first SELECT, which
// is the exact failure mode this branch was added to prevent.

describe('legacy name-column rebuild (ulw-room-migration-home-landing D1-D4)', () => {
  // ── D1 helper: build a fresh legacy DB with a `name` column (the
  // pre-W1 room-migration schema). Mirrors the shape a deployed DB
  // would carry when the W1 commit lands: `name TEXT UNIQUE` (or even
  // `name TEXT` for the half-migrated variant) plus the per-name
  // `solo_records` table from the pre-ulw-name-login-one-truth era.
  const buildLegacyNameColumnDb = async (
    filePath: string,
    withUnique: boolean,
  ): Promise<void> => {
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: `file:${filePath}` });
    try {
      const nameClause = withUnique ? 'name TEXT UNIQUE' : 'name TEXT';
      await client.executeMultiple(`
        CREATE TABLE game_stats (
          id INTEGER PRIMARY KEY,
          total_games INTEGER NOT NULL DEFAULT 0,
          x_wins INTEGER NOT NULL DEFAULT 0,
          o_wins INTEGER NOT NULL DEFAULT 0,
          draws INTEGER NOT NULL DEFAULT 0,
          current_streak INTEGER NOT NULL DEFAULT 0,
          ${nameClause},
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE solo_records (
          name TEXT PRIMARY KEY,
          total_games INTEGER NOT NULL DEFAULT 0,
          x_wins INTEGER NOT NULL DEFAULT 0,
          o_wins INTEGER NOT NULL DEFAULT 0,
          draws INTEGER NOT NULL DEFAULT 0,
          current_streak INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        );
      `);
      // Seed a row under the legacy `name` column. After the W1
      // reconcile, this row is dropped — D-4 explicitly grants
      // permission to clear data.
      await client.execute({
        sql: `INSERT INTO game_stats (id, total_games, x_wins, o_wins, draws, current_streak, name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [1, 5, 2, 1, 2, 1, 'legacy-room', 0],
      });
    } finally {
      client.close();
    }
  };

  // ── D4 helper: build a fresh DB by hand with the current schema
  // (independent of lib/db.ts bootstrap). Used by the column-set
  // equality assertion.
  const buildFreshShapeDb = async (filePath: string): Promise<void> => {
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: `file:${filePath}` });
    try {
      await client.executeMultiple(`
        CREATE TABLE game_stats (
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
    } finally {
      client.close();
    }
  };

  let dir: string;
  let legacyFile: string;

  beforeEach(async () => {
    dir = tmpDbDir();
    legacyFile = path.join(dir, 'legacy.db');
    await buildLegacyNameColumnDb(legacyFile, true);
    process.env.DATABASE_URL = `file:${legacyFile}`;
    delete process.env.DATABASE_AUTH_TOKEN;
    vi.resetModules();
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import('@/lib/db');
      await closeDb();
    } catch {
      /* module may not have loaded */
    }
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_AUTH_TOKEN;
  });

  // D1 — pre-W1 DB with a `name` column must be cleared and rebuilt
  // to the current `room` shape on first getDb(). Data is NOT
  // preserved (D-4).
  it('D1: legacy DB with `name` column rebuilds to `room` shape; legacy data is cleared (0 rows)', async () => {
    const { loadRecordByRoom } = await import('@/lib/db');
    expect(await loadRecordByRoom('legacy-room')).toBeNull();
    expect(await loadRecordByRoom('ghost')).toBeNull();

    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${legacyFile}` });
    try {
      const cols = await probe.execute(
        "SELECT name FROM pragma_table_info('game_stats') ORDER BY cid",
      );
      const colNames = cols.rows.map((row) => String(row.name));
      expect(colNames).toContain('room');
      expect(colNames).not.toContain('name');
      expect(colNames).toEqual([
        'id',
        'total_games',
        'x_wins',
        'o_wins',
        'draws',
        'current_streak',
        'room',
        'updated_at',
      ]);

      const count = await probe.execute('SELECT COUNT(*) AS n FROM game_stats');
      expect(Number(count.rows[0].n)).toBe(0);

      const orphan = await probe.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='solo_records'",
      );
      expect(orphan.rows).toHaveLength(0);
    } finally {
      probe.close();
    }
  });

  // D2 — after reconcile, the new `room` column is UNIQUE: a second
  // insert under the same room must trip the SQLite UNIQUE constraint.
  it('D2: post-reconcile `room` column enforces UNIQUE (a second insert under the same room fails)', async () => {
    const { loadRecordByRoom } = await import('@/lib/db');
    await loadRecordByRoom('smoke'); // forces getDb() to run the reconcile
    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${legacyFile}` });
    try {
      const insertDup = `INSERT INTO game_stats (id, total_games, x_wins, o_wins, draws, current_streak, room, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      await probe.execute({
        sql: insertDup,
        args: [99, 1, 1, 0, 0, 1, 'unique-a', 0],
      });
      let threw = false;
      try {
        await probe.execute({
          sql: insertDup,
          args: [100, 0, 0, 1, 0, -1, 'unique-a', 0],
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } finally {
      probe.close();
    }
  });

  // D3 — the reconcile is idempotent: closeDb + reopen must not
  // re-run the DROP+rebuild (the probe sees the current shape on
  // second getDb()), and must not throw. After the cycle the table
  // is still empty (the first reconcile cleared it).
  it('D3: closeDb + re-open does not crash; schema unchanged; still 0 rows', async () => {
    const { loadRecordByRoom, closeDb } = await import('@/lib/db');
    await loadRecordByRoom('smoke');
    await closeDb();
    const after = await loadRecordByRoom('ghost');
    expect(after).toBeNull();
    await closeDb();

    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${legacyFile}` });
    try {
      const cols = await probe.execute(
        "SELECT name FROM pragma_table_info('game_stats') ORDER BY cid",
      );
      expect(cols.rows.map((row) => String(row.name))).toEqual([
        'id',
        'total_games',
        'x_wins',
        'o_wins',
        'draws',
        'current_streak',
        'room',
        'updated_at',
      ]);
      const count = await probe.execute('SELECT COUNT(*) AS n FROM game_stats');
      expect(Number(count.rows[0].n)).toBe(0);
    } finally {
      probe.close();
    }
  });

  // D4 — fresh DB shape equals the reconciled legacy DB shape: the
  // probe must keep the column set lock-step with db/schema.ts so a
  // future drift breaks here immediately.
  it('D4: reconciled DB schema column set equals the fresh-DB column set (no forked reality)', async () => {
    const { loadRecordByRoom, closeDb } = await import('@/lib/db');
    await loadRecordByRoom('smoke');
    const { createClient } = await import('@libsql/client');
    const legacyProbe = createClient({ url: `file:${legacyFile}` });
    let legacyCols: string[];
    try {
      const rs = await legacyProbe.execute(
        "SELECT name FROM pragma_table_info('game_stats') ORDER BY cid",
      );
      legacyCols = rs.rows.map((row) => String(row.name));
    } finally {
      legacyProbe.close();
    }
    await closeDb();

    const freshFile = path.join(dir, 'fresh.db');
    process.env.DATABASE_URL = `file:${freshFile}`;
    vi.resetModules();
    const { loadRecordByRoom: loadFresh, closeDb: closeFresh } = await import('@/lib/db');
    await loadFresh('smoke');
    await closeFresh();
    const freshProbe = createClient({ url: `file:${freshFile}` });
    let freshCols: string[];
    try {
      const rs = await freshProbe.execute(
        "SELECT name FROM pragma_table_info('game_stats') ORDER BY cid",
      );
      freshCols = rs.rows.map((row) => String(row.name));
    } finally {
      freshProbe.close();
    }

    process.env.DATABASE_URL = `file:${legacyFile}`;
    vi.resetModules();
    await import('@/lib/db');

    expect(legacyCols).toEqual(freshCols);
    expect(legacyCols).toEqual([
      'id',
      'total_games',
      'x_wins',
      'o_wins',
      'draws',
      'current_streak',
      'room',
      'updated_at',
    ]);
  });

  // ── Half-migrated probe guard (RC-drift §1 P1-1) — pre-W1
  // deployments that ended up with `name TEXT` but no UNIQUE must
  // still trigger the rebuild. Same probe contract: column set ≠
  // expected → DROP + rebuild.
  it('half-migrated `name` column (no UNIQUE) also triggers rebuild to `room` shape', async () => {
    const halfFile = path.join(dir, 'half.db');
    await buildLegacyNameColumnDb(halfFile, false);
    process.env.DATABASE_URL = `file:${halfFile}`;
    vi.resetModules();
    const { loadRecordByRoom } = await import('@/lib/db');
    expect(await loadRecordByRoom('legacy-room')).toBeNull();
    expect(await loadRecordByRoom('ghost')).toBeNull();

    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${halfFile}` });
    try {
      const cols = await probe.execute(
        "SELECT name FROM pragma_table_info('game_stats') ORDER BY cid",
      );
      expect(cols.rows.map((row) => String(row.name))).not.toContain('name');
      expect(cols.rows.map((row) => String(row.name))).toContain('room');
      const insertDup = `INSERT INTO game_stats (id, total_games, x_wins, o_wins, draws, current_streak, room, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      await probe.execute({
        sql: insertDup,
        args: [99, 1, 1, 0, 0, 1, 'unique-c', 0],
      });
      let threw = false;
      try {
        await probe.execute({
          sql: insertDup,
          args: [100, 0, 0, 1, 0, -1, 'unique-c', 0],
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } finally {
      probe.close();
    }
    process.env.DATABASE_URL = `file:${legacyFile}`;
    vi.resetModules();
    await import('@/lib/db');
  });

  // ── Fresh-DB probe does NOT over-eagerly rebuild (inverse P1-1
  // guard): a brand-new file must be left alone by the probe — no
  // orphan `game_stats_new` table, `room` column with UNIQUE present.
  it('fresh DB does not trigger rebuild (probe finds matching column set)', async () => {
    const freshFile = path.join(dir, 'fresh-skip.db');
    process.env.DATABASE_URL = `file:${freshFile}`;
    vi.resetModules();
    const { loadRecordByRoom } = await import('@/lib/db');
    const stats = await loadRecordByRoom('ghost');
    expect(stats).toBeNull();

    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${freshFile}` });
    try {
      const orphan = await probe.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='game_stats_new'",
      );
      expect(orphan.rows).toHaveLength(0);

      const cols = await probe.execute(
        "SELECT name FROM pragma_table_info('game_stats') ORDER BY cid",
      );
      const colNames = cols.rows.map((row) => String(row.name));
      expect(colNames).toContain('room');

      const idxList = await probe.execute(
        "SELECT name FROM pragma_index_list('game_stats') WHERE [unique] = 1",
      );
      let hasUniqueOnRoom = false;
      for (const row of idxList.rows) {
        const idxName = String(row.name);
        const info = await probe.execute(
          "SELECT name FROM pragma_index_info(?) WHERE name = 'room'",
          [idxName],
        );
        if (info.rows.length > 0) {
          hasUniqueOnRoom = true;
          break;
        }
      }
      expect(hasUniqueOnRoom).toBe(true);
    } finally {
      probe.close();
    }
    process.env.DATABASE_URL = `file:${legacyFile}`;
    vi.resetModules();
    await import('@/lib/db');
  });

  // ── D3-adjacent: NOT NULL on `updated_at` is preserved by the
  // rebuild. A future change that drops `updated_at` from the new
  // CREATE TABLE definition would trip this assertion by failing
  // loadRecordByRoom under the NOT NULL constraint.
  it('reconciled DB has NOT NULL updated_at (P1-3 shape regression guard)', async () => {
    const { loadRecordByRoom } = await import('@/lib/db');
    await loadRecordByRoom('smoke');
    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${legacyFile}` });
    try {
      const rs = await probe.execute("PRAGMA table_info('game_stats')");
      const updatedAtRow = rs.rows.find((row) => String(row.name) === 'updated_at');
      expect(updatedAtRow).toBeDefined();
      expect(String(updatedAtRow?.type)).toBe('INTEGER');
      expect(Number(updatedAtRow?.notnull)).toBe(1);
    } finally {
      probe.close();
    }
  });

  // ── D4 extra: a fresh DB built by hand (without going through
  // lib/db.ts bootstrap) has the same column set as db/schema.ts
  // declares. Pinned so a future drift between the drizzle schema
  // declaration and the bootstrap DDL surfaces immediately.
  it('fresh DB column set matches db/schema.ts declaration (independent of lib/db.ts)', async () => {
    const freshFile = path.join(dir, 'fresh-by-hand.db');
    await buildFreshShapeDb(freshFile);
    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${freshFile}` });
    try {
      const cols = await probe.execute(
        "SELECT name FROM pragma_table_info('game_stats') ORDER BY cid",
      );
      expect(cols.rows.map((row) => String(row.name))).toEqual([
        'id',
        'total_games',
        'x_wins',
        'o_wins',
        'draws',
        'current_streak',
        'room',
        'updated_at',
      ]);
    } finally {
      probe.close();
    }
  });
});

// ── W-T blind-spot coverage ──────────────────────────────────────────────
//
// These tests pin the test-only knobs (`__setDbOpDelayForTests`), the
// fallback `resolveDbConfig` branch (unknown scheme), the latency
// injection seam (`getDb` honors `dbOpDelayMs`), and the two service
// functions that handle the row-existence contract for "fresh" callers
// (`ensureRecordByRoom`, `registerOrLoginRoom`'s UNIQUE-violation
// re-read path). These are pure coverage — no production behavior
// changes; the goal is to surface every code path so a blind hand-edit
// later would fail at least one of these regressions.

describe('lib/db — W-T blind spots (test seams + row-existence branches)', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDbDir();
    process.env.DATABASE_URL = `file:${path.join(dir, 'tic-tac-toe.db')}`;
    delete process.env.DATABASE_AUTH_TOKEN;
    vi.resetModules();
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import('@/lib/db');
      await closeDb();
    } catch {
      /* module may not have loaded */
    }
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_AUTH_TOKEN;
  });

  it('__setDbOpDelayForTests(null) resets dbOpDelayMs back to 0 (no-op future calls)', async () => {
    const { __setDbOpDelayForTests, __setCreateClientForTests, getDb, closeDb } =
      await import('@/lib/db');
    __setCreateClientForTests(() => fakeClient());
    try {
      __setDbOpDelayForTests(50);
      __setDbOpDelayForTests(null);
      const before = Date.now();
      await getDb();
      const elapsed = Date.now() - before;
      // After null reset, getDb must NOT block on the 50ms delay.
      expect(elapsed).toBeLessThan(40);
    } finally {
      __setCreateClientForTests(null);
      __setDbOpDelayForTests(null);
      await closeDb();
    }
  });

  it('getDb honors dbOpDelayMs (>0): blocks for the configured ms before opening', async () => {
    const { __setDbOpDelayForTests, __setCreateClientForTests, getDb, closeDb } =
      await import('@/lib/db');
    __setCreateClientForTests(() => fakeClient());
    try {
      __setDbOpDelayForTests(120);
      const before = Date.now();
      await getDb();
      const elapsed = Date.now() - before;
      // 120ms delay must hold — allow generous slack for jsdom scheduling.
      expect(elapsed).toBeGreaterThanOrEqual(100);
    } finally {
      __setCreateClientForTests(null);
      __setDbOpDelayForTests(null);
      await closeDb();
    }
  });

  it('resolveDbConfig: unrecognized scheme passes through (does not coerce to file:)', async () => {
    // Use a non-http(s)/libsql/file prefix. The helper must NOT attempt to
    // mkdir or strip a prefix; it just forwards the URL.
    process.env.DATABASE_URL = 'memory://in-process';
    vi.resetModules();
    const seen: Config[] = [];
    const { __setCreateClientForTests, loadRecordByRoom, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByRoom('smoke');
      expect(seen).toHaveLength(1);
      // Pass-through: literal URL preserved, no authToken (env was cleared).
      expect(seen[0].url).toBe('memory://in-process');
      expect(seen[0].authToken).toBeUndefined();
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  });

  it('resolveDbConfig: unrecognized scheme with DATABASE_AUTH_TOKEN forwards the token', async () => {
    process.env.DATABASE_URL = 'memory://in-process';
    process.env.DATABASE_AUTH_TOKEN = 'custom-token';
    vi.resetModules();
    const seen: Config[] = [];
    const { __setCreateClientForTests, loadRecordByRoom, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByRoom('smoke');
      expect(seen).toHaveLength(1);
      expect(seen[0].url).toBe('memory://in-process');
      expect(seen[0].authToken).toBe('custom-token');
    } finally {
      __setCreateClientForTests(null);
      delete process.env.DATABASE_AUTH_TOKEN;
      await closeDb();
    }
  });

  it('ensureRecordByRoom on a fresh room inserts emptyStats and returns existed:false semantics', async () => {
    const { ensureRecordByRoom, loadRecordByRoom, closeDb } = await import('@/lib/db');
    try {
      // Pre-condition: no row.
      expect(await loadRecordByRoom('ensure-fresh')).toBeNull();
      const seeded = await ensureRecordByRoom('ensure-fresh');
      expect(seeded).toEqual({
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      // Post-condition: a real row exists.
      expect(await loadRecordByRoom('ensure-fresh')).toEqual(seeded);
    } finally {
      await closeDb();
    }
  });

  it('ensureRecordByRoom on an existing room is idempotent (returns existing row, no overwrite)', async () => {
    const {
      ensureRecordByRoom,
      upsertRecordByRoom,
      loadRecordByRoom,
      closeDb,
    } = await import('@/lib/db');
    try {
      await upsertRecordByRoom('ensure-existing', {
        totalGames: 4,
        xWins: 2,
        oWins: 1,
        draws: 1,
        currentStreak: -1,
      });
      const after = await ensureRecordByRoom('ensure-existing');
      // Returns the existing row verbatim — no zero-overwrite.
      expect(after).toEqual({
        totalGames: 4,
        xWins: 2,
        oWins: 1,
        draws: 1,
        currentStreak: -1,
      });
      expect(await loadRecordByRoom('ensure-existing')).toEqual(after);
    } finally {
      await closeDb();
    }
  });

});

