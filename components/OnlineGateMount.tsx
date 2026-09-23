'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoomGateDialog } from '@/components/RoomGateDialog';
import { useGameStore } from '@/lib/store';
import { getRoomName } from '@/lib/room-name';
import { afterViewTransition } from '@/lib/view-transition';

/**
 * OnlineGateMount (ulw-result-win-celebration W-A2, D-4) — the
 * /online direct-entry gate.
 *
 * Background (plan §0.4, measured): hard-loading /online bypasses the
 * home-page gate entirely. The identity bootstrap lived only in
 * RoomGateMount (home page), so the store booted with roomName=null
 * while PlayController's mount effect auto-started the game. The board
 * was playable but the online win path hit two guards at once:
 * makeMove's anonymous-online bookkeeping guard (zero stats write) and
 * ResultNavigator's empty-name guard (no navigation) — a win produced
 * zero feedback of any kind.
 *
 * Two responsibilities, mirroring RoomGateMount's home-page contract
 * (source of the "same-origin bootstrap logic" phrasing in plan §2):
 *
 * (a) **Mount-time identity bootstrap** — identical shape to
 *     RoomGateMount effect (a): when the store has no roomName, read
 *     localStorage via getRoomName() (whose read side-effect sweeps
 *     the legacy `ttt.player.name.v1` key, D-4) and mirror a non-null
 *     value into the store. A named visitor becomes fully playable:
 *     makeMove sees the room, the outcome POST fires, and
 *     ResultNavigator pushes /result?room=.
 *
 * (b) **No-name gate** — when neither the store nor localStorage has
 *     a room name, open the RoomGateDialog right here (no
 *     `ttt:room-required` indirection: the page itself is the thing
 *     that requires a room). The dialog's native showModal() makes
 *     the board behind it inert, so an anonymous visitor cannot play
 *     a silent game. This extends the "online requires a room"
 *     contract from the home-page CTA to the page itself.
 *
 * Confirm/reject semantics:
 *  - onConfirm mirrors RoomGateMount.handleConfirm: setRoomName
 *    (localStorage + store mirror) → startGame('online') (fresh
 *    randomized board — the dialog opened over a pre-started board,
 *    so the confirmed room gets its own game) → router.push('/online')
 *    (same-route push is a harmless no-op, kept for parity).
 *  - onReject intentionally does NOT close the dialog. On the home
 *    page "取消" lands the user on a page with no game context; here
 *    it would expose an anonymous, silently-unrecorded board — the
 *    exact anti-silent-create hole this gate exists to close. The
 *    dialog stays open (ESC included: the component preventDefaults
 *    the native cancel) until the visitor either creates/enters a
 *    room or leaves via the page's 返回首页 link. Zero RoomGateDialog
 *    source changes — the component's cancel contract is "notify the
 *    host"; the host decides what rejection means.
 *
 * SSR/hydration discipline: the first server frame renders the dialog
 * closed (open=false); localStorage is only touched inside the mount
 * effect (AGENTS.md 反模式: SSR 首帧禁读 localStorage).
 *
 * Soft-nav path (/result「再来一局」→ /online): the store singleton
 * carries roomName across the navigation, so effect (a) is a no-op
 * and the dialog never opens. Hard reload: fresh store (phase='idle',
 * roomName=null); PlayController auto-starts 'online' (idle branch)
 * and this mount hydrates the name right after — by the time a human
 * can click a cell the room is in place.
 */
export function OnlineGateMount() {
  const router = useRouter();
  const setStoreName = useGameStore((s) => s.setRoomName);
  const startGame = useGameStore((s) => s.startGame);
  const storeRoomName = useGameStore((s) => s.roomName);
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    const current = useGameStore.getState().roomName;
    if (current) return; // soft-nav path: store already carries the room
    const stored = getRoomName();
    if (stored) {
      // Named hard-load: mirror localStorage → store (idempotent
      // write + legacy sweep inside). PlayController's mount effect
      // has already (or is about to) startGame('online'); the room
      // is in place before any human-speed move.
      setStoreName(stored);
      return;
    }
    // No name anywhere: the page itself requires a room — open the
    // gate in place. showModal() keeps the board inert behind it.
    // Mount-once decision (same shape as RoomGateDialog's open-sync
    // effect); not a cascading-render hazard. 案① b: 与 home→online
    // 路由过渡同窗, 错峰开启防 '穿模'。callback 内的 setOpen 是
    // effect 同步路径, 同五处已有 set-state-in-effect 边界处理。
    afterViewTransition(
      () => setOpen(true),
    );
  }, [setStoreName]);

  async function handleConfirm(room: string): Promise<void> {
    // Persist ONLY after the dialog's POST succeeded (the dialog owns
    // postRoomSession); same order as RoomGateMount.handleConfirm:
    // localStorage + store mirror, then a fresh game, then the nav.
    setStoreName(room);
    startGame('online');
    setOpen(false);
    // W-RV P3 #5：/online → /online 同路由 push 是 no-op（next/router
    // 不会重新触发导航），但保留是为与 RoomGateMount.handleConfirm
    // 路径对齐（参见 components/RoomGateMount.tsx handleConfirm 的
    // `router.push(href)` 调用——pendingNav.href 可能指向任意路由，
    // 含 /online 同路由；删掉会让两个 mount 行为不一致）。fire-and-forget
    // 是 next/router 的契约，无 await；失败时弹框已关，UI 已切到
    // playing phase，副作用无。
    router.push('/online');
  }

  // Intentionally a no-op: see header. The gate does not yield.
  function handleReject(): void {
    // no-close: rejection must not expose the anonymous board.
  }

  // initialName: the dialog only opens when the store has no name, so
  // the pre-fill is empty in practice; the store mirror keeps the
  // prop honest if the dialog is ever open while a name exists.
  return (
    <RoomGateDialog
      open={open}
      initialName={storeRoomName ?? ''}
      onConfirm={handleConfirm}
      onReject={handleReject}
    />
  );
}
