#!/usr/bin/env node
// stats-race-qa.mjs — RETIRED by W1 (ulw-one-game-two-versions).
//
// W1 retired the /api/stats chain (route.ts + outcome/route.ts) along
// with components/StatsHydrator.tsx + store.lastWriteAt. The probe's
// three coverage axes (B-1 SW double-PUT, B-2 PlayController setTimeout
// race, B-3 RSC static prerender) all relied on a ranked public ledger
// that no longer exists. W3 will rewrite the home page around a
// per-name RSC (`/result` reads the per-name row), and W4's
// one-identity-qa probe covers the new contract end-to-end.
//
// This file is kept in tests/qa/ as a retired-probe sentinel so:
//  1. anyone running `node tests/qa/stats-race-qa.mjs` sees the
//     explicit retire reason instead of an unexplained 404 / fail,
//  2. the file path stays reserved for future regression (if a new
//     stats race surfaces, the probe can be re-implemented here).
//
// Exit code 0 + clear stdout message: this is a retirement note, not
// a failure. CI does not gate on this file.

console.log(
  "\nstats-race-qa.mjs — RETIRED by W1 (ulw-one-game-two-versions §3 W1)\n" +
    "  - /api/stats chain (route.ts + outcome/route.ts) deleted\n" +
    "  - components/StatsHydrator.tsx + store.lastWriteAt removed\n" +
    "  - ranked public ledger (id=1, name=NULL) retired\n" +
    "  - B-1/B-2/B-3 race surfaces no longer applicable\n" +
    "W3 rebuilds /result as per-name RSC; W4 one-identity-qa covers\n" +
    "the new contract end-to-end.\n",
);
process.exit(0);
