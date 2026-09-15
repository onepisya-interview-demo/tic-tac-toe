import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Single-row stats table (id = 1).
 * Created on first read; updated on each finished game.
 */
export const gameStats = sqliteTable('game_stats', {
  id: integer('id').primaryKey(),
  totalGames: integer('total_games').notNull().default(0),
  xWins: integer('x_wins').notNull().default(0),
  oWins: integer('o_wins').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Per-player solo-mode stats ledger (ulw-ux-mobile-sync 波 2 W-SYNC).
 *
 * One row per `name` (TEXT PRIMARY KEY); same five-number GameStats shape
 * as game_stats so `recordOutcome` (lib/game.ts) can be reused unchanged.
 * Server-authoritative accumulation mirrors `recordAndSave`:
 *   loadSoloRecord(name) → recordOutcome(prev, outcome) → upsertSoloRecord(name, next)
 * Concurrent writes on the same name are last-write-wins at the row level
 * (intentional simplicity — the README and DESIGN.md document the model
 * boundary so "为什么不同步删除" doesn't surprise the reader).
 */
export const soloRecords = sqliteTable('solo_records', {
  name: text('name').primaryKey(),
  totalGames: integer('total_games').notNull().default(0),
  xWins: integer('x_wins').notNull().default(0),
  oWins: integer('o_wins').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
