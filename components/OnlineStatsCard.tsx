'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { fetchPlayerStats } from '@/lib/game-net';
import { emptyStats, type GameStats } from '@/lib/game';
import { Card } from '@/components/ui/Card';
import { StatsGrid } from '@/components/ui/StatsGrid';

/**
 * Read-only online-stats card on the home page
 * (ulw-name-login-one-truth W3 contract + W2 P1 fix).
 *
 * Pure display surface. The component reads `playerName` from the
 * store and, when set, GETs the matching row from
 * `/api/solo-stats?name=`. The response lives ONLY in component
 * state — it is never written to localStorage, the solo store
 * cache, or anywhere else (W3 A2 red-line: 线上永不进本地).
 *
 * W2 P1 fix: the card now refetches on (a) the
 * `ttt:solo-stats-changed` custom event — dispatched by HomeDialogMount
 * after a successful merge so the user sees the merged row ≤2s after
 * the dialog closes — and (b) window focus — cross-device read
 * recovery (the user lands on / from another device that just synced
 * under the same name). Initial mount + playerName-change still
 * trigger the same refetch path via `useEffect([refetch])`. The
 * ticket-based in-flight guard prevents a stale focus-during-fetch
 * from clobbering a fresher result.
 *
 * Logged-out rendering: a low-key prompt inside the same Card slot
 * so the layout doesn't reflow when the user signs in. This keeps
 * the home page 375px one-screen budget stable across the two
 * states — no extra scroll on the empty path, no resize on the
 * populated path.
 */
type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; stats: GameStats }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

export function OnlineStatsCard() {
  const playerName = useGameStore((s) => s.playerName);
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  // W2 P1 fix: refetch on merge success (HomeDialogMount dispatches
  // ttt:solo-stats-changed after clearing local + sentinel) and on
  // window focus (cross-device read recovery, mirrors the same signal
  // the home-return dialog uses). In-flight guard via ticket ref
  // prevents a stale focus-during-fetch from clobbering a fresher
  // result. Response lives in component state only — A2 red-line.
  const ticketRef = useRef<{ cancelled: boolean } | null>(null);

  const refetch = useCallback(() => {
    if (!playerName) {
      setState({ kind: 'idle' });
      return;
    }
    if (ticketRef.current) ticketRef.current.cancelled = true;
    const ticket = { cancelled: false };
    ticketRef.current = ticket;
    setState({ kind: 'loading' });
    void fetchPlayerStats(playerName).then((r) => {
      if (ticket.cancelled) return;
      if (!r.ok) {
        setState({
          kind: 'error',
          message:
            r.reason === 'aborted'
              ? '加载超时，请稍后再试。'
              : '加载失败，请稍后再试。',
        });
        return;
      }
      if (r.value.stats === null) {
        setState({ kind: 'empty' });
      } else {
        setState({ kind: 'ok', stats: r.value.stats });
      }
    });
  }, [playerName]);

  // Initial fetch + playerName-change refetch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch() sets loading + ok/error state synchronously to drive the in-flight lifecycle
    refetch();
    return () => {
      if (ticketRef.current) ticketRef.current.cancelled = true;
    };
  }, [refetch]);

  // Cross-device signal: window focus + the merge-success custom event.
  // Cleanup is symmetric (both addEventListener calls are paired).
  useEffect(() => {
    if (!playerName) return;
    const onSignal = (): void => {
      refetch();
    };
    window.addEventListener('ttt:solo-stats-changed', onSignal);
    window.addEventListener('focus', onSignal);
    return () => {
      window.removeEventListener('ttt:solo-stats-changed', onSignal);
      window.removeEventListener('focus', onSignal);
    };
  }, [playerName, refetch]);

  return (
    <Card>
      <div className="flex flex-col gap-3" data-testid="online-stats-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-h3 font-display font-medium">线上战绩</h2>
          {playerName ? (
            <span
              className="text-small text-text-muted font-mono"
              data-testid="online-stats-name"
            >
              {playerName}
            </span>
          ) : null}
        </div>
        {!playerName ? (
          <p
            className="text-small text-text-muted"
            data-testid="online-stats-empty-prompt"
          >
            设置名字后在此查看跨设备战绩。
          </p>
        ) : state.kind === 'loading' ? (
          <p
            className="text-small text-text-muted"
            data-testid="online-stats-loading"
          >
            加载中…
          </p>
        ) : state.kind === 'empty' ? (
          <p
            className="text-small text-text-muted"
            data-testid="online-stats-empty"
          >
            该名字尚无战绩记录，玩一局即可累计。
          </p>
        ) : state.kind === 'error' ? (
          <p
            className="text-small text-text-secondary"
            data-testid="online-stats-error"
            role="alert"
          >
            {state.message}
          </p>
        ) : state.kind === 'ok' ? (
          <div data-testid="online-stats-grid">
            <StatsGrid stats={state.stats} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// Re-export for test ergonomics: import the empty sentinel from one
// place if a future test wants to assert the post-merge display
// equals emptyStats() rather than a fresh fetch.
export { emptyStats };
