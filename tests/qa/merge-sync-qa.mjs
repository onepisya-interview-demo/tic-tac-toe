// merge-sync-qa.mjs — DISABLED for W2 (ulw-name-login-one-truth).
//
// Why disabled: /solo no longer renders the 「同步」 button or
// SyncConfirmDialog (W2 纯净化 wave). All probe steps depend on
// data-testid="solo-sync" and "sync-confirm-dialog", which have
// been removed from the /solo surface. POST /api/solo-stats/sync
// is preserved at the endpoint layer (StartGameButton is still the
// sole caller pending W3) but the UI surface to drive a merge
// from /solo is gone.
//
// Coverage migration plan: W3 ships home-return-qa.mjs which
// exercises StartGameButton's intercept (pendingSyncCount>0 →
// SyncConfirmDialog → 「合并并清空」/「保留本地」) from the home
// page — the only place that surface lives now.
//
// Re-enable only when the home-return-qa path is live in W3.

import { ensureDir, writeQaLog } from "./lib/evidence.mjs";

const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/merge-sync-qa";
await ensureDir(EVIDENCE);
await writeQaLog(EVIDENCE, {
  test: "merge-sync-qa",
  status: "DISABLED",
  reason: "W2 retired /solo sync affordances — see header comment",
  findings: [],
});
console.log("merge-sync-qa DISABLED (W2 纯净化；W3 home-return-qa 重建)");
process.exit(0);
