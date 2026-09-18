import { ViewTransition } from 'react';
import Link from 'next/link';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/Button';
import { GameShell } from '@/components/GameShell';
import { PlayController } from '@/components/PlayController';
import { RestartButton } from '@/components/RestartButton';
import { ResultNavigator } from '@/components/ResultNavigator';

export default function PlayPage() {
  return (
    <ViewTransition enter="page" exit="page" default="none">
    <GameShell
      title="游戏中"
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
      {/* W3 (ulw-one-game-two-versions A5): online mode pushes
          /result?name=... on win/draw; offline mode keeps the
          existing in-page auto-switch flow on /offline. Mounting
          the navigator inside /play keeps the prop simple (we
          always pass mode='online' here) and lets the navigator
          ride along with the store lifecycle. */}
      <ResultNavigator mode="online" />
    </GameShell>
    </ViewTransition>
  );
}
