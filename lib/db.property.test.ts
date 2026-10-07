// Property-based invariants for lib/db.ts's pure / validation face (fast-check).
// Naming follows the *.property.test.ts template (docs/verification-gauntlet.md
// §2) so `pnpm test:property` (vitest run property) picks this file up
// alongside lib/game.property.test.ts.
//
// Scope: the DB-free pure surface of the service layer — `selectDriver`
// (DATABASE_URL scheme routing) and `accumulateMergeStats` (cross-device
// merge math). No sqlite / client factory involved; the I/O-bearing service
// functions keep their example-based suites in tests/db/db.test.ts.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as nativeClient from '@libsql/client';
import * as webClient from '@libsql/client/web';
import { accumulateMergeStats, selectDriver } from './db';
import { emptyStats, type GameStats } from './game';

// Arbitrary GameStats — fields are plain counters; currentStreak is signed.
const arbStats = fc.record({
  totalGames: fc.nat({ max: 100_000 }),
  xWins: fc.nat({ max: 100_000 }),
  oWins: fc.nat({ max: 100_000 }),
  draws: fc.nat({ max: 100_000 }),
  currentStreak: fc.integer({ min: -100_000, max: 100_000 }),
});

// Ledger-consistent stats: totalGames always equals the sum of the three
// outcome counters — the bookkeeping invariant real rows satisfy.
const arbLedgerStats = fc
  .record({
    xWins: fc.nat({ max: 100_000 }),
    oWins: fc.nat({ max: 100_000 }),
    draws: fc.nat({ max: 100_000 }),
    currentStreak: fc.integer({ min: -100_000, max: 100_000 }),
  })
  .map(({ xWins, oWins, draws, currentStreak }): GameStats => ({
    totalGames: xWins + oWins + draws,
    xWins,
    oWins,
    draws,
    currentStreak,
  }));

// URL candidates: the schemes resolveDbConfig/selectDriver care about plus
// arbitrary junk to pin the "unrecognized scheme → web transport" fallback.
const arbUrl = fc
  .tuple(
    fc.constantFrom('file:', 'https://', 'http://', 'libsql://', 'ftp://', ''),
    fc.string({ minLength: 0, maxLength: 24 }),
  )
  .map(([prefix, rest]) => prefix + rest);

describe('property: lib/db pure validation invariants', () => {
  it('selectDriver routes to the native client iff the url starts with "file:"', () => {
    fc.assert(
      fc.property(arbUrl, (url) => {
        const mod = selectDriver(url);
        if (url.startsWith('file:')) {
          expect(mod.createClient).toBe(nativeClient.createClient);
        } else {
          expect(mod.createClient).toBe(webClient.createClient);
        }
      }),
    );
  });

  it('accumulateMergeStats is componentwise addition (server + client)', () => {
    fc.assert(
      fc.property(arbStats, arbStats, (server, client) => {
        const merged = accumulateMergeStats(server, client);
        expect(merged).toEqual({
          totalGames: server.totalGames + client.totalGames,
          xWins: server.xWins + client.xWins,
          oWins: server.oWins + client.oWins,
          draws: server.draws + client.draws,
          currentStreak: server.currentStreak + client.currentStreak,
        });
      }),
    );
  });

  it('accumulateMergeStats is commutative and has emptyStats as identity', () => {
    fc.assert(
      fc.property(arbStats, arbStats, (a, b) => {
        expect(accumulateMergeStats(a, b)).toEqual(accumulateMergeStats(b, a));
        expect(accumulateMergeStats(a, emptyStats())).toEqual(a);
        expect(accumulateMergeStats(emptyStats(), a)).toEqual(a);
      }),
    );
  });

  it('accumulateMergeStats is associative', () => {
    fc.assert(
      fc.property(arbStats, arbStats, arbStats, (a, b, c) => {
        const left = accumulateMergeStats(a, accumulateMergeStats(b, c));
        const right = accumulateMergeStats(accumulateMergeStats(a, b), c);
        expect(left).toEqual(right);
      }),
    );
  });

  it('accumulateMergeStats preserves the ledger identity totalGames = xWins + oWins + draws', () => {
    fc.assert(
      fc.property(arbLedgerStats, arbLedgerStats, (server, client) => {
        const merged = accumulateMergeStats(server, client);
        expect(merged.totalGames).toBe(merged.xWins + merged.oWins + merged.draws);
      }),
    );
  });
});
