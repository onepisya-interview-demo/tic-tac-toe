import * as nativeClient from '@libsql/client';
import { type Client, type Config } from '@libsql/client';
import * as webClient from '@libsql/client/web';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from '../db/schema';
import { gameStats } from '../db/schema';
import { emptyStats, type GameStats } from './game';

const STATS_ROW_ID = 1;

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'tic-tac-toe.db');

type CreateClientFn = (config: Config) => Client;

/**
 * Pick the @libsql client module to use for the given DATABASE_URL.
 * - `file:` URLs go to the native client (in-process sqlite, needs node runtime).
 * - Anything else (http://, https://, libsql://) goes to /web (HTTP transport,
 *   edge/serverless friendly, smaller serverless bundle).
 * Exported for tests; production callers should not need it.
 */
export function selectDriver(url: string): { createClient: (config: Config) => Client } {
  if (url.startsWith('file:')) return nativeClient;
  return webClient;
}

/** Default factory: pick the driver that matches the URL, then create the client. */
const defaultCreateClient: CreateClientFn = (config) =>
  selectDriver(config.url).createClient(config);

// Test seam — replaced by tests to capture config without hitting a real DB.
let createClientFn: CreateClientFn = defaultCreateClient;

/**
 * Swap the factory used by `getDb`. Pass `null` to restore the default
 * `selectDriver`-based createClient. Test-only — production code must not call.
 */
export function __setCreateClientForTests(fn: CreateClientFn | null): void {
  createClientFn = fn ?? defaultCreateClient;
}

let cachedDb: LibSQLDatabase<typeof schema> | null = null;
let cachedClient: Client | null = null;

/**
 * Resolve DATABASE_URL + DATABASE_AUTH_TOKEN into an @libsql/client Config.
 *
 * - http(s)://... or libsql://...  →  remote Turso client (passes authToken when set)
 * - file:./path/to.db              →  local sqlite file (auto-creates the parent dir)
 * - undefined                      →  file:./data/tic-tac-toe.db under CWD
 *
 * Anything else falls through to the URL as-is so the underlying client can
 * surface its own protocol error.
 */
function resolveDbConfig(): Config {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  if (!url) {
    const dir = path.dirname(DEFAULT_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return { url: `file:${DEFAULT_DB_PATH}` };
  }

  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('libsql:')
  ) {
    return authToken ? { url, authToken } : { url };
  }

  if (url.startsWith('file:')) {
    const filePath = url.slice('file:'.length);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return { url };
  }

  // Unrecognized scheme — pass through. @libsql/client will error with a
  // clear protocol message rather than us silently coercing to a file path.
  return authToken ? { url, authToken } : { url };
}

/**
 * Open the libsql client, bootstrap the game_stats table, and return a
 * Drizzle wrapper. Cached per process; pair every successful `getDb()`
 * with a `closeDb()` in tests.
 */
export async function getDb(): Promise<LibSQLDatabase<typeof schema>> {
  if (cachedDb) return cachedDb;
  const config = resolveDbConfig();
  cachedClient = createClientFn(config);
  // Bootstrap table — keeps the app runnable without a manual `db:push`.
  // DDL via the raw client ensures the schema exists before drizzle hits it.
  await cachedClient.execute(`
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
  cachedDb = drizzle(cachedClient, { schema });
  return cachedDb;
}

/** Read stats; creates the row if absent. Returns zero-stats on first read. */
export async function loadStats(): Promise<GameStats> {
  const db = await getDb();
  const existing = await db
    .select()
    .from(gameStats)
    .where(eq(gameStats.id, STATS_ROW_ID))
    .get();
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
  await db
    .insert(gameStats)
    .values({ id: STATS_ROW_ID, updatedAt: now })
    .run();
  return emptyStats();
}

/** Write stats (overwrite fields, bump updated_at). */
export async function saveStats(stats: GameStats): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db
    .insert(gameStats)
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
export async function resetStats(): Promise<GameStats> {
  const zero = emptyStats();
  await saveStats(zero);
  return zero;
}

/** Close the cached client (used by tests / shutdown). */
export async function closeDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}
