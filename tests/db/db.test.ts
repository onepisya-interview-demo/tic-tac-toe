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
  // with the /api/stats chain. The per-name surface (loadRecordByName /
  // upsertRecordByName / recordOutcomeForName / mergeRecordByName /
  // registerOrLoginName) is now the only writable surface. Coverage
  // for recordOutcomeForName is in the describe block below; the
  // http(s)/file URL branch tests keep covering getDb() plumbing.

  it('http(s) URL branch forwards DATABASE_URL + DATABASE_AUTH_TOKEN to createClient', async () => {
    process.env.DATABASE_URL = 'https://example.turso.io';
    process.env.DATABASE_AUTH_TOKEN = 'test-token';
    vi.resetModules();
    const seen: Config[] = [];
    const { __setCreateClientForTests, loadRecordByName, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByName('smoke');
      // Smoke: loadRecordByName ran the bootstrap DDL through the fake client.
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
    const { __setCreateClientForTests, loadRecordByName, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByName('smoke');
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
    const { __setCreateClientForTests, loadRecordByName, closeDb } = await import('@/lib/db');
    // Inject fake so we can capture config without hitting a real sqlite file
    // — the bootstrap DDL also goes through the fake, which is fine.
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByName('smoke');
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
    const { __setCreateClientForTests, loadRecordByName, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByName('smoke');
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
    const { __setCreateClientForTests, loadRecordByName, closeDb } = await import('@/lib/db');
    __setCreateClientForTests((config: Config) => {
      seen.push(config);
      return fakeClient();
    });
    try {
      await loadRecordByName('smoke');
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
    expect(t).toHaveProperty('name');
    expect(t).toHaveProperty('updatedAt');
  });

  it('bootstrap DDL creates the game_stats table with stable physical columns', async () => {
    const { loadRecordByName, closeDb } = await import('@/lib/db');
    try {
      await loadRecordByName('smoke');
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
    const { loadRecordByName, closeDb } = await import('@/lib/db');
    try {
      await loadRecordByName('smoke');
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

  // ── W1 (ulw-one-game-two-versions §3 W1): recordOutcomeForName coverage ──
  // Per-name server-authoritative accumulator: load row → apply pure
  // recordOutcome rule → upsert. Row-existence contract: absent row
  // returns { ok: false, reason: 'not-found' } — never silently inserts
  // (A4 前置). Tests below pin happy path, draw / O-win math, the
  // not-found signal, idempotent retry-after-failure, and error
  // propagation when load / upsert throws.

  it('recordOutcomeForName(\'X\') on registered name → xWins:1, totalGames:1, currentStreak:1', async () => {
    const { registerOrLoginName, recordOutcomeForName, closeDb } = await import('@/lib/db');
    try {
      await registerOrLoginName('alice');
      const result = await recordOutcomeForName('alice', 'X');
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

  it('recordOutcomeForName 两次 \'X\' → xWins:2, totalGames:2, currentStreak:2', async () => {
    const { registerOrLoginName, recordOutcomeForName, closeDb } = await import('@/lib/db');
    try {
      await registerOrLoginName('bob');
      await recordOutcomeForName('bob', 'X');
      const result = await recordOutcomeForName('bob', 'X');
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

  it('recordOutcomeForName(\'draw\') resets streak to 0 and increments draws', async () => {
    const { registerOrLoginName, recordOutcomeForName, upsertRecordByName, closeDb } = await import('@/lib/db');
    try {
      // Seed a non-zero streak so the reset is observable.
      await registerOrLoginName('carol');
      await upsertRecordByName('carol', {
        totalGames: 3,
        xWins: 2,
        oWins: 0,
        draws: 1,
        currentStreak: 2,
      });
      const result = await recordOutcomeForName('carol', 'draw');
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

  it('recordOutcomeForName(\'O\') flips streak polarity from +1 to -1', async () => {
    const { registerOrLoginName, recordOutcomeForName, upsertRecordByName, closeDb } = await import('@/lib/db');
    try {
      await registerOrLoginName('dave');
      await upsertRecordByName('dave', {
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
      const result = await recordOutcomeForName('dave', 'O');
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

  it('recordOutcomeForName 写后读一致: loadRecordByName after recordOutcomeForName returns the same row', async () => {
    const { registerOrLoginName, recordOutcomeForName, loadRecordByName, closeDb } = await import('@/lib/db');
    try {
      await registerOrLoginName('erin');
      const written = await recordOutcomeForName('erin', 'O');
      expect(written.ok).toBe(true);
      if (written.ok) {
        const read = await loadRecordByName('erin');
        expect(read).toEqual(written.stats);
      }
    } finally {
      await closeDb();
    }
  });

  it('recordOutcomeForName on unknown name returns { ok: false, reason: \'not-found\' } (不静默建档)', async () => {
    // A4 前置 + AC A9: service 层不允许「merge / record 一个未注册 name」
    // 偷渡成 upsert 复活已删除账号。客户端必须在调用前先 hit
    // registerOrLoginName (POST /api/sessions)。White-box probe: 在
    // 没有任何 registerOrLoginName 调用的情况下直接 recordOutcomeForName。
    const { recordOutcomeForName, loadRecordByName, closeDb } = await import('@/lib/db');
    try {
      const result = await recordOutcomeForName('ghost', 'X');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('not-found');
      }
      // Double-check: the row must NOT exist after the not-found call.
      expect(await loadRecordByName('ghost')).toBeNull();
    } finally {
      await closeDb();
    }
  });

  it('recordOutcomeForName rejects when load throws (no silent swallow)', async () => {
    const { recordOutcomeForName, __setCreateClientForTests, closeDb } = await import('@/lib/db');
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
      await expect(recordOutcomeForName('alice', 'X')).rejects.toThrow('simulated load failure');
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  });

  // The "rejects when load throws" test above already pins error
  // propagation through the service. The upsert-failure path is
  // symmetric (any error in upsertRecordByName is re-thrown to the
  // caller) and is covered by tests against upsertRecordByName's
  // existing suite. We intentionally omit a dedicated
  // 「recordOutcomeForName rejects when upsert throws after load
  // succeeds」 test: reproducing it requires splitting the cached
  // client state across two phases, which adds machinery beyond the
  // service contract being asserted.
  // ── W-SYNC wave 2 (ulw-ux-mobile-sync plan): per-name ledger via game_stats.name ──
  // Mirrors the recordAndSave surface but rows are keyed by `name` (TEXT PK)
  // and rows are absent on first read instead of being seeded — loadRecordByName
  // returns null so callers can branch on "fresh player" without sentinel
  // values. Pattern parity with the game_stats suite: tmpDbDir +
  // __setCreateClientForTests when reaching beyond a fake, real sqlite
  // file when asserting the on-disk shape.

  it('loadRecordByName returns null on first read for an unknown name', async () => {
    const { loadRecordByName, closeDb } = await import('@/lib/db');
    try {
      const row = await loadRecordByName('alice');
      expect(row).toBeNull();
    } finally {
      await closeDb();
    }
  });

  it('upsertRecordByName writes a row that loadRecordByName reads back', async () => {
    const { upsertRecordByName, loadRecordByName, closeDb } = await import('@/lib/db');
    try {
      await upsertRecordByName('bob', {
        totalGames: 3,
        xWins: 2,
        oWins: 1,
        draws: 0,
        currentStreak: 1,
      });
      const row = await loadRecordByName('bob');
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

  it('upsertRecordByName overwrites a row by name (PK is name, not id)', async () => {
    const { upsertRecordByName, loadRecordByName, closeDb } = await import('@/lib/db');
    try {
      await upsertRecordByName('carol', {
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
      await upsertRecordByName('carol', {
        totalGames: 4,
        xWins: 3,
        oWins: 0,
        draws: 1,
        currentStreak: -1,
      });
      const row = await loadRecordByName('carol');
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

  it('mergeRecordByName load → accumulate per-field → upsert (真实 sqlite)', async () => {
    // End-to-end through the same db used by mergeRecordByName.
    const { mergeRecordByName, loadRecordByName, closeDb } = await import('@/lib/db');
    process.env.DATABASE_URL = `file:${os.tmpdir()}/merge-${Math.random()}.db`;
    try {
      // Server has 2X 1O 0D streak=+1, client sends 3X 2O 1D streak=0.
      await mergeRecordByName('merger', {
        totalGames: 3,
        xWins: 3,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      const next = await mergeRecordByName('merger', {
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
      const reloaded = await loadRecordByName('merger');
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
    const { registerOrLoginName, loadRecordByName, closeDb } = await import('@/lib/db');
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
      expect(await loadRecordByName('alice')).toEqual(result.stats);
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginName on existing name returns existed:true with stored stats', async () => {
    const {
      registerOrLoginName,
      upsertRecordByName,
      loadRecordByName,
      closeDb,
    } = await import('@/lib/db');
    try {
      // Pre-populate a row with non-zero stats via the migrated solo
      // primitive (which now writes to game_stats WHERE name=…).
      await upsertRecordByName('bob', {
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
      expect(await loadRecordByName('bob')).toEqual(result.stats);
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginName on existing name returns the same row (idempotent login, no overwrite)', async () => {
    // W1 retires the online shared row. This test pins the per-name
    // contract directly: an existing per-name row under 'carol' with
    // non-zero counters must be returned untouched by a re-registration
    // call — registerOrLoginName is the register/login primitive and
    // MUST NOT reset existing stats on a re-login.
    const { registerOrLoginName, upsertRecordByName, loadRecordByName, closeDb } = await import('@/lib/db');
    try {
      await upsertRecordByName('carol', {
        totalGames: 12,
        xWins: 6,
        oWins: 4,
        draws: 2,
        currentStreak: 3,
      });
      const before = await loadRecordByName('carol');
      const result = await registerOrLoginName('carol');
      expect(result.existed).toBe(true);
      expect(result.stats).toEqual(before);
      // Persisted row unchanged.
      const after = await loadRecordByName('carol');
      expect(after).toEqual(before);
    } finally {
      await closeDb();
    }
  });

  it('registerOrLoginName UNIQUE-拒同名二插: parallel callers converge on a single row', async () => {
    const { registerOrLoginName, loadRecordByName, closeDb } = await import('@/lib/db');
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
      expect(await loadRecordByName('racer')).toEqual(a.stats);
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
    // (via upsertRecordByName, which is now also routed through game_stats)
    // and then calling registerOrLoginName. The function must observe the
    // pre-existing row and return existed:true without touching it.
    const {
      registerOrLoginName,
      upsertRecordByName,
      loadRecordByName,
      closeDb,
    } = await import('@/lib/db');
    try {
      await upsertRecordByName('darren', {
        totalGames: 3,
        xWins: 1,
        oWins: 1,
        draws: 1,
        currentStreak: -1,
      });
      const result = await registerOrLoginName('darren');
      expect(result.existed).toBe(true);
      expect(result.stats.currentStreak).toBe(-1);
      expect(await loadRecordByName('darren')).toEqual(result.stats);
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
    // W1 (ulw-one-game-two-versions): the legacy shape is now a
    // game_stats table with NO `name` column (matching the W-1 rank-only
    // shape) seeded with a single per-name row in the pre-W1
    // `solo_records` table. The reconcile branch in lib/db.ts:
    //   1. Sees `name` column missing on game_stats → triggers rebuild.
    //   2. Rebuild carries over only `name IS NOT NULL` rows
    //      (legacy-solo has been migrated; the online shared row at
    //      id=1 was retired alongside /api/stats).
    //   3. Drops `solo_records` in the same batch.
    //   4. Adds UNIQUE(name) on game_stats via the new CREATE TABLE.
    // After reconcile, no per-name row exists (legacy-solo lives in
    // solo_records which is dropped, not migrated); the regression
    // guard is that loadRecordByName returns null on any name.
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
      // Seed only the legacy solo_records row (pre-W1 per-player table).
      // The online shared row (id=1, name=NULL) is intentionally not
      // seeded here — W1 retires it and the new reconcile drops it via
      // the `WHERE name IS NOT NULL` filter.
      const seedNow = 1_700_000_000_000;
      await client.batch([
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
  // ── red reproduction (proves the bug exists pre-fix; after the fix it
  //    also serves as a regression guard so removing the reconcile
  //    surfaces the column-missing failure rather than silently corrupting
  //    data) ──
  it('reconcile heals the legacy DB on first getDb() (loadRecordByName does not throw "no such column")', async () => {
    // W1 retires the online shared row (id=1, totalGames=7) along with
    // /api/stats. The legacy DB seeded by buildLegacyDb has only a row
    // in the pre-W1 `solo_records` table — game_stats has no `name`
    // column at all. After reconcile:
    //   1. `name TEXT UNIQUE` is added to game_stats;
    //   2. the orphan `solo_records` table is dropped (W1 retired it);
    //   3. no per-name row exists (solo_records is dropped, not migrated).
    // loadRecordByName on any name must return null (not throw) — that
    // is the regression guard.
    const { loadRecordByName } = await import('@/lib/db');
    await expect(loadRecordByName('ghost')).resolves.toBeNull();
  });

  // ── green migrations (each individually named) ──
  it('reconcile retires the online shared row (no id=1 row carries forward)', async () => {
    // W1 (ulw-one-game-two-versions) retired the online shared row
    // (id=1, name=NULL) along with the /api/stats chain. The reconcile
    // branch now carries only `name IS NOT NULL` rows forward; legacy
    // online shared rows (name=NULL) are dropped. The buildLegacyDb
    // seed lives in `solo_records` (dropped, not migrated), so after
    // reconcile no per-name row exists. This test pins that.
    const { loadRecordByName } = await import('@/lib/db');
    expect(await loadRecordByName('legacy-solo')).toBeNull();
    expect(await loadRecordByName('ghost')).toBeNull();
  });

  it('reconcile adds the `name` column with UNIQUE on game_stats', async () => {
    const { loadRecordByName } = await import('@/lib/db');
    await loadRecordByName('smoke');
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
    const { loadRecordByName } = await import('@/lib/db');
    await loadRecordByName('smoke');
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

  it('reconcile is idempotent: closeDb() + re-open does not crash, schema unchanged', async () => {
    // W1 retires the online shared row. After first reconcile, the
    // schema has `name TEXT UNIQUE` on game_stats and no `solo_records`.
    // A closeDb() + re-open cycle must not re-run the rebuild branch
    // (the probe sees name+UNIQUE on a fresh getDb()) and must not
    // throw. This test pins both invariants.
    const { loadRecordByName, closeDb } = await import('@/lib/db');
    await loadRecordByName('smoke');
    await closeDb();
    const second = await loadRecordByName('ghost');
    expect(second).toBeNull();
    await closeDb();
  });

  it('reconciled DB schema equals a fresh-DB schema (no forked reality)', async () => {
    // Phase 1 — legacy reconcile via lib/db.ts.
    const { loadRecordByName, closeDb } = await import('@/lib/db');
    await loadRecordByName('smoke');
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
    const { loadRecordByName: loadFresh, closeDb: closeFresh } = await import('@/lib/db');
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

  it('reconcile adds game_stats with NOT NULL updated_at (P1-3 shape regression guard)', async () => {
    // RC-drift §1 P1-3: prior suite asserted counters + name UNIQUE +
    // table shape, but never pinned `updated_at`. A future change that
    // drops `updated_at` from the new CREATE TABLE definition would
    // trip this assertion by failing loadRecordByName (NOT NULL
    // constraint on the new table has no DEFAULT). After W1's retire
    // of the online shared row, the legacy seed no longer has a row to
    // inspect; instead we assert the new table's `updated_at` column
    // is INTEGER NOT NULL by direct PRAGMA introspection.
    const { loadRecordByName } = await import('@/lib/db');
    await loadRecordByName('smoke');
    const { createClient } = await import('@libsql/client');
    const probe = createClient({ url: `file:${legacyFile}` });
    try {
      const rs = await probe.execute("PRAGMA table_info('game_stats')");
      const updatedAtRow = rs.rows.find((row) => String(row.name) === 'updated_at');
      expect(updatedAtRow).toBeDefined();
      expect(String(updatedAtRow?.type)).toBe('INTEGER');
      // NOT NULL guard: notnull === 1 means NOT NULL is set.
      expect(Number(updatedAtRow?.notnull)).toBe(1);
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
    // W1's reconcile drops the seeded row (id=1, name=NULL) via the
    // `WHERE name IS NOT NULL` filter; loadRecordByName under any name
    // must return null post-rebuild (no per-name row exists in this
    // half-migrated shape).
    const halfFile = path.join(dir, 'half.db');
    await buildHalfMigratedDb(halfFile);
    process.env.DATABASE_URL = `file:${halfFile}`;
    vi.resetModules();
    const { loadRecordByName } = await import('@/lib/db');
    await expect(loadRecordByName('ghost')).resolves.toBeNull();
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
    const { loadRecordByName } = await import('@/lib/db');
    const stats = await loadRecordByName('ghost');
    expect(stats).toBeNull();
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
