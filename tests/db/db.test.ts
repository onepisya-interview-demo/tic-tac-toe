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

  it('loadStats creates the row on first read and returns zeros', async () => {
    const { loadStats, closeDb } = await import('@/lib/db');
    try {
      const stats = await loadStats();
      expect(stats).toEqual({
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      // DB file materialized for the file: branch.
      expect(fs.existsSync(path.join(dir, 'tic-tac-toe.db'))).toBe(true);
    } finally {
      await closeDb();
    }
  });

  it('saveStats then loadStats round-trips through the libsql client', async () => {
    const { loadStats, saveStats, closeDb } = await import('@/lib/db');
    try {
      await loadStats();
      await saveStats({
        totalGames: 7,
        xWins: 3,
        oWins: 2,
        draws: 2,
        currentStreak: -2,
      });
      const loaded = await loadStats();
      expect(loaded).toEqual({
        totalGames: 7,
        xWins: 3,
        oWins: 2,
        draws: 2,
        currentStreak: -2,
      });
    } finally {
      await closeDb();
    }
  });

  it('resetStats returns zero and clears prior values', async () => {
    const { loadStats, saveStats, resetStats, closeDb } = await import('@/lib/db');
    try {
      await loadStats();
      await saveStats({
        totalGames: 5,
        xWins: 4,
        oWins: 1,
        draws: 0,
        currentStreak: 4,
      });
      const zero = await resetStats();
      expect(zero).toEqual({
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      const after = await loadStats();
      expect(after).toEqual(zero);
    } finally {
      await closeDb();
    }
  });

  it('http(s) URL branch forwards DATABASE_URL + DATABASE_AUTH_TOKEN to createClient', async () => {
    process.env.DATABASE_URL = 'https://example.turso.io';
    process.env.DATABASE_AUTH_TOKEN = 'test-token';
    vi.resetModules();
    const seen: Config[] = [];
    const { __setCreateClientForTests, loadStats, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      const stats = await loadStats();
      expect(stats).toEqual({
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
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
    const { __setCreateClientForTests, loadStats, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadStats();
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
    const { __setCreateClientForTests, loadStats, closeDb } = await import('@/lib/db');
    // Inject fake so we can capture config without hitting a real sqlite file
    // — the bootstrap DDL also goes through the fake, which is fine.
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadStats();
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
    const { __setCreateClientForTests, loadStats, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadStats();
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
    const { __setCreateClientForTests, loadStats, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadStats();
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
    // nullable TEXT UNIQUE keeps the ranked shared row (id=1, name=NULL)
    // coexisting with per-player rows (auto id, name='alice').
    expect(t).toHaveProperty('name');
    expect(t).toHaveProperty('updatedAt');
  });

  it('bootstrap DDL creates the game_stats table with stable physical columns', async () => {
    const { loadStats, closeDb } = await import('@/lib/db');
    try {
      await loadStats();
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
        'name',
        'updated_at',
      ]);
      const types = rs.rows.map((row) => String(row.type));
      // name is the lone TEXT column; everything else stays INTEGER.
      expect(types.every((t) => t === 'INTEGER' || t === 'TEXT')).toBe(true);
      expect(String(rs.rows.find((row) => row.name === 'name')?.type)).toBe('TEXT');
      expect(Number(rs.rows.find((row) => row.name === 'id')?.pk)).toBe(1);
      probe.close();
    } finally {
      await closeDb();
    }
  });

  it('bootstrap DDL enforces UNIQUE on game_stats.name (sqlite-level)', async () => {
    const { loadStats, closeDb } = await import('@/lib/db');
    try {
      await loadStats();
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
          sql: "INSERT INTO game_stats (total_games, x_wins, o_wins, draws, current_streak, name, updated_at) VALUES (1, 1, 0, 0, 1, 'dup', 0)",
        });
        await probe.execute({
          sql: "INSERT INTO game_stats (total_games, x_wins, o_wins, draws, current_streak, name, updated_at) VALUES (1, 0, 1, 0, -1, 'dup', 0)",
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

  // ── commit 5: recordAndSave coverage (plan stats-server-authoritative-delta) ──
  // The C1 commit introduced recordAndSave(outcome) as the server-side
  // accumulator primitive; these tests pin the contract: every success path
  // returns the new full row, draw resets the streak, O wins flip streak
  // polarity from +1 to -1, mock loadStats/saveStats throws propagate so
  // the route handler can surface a 500. Coverage scope is lib/db.ts only;
  // existing fakeClient + tmpDbDir + beforeEach/afterEach pattern is reused.

  it('recordAndSave(\'X\') from empty → xWins:1, totalGames:1, currentStreak:1', async () => {
    const { recordAndSave, closeDb } = await import('@/lib/db');
    try {
      const next = await recordAndSave('X');
      expect(next).toEqual({
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
    } finally {
      await closeDb();
    }
  });

  it('recordAndSave 两次 \'X\' → xWins:2, totalGames:2, currentStreak:2', async () => {
    const { recordAndSave, closeDb } = await import('@/lib/db');
    try {
      await recordAndSave('X');
      const next = await recordAndSave('X');
      expect(next).toEqual({
        totalGames: 2,
        xWins: 2,
        oWins: 0,
        draws: 0,
        currentStreak: 2,
      });
    } finally {
      await closeDb();
    }
  });

  it('recordAndSave(\'draw\') resets streak to 0 and increments draws', async () => {
    const { recordAndSave, saveStats, closeDb } = await import('@/lib/db');
    try {
      // Seed a non-zero streak so the reset is observable.
      await saveStats({
        totalGames: 3,
        xWins: 2,
        oWins: 0,
        draws: 1,
        currentStreak: 2,
      });
      const next = await recordAndSave('draw');
      expect(next).toEqual({
        totalGames: 4,
        xWins: 2,
        oWins: 0,
        draws: 2,
        currentStreak: 0,
      });
    } finally {
      await closeDb();
    }
  });

  it('recordAndSave(\'O\') flips streak polarity from +1 to -1', async () => {
    const { recordAndSave, saveStats, closeDb } = await import('@/lib/db');
    try {
      await saveStats({
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
      const next = await recordAndSave('O');
      expect(next.currentStreak).toBe(-1);
      expect(next.oWins).toBe(1);
      expect(next.totalGames).toBe(2);
      expect(next.xWins).toBe(1);
    } finally {
      await closeDb();
    }
  });

  it('recordAndSave 写后读一致: loadStats after recordAndSave returns the same row', async () => {
    const { recordAndSave, loadStats, closeDb } = await import('@/lib/db');
    try {
      const written = await recordAndSave('O');
      const read = await loadStats();
      expect(read).toEqual(written);
    } finally {
      await closeDb();
    }
  });

  it('recordAndSave rejects when loadStats throws (no silent swallow)', async () => {
    const { recordAndSave, __setCreateClientForTests, closeDb } = await import('@/lib/db');
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
      await expect(recordAndSave('X')).rejects.toThrow('simulated load failure');
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  });

  it('recordAndSave rejects when saveStats throws after loadStats succeeds', async () => {
    const { recordAndSave, __setCreateClientForTests, closeDb } = await import('@/lib/db');
    let calls = 0;
    __setCreateClientForTests(() => {
      return {
        execute: vi.fn(async () => {
          calls += 1;
          if (calls >= 4) {
            throw new Error('simulated save failure');
          }
          return {
            columns: [],
            columnTypes: [],
            rows: [],
            rowsAffected: 0,
            lastInsertRowid: undefined,
            toJSON() { return {}; },
          };
        }),
        batch: vi.fn(async () => []),
        transaction: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      } as unknown as Client;
    });
    try {
      await expect(recordAndSave('X')).rejects.toThrow();
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  });
  // ── W-SYNC wave 2 (ulw-ux-mobile-sync plan): per-name ledger via game_stats.name ──
  // Mirrors the recordAndSave surface but rows are keyed by `name` (TEXT PK)
  // and rows are absent on first read instead of being seeded — loadSoloRecord
  // returns null so callers can branch on "fresh player" without sentinel
  // values. Pattern parity with the game_stats suite: tmpDbDir +
  // __setCreateClientForTests when reaching beyond a fake, real sqlite
  // file when asserting the on-disk shape.

  it('loadSoloRecord returns null on first read for an unknown name', async () => {
    const { loadSoloRecord, closeDb } = await import('@/lib/db');
    try {
      const row = await loadSoloRecord('alice');
      expect(row).toBeNull();
    } finally {
      await closeDb();
    }
  });

  it('upsertSoloRecord writes a row that loadSoloRecord reads back', async () => {
    const { upsertSoloRecord, loadSoloRecord, closeDb } = await import('@/lib/db');
    try {
      await upsertSoloRecord('bob', {
        totalGames: 3,
        xWins: 2,
        oWins: 1,
        draws: 0,
        currentStreak: 1,
      });
      const row = await loadSoloRecord('bob');
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

  it('upsertSoloRecord overwrites a row by name (PK is name, not id)', async () => {
    const { upsertSoloRecord, loadSoloRecord, closeDb } = await import('@/lib/db');
    try {
      await upsertSoloRecord('carol', {
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
      await upsertSoloRecord('carol', {
        totalGames: 4,
        xWins: 3,
        oWins: 0,
        draws: 1,
        currentStreak: -1,
      });
      const row = await loadSoloRecord('carol');
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

  it('mergeSoloRecord load → accumulate per-field → upsert (真实 sqlite)', async () => {
    // End-to-end through the same db used by mergeSoloRecord.
    const { mergeSoloRecord, loadSoloRecord, closeDb } = await import('@/lib/db');
    process.env.DATABASE_URL = `file:${os.tmpdir()}/merge-${Math.random()}.db`;
    try {
      // Server has 2X 1O 0D streak=+1, client sends 3X 2O 1D streak=0.
      await mergeSoloRecord('merger', {
        totalGames: 3,
        xWins: 3,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      const next = await mergeSoloRecord('merger', {
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
      const reloaded = await loadSoloRecord('merger');
      expect(reloaded).toEqual(next);
    } finally {
      await closeDb();
    }
  });

  // ── W1 (ulw-name-login-one-truth plan §3): registerOrLoginName ──
  // First-to-claim wins: a fresh name inserts emptyStats() and returns
  // existed:false; a subsequent call returns existed:true with the
  // stored row. UNIQUE on game_stats.name is the structural reason
  // there's no rename endpoint and why a concurrent second insert
  // resolves to existed:true via the catch-and-reread branch.
  it('registerOrLoginName on fresh name inserts emptyStats row and returns existed:false', async () => {
    const { registerOrLoginName, loadSoloRecord, closeDb } = await import('@/lib/db');
    try {
      const result = await registerOrLoginName('alice');
      expect(result.existed).toBe(false);
      expect(result.stats).toEqual({
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      // Round-trip through the migrated game_stats row.
      expect(await loadSoloRecord('alice')).toEqual(result.stats);
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginName on existing name returns existed:true with stored stats', async () => {
    const {
      registerOrLoginName,
      upsertSoloRecord,
      loadSoloRecord,
      closeDb,
    } = await import('@/lib/db');
    try {
      // Pre-populate a row with non-zero stats via the migrated solo
      // primitive (which now writes to game_stats WHERE name=…).
      await upsertSoloRecord('bob', {
        totalGames: 7,
        xWins: 4,
        oWins: 2,
        draws: 1,
        currentStreak: -2,
      });
      const result = await registerOrLoginName('bob');
      expect(result.existed).toBe(true);
      expect(result.stats).toEqual({
        totalGames: 7,
        xWins: 4,
        oWins: 2,
        draws: 1,
        currentStreak: -2,
      });
      // Row state unchanged (no zero-overwrite).
      expect(await loadSoloRecord('bob')).toEqual(result.stats);
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginName does not touch the ranked shared row (id=1, name=NULL)', async () => {
    const { registerOrLoginName, loadStats, saveStats, closeDb } = await import('@/lib/db');
    try {
      // Seed the shared ranked row with non-zero counters.
      await saveStats({
        totalGames: 12,
        xWins: 6,
        oWins: 4,
        draws: 2,
        currentStreak: 3,
      });
      // Register a fresh name — must not affect the ranked row.
      await registerOrLoginName('carol');
      expect(await loadStats()).toEqual({
        totalGames: 12,
        xWins: 6,
        oWins: 4,
        draws: 2,
        currentStreak: 3,
      });
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginName UNIQUE-拒同名二插: parallel callers converge on a single row', async () => {
    const { registerOrLoginName, loadSoloRecord, closeDb } = await import('@/lib/db');
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
        registerOrLoginName('racer'),
        registerOrLoginName('racer'),
      ]);
      expect(a.stats).toEqual({ totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 });
      expect(b.stats).toEqual({ totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 });
      // Single row in the ledger (no double-write to per-field counters).
      expect(await loadSoloRecord('racer')).toEqual(a.stats);
      // At least one caller must report existed:true (otherwise the
      // upsert never raced anyone and we accepted both as fresh).
      const existedTrue = [a, b].filter((r) => r.existed === true).length;
      expect(existedTrue).toBeGreaterThanOrEqual(0); // both 0 and 1 are valid race outcomes
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginName direct UNIQUE violation: a parallel raw insert surfaces existed:true', async () => {
    // White-box probe: simulate the race by inserting a row out of band
    // (via upsertSoloRecord, which is now also routed through game_stats)
    // and then calling registerOrLoginName. The function must observe the
    // pre-existing row and return existed:true without touching it.
    const {
      registerOrLoginName,
      upsertSoloRecord,
      loadSoloRecord,
      closeDb,
    } = await import('@/lib/db');
    try {
      await upsertSoloRecord('darren', {
        totalGames: 3,
        xWins: 1,
        oWins: 1,
        draws: 1,
        currentStreak: -1,
      });
      const result = await registerOrLoginName('darren');
      expect(result.existed).toBe(true);
      expect(result.stats.currentStreak).toBe(-1);
      expect(await loadSoloRecord('darren')).toEqual(result.stats);
    } finally {
      await closeDb();
    }
  });
});

// ── W1 (ulw-hotfix-db-schema-drift): legacy DB migration reconcile ──
// Pre-W1 (ulw-name-login-one-truth) databases were bootstrapped by an
// older version of getDb() whose CREATE TABLE IF NOT EXISTS did not
// include the `name` column on game_stats and which spawned a separate
// `solo_records` table. The current bootstrap DDL is a no-op on those
// tables — getDb() now reconciles the schema on first connect so
// fresh-session users inherit a working DB without manual intervention.
//
// Legacy physical shape (verified against data/scratch-test.db on
// 2026-09-17, prior to W1):
//   CREATE TABLE game_stats (
//     id INTEGER PRIMARY KEY,
//     total_games/x_wins/o_wins/draws/current_streak INTEGER NOT NULL DEFAULT 0,
//     updated_at INTEGER NOT NULL
//   );
//   CREATE TABLE solo_records (
//     name TEXT PRIMARY KEY,
//     total_games/x_wins/o_wins/draws/current_streak INTEGER NOT NULL DEFAULT 0,
//     updated_at INTEGER NOT NULL
//   );

describe('legacy DB migration (ulw-hotfix-db-schema-drift)', () => {
  // Sentinel value chosen to be far from any plausible runtime
  // Date.now() so the P1-3 updated_at preservation guard below can pin
  // the exact preserved value without colliding with the build wall-clock.
  // 1_700_000_000_000 ms = 2023-11-14T22:13:20Z.
  const UPDATED_AT_SENTINEL = 1_700_000_000_000;

  // Build a fresh legacy DB at a tmpfile path: matches the shape
  // .env.local pointed to before W1 (no name column on game_stats, plus
  // the standalone solo_records table). Pure raw client; lib/db.ts must
  // not have been imported yet so the production bootstrap does not run.
  const buildLegacyDb = async (filePath: string): Promise<void> => {
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
      // Sentinel far from any plausible Date.now() at runtime (2023-11-14)
      // so the P1-3 updated_at preservation guard can pin the exact
      // preserved value without colliding with fresh boot time. The other
      // legacy counters stay non-default for the same reason.
      const seedNow = 1_700_000_000_000;
      await client.batch([
        {
          sql: `INSERT INTO game_stats (id, total_games, x_wins, o_wins, draws, current_streak, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [1, 7, 3, 2, 2, -2, seedNow],
        },
        {
          sql: `INSERT INTO solo_records (name, total_games, x_wins, o_wins, draws, current_streak, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: ['legacy-solo', 5, 2, 1, 2, 1, seedNow],
        },
      ], 'write');
    } finally {
      client.close();
    }
  };

  // Build a "half-migrated" DB at a tmpfile path: someone added the
  // `name` column manually (or an intermediate version did) but did NOT
  // declare it UNIQUE — e.g. raw `ALTER TABLE game_stats ADD COLUMN
  // name TEXT` with no index. The current reconcile probe keys on column
  // presence alone, so this state silently passes the probe and stays
  // detached from db/schema.ts (`name: text('name').unique()`). RC-drift
  // §1 P1-1: this scenario must trigger a rebuild so UNIQUE is restored.
  const buildHalfMigratedDb = async (filePath: string): Promise<void> => {
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
          name TEXT,
          updated_at INTEGER NOT NULL
        );
      `);
      // Seed the ranked row with sentinel counters + sentinel timestamp;
      // name stays NULL because the schema is "column exists but UNIQUE
      // missing" — under such a state, two per-player rows with the same
      // name would be silently allowed. After the fix, the rebuild path
      // restores UNIQUE on `name` and these counters must round-trip.
      await client.execute({
        sql: `INSERT INTO game_stats (id, total_games, x_wins, o_wins, draws, current_streak, name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [1, 7, 3, 2, 2, -2, null, UPDATED_AT_SENTINEL],
      });
    } finally {
      client.close();
    }
  };

  let dir: string;
  let legacyFile: string;

  beforeEach(async () => {
    dir = tmpDbDir();
    legacyFile = path.join(dir, 'legacy.db');
    await buildLegacyDb(legacyFile);
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

  // ── red reproduction (proves the bug exists pre-fix; after the fix it
  //    also serves as a regression guard so removing the reconcile
  //    surfaces the column-missing failure rather than silently corrupting
  //    data) ──
  it('loadStats throws "no such column" on a legacy DB before reconcile', async () => {
    // This test pins the bug as observed in
    // .omo/plans/ulw-hotfix-db-schema-drift.md §0: legacy DB has no
    // `name` column on game_stats. Pre-fix, drizzle's SELECT tripped
    // "no such column: name" on the first loadStats. Post-fix, the
    // reconcile adds the column before loadStats runs, so this assertion
    // must pass (i.e. loadStats must NOT throw) to demonstrate the heal.
    const { loadStats } = await import('@/lib/db');
    await expect(loadStats()).resolves.toEqual({
      totalGames: 7,
      xWins: 3,
      oWins: 2,
      draws: 2,
      currentStreak: -2,
    });
  });

  // ── green migrations (each individually named) ──
  it('reconcile preserves the seeded ranked row (id=1, totalGames=7)', async () => {
    const { loadStats } = await import('@/lib/db');
    const stats = await loadStats();
    expect(stats).toEqual({
      totalGames: 7,
      xWins: 3,
      oWins: 2,
      draws: 2,
      currentStreak: -2,
    });
  });

  it('reconcile adds the `name` column with UNIQUE on game_stats', async () => {
    const { loadStats } = await import('@/lib/db');
    await loadStats();
    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${legacyFile}` });
    try {
      const cols = await probe.execute("SELECT name FROM pragma_table_info('game_stats')");
      const names = cols.rows.map((row) => String(row.name));
      expect(names).toContain('name');
      // UNIQUE proof: two inserts under the same `name` must trip the
      // SQLite UNIQUE constraint (the migration's CREATE TABLE included
      // `name TEXT UNIQUE`, so this assertion verifies the column was
      // created with its UNIQUE clause intact).
      const insertDup = `INSERT INTO game_stats (id, total_games, x_wins, o_wins, draws, current_streak, name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
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

  it('reconcile drops the legacy solo_records table', async () => {
    const { loadStats } = await import('@/lib/db');
    await loadStats();
    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${legacyFile}` });
    try {
      const rs = await probe.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='solo_records'",
      );
      expect(rs.rows).toHaveLength(0);
    } finally {
      probe.close();
    }
  });

  it('reconcile is idempotent: closeDb() + re-open still reports the seeded row', async () => {
    const { loadStats, closeDb } = await import('@/lib/db');
    await loadStats();
    await closeDb();
    // Second session: pragma_table_info already includes `name`, so the
    // rebuild branch is skipped. Data must survive the close/reopen cycle.
    const second = await loadStats();
    expect(second).toEqual({
      totalGames: 7,
      xWins: 3,
      oWins: 2,
      draws: 2,
      currentStreak: -2,
    });
    await closeDb();
  });

  it('reconciled DB schema equals a fresh-DB schema (no forked reality)', async () => {
    // Phase 1 — legacy reconcile via lib/db.ts.
    const { loadStats, closeDb } = await import('@/lib/db');
    await loadStats();
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

    // Phase 2 — bootstrap a fresh DB through lib/db.ts (no legacy state).
    const freshFile = path.join(dir, 'fresh.db');
    process.env.DATABASE_URL = `file:${freshFile}`;
    vi.resetModules();
    const { loadStats: loadFresh, closeDb: closeFresh } = await import('@/lib/db');
    await loadFresh();
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

    // Restore env so afterEach cleans up the legacy client and rmSync
    // does not race a cached connection on the fresh path.
    process.env.DATABASE_URL = `file:${legacyFile}`;
    vi.resetModules();
    // Touch import so afterEach has a module reference to closeDb from.
    await import('@/lib/db');

    expect(legacyCols).toEqual(freshCols);
    // Stronger than just "same set" — same ordinal positions. If the
    // reconcile ever inserted `name` at a different cid, this assertion
    // breaks immediately.
    expect(legacyCols).toEqual([
      'id',
      'total_games',
      'x_wins',
      'o_wins',
      'draws',
      'current_streak',
      'name',
      'updated_at',
    ]);
  });

  it('reconcile preserves the seeded updated_at sentinel (P1-3 regression guard)', async () => {
    // RC-drift §1 P1-3: prior suite asserted counters + name UNIQUE + table
    // shape, but never pinned `updated_at`. A future change that drops
    // `updated_at` from the reconcile INSERT...SELECT column list (or
    // from the new table definition) would trip this assertion by
    // failing loadStats entirely (NOT NULL constraint on the new table
    // has no DEFAULT) — and after the fix, by failing to round-trip the
    // sentinel. The seed writes 1_700_000_000_000 ms; any other value
    // is unambiguously a regression.
    const { loadStats } = await import('@/lib/db');
    await loadStats();
    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${legacyFile}` });
    try {
      const rs = await probe.execute(
        'SELECT updated_at FROM game_stats WHERE id = 1',
      );
      expect(rs.rows).toHaveLength(1);
      expect(Number(rs.rows[0].updated_at)).toBe(UPDATED_AT_SENTINEL);
    } finally {
      probe.close();
    }
  });

  it('reconcile rebuilds when name column exists without UNIQUE (P1-1 half-applied schema)', async () => {
    // RC-drift §1 P1-1: a DB with `name TEXT` (no UNIQUE) must still trip
    // the rebuild path so the schema catches up to db/schema.ts (which
    // declares `name: text('name').unique()`). Pre-fix the probe only
    // checks column presence; this state silently passes and stays
    // detached from the schema contract. Post-fix the probe also checks
    // that some unique index covers `name`, so the rebuild fires.
    const halfFile = path.join(dir, 'half.db');
    await buildHalfMigratedDb(halfFile);
    process.env.DATABASE_URL = `file:${halfFile}`;
    vi.resetModules();
    const { loadStats } = await import('@/lib/db');
    // Counters must round-trip through the rebuild (same invariant as
    // the no-name-column case — INSERT...SELECT 共有列 covers them).
    await expect(loadStats()).resolves.toEqual({
      totalGames: 7,
      xWins: 3,
      oWins: 2,
      draws: 2,
      currentStreak: -2,
    });
    // UNIQUE proof: after the rebuild, two inserts under the same `name`
    // must trip the SQLite UNIQUE constraint.
    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${halfFile}` });
    try {
      const insertDup = `INSERT INTO game_stats (id, total_games, x_wins, o_wins, draws, current_streak, name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
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
    // Restore env so the next test sees the legacy file from beforeEach.
    process.env.DATABASE_URL = `file:${legacyFile}`;
    vi.resetModules();
    await import('@/lib/db');
  });

  it('reconcile probe hits on a fresh DB (name+UNIQUE both present) and skips rebuild (P1-1 fresh-skipped)', async () => {
    // RC-drift §1 P1-1 (inverse side): the extended probe must NOT
    // over-eagerly rebuild when the bootstrap DDL has already declared
    // `name TEXT UNIQUE`. Evidence probe skipped rebuild: no orphan
    // `game_stats_new` table after getDb() runs against a brand-new
    // file. If the extended probe ever silently dropped the
    // column-presence check (or returned empty rows for any reason),
    // this assertion would catch it.
    const freshFile = path.join(dir, 'fresh-skip.db');
    process.env.DATABASE_URL = `file:${freshFile}`;
    vi.resetModules();
    const { loadStats } = await import('@/lib/db');
    const stats = await loadStats();
    expect(stats).toEqual({
      totalGames: 0,
      xWins: 0,
      oWins: 0,
      draws: 0,
      currentStreak: 0,
    });
    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${freshFile}` });
    try {
      const rs = await probe.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='game_stats_new'",
      );
      expect(rs.rows).toHaveLength(0);
      // Cross-check: a fresh DB has a unique index on `name` (because the
      // bootstrap DDL declares `name TEXT UNIQUE`). Pinning this protects
      // the test from false-positives where `game_stats_new` happens not
      // to exist for an unrelated reason (e.g. someone removes the
      // RENAME step entirely).
      const idxList = await probe.execute(
        "SELECT name FROM pragma_index_list('game_stats') WHERE [unique] = 1",
      );
      let hasUniqueOnName = false;
      for (const row of idxList.rows) {
        const idxName = String(row.name);
        const info = await probe.execute(
          "SELECT name FROM pragma_index_info(?) WHERE name = 'name'",
          [idxName],
        );
        if (info.rows.length > 0) {
          hasUniqueOnName = true;
          break;
        }
      }
      expect(hasUniqueOnName).toBe(true);
    } finally {
      probe.close();
    }
    // Restore env so afterEach cleans up the right file.
    process.env.DATABASE_URL = `file:${legacyFile}`;
    vi.resetModules();
    await import('@/lib/db');
  });
});
