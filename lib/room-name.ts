// Room-name whitelist — server-side / client-side single source of truth
// for the per-room ledger identifier (W1 ulw-room-migration-home-landing,
// plan §1 映射表).
//
// `room` is the new name for what used to be `player` in this codebase:
// both modes (online / offline) are pass-and-play on the same device, so
// the row identifier has always been "this device's ledger tag" — "room"
// names that idea accurately. See plan §0.1-4 for the concept rename
// rationale and §1 for the symbol map.
//
// Whitelist semantics are pinned byte-for-byte against the prior
// lib/player-name.ts so a server accept / reject matches what the API
// would do. The whitelist (trim → 1–24 chars → reject control chars)
// MUST stay mirrored between server validator (this file, called from
// app/api/rooms/**/route.ts) and any future client validator (W2
// introduces lib/room-name.ts's storage helpers; same-module use here
// is the bridge).
//
// W1 (this commit) ships only the pure whitelist: `normalizeRoom` and
// `isRoomName`. W2 adds the localStorage surface (getRoomName,
// setRoomName, clearRoomName) plus the legacy `ttt.player.name.v1`
// one-shot cleanup helper (plan §2.5). Keeping the storage surface
// out of W1 keeps the W1→W2 transition clean: app code that already
// imports lib/player-name.ts (the half-not-yet-migrated client) keeps
// compiling until W2 deletes it.

/** Same constants as the API route's whitelist. Mirrored from the prior
 *  lib/player-name.ts so a future drift breaks at compile time (one
 *  module, one set of constants). */
const NAME_MAX = 24;
const NAME_MIN = 1;

/**
 * Whitelist check. Mirrors the validator the four new room routes use.
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
