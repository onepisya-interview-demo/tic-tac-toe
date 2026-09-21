import { ViewTransition } from 'react';
import Link from 'next/link';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/Button';
import { GameShell } from '@/components/GameShell';
import { OnlineGateMount } from '@/components/OnlineGateMount';
import { PlayController } from '@/components/PlayController';
import { RestartButton } from '@/components/RestartButton';
import { ResultNavigator } from '@/components/ResultNavigator';

/**
 * W2 (ulw-room-migration-home-landing D-3) — online play page.
 *
 * Term adaptation: 标题 改「在线房间」(was 「游戏中」)；pass-and-play
 * 语义在文案「同设备对战」显形。ResultNavigator 已切到 `/result?room=`。
 *
 * Entry paths (W-A2, ulw-result-win-celebration D-4):
 *  - Home gate (StartGameButton + RoomGateMount): the dialog writes
 *    localStorage before pushing /online, so the room is in the store
 *    by the time the page mounts.
 *  - Direct hard-load (bookmark / refresh / shared URL): used to boot
 *    with roomName=null (bootstrap lived only on the home page), which
 *    made a win produce zero feedback. OnlineGateMount now closes that
 *    hole on this page: named visitors get the localStorage → store
 *    bootstrap (same-origin logic as RoomGateMount, legacy sweep
 *    included); anonymous visitors get the RoomGateDialog opened
 *    in place (native showModal keeps the board inert — no silent
 *    anonymous games).
 *  - Soft-nav from /result「再来一局」: the store singleton carries
 *    the room across, so the gate is a no-op.
 */
export default function PlayPage() {
  return (
    <ViewTransition enter="page" exit="page" default="none">
    <GameShell
      title="在线房间"
      actions={
        <>
          <Link href="/" className="flex-1">
            <Button variant="secondary" className="w-full">
              返回首页
            </Button>
          </Link>
          <RestartButton />
        </>
      }
    >
      <PlayController>
        <Board />
      </PlayController>
      <ResultNavigator mode="online" />
      <OnlineGateMount />
    </GameShell>
    </ViewTransition>
  );
}
