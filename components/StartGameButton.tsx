'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameStore, type GameMode } from '@/lib/store';
import { Button } from '@/components/ui/Button';

type Props = {
  /** Navigation target: /play for online, /solo for offline. */
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
   * W3 (ulw-one-game-two-versions A4 前置): when true (default for
   * online CTA), the button blocks navigation while
   * `useGameStore.playerName` is empty. The click handler:
   *   - preventDefault (no nav).
   *   - dispatch a `ttt:player-name-required` window event so the
   *     identity region can scroll into view + focus its input +
   *     surface an inline nudge.
   *   - skip startGame() + router.push entirely.
   * When false (offline CTA), the click handler is the W1 contract:
   *   preventDefault → startGame(mode) → router.push.
   *
   * The default is `true` because the online mode requires a name
   * (AC A4 — anonymous-online is rejected by the server's
   * recordOutcomeForName 404 anti-silent-create contract). Offline
   * mode does not require a name (offline pure-local, anonymous).
   */
  requireName?: boolean;
};

/**
 * W3 (ulw-one-game-two-versions) rename + online entry gate:
 *
 * - mode: `'online'|'offline'` (already W1).
 * - Testid + label + href keep targeting the current /play + /solo
 *   routes; W4 rewires /play → /online and /solo → /offline per the
 *   plan §1.
 * - The new `requireName` prop (default true) gates the online CTA.
 *   Empty playerName + click → no nav, dispatch a
 *   `ttt:player-name-required` event so the PlayerNameForm (or its
 *   parent) can focus the input. With a name → startGame('online')
 *   → router.push('/play').
 * - Offline CTA passes `requireName={false}` so W2's "无身份可玩
 *   solo" contract stays intact.
 *
 * The `ttt:player-name-required` event is intentionally a window
 * CustomEvent (not a Zustand selector) so the PlayerNameForm can be
 * the single owner of focus / inline-nudge UI without coupling the
 * StartGameButton to the identity region's internals. The event
 * detail is empty; subscribers can read store state if needed.
 */
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
  const playerName = useGameStore((s) => s.playerName);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    e.preventDefault();
    if (requireName && (playerName === null || playerName === '')) {
      // A4 前置: 无名点击 online 不导航、不调用 startGame,
      // 派发事件让身份区自己聚焦 + 提示。冒泡到 window, 任意订阅者
      // (PlayerNameForm 自身的 useEffect 监听) 可响应。
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ttt:player-name-required'));
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
