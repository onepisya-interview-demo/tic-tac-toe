'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  SyncConfirmDialog,
  clearDeclinedPending,
  loadDeclinedPending,
  writeDeclinedPending,
} from '@/components/SyncConfirmDialog';
import { consumeNavPrev } from '@/components/NavPrevTracker';
import { useGameStore } from '@/lib/store';
import {
  clearOfflineStats,
  pendingSyncCount,
  persistLastMergedLocal,
} from '@/lib/offline-stats';
import { afterViewTransition } from '@/lib/view-transition';

/**
 * Home-return sync dialog mount
 * (ulw-name-login-one-truth W3 + ulw-room-migration-home-landing W2;
 * trigger semantics re-decreed 2026-09-22 — BR-1, docs/business-rules.md).
 *
 * The home page renders this client component once. On mount it consumes
 * the root-layout NavPrevTracker's previous-route marker and opens the
 * SyncConfirmDialog only on the「离线局 → 首页」soft-navigation transition:
 *
 *   arm  = consumeNavPrev() === '/offline'   (and pathname === '/')
 *   pending = max(0, local.totalGames - lastMergedLocal)
 *   declined = sessionStorage[ttt.offline.sync-declined.v1]
 *   → open when armed && pending > declined && pending > 0
 *
 * BR-1 反面场景 (2026-09-22 主公 decree; learnings §32):
 *   - 直接打开 / 硬刷新首页（含 pending > 0）：不弹——consume-on-read 使
 *     刷新天然无标记。
 *   - 从 /online、/result 回首页：不弹——tracker 只记 /offline 来源。
 *   - 同会话 pending 无增量（≤ declined 哨兵）：不重弹。
 *
 * Retired (were W3/W2 defence-in-depth triggers; superseded by BR-1):
 * focus / visibilitychange / storage / ttt:offline-stats-changed
 * re-evaluation listeners. A session that never visited /offline must not
 * be prompted, per decree — the listeners' only effect was opening.
 *
 * W4 F1: the `lastMergedLocal` baseline is 0 right after a successful
 * merge (clearOfflineStats() already ran), so `pending === local`. The
 * dialog text "本机 N 局" therefore always matches the snapshot
 * that postSoloSync will actually send. (Pre-F1 the sentinel stored
 * the server's absolute totalGames, leaving a catch-up window where
 * pending < local and the text under-reported the payload — see
 * V4 MINOR-F1 and lib/offline-stats.ts:OFFLINE_LAST_MERGED_LOCAL_KEY.)
 *
 * On confirm success: clear local + write syncedServerTotal to the
 * server-merged row's totalGames + clearDeclinedPending.
 *
 * On reject: writeDeclinedPending(snapshot) so a same-visit re-entry
 * doesn't re-open the dialog for the same pending value (sessionStorage
 * lives until the tab is closed).
 */
export function HomeDialogMount() {
  const pathname = usePathname();
  const setStoreName = useGameStore((s) => s.setRoomName);
  const [open, setOpen] = useState<boolean>(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<number>(0);
  const [initialName, setInitialName] = useState<string>('');

  useEffect(() => {
    if (pathname !== '/') return;

    // BR-1 arm check. Consume-on-read: the marker survives exactly one
    // home landing, so a hard reload finds nothing and stays silent.
    if (consumeNavPrev() !== '/offline') return;

    const pending = pendingSyncCount();
    const declined = loadDeclinedPending();
    if (pending > declined && pending > 0) {
      const roomName = useGameStore.getState().roomName ?? '';
      // Mount-time external read (sessionStorage marker + localStorage
      // ledger) opening the dialog — same documented boundary pattern as
      // the five existing set-state-in-effect disables in components/.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingSnapshot(pending);
      setInitialName(roomName);
      // 案① a: 错峰开启 — 推迟到当前路由过渡 (150ms .page + 250ms root)
      // 结束后再 setOpen(true), 避免 SyncConfirmDialog 被烘进 root 快照,
      // 走 250ms UA 默认交叉淡化与旧页重合（'穿模' 缺陷）。BR-1 触发
      // 条件不变, 只动开启时机。afterViewTransition 600ms safety 上限
      // 防浏览器卡顿; 详见 lib/view-transition.ts。
      afterViewTransition(() => setOpen(true));
    }
  }, [pathname]);

  function handleReject(): void {
    // Snapshot the pending count the user just declined so the
    // sentinel blocks re-opening for the SAME value, but a fresh
    // game that pushes pending above the snapshot re-triggers the
    // dialog on the next home-return.
    writeDeclinedPending(pendingSnapshot);
    setOpen(false);
  }

  async function handleConfirm(name: string): Promise<void> {
    // SyncConfirmDialog has already completed the postRoomSession +
    // postMerge sequence and forwarded the merged row. The F1
    // baseline model (W4) sets the post-merge local baseline to 0,
    // the canonical value right after clearOfflineStats() runs.
    // pendingSyncCount() now reads this baseline, so the next
    // home-return has pending = local - 0 = local — the dialog
    // text "本机 N 局" always matches the data the next merge
    // would actually send.
    // W-RV P3 #11：清空三连是防御性的——SyncConfirmDialog.runMergeSequence
    // 已成功 postRoomSession + postMerge（服务端 row 已更新），并把
    // merged row forward 给本 hook；理论上前两步之一失败应该 throw
    // 而不让本函数执行。clearOfflineStats() / clearDeclinedPending()
    // 双调与 persistLastMergedLocal(0) 形成「post-merge local 必须
    // 干净」的不变量：合并后再开 dialog 只能由下次新离线局累加触发，
    // 不会因为残留 pendingSyncCount 让用户误以为还有未合并局。
    // 幂等 + 单点失败可恢复，保留。
    persistLastMergedLocal(0);
    clearOfflineStats();
    clearDeclinedPending();
    setOpen(false);
    // If the user just used the dialog to register a new room
    // (no prior roomName in store), mirror it so subsequent
    // navigation carries the new identity.
    if (name && !useGameStore.getState().roomName) {
      setStoreName(name);
    }
  }

  return (
    <SyncConfirmDialog
      open={open}
      pendingGamesCount={pendingSnapshot}
      initialName={initialName}
      onConfirm={handleConfirm}
      onReject={handleReject}
    />
  );
}
