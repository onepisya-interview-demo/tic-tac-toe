// sync-qa.mjs — DISABLED for W2 (ulw-name-login-one-truth).
//
// Why disabled: the panel mounted on /solo no longer carries the
// 「同步」 button / SyncConfirmDialog / 「合并并清空」 / 「保留本地」
// affordances — they were retired in W2 as part of the
// 「solo 页纯净化」 wave. The probe's assertions depend on
// data-testid="solo-sync" and "sync-confirm-dialog" which no longer
// exist on the /solo surface.
//
// Coverage migration plan:
//   - sync-qa step 01 "unnamed-solo-zero-network"    → subsumed by
//     pure-local-qa (A1) which now explicitly asserts zero /api/ requests
//     in both named and unnamed paths.
//   - sync-qa step 02 "home-save-player-name"       → moves to the W3
//     home-return-qa probe which exercises the renamed
//     PlayerNameForm (注册/登录 语义) under the new W3 contract.
//   - sync-qa step 02.5 "save-only-immediate-server-row" → W3 home-return-qa.
//   - sync-qa step 03 "named-solo-game-roundtrip"   → retired (named+sync
//     no longer supported on /solo).
//   - sync-qa step 04 "different-device-pulls-same-row" → W3 home-return-qa
//     (cross-device read-only surface moves to /).
//   - sync-qa step 04b "save-only-cross-device-pull" → W3 home-return-qa.
//   - sync-qa step 05 "manual-sync-button"           → retired; sync button
//     no longer on /solo.
//
// Re-enable only when W3 ships the home-page replacement probe.

import { ensureDir, writeQaLog } from "./lib/evidence.mjs";

const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/sync-qa";
await ensureDir(EVIDENCE);
await writeQaLog(EVIDENCE, {
  test: "sync-qa",
  status: "DISABLED",
  reason: "W2 retired /solo sync affordances — see header comment",
  findings: [],
});
console.log("sync-qa DISABLED (W2 纯净化；W3 home-return-qa 重建)");
process.exit(0);
