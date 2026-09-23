import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { OnlineGateMount } from './OnlineGateMount';
import { useGameStore } from '@/lib/store';

import { resetStore } from '@/tests/helpers/reset-store';
// OnlineGateMount (ulw-result-win-celebration W-A2, D-4) — the
// /online direct-entry gate. Coverage:
//
//   G1: named hard-load (localStorage set, store empty) → bootstrap
//       hydrates the store; dialog never opens
//   G2: soft-nav path (store already carries the room) → no-op, no
//       dialog, no store write
//   G3: anonymous hard-load (both keys empty) → dialog opens (open
//       attribute present)
//   G4: legacy key only → legacy swept (D-4), store stays empty,
//       dialog opens (still anonymous)
//   G5: StrictMode double mount — bootstrap is idempotent
//   G6: confirm flow end-to-end — POST ok → setRoomName + fresh
//       startGame('online') + dialog closes + router.push('/online')
//   G7: reject does NOT close the dialog (anti-silent-create: the
//       anonymous board must stay inert behind the modal)
//
// The bootstrap logic mirrors RoomGateMount effect (a); G1/G4 are the
// /online equivalents of its H1/H2.

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
  resetStore();
  routerPush.mockClear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('components/OnlineGateMount (W-A2 /online direct-entry gate)', () => {
  it('G1: named hard-load — localStorage set + store empty → bootstrap hydrates store, dialog never opens', async () => {
    window.localStorage.setItem('ttt.room.name.v1', 'direct-named');
    expect(useGameStore.getState().roomName).toBeNull();
    render(<OnlineGateMount />);
    await waitFor(() => {
      expect(useGameStore.getState().roomName).toBe('direct-named');
    });
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBe('direct-named');
    const dialog = screen.queryByTestId('room-gate-dialog');
    expect(dialog).not.toHaveAttribute('open');
  });

  it('G2: soft-nav path — store already carries the room → no-op (no dialog, no overwrite)', async () => {
    useGameStore.setState({ roomName: 'carried-room' });
    window.localStorage.setItem('ttt.room.name.v1', 'disk-room');
    render(<OnlineGateMount />);
    await new Promise((r) => setTimeout(r, 30));
    expect(useGameStore.getState().roomName).toBe('carried-room');
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBe('disk-room');
    const dialog = screen.queryByTestId('room-gate-dialog');
    expect(dialog).not.toHaveAttribute('open');
  });

  it('G3: anonymous hard-load — both keys empty → gate dialog opens', async () => {
    render(<OnlineGateMount />);
    await waitFor(() => {
      expect(screen.getByTestId('room-gate-dialog')).toHaveAttribute('open');
    });
    expect(useGameStore.getState().roomName).toBeNull();
  });

  it('G4: legacy key only → legacy swept (D-4), store stays empty, dialog opens', async () => {
    window.localStorage.setItem('ttt.player.name.v1', 'legacy-user');
    render(<OnlineGateMount />);
    await waitFor(() => {
      expect(screen.getByTestId('room-gate-dialog')).toHaveAttribute('open');
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(useGameStore.getState().roomName).toBeNull();
    expect(window.localStorage.getItem('ttt.player.name.v1')).toBeNull();
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBeNull();
  });

  it('G5: StrictMode double mount — bootstrap is idempotent', async () => {
    window.localStorage.setItem('ttt.room.name.v1', 'strict-gate');
    render(
      <StrictMode>
        <OnlineGateMount />
      </StrictMode>,
    );
    await waitFor(() => {
      expect(useGameStore.getState().roomName).toBe('strict-gate');
    });
    const dialog = screen.queryByTestId('room-gate-dialog');
    expect(dialog).not.toHaveAttribute('open');
  });

  it('G6: confirm flow — POST ok → setRoomName + fresh startGame(online) + dialog closes + push(/online)', async () => {
    const user = userEvent.setup();
    render(<OnlineGateMount />);
    await waitFor(() => {
      expect(screen.getByTestId('room-gate-dialog')).toHaveAttribute('open');
    });
    await user.type(screen.getByTestId('room-gate-name'), 'gate-confirm-room');
    await user.click(screen.getByTestId('room-gate-confirm'));
    await waitFor(() => {
      expect(useGameStore.getState().roomName).toBe('gate-confirm-room');
    });
    // startGame('online') ran: fresh randomized game in playing phase.
    expect(useGameStore.getState().phase).toBe('playing');
    expect(useGameStore.getState().mode).toBe('online');
    expect(useGameStore.getState().currentPlayer).not.toBeNull();
    // Dialog closed.
    await waitFor(() => {
      expect(screen.getByTestId('room-gate-dialog')).not.toHaveAttribute('open');
    });
    // Same-route push kept for RoomGateMount parity.
    expect(routerPush).toHaveBeenCalledWith('/online');
    // The dialog's own postRoomSession hit the rooms endpoint.
    expect(fetchSpy.mock.calls.some((c) => String(c[0]).endsWith('/api/rooms'))).toBe(true);
    // localStorage persisted (dialog success path).
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBe('gate-confirm-room');
  });

  it('G7: reject does NOT close the gate — anonymous board stays inert behind the modal', async () => {
    const user = userEvent.setup();
    render(<OnlineGateMount />);
    await waitFor(() => {
      expect(screen.getByTestId('room-gate-dialog')).toHaveAttribute('open');
    });
    await user.click(screen.getByTestId('room-gate-cancel'));
    // Give any (incorrect) close effect a tick to run.
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId('room-gate-dialog')).toHaveAttribute('open');
    // Zero persistence, zero navigation.
    expect(useGameStore.getState().roomName).toBeNull();
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();
    // Zero network writes from the rejection path.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
