// Room-name whitelist + browser-side localStorage helpers
// (W2 ulw-room-migration-home-landing, plan §2.5).
//
// `room` is the new name for what used to be `player` in this codebase:
// both modes (online / offline) are pass-and-play on the same device, so
// the row identifier has always been "this device's ledger tag" — "room"
// names that idea accurately. See plan §0.1-4 for the concept rename
// rationale and §1 for the symbol map.
//
// This module ships the W1 pure whitelist (`normalizeRoom` / `isRoomName`)
// + W2 storage helpers (`getRoomName` / `setRoomName` / `clearRoomName`)
// + a one-shot legacy-key cleanup helper. All reads/writes are guarded
// and fail soft — private browsing mode and quota errors degrade to
// "no name set" instead of throwing mid-render.

import { emptyStats, type GameStats } from './game';

/** localStorage key for the chosen room name. Versioned for future shape changes. */
export const ROOM_NAME_KEY = 'ttt.room.name.v1';

/**
 * Legacy key from the pre-room-migration era. W2 (D-4 permit) does
 * NOT migrate values from this key — the hydrate path sees it and
 * removes it. The constant lives here so tests can assert cleanup
 * without hard-coding the string.
 */
export const LEGACY_PLAYER_NAME_KEY = 'ttt.player.name.v1';

/** Same constants as the API route's whitelist. */
const NAME_MAX = 24;
const NAME_MIN = 1;

/**
 * Whitelist check. Mirrors the validator the four room routes use.
 * Returns true iff `value` (after trim) has length in [NAME_MIN, NAME_MAX]
 * and contains no character below U+0020 / equal to U+007F (DEL) / in the
 * C1 control range.
 */
export function isRoomName(value: unknown): value is string {
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
 * Single source of truth for server-side room-name normalization.
 * Trims `raw` if and only if it passes `isRoomName`; returns null
 * otherwise. All four route handlers under app/api/rooms/ import this
 * so the whitelist cannot drift between endpoints. Returns the trimmed
 * canonical PK value (the same shape `isRoomName` validates), so
 * callers can pass the result straight into a service function without
 * re-trimming.
 */
export function normalizeRoom(raw: unknown): string | null {
  if (!isRoomName(raw)) return null;
  return (raw as string).trim();
}

/**
 * Read the persisted room name. SSR-safe (no window → null) and
 * corruption-safe: missing key, non-string value, or a value whose
 * shape doesn't match the whitelist all degrade to null so the caller
 * can branch on "fresh user" without sentinel gymnastics.
 *
 * D-4 (ulw-room-migration-home-landing §0.2 + §2.5): on read, the
 * legacy `ttt.player.name.v1` key (one-shot) is removed when present.
 * The function never migrates its value — D-4 permits clearing. New
 * callers see only the new key.
 */
export function getRoomName(): string | null {
  if (typeof window === 'undefined') return null;
  // Always run the legacy sweep so a stale legacy key does not stick
  // around across reads.
  cleanupLegacyPlayerNameKey();
  try {
    const raw = window.localStorage.getItem(ROOM_NAME_KEY);
    if (raw === null) return null;
    return isRoomName(raw) ? raw.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Persist the room name. Returns true iff the write landed and the
 * value passed the whitelist; false on whitelist rejection OR on
 * quota / privacy-mode failure. Callers (RoomGateDialog /
 * SyncConfirmDialog) use the boolean to show a success or a silent
 * no-op (the API whitelist is the authoritative gate and will 422
 * anyway).
 */
export function setRoomName(room: string): boolean {
  if (!isRoomName(room)) return false;
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(ROOM_NAME_KEY, room.trim());
    // Best-effort: legacy key cleanup is part of every successful
    // write so the user cannot end up with both keys present after
    // they switched rooms.
    cleanupLegacyPlayerNameKey();
    return true;
  } catch {
    return false;
  }
}

/** Remove the persisted room name. Failure is swallowed for symmetry with setRoomName. */
export function clearRoomName(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ROOM_NAME_KEY);
  } catch {
    // Nothing to recover — the key may simply not exist.
  }
}

/**
 * One-shot cleanup of the pre-migration `ttt.player.name.v1` key.
 * SSR-safe. Idempotent — calling repeatedly is a no-op.
 *
 * D-4 (ulw-room-migration-home-landing §2.5): D-4 permits clearing
 * the legacy value outright; we never read it. Side-effect only,
 * never throws.
 */
export function cleanupLegacyPlayerNameKey(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_PLAYER_NAME_KEY);
  } catch {
    // Private mode: degrade silently. The legacy key may simply not
    // be present, or removal may throw — neither is a contract
    // violation.
  }
}

/**
 * Sole shape known to lib/store.ts and lib/offline-stats.ts. Re-exported
 * here so consumers of room-name don't have to reach into game.ts when
 * they want to type a panel state.
 */
export type { GameStats };
export { emptyStats };
