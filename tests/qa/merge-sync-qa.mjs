// merge-sync-qa.mjs — DISABLED for W2 + W3 (ulw-name-login-one-truth).
//
// Why disabled: /solo no longer renders the 「同步」 button or
// SyncConfirmDialog (W2 纯净化 wave). All probe steps depend on
// data-testid="offline-sync" and "sync-confirm-dialog", which have
// been removed from the /offline surface. POST /api/offline-stats/sync
// is preserved at the endpoint layer (StartGameButton is still the
// sole caller pending W3) but the UI surface to drive a merge
// from /offline is gone.
//
// Coverage migration plan (W3 final): StartGameButton's intercept
// is gone (Decision D1 retired it). The home-return SyncConfirmDialog
// is mounted by HomeDialogMount on the home page itself, triggered
// when pendingSyncCount() > declinedSentinel (see SessionStorage
// ttt.offline.sync-declined.v1). The "merge + clear" sequence is
// exercised by home-return-qa.mjs; this probe is retired alongside
// the StartGameButton intercept path.
//
// Re-enable only when /solo or another route regains a sync
// affordance that exercises the merge surface outside the
// home-return dialog flow.

import { ensureDir, writeQaLog } from "./lib/evidence.mjs";

const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/merge-sync-qa";
await ensureDir(EVIDENCE);
await writeQaLog(EVIDENCE, {
  test: "merge-sync-qa",
  status: "DISABLED",
  reason: "W2 retired /offline sync affordances — see header comment",
  findings: [],
});
console.log("merge-sync-qa DISABLED (W2 纯净化 + W3 home-return-qa 承接 — 头部注释见上)");
process.exit(0);
