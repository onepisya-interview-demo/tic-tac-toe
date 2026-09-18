import { ViewTransition } from 'react';
import { SoundToggle } from '@/components/SoundToggle';
import { StartGameButton } from '@/components/StartGameButton';
import { OnlineStatsCard } from '@/components/OnlineStatsCard';
import { HomeDialogMount } from '@/components/HomeDialogMount';

export const dynamic = 'force-dynamic';

/**
 * W1 home page (intermediate).
 *
 * The ranked public ledger (id=1, name=NULL) is retired along with the
 * /api/stats chain, so the legacy "公共战绩 + 公共卡 + 重置公共战绩" Card
 * is gone. W3 will rebuild this surface as a 展示页 (hero + 双入口 CTA +
 * 身份区 + 线上战绩卡 + 合并弹框, schema.org JSON-LD).
 *
 * For W1's intermediate state, the home page renders the minimum
 * surface that does not depend on the retired ledger:
 *  - 标题 + SoundToggle
 *  - 线上战绩卡 (OnlineStatsCard; reads /api/solo-stats?name=...)
 *  - 双入口 CTA (online + offline; pending W3/W4 route rename)
 *  - 合并弹框挂载 (HomeDialogMount)
 */
export default async function HomePage() {
  return (
    <ViewTransition enter="page" exit="page" default="none">
    <main className="page-shell page-fade-in">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-display font-display font-semibold tracking-tight">井字棋</h1>
          <SoundToggle />
        </div>
        <p className="text-body text-text-secondary">
          两人同设备轮流下，自动记录战绩。
        </p>
      </header>

      <OnlineStatsCard />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <StartGameButton href="/play" label="开始对战" mode="online" variant="primary" testid="start-game" />
        <StartGameButton href="/solo" label="单机练习" mode="offline" variant="secondary" testid="start-solo" />
      </div>

      <HomeDialogMount />
    </main>
    </ViewTransition>
  );
}
