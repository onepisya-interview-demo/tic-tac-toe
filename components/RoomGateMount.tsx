'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoomGateDialog } from '@/components/RoomGateDialog';
import { useGameStore, type GameMode } from '@/lib/store';
import { getRoomName } from '@/lib/room-name';

/**
 * RoomGateMount (ulw-room-migration-home-landing W2 D-2 + W2-rework):
 *
 * Two responsibilities on the home page:
 *
 * (a) **Mount-time identity bootstrap** — single mount-period
 *     hydration point for the room name. The pre-W2 PlayerNameForm
 *     owned this side-effect via its reverse-hydration useEffect
 *     (localStorage → store mirror). W2 deleted PlayerNameForm but
 *     left the hydration implicit in nothing — causing Q6/A7
 *     (legacy ttt.player.name.v1 never swept), A2 (hard reload →
 *     home-stats-entry not rendered), and the §2.2 named-user
 *     regression (online CTA opens the gate when it shouldn't).
 *     This mount effect fixes all three by calling getRoomName()
 *     exactly once: the read sweeps the legacy key (D-4) AND
 *     returns the trimmed canonical PK; when the store is empty
 *     and the read is non-null we mirror the value into the store.
 *     The sweep is idempotent and survives re-mounts.
 *
 * (b) **Dialog dispatch listener** — listens for `ttt:room-required`
 *     window events (dispatched by StartGameButton when the online
 *     CTA is clicked and store.roomName is null) and opens the
 *     RoomGateDialog. The event detail carries `{ mode, href }` so
 *     the dialog's onConfirm knows where to navigate and which mode
 *     to start.
 *
 * The hydration runs once per mount; no ambient network calls
 * (D-1 contract: home page = hero + guidance + CTAs + static
 * entry; nothing else auto-fires on mount). The two effects are
 * separate so the hydration is idempotent even if the event
 * subscription re-binds.
 *
 * Race-safety: the dialog's localStorage write happens AFTER the
 * server returns success, so a transient network failure leaves
 * the user without a name (the dialog shows an inline error and
 * keeps the typed value for retry — R4/R6/R9 branches).
 */

interface RoomRequiredDetail {
  mode: GameMode;
  href: string;
}

const ROOM_REQUIRED_EVENT = 'ttt:room-required';

function isRoomRequiredDetail(value: unknown): value is RoomRequiredDetail {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { mode?: unknown; href?: unknown };
  return (
    (v.mode === 'online' || v.mode === 'offline') &&
    typeof v.href === 'string'
  );
}

export function RoomGateMount() {
  const router = useRouter();
  const setStoreName = useGameStore((s) => s.setRoomName);
  const startGame = useGameStore((s) => s.startGame);
  const storeRoomName = useGameStore((s) => s.roomName);
  const [open, setOpen] = useState<boolean>(false);
  const [initialName, setInitialName] = useState<string>('');
  // Pending navigation: the next startGame + router.push we owe the
  // dialog's confirm branch. Captured at dispatch time so a
  // mid-flight mode change can't sneak in.
  const [pendingNav, setPendingNav] = useState<RoomRequiredDetail | null>(
    null,
  );

  // (a) Mount-time identity bootstrap. Single mount-period hydration
  // point — see file header. The read fires cleanupLegacyPlayerNameKey
  // via getRoomName's side-effect, so a pre-migration browser loses
  // its `ttt.player.name.v1` on first mount.
  useEffect(() => {
    const current = useGameStore.getState().roomName;
    if (current) return; // store already populated — nothing to do
    const stored = getRoomName();
    if (stored) {
      // setRoomName writes localStorage (idempotent — already there)
      // and clears legacy (idempotent — already swept). The key
      // surface is the store mirror: from this point on
      // HomeStatsEntry renders and StartGameButton's requireName
      // gate sees the value.
      setStoreName(stored);
    }
  }, [setStoreName]);

  // (b) Dialog dispatch listener.
  useEffect(() => {
    function onRequired(event: Event): void {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isRoomRequiredDetail(detail)) return;
      // Pre-fill the input with the current room name so a returning
      // user sees their room. They can still edit (e.g. to enter a
      // different room).
      const current = useGameStore.getState().roomName ?? '';
      setInitialName(current);
      setPendingNav({ mode: detail.mode, href: detail.href });
      setOpen(true);
    }
    window.addEventListener(ROOM_REQUIRED_EVENT, onRequired);
    return () => {
      window.removeEventListener(ROOM_REQUIRED_EVENT, onRequired);
    };
  }, []);

  async function handleConfirm(
    room: string,
    existed: boolean,
  ): Promise<void> {
    // Persist ONLY on success: localStorage first (reload safety) then
    // the store mirror (same-tick UI).
    setStoreName(room);
    if (pendingNav) {
      startGame(pendingNav.mode);
      const href = pendingNav.href;
      // Reset pending state BEFORE pushing so a fast reopen does not
      // see stale nav.
      setPendingNav(null);
      setOpen(false);
      router.push(href);
      // No await on router.push — the dialog stays closed either way
      // and the navigation is a fire-and-forget; the existing
      // PlayController mount-stale-reset (ulw-result-play-again-loop
      // F1) handles whatever residual board state the store has.
      return;
    }
    // Defensive: no pending nav (e.g. dialog opened via direct call).
    setOpen(false);
    // `existed` is currently unused here — kept in the callback shape
    // for future toast / status surface. Lint appeasement.
    void existed;
  }

  function handleReject(): void {
    setPendingNav(null);
    setOpen(false);
  }

  // Mirror the store's room name into the input on each open so a
  // user who already has a room sees it pre-filled (the input
  // effect inside the dialog also handles this; we pass initialName
  // as a stable seed). storeRoomName is referenced for symmetry /
  // future use — the input effect inside the dialog owns the actual
  // value sync.
  void storeRoomName;

  return (
    <RoomGateDialog
      open={open}
      initialName={initialName}
      onConfirm={handleConfirm}
      onReject={handleReject}
    />
  );
}
