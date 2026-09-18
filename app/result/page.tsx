import { ViewTransition } from 'react';
import { SoundToggle } from '@/components/SoundToggle';
import { ResultBanner } from '@/components/ResultBanner';
import { ResultActions } from '@/components/ResultActions';

export const dynamic = 'force-dynamic';

/**
 * W1 /result page (intermediate).
 *
 * The ranked public ledger (id=1, name=NULL) is retired along with the
 * /api/stats chain, so the legacy StatsGrid (公共战绩数字) Card is
 * gone. W3 will rebuild /result as an RSC reading the per-name row:
 *   - `await loadSoloRecord(name)` → `await recordOutcome` → upsert
 *     (server-side authoritative accumulation)
 *   - render real-time ResultBanner + StatsGrid
 *
 * For W1's intermediate state, the /result page renders just the
 * banner (which reads its own state from the store) and the
 * play-again / back-home actions. No ranked ledger is shown.
 */
export default async function ResultPage() {
  return (
    <ViewTransition enter="page" exit="page" default="none">
    <main className="page-shell page-fade-in">
      <header className="flex flex-row items-center justify-between gap-3 relative">
        <ResultBanner headingLevel={1} />
        <SoundToggle />
      </header>

      <ResultActions />
    </main>
    </ViewTransition>
  );
}
