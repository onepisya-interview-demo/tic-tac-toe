import Link from 'next/link';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SoundToggle } from '@/components/SoundToggle';
import { PlayController } from '@/components/PlayController';
import { StatusBarClient } from '@/components/StatusBarClient';
import { RestartButton } from '@/components/RestartButton';

export default function PlayPage() {
  return (
    <main className="page-shell page-fade-in">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-h1 font-display font-semibold">游戏中</h1>
          <SoundToggle />
        </div>
        <StatusBarClient />
      </header>

      <Card>
        <PlayController>
          <Board />
        </PlayController>
      </Card>

      <div className="flex flex-row gap-3">
        <Link href="/" className="flex-1">
          <Button variant="secondary" className="w-full">
            返回首页
          </Button>
        </Link>
        <RestartButton />
      </div>
    </main>
  );
}
