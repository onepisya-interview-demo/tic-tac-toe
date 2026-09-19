import { ViewTransition } from 'react';
import { SoundToggle } from '@/components/SoundToggle';
import { StartGameButton } from '@/components/StartGameButton';
import { HomeDialogMount } from '@/components/HomeDialogMount';
import { HomeStatsEntry } from '@/components/HomeStatsEntry';
import { RoomGateMount } from '@/components/RoomGateMount';
import { serializeHomeJsonLd } from '@/lib/home-jsonld';

export const dynamic = 'force-dynamic';

/**
 * W2 (ulw-room-migration-home-landing D-1 / D-2 / D-3) home page
 * rendering — 引导页形态.
 *
 * The home page is the project's 引导页:
 *   - hero (brand + 一句话价值主张)
 *   - 玩法引导区 (纯 RSC 静态：轮流落子 · 三连即胜 · 同设备对战)
 *   - 双 CTA (线下房间直行 / 在线房间无名弹 RoomGateDialog)
 *   - 战绩静态入口 (有 roomName → 「查看 <room> 的战绩 →」去
 *     /result?room=；无名不渲染 — 见 HomeStatsEntry)
 *   - HomeDialogMount (保留：合并弹框，文案房间化)
 *   - RoomGateMount (新挂载：监听 ttt:room-required)
 *   - JSON-LD / SoundToggle / ViewTransition / force-dynamic
 *
 * Removed surfaces (W2 退役):
 *   - OnlineStatsCard (was the home-page identity region)
 *   - PlayerNameForm (home 常驻收名表单)
 * 首页零 /api/* 请求 (A1 红线)；战绩主场归 /result。
 *
 * 文案红线 (A9): 用户可见文案零「玩家名/注册/登录」；统一「房间
 * 名/创建房间/进入房间」。/online 与 /offline 页内文案注明「同设
 * 备对战」(pass-and-play 语义)。
 *
 * One-screen budget (one-screen-qa): 375×667 viewport fits the
 * entire home page in a single screen — confirmed by visual-qa.mjs.
 */
export default function HomePage() {
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
          同设备轮流下，自动记录战绩。
        </p>
      </header>

      <section
        className="flex flex-col gap-2"
        data-testid="home-howto"
        aria-label="玩法说明"
      >
        <h2 className="text-h3 font-display font-medium">玩法</h2>
        <ul className="list-disc pl-5 text-body text-text-secondary marker:text-text-muted">
          <li data-testid="home-howto-turn">
            轮流落子：X 先手，然后 O。
          </li>
          <li data-testid="home-howto-win">
            三连即胜：横、竖、对角任一行先连成三个相同符号。
          </li>
          <li data-testid="home-howto-pass">
            同设备对战：两人轮流在同一台设备上下棋（pass-and-play）。
          </li>
        </ul>
      </section>

      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        data-testid="home-cta-row"
      >
        <StartGameButton
          href="/offline"
          label="线下房间 · 同设备对战 · 本地记账"
          mode="offline"
          variant="secondary"
          testid="start-offline"
          requireName={false}
        />
        <StartGameButton
          href="/online"
          label="在线房间 · 同设备对战 · 战绩云端"
          mode="online"
          variant="primary"
          testid="start-online"
          requireName
        />
      </div>

      <p className="text-small text-text-muted" data-testid="home-cta-subtext">
        线下版基于 React 单页应用（SPA）；在线版基于 RSC，完局后服务端权威累加战绩。
      </p>

      <HomeStatsEntry />

      <HomeDialogMount />
      <RoomGateMount />
    </main>
    </ViewTransition>
  );
}
