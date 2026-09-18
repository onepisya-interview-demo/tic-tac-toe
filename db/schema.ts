import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Single-row stats table.
 *
 * `id = 1` is the canonical ranked (shared, two-player pass-and-play) row
 * — `name` stays NULL so the loadStats / saveStats / recordAndSave surface
 * in lib/db.ts keeps its existing semantics and its existing id contract.
 *
 * Per-player solo rows live in the same table under their own auto-
 * assigned `id`, identified by a non-null `name`. `name TEXT UNIQUE`
 * makes the row the player’s identity on the wire: registration is the
 * act of inserting a fresh emptyStats() row under a previously-unseen
 * name, login is reading the row that already exists. SQLite allows
 * multiple NULLs under UNIQUE, so the ranked shared row (name=NULL) and
 * the per-player rows (name='alice' etc.) coexist without constraint
 * conflicts.
 */
export const gameStats = sqliteTable('game_stats', {
  id: integer('id').primaryKey(),
  totalGames: integer('total_games').notNull().default(0),
  xWins: integer('x_wins').notNull().default(0),
  oWins: integer('o_wins').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  name: text('name').unique(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
