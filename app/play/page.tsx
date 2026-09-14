import Link from 'next/link';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/Button';
import { GameShell } from '@/components/GameShell';
import { PlayController } from '@/components/PlayController';
import { RestartButton } from '@/components/RestartButton';

export default function PlayPage() {
  return (
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
    </GameShell>
  );
}
