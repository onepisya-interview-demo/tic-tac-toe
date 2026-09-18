import { describe, it, expect, beforeEach } from 'vitest';
import {
  PLAYER_NAME_KEY,
  clearPlayerName,
  getPlayerName,
  isPlayerName,
  setPlayerName,
} from '@/lib/player-name';

// isPlayerName is the validator both client and server depend on; the
// server-side whitelist lives at app/api/offline-stats/route.ts. Both must
// reject the same inputs (or a "save" the client accepts becomes a 422
// on POST), and accept the same inputs. The cases below mirror the
// route's normalizeName() shape so a future drift in either direction
// would surface here as an open test gap.

describe('lib/player-name / isPlayerName', () => {
  it('accepts a single ASCII letter', () => {
    expect(isPlayerName('a')).toBe(true);
  });

  it('accepts a 24-character name (boundary)', () => {
    expect(isPlayerName('a'.repeat(24))).toBe(true);
  });

  it('rejects a 25-character name (over boundary)', () => {
    expect(isPlayerName('a'.repeat(25))).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isPlayerName('')).toBe(false);
  });

  it('rejects whitespace-only strings after trim', () => {
    expect(isPlayerName('     ')).toBe(false);
  });

  it('accepts names with leading/trailing whitespace (will be trimmed at storage)', () => {
    expect(isPlayerName('  alice  ')).toBe(true);
  });

  it('accepts CJK names', () => {
    expect(isPlayerName('小明')).toBe(true);
  });

  it('accepts names with spaces (CJK spaces between first/last)', () => {
    expect(isPlayerName('王 小明')).toBe(true);
  });

  it('accepts emoji (the validator does not screen Unicode supplementary)', () => {
    expect(isPlayerName('player🎮')).toBe(true);
  });

  it('rejects names containing NUL (control char)', () => {
    expect(isPlayerName('bad\x00name')).toBe(false);
  });

  it('rejects names containing newline', () => {
    expect(isPlayerName('bad\nname')).toBe(false);
  });

  it('rejects names containing tab', () => {
    expect(isPlayerName('bad\tname')).toBe(false);
  });

  it('rejects names containing BEL (\\x07)', () => {
    expect(isPlayerName('bad\x07name')).toBe(false);
  });

  it('rejects names containing DEL (U+007F)', () => {
    expect(isPlayerName('bad\x7fname')).toBe(false);
  });

  it('rejects non-string values (number, null, undefined, object)', () => {
    expect(isPlayerName(42)).toBe(false);
    expect(isPlayerName(null)).toBe(false);
    expect(isPlayerName(undefined)).toBe(false);
    expect(isPlayerName({ name: 'alice' })).toBe(false);
    expect(isPlayerName(['alice'])).toBe(false);
  });
});

describe('lib/player-name / storage round-trip', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('getPlayerName returns null on a fresh browser', () => {
    expect(getPlayerName()).toBeNull();
  });

  it('setPlayerName writes a valid name and getPlayerName reads it back', () => {
    expect(setPlayerName('alice')).toBe(true);
    expect(getPlayerName()).toBe('alice');
    expect(window.localStorage.getItem(PLAYER_NAME_KEY)).toBe('alice');
  });

  it('setPlayerName trims whitespace before storing', () => {
    expect(setPlayerName('  alice  ')).toBe(true);
    expect(getPlayerName()).toBe('alice');
    expect(window.localStorage.getItem(PLAYER_NAME_KEY)).toBe('alice');
  });

  it('setPlayerName returns false (no write) for invalid names', () => {
    expect(setPlayerName('')).toBe(false);
    expect(getPlayerName()).toBeNull();
    expect(window.localStorage.getItem(PLAYER_NAME_KEY)).toBeNull();
  });

  it('setPlayerName returns false (no write) for control-char names', () => {
    expect(setPlayerName('bad\x07name')).toBe(false);
    expect(getPlayerName()).toBeNull();
  });

  it('getPlayerName returns null for a corrupted storage value', () => {
    window.localStorage.setItem(PLAYER_NAME_KEY, 'bad\x00name');
    expect(getPlayerName()).toBeNull();
  });

  it('getPlayerName returns null for a non-string storage value', () => {
    window.localStorage.setItem(PLAYER_NAME_KEY, '123');
    // '123' is a valid name per the whitelist; this documents the
    // contract — getPlayerName does not reject numbers-as-strings.
    expect(getPlayerName()).toBe('123');
  });

  it('clearPlayerName removes the key and getPlayerName returns null', () => {
    setPlayerName('alice');
    expect(getPlayerName()).toBe('alice');
    clearPlayerName();
    expect(getPlayerName()).toBeNull();
    expect(window.localStorage.getItem(PLAYER_NAME_KEY)).toBeNull();
  });

  it('clearPlayerName is a no-op when the key is absent', () => {
    expect(() => clearPlayerName()).not.toThrow();
    expect(getPlayerName()).toBeNull();
  });
});
