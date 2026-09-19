import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Per-room stats table (W1 ulw-room-migration-home-landing).
 *
 * One row per room name; the row is the device's ledger for that room
 * — both modes (online / offline) are pass-and-play on the same
 * device, so the row identifier has always been "this device's ledger
 * tag" rather than "this player in this match". Plan §0.1-4 documents
 * the rename rationale; §1 maps the old `name` identifier to `room`.
 *
 * `room TEXT UNIQUE` makes the row the room's identity on the wire:
 * there is exactly one row per non-null room name, so renaming is
 * structurally impossible (no rename endpoint + UNIQUE doubles the
 * guard).
 *
 * Per-room row lifecycle:
 *  - Registration: insert emptyStats() under a previously-unseen room
 *    (lib/db.ts:registerOrLoginRoom).
 *  - Login: read the row that already exists.
 *  - Online outcome: loadRecordByRoom → recordOutcome → upsertRecordByRoom
 *    (lib/db.ts:recordOutcomeForRoom). Server-side authoritative.
 *  - Cross-device merge: loadRecordByRoom → accumulateMergeStats →
 *    upsertRecordByRoom (lib/db.ts:mergeRecordByRoom). User-confirmed only.
 *
 * Data retention: W1 ships an empty-room cleanup reconcile branch in
 * getDb() — any legacy DB (pre-W1 `name` column, retired `solo_records`
 * table, half-migrated column-without-UNIQUE states) is dropped and
 * rebuilt under the current shape on first connect. See
 * tests/db/db.test.ts: D1-D4 pin the contract.
 */
export const gameStats = sqliteTable('game_stats', {
  id: integer('id').primaryKey(),
  totalGames: integer('total_games').notNull().default(0),
  xWins: integer('x_wins').notNull().default(0),
  oWins: integer('o_wins').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  room: text('room').unique(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
