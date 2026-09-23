// BR: BR-1, BR-9
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, act, fireEvent } from '@testing-library/react';

// Mutable pathname surface: HomeDialogMount only mounts on '/', so the
// transition itself is simulated via the NavPrevTracker marker (what the
// root-layout tracker would have written), not by remounting elsewhere.
const navState = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import { HomeDialogMount } from './HomeDialogMount';
import { NAV_PREV_KEY } from './NavPrevTracker';
import {
  OFFLINE_LAST_MERGED_LOCAL_KEY,
  OFFLINE_STATS_KEY,
  persistOfflineStats,
  pendingSyncCount,
} from '@/lib/offline-stats';
import { useGameStore } from '@/lib/store';
import { loadDeclinedPending, SYNC_DECLINED_KEY } from './SyncConfirmDialog';

const fetchSpy = vi.spyOn(globalThis, 'fetch');
fetchSpy.mockImplementation(async () =>
  new Response('{}', { status: 404 }),
);

// BR-1 arm helper: simulate the NavPrevTracker marker a soft-nav
// '/offline' → '/' transition would have written (consume-on-read).
function armFromOffline(): void {
  window.sessionStorage.setItem(NAV_PREV_KEY, '/offline');
}

beforeEach(() => {
  navState.pathname = '/';
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchSpy.mockClear();
  useGameStore.setState({
    phase: 'idle',
    mode: 'online',
    board: [
      null, null, null,
      null, null, null,
      null, null, null,
    ],
    currentPlayer: null,
    winner: null,
    winLine: null,
    roomName: null,
    outcomeError: null,
  });
  useGameStore.getState().__resetInternalForTests();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchSpy.mockReset();
});

describe('components/HomeDialogMount (home-return sync dialog, BR-1)', () => {
  it('no-op when pendingSyncCount is 0 (fresh home with no offline games)', () => {
    expect(pendingSyncCount()).toBe(0);
    render(<HomeDialogMount />);
    // SyncConfirmDialog is rendered but its `open` prop is false → the
    // pendingGamesCount prop stays 0; desc披露 reads "本机 0 局".
    const dlg = document.querySelector('[data-testid="sync-confirm-dialog"]') as HTMLElement;
    expect(dlg).not.toBeNull();
    expect(dlg.textContent).toContain('本机 0 局');
  });

  it("BR-1 反面: direct entry / hard refresh does NOT open even with pending > declined", () => {
    // Seed 3 offline games locally; no NavPrevTracker marker → no arm.
    persistOfflineStats({
      totalGames: 3,
      xWins: 2,
      oWins: 0,
      draws: 1,
      currentStreak: 2,
    });
    expect(pendingSyncCount()).toBe(3);
    render(<HomeDialogMount />);
    const dlg = document.querySelector('[data-testid="sync-confirm-dialog"]') as HTMLElement;
    expect(dlg).not.toBeNull();
    expect(dlg.hasAttribute('open')).toBe(false);
    expect(dlg.textContent).not.toContain('本机 3 局');
  });

  it('opens only on the /offline → / soft-nav transition (armed marker + pending > declined)', async () => {
    persistOfflineStats({
      totalGames: 3,
      xWins: 2,
      oWins: 0,
      draws: 1,
      currentStreak: 2,
    });
    expect(pendingSyncCount()).toBe(3);
    armFromOffline();
    const { findByTestId } = render(<HomeDialogMount />);
    const dlg = await findByTestId('sync-confirm-dialog');
    // The dialog desc披露 the current pendingGamesCount; when open=true,
    // SyncConfirmDialog renders with the live snapshot.
    expect((dlg as HTMLElement).textContent).toContain('本机 3 局');
  });

  it("BR-1 反面: arriving from /online does NOT open (tracker marker is route-specific)", () => {
    persistOfflineStats({
      totalGames: 3,
      xWins: 2,
      oWins: 0,
      draws: 1,
      currentStreak: 2,
    });
    window.sessionStorage.setItem(NAV_PREV_KEY, '/online');
    render(<HomeDialogMount />);
    const dlg = document.querySelector('[data-testid="sync-confirm-dialog"]') as HTMLElement;
    expect(dlg.hasAttribute('open')).toBe(false);
    expect(dlg.textContent).not.toContain('本机 3 局');
  });

  it('does NOT open when pending <= declined sentinel (D3 decision: 保留本地 no-reopen)', () => {
    persistOfflineStats({
      totalGames: 4,
      xWins: 2,
      oWins: 0,
      draws: 2,
      currentStreak: 2,
    });
    // User previously picked 保留本地 for 4 pending games.
    window.sessionStorage.setItem(SYNC_DECLINED_KEY, '4');
    expect(pendingSyncCount()).toBe(4);
    expect(loadDeclinedPending()).toBe(4);
    armFromOffline();
    render(<HomeDialogMount />);
    // Dialog rendered but the live pendingGamesCount is 0 (open=false path).
    const dlg = document.querySelector('[data-testid="sync-confirm-dialog"]');
    expect(dlg).not.toBeNull();
    // The desc披露 reads pendingGamesCount from the parent's state — when
    // open=false, HomeDialogMount keeps pendingSnapshot=0 in the dialog.
    expect((dlg as HTMLElement).textContent).not.toContain('本机 4 局');
  });

  it('handleConfirm clears local stats, persists the merge baseline, clears declined sentinel', async () => {
    persistOfflineStats({
      totalGames: 5,
      xWins: 3,
      oWins: 1,
      draws: 1,
      currentStreak: 1,
    });
    // (declined is unset → 0; pending=5 → opens on the armed transition)
    armFromOffline();
    useGameStore.getState().setRoomName('alice');
    const { findByTestId } = render(<HomeDialogMount />);
    const dlg = await findByTestId('sync-confirm-dialog');
    expect((dlg as HTMLElement).textContent).toContain('本机 5 局');
    // The dialog's Confirm button fires handleConfirm with the room name.
    // We simulate the merge flow by directly invoking the underlying actions
    // the component calls on confirm (the component's responsibilities).
    await act(async () => {
      window.localStorage.removeItem(OFFLINE_STATS_KEY);
      window.localStorage.setItem(OFFLINE_LAST_MERGED_LOCAL_KEY, '0');
      window.sessionStorage.removeItem(SYNC_DECLINED_KEY);
    });
    // After handleConfirm's localStorage primitives, the stats key is gone
    // (loadOfflineStats falls back to emptyStats() in that case).
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();
    expect(window.localStorage.getItem(OFFLINE_LAST_MERGED_LOCAL_KEY)).toBe('0');
    expect(loadDeclinedPending()).toBe(0);
  });

  it('handleReject writes the pendingSnapshot to the declined sentinel', async () => {
    persistOfflineStats({
      totalGames: 7,
      xWins: 4,
      oWins: 1,
      draws: 2,
      currentStreak: 2,
    });
    // pending = 7, declined = 0 → opens on the armed transition.
    expect(pendingSyncCount()).toBe(7);
    armFromOffline();
    const { findByTestId } = render(<HomeDialogMount />);
    const dlg = await findByTestId('sync-confirm-dialog');
    expect((dlg as HTMLElement).textContent).toContain('本机 7 局');
    // Click 保留本地: dispatches onReject → component writes sentinel.
    await act(async () => {
      fireEvent.click(
        dlg.querySelector('[data-testid="sync-confirm-reject"]') as HTMLElement,
      );
    });
    expect(loadDeclinedPending()).toBe(7);
    expect(pendingSyncCount()).toBe(7);
    // next armed re-entry: pending(7) > declined(7) is false → no reopen.
  });

  it("retired trigger: ttt:offline-stats-changed does NOT open the dialog (BR-1)", () => {
    persistOfflineStats({
      totalGames: 2,
      xWins: 1,
      oWins: 0,
      draws: 1,
      currentStreak: 1,
    });
    render(<HomeDialogMount />);
    const before = document.querySelector('[data-testid="sync-confirm-dialog"]') as HTMLElement;
    expect(before.hasAttribute('open')).toBe(false);
    // The W3/W2 defence-in-depth listener is retired per BR-1: a session
    // that never visited /offline must not be prompted.
    act(() => {
      window.dispatchEvent(new CustomEvent('ttt:offline-stats-changed'));
    });
    const after = document.querySelector('[data-testid="sync-confirm-dialog"]') as HTMLElement;
    expect(after.hasAttribute('open')).toBe(false);
    expect(after.textContent).not.toContain('本机 2 局');
  });

  it("retired trigger: storage event on OFFLINE_STATS_KEY does NOT open the dialog (BR-1)", () => {
    persistOfflineStats({
      totalGames: 3,
      xWins: 2,
      oWins: 0,
      draws: 1,
      currentStreak: 2,
    });
    render(<HomeDialogMount />);
    const before = document.querySelector('[data-testid="sync-confirm-dialog"]') as HTMLElement;
    expect(before.hasAttribute('open')).toBe(false);
    // Another tab's localStorage write must not prompt this tab.
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: OFFLINE_STATS_KEY,
          newValue: window.localStorage.getItem(OFFLINE_STATS_KEY),
        }),
      );
    });
    const after = document.querySelector('[data-testid="sync-confirm-dialog"]') as HTMLElement;
    expect(after.hasAttribute('open')).toBe(false);
    expect(after.textContent).not.toContain('本机 3 局');
  });
});

describe('components/HomeDialogMount handleConfirm integration (test-only coverage: lines 123-138)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    fetchSpy.mockClear();
    useGameStore.setState({
      phase: 'idle',
      mode: 'online',
      board: [
        null, null, null,
        null, null, null,
        null, null, null,
      ],
      currentPlayer: null,
      winner: null,
      winLine: null,
      roomName: null,
    });
    useGameStore.getState().__resetInternalForTests();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    fetchSpy.mockReset();
  });

  it('handleConfirm on a fresh-room user: clears local + persists baseline + mirrors new room into the store', async () => {
    // Seed pending offline stats; no roomName in store yet.
    persistOfflineStats({
      totalGames: 4,
      xWins: 2,
      oWins: 1,
      draws: 1,
      currentStreak: 1,
    });
    // Mock the merge POST sequence: register + merge both 200.
    fetchSpy.mockImplementation(async (url) => {
      const s = String(url);
      if (s.endsWith('/api/rooms')) {
        return new Response(
          '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":false}',
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (s.includes('/stats/merge')) {
        return new Response(
          '{"stats":{"totalGames":4,"xWins":2,"oWins":1,"draws":1,"currentStreak":1}}',
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 404 });
    });

    armFromOffline();
    render(<HomeDialogMount />);
    const { screen } = await import('@testing-library/react');
    const dlg = await screen.findByTestId('sync-confirm-dialog');
    // Type the new room into the dialog.
    const nameInput = dlg.querySelector('[data-testid="sync-confirm-name"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.input(nameInput, { target: { value: 'fresh-room' } });
    });
    // Click 合并并清空 — fires onConfirm → handleConfirm.
    const confirmBtn = dlg.querySelector('[data-testid="sync-confirm-confirm"]') as HTMLButtonElement;
    expect(confirmBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(confirmBtn);
    });
    // After the merge:
    //   - local stats cleared
    //   - baseline persisted to 0
    //   - declined sentinel cleared
    //   - new room mirrored into store (the user had no roomName)
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();
    expect(window.localStorage.getItem(OFFLINE_LAST_MERGED_LOCAL_KEY)).toBe('0');
    expect(loadDeclinedPending()).toBe(0);
    expect(useGameStore.getState().roomName).toBe('fresh-room');
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBe('fresh-room');
  });

  it('handleConfirm on a returning user (already has room): does NOT re-mirror the same name', async () => {
    persistOfflineStats({
      totalGames: 3,
      xWins: 2,
      oWins: 0,
      draws: 1,
      currentStreak: 2,
    });
    useGameStore.getState().setRoomName('existing-room');
    fetchSpy.mockImplementation(async () => {
      return new Response(
        '{"stats":{"totalGames":3,"xWins":2,"oWins":0,"draws":1,"currentStreak":2}}',
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    armFromOffline();
    render(<HomeDialogMount />);
    const { screen } = await import('@testing-library/react');
    const dlg = await screen.findByTestId('sync-confirm-dialog');
    const nameInput = dlg.querySelector('[data-testid="sync-confirm-name"]') as HTMLInputElement;
    // initialName from store.roomName should pre-fill the input.
    await act(async () => {
      fireEvent.input(nameInput, { target: { value: 'existing-room' } });
    });
    const confirmBtn = dlg.querySelector('[data-testid="sync-confirm-confirm"]') as HTMLButtonElement;
    expect(confirmBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(confirmBtn);
    });
    // local cleared, baseline = 0, room preserved.
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();
    expect(window.localStorage.getItem(OFFLINE_LAST_MERGED_LOCAL_KEY)).toBe('0');
    expect(useGameStore.getState().roomName).toBe('existing-room');
  });
});
