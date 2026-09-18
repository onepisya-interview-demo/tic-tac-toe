'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { fetchSoloStats } from '@/lib/solo-net';
import { emptyStats, type GameStats } from '@/lib/game';
import { Card } from '@/components/ui/Card';
import { StatsGrid } from '@/components/ui/StatsGrid';

/**
 * Read-only online-stats card on the home page
 * (ulw-name-login-one-truth W3 contract).
 *
 * Pure display surface. The component reads `playerName` from the
 * store and, when set, GETs the matching row from
 * `/api/solo-stats?name=`. The response lives ONLY in component
 * state — it is never written to localStorage, the solo store
 * cache, or anywhere else (W3 A2 red-line: 线上永不进本地).
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

  useEffect(() => {
    if (!playerName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    void fetchSoloStats(playerName).then((r) => {
      if (cancelled) return;
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
    return () => {
      cancelled = true;
    };
  }, [playerName]);

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
