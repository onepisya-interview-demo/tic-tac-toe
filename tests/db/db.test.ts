import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Each test gets an isolated sqlite file under os.tmpdir()/ulw-db-*.
const tmpDbDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'ulw-db-'));

describe('lib/db (server-side SQLite + Drizzle)', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDbDir();
    process.env.DATABASE_URL = `file:${path.join(dir, 'tic-tac-toe.db')}`;
    // Force lib/db to re-evaluate cachedDb against the new env path.
    vi.resetModules();
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import('@/lib/db');
      closeDb();
    } catch {
      /* module may not have loaded */
    }
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.DATABASE_URL;
  });

  it('loadStats creates the row on first read and returns zeros', async () => {
    const { loadStats, closeDb } = await import('@/lib/db');
    try {
      const stats = loadStats();
      expect(stats).toEqual({
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      // DB file materialized.
      expect(fs.existsSync(path.join(dir, 'tic-tac-toe.db'))).toBe(true);
    } finally {
      closeDb();
    }
  });

  it('saveStats then loadStats round-trips through sqlite', async () => {
    const { loadStats, saveStats, closeDb } = await import('@/lib/db');
    try {
      loadStats();
      saveStats({
        totalGames: 7,
        xWins: 3,
        oWins: 2,
        draws: 2,
        currentStreak: -2,
      });
      const loaded = loadStats();
      expect(loaded).toEqual({
        totalGames: 7,
        xWins: 3,
        oWins: 2,
        draws: 2,
        currentStreak: -2,
      });
    } finally {
      closeDb();
    }
  });

  it('resetStats returns zero and clears prior values', async () => {
    const { loadStats, saveStats, resetStats, closeDb } = await import('@/lib/db');
    try {
      loadStats();
      saveStats({
        totalGames: 5,
        xWins: 4,
        oWins: 1,
        draws: 0,
        currentStreak: 4,
      });
      const zero = resetStats();
      expect(zero).toEqual({
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      });
      const after = loadStats();
      expect(after).toEqual(zero);
    } finally {
      closeDb();
    }
  });

  it('getDb returns the same cached instance on repeated calls', async () => {
    const { getDb, closeDb } = await import('@/lib/db');
    try {
      const a = getDb();
      const b = getDb();
      expect(a).toBe(b);
    } finally {
      closeDb();
    }
  });

  it('closeDb drops the cached handle so the next getDb opens fresh', async () => {
    const { getDb, closeDb } = await import('@/lib/db');
    const a = getDb();
    closeDb();
    const b = getDb();
    expect(a).not.toBe(b);
    closeDb();
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

  it('creates the SQLite schema with stable physical columns', async () => {
    const { loadStats, getDb, closeDb } = await import('@/lib/db');
    const Database = (await import('better-sqlite3')).default;
    try {
      loadStats();
      const raw = new Database(path.join(dir, 'tic-tac-toe.db'), { readonly: true });
      const columns = raw.prepare('PRAGMA table_info(game_stats)').all() as Array<{
        name: string;
        type: string;
        pk: number;
      }>;
      expect(columns.map((column) => column.name)).toEqual([
        'id',
        'total_games',
        'x_wins',
        'o_wins',
        'draws',
        'current_streak',
        'updated_at',
      ]);
      expect(columns.every((column) => column.type === 'INTEGER')).toBe(true);
      expect(columns.find((column) => column.name === 'id')?.pk).toBe(1);
      expect(getDb()).toBeDefined();
      raw.close();
    } finally {
      closeDb();
    }
  });
});
