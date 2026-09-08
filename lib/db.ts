import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from '../db/schema';
import { gameStats } from '../db/schema';
import { emptyStats, type GameStats } from './game';

const STATS_ROW_ID = 1;

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'tic-tac-toe.db');

let cachedDb: BetterSQLite3Database<typeof schema> | null = null;
let cachedSqlite: Database.Database | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (cachedDb) return cachedDb;
  const url = process.env.DATABASE_URL;
  const dbPath = !url
    ? DEFAULT_DB_PATH
    : url.startsWith('file:')
      ? url.slice('file:'.length)
      : url;
  {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  cachedSqlite = new Database(dbPath);
  cachedSqlite.pragma('journal_mode = WAL');
  // Bootstrap table — keeps the app runnable without a manual `db:push`.
  cachedSqlite.exec(`
    CREATE TABLE IF NOT EXISTS game_stats (
      id INTEGER PRIMARY KEY,
      total_games INTEGER NOT NULL DEFAULT 0,
      x_wins INTEGER NOT NULL DEFAULT 0,
      o_wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `);
  cachedDb = drizzle(cachedSqlite, { schema });
  return cachedDb;
}

/** Read stats; creates the row if absent. Returns zero-stats on first read. */
export function loadStats(): GameStats {
  const db = getDb();
  const existing = db.select().from(gameStats).where(eq(gameStats.id, STATS_ROW_ID)).get();
  if (existing) {
    return {
      totalGames: existing.totalGames,
      xWins: existing.xWins,
      oWins: existing.oWins,
      draws: existing.draws,
      currentStreak: existing.currentStreak,
    };
  }
  const now = new Date();
  db.insert(gameStats).values({ id: STATS_ROW_ID, updatedAt: now }).run();
  return emptyStats();
}

/** Write stats (overwrite fields, bump updated_at). */
export function saveStats(stats: GameStats): void {
  const db = getDb();
  const now = new Date();
  db.insert(gameStats)
    .values({
      id: STATS_ROW_ID,
      totalGames: stats.totalGames,
      xWins: stats.xWins,
      oWins: stats.oWins,
      draws: stats.draws,
      currentStreak: stats.currentStreak,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: gameStats.id,
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

/** Reset stats to zero. */
export function resetStats(): GameStats {
  const zero = emptyStats();
  saveStats(zero);
  return zero;
}

/** Close the underlying sqlite handle (used by tests / shutdown). */
export function closeDb(): void {
  if (cachedSqlite) {
    cachedSqlite.close();
    cachedSqlite = null;
    cachedDb = null;
  }
}
