'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameStore, type GameMode } from '@/lib/store';
import { Button } from '@/components/ui/Button';

type Props = {
  /** Navigation target: /online for online, /offline for offline. */
  href: string;
  /** Visible CTA label. */
  label: string;
  /** Mode handed to startGame() on click; omitted resolves to 'online'. */
  mode?: GameMode;
  /** Button variant: primary (main CTA) or secondary (alternate CTA). */
  variant?: 'primary' | 'secondary';
  /** Stable QA testid — the click contract for every probe. */
  testid: string;
  /**
   * W2 (ulw-room-migration-home-landing D-2): when true (default for
   * online CTA), the button blocks navigation while
   * `useGameStore.roomName` is empty. The click handler:
   *   - preventDefault (no nav).
   *   - dispatch a `ttt:room-required` window event so
   *     RoomGateMount can open the gate dialog. Detail carries
   *     { mode, href } so the dialog knows where to navigate and
   *     which mode to start.
   *   - skip startGame() + router.push entirely.
   * When false (offline CTA), the click handler is the pure-local
   * contract: preventDefault → startGame(mode) → router.push.
   *
   * The default is `true` because the online mode requires a room
   * (AC A4 — anonymous-online is rejected by the server's
   * recordOutcomeForRoom 404 anti-silent-create contract). Offline
   * mode does not require a name (offline pure-local, anonymous).
   */
  requireName?: boolean;
};

/**
 * W2 (ulw-room-migration-home-landing) — rename + online entry gate:
 *
 * - `roomName` instead of `playerName` (the W2 symbol swap; the
 *   `playerName` spelling is retired).
 * - The `requireName` prop (default true) gates the online CTA.
 *   Empty roomName + click → no nav, dispatch a `ttt:room-required`
 *   event so RoomGateMount opens the gate. With a name →
 *   startGame('online') → router.push('/online').
 * - Offline CTA passes `requireName={false}` so the W2 pure-local
 *   contract stays intact.
 *
 * The `ttt:room-required` event is intentionally a window CustomEvent
 * (not a Zustand selector) so RoomGateMount is the single owner of
 * the dialog lifecycle without coupling the StartGameButton to the
 * dialog's internals. The event detail is `{ mode, href }`;
 * subscribers (RoomGateMount) use them directly.
 */
const ROOM_REQUIRED_EVENT = 'ttt:room-required';

export function StartGameButton({
  href,
  label,
  mode,
  variant = 'primary',
  testid,
  requireName = true,
}: Props) {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);
  const roomName = useGameStore((s) => s.roomName);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    e.preventDefault();
    if (requireName && (roomName === null || roomName === '')) {
      // A4 前置: 无名点 online 不导航、不调用 startGame,
      // 派发事件让 RoomGateMount 自己开弹框 + 收名 + 后续导航。
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(ROOM_REQUIRED_EVENT, {
            detail: { mode: mode ?? 'online', href },
          }),
        );
      }
      return;
    }
    startGame(mode);
    router.push(href);
  }

  return (
    <Link href={href} className="flex-1" onClick={handleClick} data-testid={testid}>
      <Button variant={variant} className="w-full">
        {label}
      </Button>
    </Link>
  );
}
