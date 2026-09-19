import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { HomeStatsEntry } from './HomeStatsEntry';
import { useGameStore } from '@/lib/store';

// HomeStatsEntry (W2 ulw-room-migration-home-landing D-1) renders
// "查看房间 <room> 的战绩 →" only when useGameStore.roomName is set.
//
// Coverage (W2-rework hard-reload entry render testid):
//   E1: roomName set in store → entry renders with correct href
//   E2: roomName null → entry does NOT render (no flicker / no
//       empty link)
//   E3: URL-encodes the room name (special characters)
//
// The mount-time hydration that fills store.roomName from
// localStorage is tested in components/RoomGateMount.test.tsx (H5).

afterEach(() => {
  cleanup();
  window.localStorage.clear();
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

describe('components/HomeStatsEntry', () => {
  it('E1: roomName set in store → entry renders with correct href', () => {
    useGameStore.setState({ roomName: 'my-room' });
    render(<HomeStatsEntry />);
    expect(screen.getByTestId('home-stats-entry')).toBeInTheDocument();
    const link = screen.getByTestId('home-stats-link');
    expect(link).toHaveAttribute('href', '/result?room=my-room');
    expect(link.textContent).toContain('my-room');
  });

  it('E2: roomName null → entry does NOT render', () => {
    render(<HomeStatsEntry />);
    expect(screen.queryByTestId('home-stats-entry')).toBeNull();
    expect(screen.queryByTestId('home-stats-link')).toBeNull();
  });

  it('E3: roomName with special chars → URL-encoded href', () => {
    useGameStore.setState({ roomName: '房 间' });
    render(<HomeStatsEntry />);
    const link = screen.getByTestId('home-stats-link');
    expect(link).toHaveAttribute('href', '/result?room=%E6%88%BF%20%E9%97%B4');
  });
});
