import { ViewTransition } from 'react';
import { SoundToggle } from '@/components/SoundToggle';
import { StartGameButton } from '@/components/StartGameButton';
import { OnlineStatsCard } from '@/components/OnlineStatsCard';
import { PlayerNameForm } from '@/components/PlayerNameForm';
import { HomeDialogMount } from '@/components/HomeDialogMount';
import { serializeHomeJsonLd } from '@/lib/home-jsonld';

export const dynamic = 'force-dynamic';

/**
 * W3 (ulw-one-game-two-versions) home page rendering.
 *
 * The page is the project's 展示页: a hero (title + 一句话价值) +
 * 双入口 CTA 按用户意图命名 + identity region (folded) + online
 * stats card (read-only) + merged home-return sync dialog. A
 * schema.org JSON-LD block (next to the body) declares the surface
 * as VideoGame + WebApplication for crawlers + AI aggregators —
 * `playMode: MultiPlayer` + `numberOfPlayers(min:1, max:2)` tell
 * search engines this is a two-player board game playable in a
 * browser. Plan §1 / AC A8.
 *
 * The hero copy follows the design intent (ulw-one-game-two-versions
 * §0): the H1 names the brand (井字棋), the subline states the value
 * (两人同设备轮流下，自动记录战绩), and the CTA labels carry the
 * distinction between offline (离线可玩 · 本地记账) and online
 * (战绩实时云端) modes. The RSC/SPA technical split is the 次级
 * 文案 in the page-fade paragraph below the CTAs so the surface
 * stays user-intent-first and 技术实现 is supporting context.
 *
 * Public ledger + ResetStatsButton(scope='ranked') Card retired in
 * W1 (id=1, name=NULL 全行族). OnlineStatsCard replaces the
 * retired surface with the same visual slot (no layout shift
 * between empty + populated states per W3 contract).
 */
export default async function HomePage() {
  return (
    <ViewTransition enter="page" exit="page" default="none">
    {/* JSON-LD: escape `<` per Next.js 16 docs to prevent XSS via
        stringified schema fields that may carry user-controlled text.
        Payload is defined in lib/home-jsonld.ts (test seam). */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeHomeJsonLd() }}
    />
    <main className="page-shell page-fade-in" data-testid="home-page">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-display font-display font-semibold tracking-tight">
            井字棋
          </h1>
          <SoundToggle />
        </div>
        <p className="text-body text-text-secondary">
          两人同设备轮流下，自动记录战绩。
        </p>
      </header>

      <OnlineStatsCard />

      <PlayerNameForm />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center" data-testid="home-cta-row">
        <StartGameButton
          href="/offline"
          label="单机练习 · 离线可玩 · 本地记账"
          mode="offline"
          variant="secondary"
          testid="start-offline"
          requireName={false}
        />
        <StartGameButton
          href="/online"
          label="在线对战 · 战绩实时云端"
          mode="online"
          variant="primary"
          testid="start-online"
          requireName
        />
      </div>

      <p className="text-small text-text-muted" data-testid="home-cta-subtext">
        离线版基于 React 单页应用（SPA）；在线版基于 RSC，完局后服务端权威累加战绩。
      </p>

      <HomeDialogMount />
    </main>
    </ViewTransition>
  );
}
