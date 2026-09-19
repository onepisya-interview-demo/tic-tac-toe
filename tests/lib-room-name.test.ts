import { describe, it, expect } from 'vitest';

import { isRoomName, normalizeRoom } from '@/lib/room-name';

// isRoomName is the validator both client and server depend on; the
// server-side whitelist lives at app/api/rooms/**/route.ts. Both must
// reject the same inputs (or a "save" a room the API would accept can
// also be saved, and a save the API would reject can never be POSTed).
// W2 adds the storage helpers (getRoomName / setRoomName /
// clearRoomName) + legacy `ttt.player.name.v1` cleanup — those tests
// live in the same file when W2 lands; this file currently pins only
// the pure whitelist surface that ships in W1.

describe('lib/room-name / isRoomName', () => {
  it('accepts a single ASCII letter', () => {
    expect(isRoomName('a')).toBe(true);
  });

  it('accepts a 24-character name (boundary)', () => {
    expect(isRoomName('a'.repeat(24))).toBe(true);
  });

  it('rejects a 25-character name (over boundary)', () => {
    expect(isRoomName('a'.repeat(25))).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isRoomName('')).toBe(false);
  });

  it('rejects whitespace-only strings after trim', () => {
    expect(isRoomName('     ')).toBe(false);
  });

  it('accepts names with leading/trailing whitespace (will be trimmed at storage)', () => {
    expect(isRoomName('  alice  ')).toBe(true);
  });

  it('accepts CJK names', () => {
    expect(isRoomName('小明')).toBe(true);
  });

  it('accepts names with spaces (CJK spaces between first/last)', () => {
    expect(isRoomName('王 小明')).toBe(true);
  });

  it('accepts emoji (the validator does not screen Unicode supplementary)', () => {
    expect(isRoomName('player🎮')).toBe(true);
  });

  it('rejects names containing NUL (control char)', () => {
    expect(isRoomName('bad\x00name')).toBe(false);
  });

  it('rejects names containing newline', () => {
    expect(isRoomName('bad\nname')).toBe(false);
  });

  it('rejects names containing tab', () => {
    expect(isRoomName('bad\tname')).toBe(false);
  });

  it('rejects names containing BEL (\\x07)', () => {
    expect(isRoomName('bad\x07name')).toBe(false);
  });

  it('rejects names containing DEL (U+007F)', () => {
    expect(isRoomName('bad\x7fname')).toBe(false);
  });

  it('rejects non-string values (number, null, undefined, object)', () => {
    expect(isRoomName(42)).toBe(false);
    expect(isRoomName(null)).toBe(false);
    expect(isRoomName(undefined)).toBe(false);
    expect(isRoomName({ name: 'alice' })).toBe(false);
    expect(isRoomName(['alice'])).toBe(false);
  });
});

describe('lib/room-name / normalizeRoom', () => {
  it('returns the trimmed canonical PK when input passes the whitelist', () => {
    expect(normalizeRoom('  alice  ')).toBe('alice');
  });

  it('returns null on empty input', () => {
    expect(normalizeRoom('')).toBeNull();
  });

  it('returns null on whitespace-only input', () => {
    expect(normalizeRoom('     ')).toBeNull();
  });

  it('returns null on control characters', () => {
    expect(normalizeRoom('bad\x07name')).toBeNull();
  });

  it('returns null on over-boundary length', () => {
    expect(normalizeRoom('a'.repeat(25))).toBeNull();
  });

  it('returns null on non-string values', () => {
    expect(normalizeRoom(42)).toBeNull();
    expect(normalizeRoom(null)).toBeNull();
    expect(normalizeRoom(undefined)).toBeNull();
    expect(normalizeRoom({ room: 'alice' })).toBeNull();
    expect(normalizeRoom(['alice'])).toBeNull();
  });

  it('does not double-trim (idempotent on already-trimmed input)', () => {
    expect(normalizeRoom('alice')).toBe('alice');
  });
});
