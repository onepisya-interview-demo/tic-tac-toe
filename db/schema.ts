import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Per-player stats table (W1 ulw-one-game-two-versions).
 *
 * The ranked public ledger (id=1, name=NULL) is retired along with the
 * /api/stats chain. `id` stays as INTEGER PRIMARY KEY (auto-incremented
 * for new per-player rows); `name TEXT UNIQUE` is the canonical
 * identity of a player row. SQLite allows multiple NULLs under UNIQUE,
 * so legacy online shared rows (id=1, name=NULL) are migrated out by
 * getDb()'s reconcile branch in lib/db.ts (W1 retired the ranked
 * surface entirely).
 *
 * Per-player row lifecycle:
 *  - Registration: insert emptyStats() under a previously-unseen name
 *    (lib/db.ts:registerOrLoginName).
 *  - Login: read the row that already exists.
 *  - Online outcome: loadRecordByName → recordOutcome → upsertRecordByName
 *    (lib/db.ts:recordOutcomeForName). Server-side authoritative.
 *  - Cross-device merge: loadRecordByName → accumulateMergeStats →
 *    upsertRecordByName (lib/db.ts:mergeRecordByName). User-confirmed only.
 *
 * `name TEXT UNIQUE` makes the row the player's identity on the wire:
 * there is exactly one row per non-null name, so renaming is
 * structurally impossible (no rename endpoint + UNIQUE doubles the
 * guard).
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
