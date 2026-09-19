import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { act, StrictMode } from 'react';
import { RoomGateMount } from './RoomGateMount';
import { HomeStatsEntry } from './HomeStatsEntry';
import { useGameStore } from '@/lib/store';

// RoomGateMount W2-rework: mount-time identity bootstrap (Q6/A7/A2/§2.2
// regression fixes). The pre-W2 PlayerNameForm owned this side-effect
// via its reverse-hydration useEffect; W2 deleted the form without
// preserving the hydration. The mount effect here is the single
// mount-period hydration point.
//
// Coverage:
//   H1: localStorage ttt.room.name.v1 set + store empty → mount hydrates store
//   H2: localStorage ttt.player.name.v1 (legacy) only → mount sweeps
//       legacy, leaves store empty (D-4)
//   H3: store already populated → mount is a no-op (no double-write)
//   H4: localStorage empty → mount is a no-op (store stays empty)
//   H5: hard-reload entry render: localStorage has room → mount hydrates
//       store → HomeStatsEntry renders the static entry link
//   H6: dispatch ttt:room-required when store has a hydrated room → dialog opens
//   H7: hydration effect is idempotent on re-mount (StrictMode double mount)
//
// Dialog end-to-end (input typing, submit, POST, navigation) is covered
// by components/RoomGateDialog.test.tsx (R1-R9). jsdom does not
// implement HTMLDialogElement.showModal() so the modal mount throws
// under test, which makes click→POST→navigation assertions flaky in
// unit tests but not in the real browser.

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

const fetchSpy = vi.spyOn(globalThis, 'fetch');
fetchSpy.mockImplementation(async (url) => {
  const s = String(url);
  if (s.endsWith('/api/rooms')) {
    return new Response(
      '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":false}',
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  return new Response('{}', { status: 404 });
});

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
  routerPush.mockClear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchSpy.mockReset();
});

describe('components/RoomGateMount (W2-rework mount-time identity bootstrap)', () => {
  it('H1: localStorage ttt.room.name.v1 set + store empty → mount hydrates store', async () => {
    window.localStorage.setItem('ttt.room.name.v1', 'returning-user');
    expect(useGameStore.getState().roomName).toBeNull();
    render(<RoomGateMount />);
    await waitFor(() => {
      expect(useGameStore.getState().roomName).toBe('returning-user');
    });
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBe('returning-user');
  });

  it('H2: localStorage only has legacy ttt.player.name.v1 → mount sweeps legacy, store stays empty (D-4)', async () => {
    window.localStorage.setItem('ttt.player.name.v1', 'legacy-user');
    expect(useGameStore.getState().roomName).toBeNull();
    render(<RoomGateMount />);
    await new Promise((r) => setTimeout(r, 30));
    expect(useGameStore.getState().roomName).toBeNull();
    expect(window.localStorage.getItem('ttt.player.name.v1')).toBeNull();
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBeNull();
  });

  it('H3: store already populated → mount is a no-op (no double-write, no extra setRoomName call)', async () => {
    useGameStore.setState({ roomName: 'already-set' });
    window.localStorage.setItem('ttt.room.name.v1', 'disk-value');
    render(<RoomGateMount />);
    await new Promise((r) => setTimeout(r, 30));
    expect(useGameStore.getState().roomName).toBe('already-set');
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBe('disk-value');
  });

  it('H4: both localStorage keys empty → mount is a no-op, store stays empty', async () => {
    render(<RoomGateMount />);
    await new Promise((r) => setTimeout(r, 30));
    expect(useGameStore.getState().roomName).toBeNull();
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBeNull();
    expect(window.localStorage.getItem('ttt.player.name.v1')).toBeNull();
  });

  it('H5: hard-reload entry render — mount hydrates store → HomeStatsEntry renders the link', async () => {
    window.localStorage.setItem('ttt.room.name.v1', 'hard-reload-room');
    expect(useGameStore.getState().roomName).toBeNull();

    render(
      <>
        <RoomGateMount />
        <HomeStatsEntry />
      </>,
    );

    await waitFor(() => {
      expect(useGameStore.getState().roomName).toBe('hard-reload-room');
    });
    const entry = await screen.findByTestId('home-stats-entry');
    expect(entry).toBeInTheDocument();
    const link = screen.getByTestId('home-stats-link');
    expect(link).toHaveAttribute('href', '/result?room=hard-reload-room');
  });

  it('H6: dispatch ttt:room-required when store has a hydrated room → dialog opens', async () => {
    window.localStorage.setItem('ttt.room.name.v1', 'returning-user');
    render(<RoomGateMount />);
    await waitFor(() => {
      expect(useGameStore.getState().roomName).toBe('returning-user');
    });
    act(() => {
      window.dispatchEvent(
        new CustomEvent('ttt:room-required', {
          detail: { mode: 'online', href: '/online' },
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('room-gate-dialog')).toBeInTheDocument();
    });
    // The dialog effect syncs initialName into the input on open
    await waitFor(() => {
      expect(
        (screen.getByTestId('room-gate-name') as HTMLInputElement).value,
      ).toBe('returning-user');
    });
  });

  it('H7: hydration effect is idempotent on re-mount (StrictMode double mount)', async () => {
    window.localStorage.setItem('ttt.room.name.v1', 'strict-user');
    expect(useGameStore.getState().roomName).toBeNull();
    render(
      <StrictMode>
        <RoomGateMount />
      </StrictMode>,
    );
    await waitFor(() => {
      expect(useGameStore.getState().roomName).toBe('strict-user');
    });
  });
});
