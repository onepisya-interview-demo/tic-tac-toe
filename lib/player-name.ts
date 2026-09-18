// Player-name persistence on top of browser localStorage.
// Modeled after lib/solo-stats.ts (browser-persisted preference in its
// own module): kept out of store.ts so the store engine stays about game
// lifecycle + API sync, and so consumers that only need the persisted
// baseline (e.g. SoloStatsPanel name resolution) don't have to import
// the whole store. All reads/writes are guarded and fail soft — private
// browsing mode and quota errors degrade to "no name set" instead of
// throwing mid-render.
//
// The whitelist below MUST mirror the server-side validator in
// app/api/solo-stats/route.ts (trim → 1–24 chars → no control chars) so
// a POST the API would accept can also be saved, and a save the API
// would reject can never be POSTed. Drift between the two breaks the
// "save a name, play, see the same row on another device" loop.

import { emptyStats, type GameStats } from './game';

/** localStorage key for the player's chosen name. Versioned for future shape changes. */
export const PLAYER_NAME_KEY = 'ttt.player.name.v1';

/** Same constants as the API route's normalizeName(). */
const NAME_MAX = 24;
const NAME_MIN = 1;

/**
 * Whitelist check. Mirrors the server-side validator in
 * app/api/solo-stats/route.ts. Returns true iff `value` (after trim)
 * has length in [NAME_MIN, NAME_MAX] and contains no character below
 * U+0020 / equal to U+007F (DEL) / in the C1 control range.
 */
export function isPlayerName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) return false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20) return false;
    if (code === 0x7f) return false;
    if (code >= 0x80 && code <= 0x9f) return false;
  }
  return true;
}


/**
 * Single source of truth for server-side name normalization
 * (W2 ulw-one-game-two-versions). Trims `raw` if and only if it
 * passes `isPlayerName`; returns null otherwise. All four route
 * handlers under app/api/ import this so the whitelist cannot
 * drift between endpoints — the prior W3 setup duplicated the
 * rule inside `app/api/solo-stats/route.ts` and `app/api/solo-stats/sync/route.ts`,
 * which AGENTS.md §本项目反模式 already flagged as the single
 * drift point to remove.
 *
 * Returns the trimmed canonical PK value (the same shape `isPlayerName`
 * validates), so callers can pass the result straight into a service
 * function without re-trimming.
 */
export function normalizePlayerName(raw: unknown): string | null {
  if (!isPlayerName(raw)) return null;
  return (raw as string).trim();
}
/**
 * Read the persisted player name. SSR-safe (no window → null) and
 * corruption-safe: missing key, non-string value, or a value whose
 * shape doesn't match the whitelist all degrade to null so the caller
 * can branch on "fresh user" without sentinel gymnastics.
 */
export function getPlayerName(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PLAYER_NAME_KEY);
    if (raw === null) return null;
    return isPlayerName(raw) ? raw.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Persist the player's name. Returns true iff the write landed and the
 * value passed the whitelist; false on whitelist rejection OR on quota
 * / privacy-mode failure. Callers (PlayerNameForm) use the boolean to
 * show a success or a silent no-op (the form does not surface errors —
 * the API whitelist is the authoritative gate and will 422 anyway).
 */
export function setPlayerName(name: string): boolean {
  if (!isPlayerName(name)) return false;
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(PLAYER_NAME_KEY, name.trim());
    return true;
  } catch {
    return false;
  }
}

/** Remove the persisted name. Failure is swallowed for symmetry with setPlayerName. */
export function clearPlayerName(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PLAYER_NAME_KEY);
  } catch {
    // Nothing to recover — the key may simply not exist.
  }
}

/**
 * Sole shape known to lib/store.ts and lib/solo-stats.ts. Re-exported
 * here so consumers of player-name don't have to reach into game.ts
 * when they want to type a panel state.
 */
export type { GameStats };
export { emptyStats };
