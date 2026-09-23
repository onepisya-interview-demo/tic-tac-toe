'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/store';

/**
 * Home-page stats static entry
 * (ulw-room-migration-home-landing W2 D-1).
 *
 * Renders "查看房间 <room> 的战绩 →" only when the user has a
 * persisted roomName in the store. No fetch on mount, no
 * localStorage read on the server frame (the page is a Server
 * Component; the entry defers the store read to the client where
 * the Zustand module singleton + localStorage hydration surface
 * the right value).
 *
 * testid contract: `home-stats-entry` (whole block) +
 * `home-stats-link` (anchor) for QA probes. The link wraps the
 * room name in a <span class="font-mono"> so visual QA can spot
 * non-ASCII room names cleanly.
 */
export function HomeStatsEntry() {
  const roomName = useGameStore((s) => s.roomName);
  if (!roomName) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="home-stats-entry">
      <Link
        href={`/result?room=${encodeURIComponent(roomName)}`}
        className="text-small text-text-secondary underline underline-offset-2 hover:text-text-primary"
        data-testid="home-stats-link"
      >
        查看房间 <span className="font-mono">{roomName}</span> 的战绩 →
      </Link>
    </div>
  );
}
