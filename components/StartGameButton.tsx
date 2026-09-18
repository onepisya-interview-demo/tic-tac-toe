'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postSoloSync, putSoloName } from '@/lib/solo-net';
import {
  clearSoloStats,
  clearSyncedServerTotal,
  loadSoloStats,
  pendingSyncCount,
  persistSyncedServerTotal,
} from '@/lib/solo-stats';
import { useGameStore, type GameMode } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { SyncConfirmDialog } from '@/components/SyncConfirmDialog';

type Props = {
  /** Navigation target: /play for ranked, /solo for solo. */
  href: string;
  /** Visible CTA label. */
  label: string;
  /** Mode handed to startGame() on click; omitted resolves to 'ranked'
   * in the store (the historical /play behavior). */
  mode?: GameMode;
  /** Button variant: primary (main CTA) or secondary (alternate CTA). */
  variant?: 'primary' | 'secondary';
  /** Stable QA testid — the click contract for every probe. */
  testid: string;
};

/**
 * CTA that starts a game in the given mode and navigates to its page.
 *
 * W1 intercept: when the user has unsynced solo stats
 * (`pendingSyncCount() > 0`) and clicks this button, we open the
 * `SyncConfirmDialog` BEFORE navigating. Two branches:
 *  - 「合并并清空」 → run the B-T4 merge sequence (PUT name if changed
 *    → POST /sync → clear local → adopt server stats → navigate).
 *  - 「保留本地」 → zero network writes; navigate immediately.
 *
 * `pendingSyncCount === 0` → navigate silently (no dialog, no extra
 * latency). This matches the spec (主公谕: "切换到在线版本的时候就弹窗"
 * applies only when there is pending local data to merge).
 */
export function StartGameButton({ href, label, mode, variant = 'primary', testid }: Props) {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);
  const playerName = useGameStore((s) => s.playerName);
  // Dialog state lives at the button level: only one button on the
  // page renders this dialog at a time (the 「开始对战」 / ranked CTA),
  // but in principle the 「单机练习」 button shares the same intercept
  // since switching to solo also benefits from a pre-flight merge.
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  // Snapshot of the pending count at the moment the dialog opened, so
  // the "本机 N 局" copy stays stable even if the user plays another
  // game mid-dialog.
  const [pendingCount, setPendingCount] = useState<number>(0);

  function navigateAfterMerge(): void {
    startGame(mode);
    router.push(href);
  }

  /**
   * Run the B-T4 merge sequence: PUT (if name changed) → POST /sync
   * with the current localStorage snapshot → clear local + sentinel
   * → adopt the server's authoritative stats row. Mirrors
   * SoloStatsPanel.confirmSync (deliberate duplication — the two
   * callers want different success UX; future refactor target).
   */
  async function runMerge(name: string): Promise<void> {
    if (name !== playerName) {
      const put = await putSoloName(name);
      if (!put.ok) {
        throw new Error(
          put.reason === 'http-error'
            ? `存名失败 (HTTP ${put.status ?? '?'})`
            : `存名失败 (${put.reason})`,
        );
      }
      useGameStore.getState().setPlayerName(name);
    }
    const localSnapshot = loadSoloStats();
    const r = await postSoloSync(name, localSnapshot);
    if (!r.ok) {
      throw new Error(
        r.reason === 'http-error'
          ? `同步失败 (HTTP ${r.status ?? '?'})`
          : `同步失败 (${r.reason})`,
      );
    }
    clearSoloStats();
    clearSyncedServerTotal();
    persistSyncedServerTotal(r.value.stats.totalGames);
    // W2: the soloSync zombie state is gone from the store. The
    // panel state on /solo is mounted only by the user opening the
    // stats view there; the home page does not render a SoloStatsPanel.
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    // Always preventDefault — we route manually so we can intercept
    // first (open dialog) and navigate after.
    e.preventDefault();
    const diff = pendingSyncCount();
    if (diff > 0) {
      setPendingCount(diff);
      setDialogOpen(true);
      return;
    }
    // No pending: navigate immediately. W1 spec: pending=0 时无弹框直行.
    navigateAfterMerge();
  }

  function handleConfirm(name: string): Promise<void> | void {
    return runMerge(name);
  }

  function handleAfterConfirm(): void {
    // runMerge already adopted the server row; we now close the
    // dialog and continue navigation. If runMerge threw, this hook
    // never fires (SyncConfirmDialog keeps the dialog open).
    setDialogOpen(false);
    navigateAfterMerge();
  }

  function handleReject(): void {
    // 「保留本地」: zero network writes, navigate immediately.
    setDialogOpen(false);
    navigateAfterMerge();
  }

  return (
    <>
      <Link href={href} className="flex-1" onClick={handleClick} data-testid={testid}>
        <Button variant={variant} className="w-full">
          {label}
        </Button>
      </Link>
      <SyncConfirmDialog
        open={dialogOpen}
        pendingGamesCount={pendingCount}
        initialName={playerName ?? ''}
        onConfirm={handleConfirm}
        onAfterConfirm={handleAfterConfirm}
        onReject={handleReject}
      />
    </>
  );
}
