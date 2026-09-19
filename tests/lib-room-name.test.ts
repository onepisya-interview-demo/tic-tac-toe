import { describe, it, expect, beforeEach } from 'vitest';

import {
  LEGACY_PLAYER_NAME_KEY,
  ROOM_NAME_KEY,
  cleanupLegacyPlayerNameKey,
  clearRoomName,
  getRoomName,
  isRoomName,
  normalizeRoom,
  setRoomName,
} from '@/lib/room-name';

// isRoomName is the validator both client and server depend on; the
// server-side whitelist lives at app/api/rooms/**/route.ts. Both must
// reject the same inputs (or a "save" a room the API would accept can
// also be saved, and a save the API would reject can never be POSTed).

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

describe('lib/room-name / storage round-trip', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('getRoomName returns null on a fresh browser', () => {
    expect(getRoomName()).toBeNull();
  });

  it('setRoomName writes a valid room and getRoomName reads it back', () => {
    expect(setRoomName('alice')).toBe(true);
    expect(getRoomName()).toBe('alice');
    expect(window.localStorage.getItem(ROOM_NAME_KEY)).toBe('alice');
  });

  it('setRoomName trims whitespace before storing', () => {
    expect(setRoomName('  alice  ')).toBe(true);
    expect(getRoomName()).toBe('alice');
    expect(window.localStorage.getItem(ROOM_NAME_KEY)).toBe('alice');
  });

  it('setRoomName returns false (no write) for invalid names', () => {
    expect(setRoomName('')).toBe(false);
    expect(getRoomName()).toBeNull();
    expect(window.localStorage.getItem(ROOM_NAME_KEY)).toBeNull();
  });

  it('setRoomName returns false (no write) for control-char names', () => {
    expect(setRoomName('bad\x07name')).toBe(false);
    expect(getRoomName()).toBeNull();
  });

  it('getRoomName returns null for a corrupted storage value', () => {
    window.localStorage.setItem(ROOM_NAME_KEY, 'bad\x00name');
    expect(getRoomName()).toBeNull();
  });

  it('clearRoomName removes the key and getRoomName returns null', () => {
    setRoomName('alice');
    expect(getRoomName()).toBe('alice');
    clearRoomName();
    expect(getRoomName()).toBeNull();
    expect(window.localStorage.getItem(ROOM_NAME_KEY)).toBeNull();
  });

  it('clearRoomName is a no-op when the key is absent', () => {
    expect(() => clearRoomName()).not.toThrow();
    expect(getRoomName()).toBeNull();
  });
});

// W2 (ulw-room-migration-home-landing §2.5 + plan §3.2 L1-L4): D-4
// permits clearing the legacy `ttt.player.name.v1` key outright;
// the value is never migrated. The cleanup is fired on every
// read (getRoomName) + every successful write (setRoomName) and
// exposed as a standalone helper for tests.
describe('lib/room-name / legacy key cleanup (L1-L4)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('L1: 旧 key 有 + 新 key 无 → 视为无名（旧 key 被清除，零新写入）', () => {
    window.localStorage.setItem(LEGACY_PLAYER_NAME_KEY, 'pre-migration');
    expect(window.localStorage.getItem(ROOM_NAME_KEY)).toBeNull();
    expect(getRoomName()).toBeNull();
    // 旧 key 被清除（getRoomName 触发 side-effect）
    expect(window.localStorage.getItem(LEGACY_PLAYER_NAME_KEY)).toBeNull();
    // 新 key 仍不存在 — 不迁移
    expect(window.localStorage.getItem(ROOM_NAME_KEY)).toBeNull();
  });

  it('L2: 新 key 有 + 旧 key 有 → 正常读新 key 值；旧 key 顺手清除；新值不被影响', () => {
    window.localStorage.setItem(LEGACY_PLAYER_NAME_KEY, 'legacy-name');
    window.localStorage.setItem(ROOM_NAME_KEY, 'new-room');
    expect(getRoomName()).toBe('new-room');
    expect(window.localStorage.getItem(LEGACY_PLAYER_NAME_KEY)).toBeNull();
    expect(window.localStorage.getItem(ROOM_NAME_KEY)).toBe('new-room');
  });

  it('L3: 双 key 无 → 返回 null；零写入', () => {
    expect(getRoomName()).toBeNull();
    expect(window.localStorage.getItem(LEGACY_PLAYER_NAME_KEY)).toBeNull();
    expect(window.localStorage.getItem(ROOM_NAME_KEY)).toBeNull();
  });

  it('L4: SSR（无 window） → 返回 null；零异常', () => {
    const originalWindow = (globalThis as unknown as { window?: Window }).window;
    // jsdom exposes window as non-optional, so we cast around it for
    // the SSR simulation. The intent: `typeof window === 'undefined'`
    // is the gate every helper uses; emulate it by stripping the
    // property.
    (globalThis as unknown as { window?: Window }).window = undefined;
    try {
      expect(getRoomName()).toBeNull();
      expect(() => cleanupLegacyPlayerNameKey()).not.toThrow();
      expect(() => clearRoomName()).not.toThrow();
    } finally {
      (globalThis as unknown as { window?: Window }).window = originalWindow;
    }
  });


  it('setRoomName 成功后也顺手清掉旧 key（best-effort 兜底）', () => {
    window.localStorage.setItem(LEGACY_PLAYER_NAME_KEY, 'legacy-name');
    expect(setRoomName('fresh-room')).toBe(true);
    expect(window.localStorage.getItem(ROOM_NAME_KEY)).toBe('fresh-room');
    expect(window.localStorage.getItem(LEGACY_PLAYER_NAME_KEY)).toBeNull();
  });

  it('cleanupLegacyPlayerNameKey 自身幂等：重复调用不抛', () => {
    window.localStorage.setItem(LEGACY_PLAYER_NAME_KEY, 'legacy');
    expect(() => {
      cleanupLegacyPlayerNameKey();
      cleanupLegacyPlayerNameKey();
    }).not.toThrow();
    expect(window.localStorage.getItem(LEGACY_PLAYER_NAME_KEY)).toBeNull();
  });
});
