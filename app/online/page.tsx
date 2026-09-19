import { ViewTransition } from 'react';
import Link from 'next/link';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/Button';
import { GameShell } from '@/components/GameShell';
import { PlayController } from '@/components/PlayController';
import { RestartButton } from '@/components/RestartButton';
import { ResultNavigator } from '@/components/ResultNavigator';

/**
 * W2 (ulw-room-migration-home-landing D-3) — online play page.
 *
 * Term adaptation: 标题 改「在线房间」(was 「游戏中」)；pass-and-play
 * 语义在文案「同设备对战」显形。ResultNavigator 已切到 `/result?room=`。
 *
 * The route is reachable only when the user has a roomName in
 * store + localStorage (StartGameButton + RoomGateMount blocks the
 * CTA otherwise). RoomGateMount writes the localStorage on success
 * before pushing /online, so by the time the page mounts the room
 * is in the store.
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
    </GameShell>
    </ViewTransition>
  );
}
