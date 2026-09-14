import { ViewTransition } from 'react';
import Link from 'next/link';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/Button';
import { GameShell } from '@/components/GameShell';
import { PlayController } from '@/components/PlayController';
import { RestartButton } from '@/components/RestartButton';
import { SoloResultInline } from '@/components/SoloResultInline';
import { SoloStatsPanel } from '@/components/SoloStatsPanel';

/**
 * Solo practice route. Composition only — the page is a Server Component
 * assembling the shared pieces: GameShell (header/card/footer), the mode-
 * aware PlayController driving a solo session, the Board, and the inline
 * ResultBanner that appears under the board on game over (solo never
 * navigates to /result — there is no lastWriteAt by contract). The solo
 * stats panel + local clear live in one card section below the board.
 */
export default function SoloPage() {
  return (
    <ViewTransition enter="page" exit="page" default="none">
    <GameShell
      title="单机练习"
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
      <div className="flex flex-col gap-4">
        <PlayController mode="solo">
          <Board />
          <SoloResultInline />
        </PlayController>
        <SoloStatsPanel />
      </div>
    </GameShell>
    </ViewTransition>
  );
}
