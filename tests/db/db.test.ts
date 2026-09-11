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
      expect(cols).toEqual([
        'id',
        'total_games',
        'x_wins',
        'o_wins',
        'draws',
        'current_streak',
        'updated_at',
      ]);
      const types = rs.rows.map((row) => String(row.type));
      expect(types.every((t) => t === 'INTEGER')).toBe(true);
      expect(Number(rs.rows.find((row) => row.name === 'id')?.pk)).toBe(1);
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
});
