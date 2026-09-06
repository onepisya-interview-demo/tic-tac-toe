import { sqliteTable, integer } from 'drizzle-orm/sqlite-core';

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

export type GameStatsRow = typeof gameStats.$inferSelect;
export type NewGameStatsRow = typeof gameStats.$inferInsert;
