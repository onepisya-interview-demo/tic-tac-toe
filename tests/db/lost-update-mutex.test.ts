// tests/db/lost-update-mutex.test.ts — 票 T-C 回归用例（地图 ulw-rooms-race-map T-C / D9）。
// BR: BR-6
//
// 锁定真产品码的并发写不丢失：
//   - recordOutcomeForRoom 双并发 X 记局（10 轮）→ 终值精确 = (2,2,0,0,+2)
//   - mergeRecordByRoom 双并发累加 → 终值精确 = server + 2 × client
//   - recordOutcomeForRoom + resetRecordByRoom 并发 → 终值必须属于
//     「任一串行执行序」可达的最终态；禁止「两调用都基于同一 stale
//     load 各自 upsert」产生的中间态
//   - 一次失败的 recordOutcomeForRoom 不能毒化互斥链：紧接的成功
//     调用必须落库（终值 = 1）
//
// 修复前 lib/db.ts 在这些场景下确定性失败（E1 实验 60/60 丢更新，
// tests/db/ta-transaction-feasibility.test.ts 的实测数据），故这些
// 用例即「修复前 RED / 修复后 GREEN」的不变约束。回归 + 真值锁一并
// 承接，不分 windows 接受新测试。
//
// BR：无（明确锁定"修复后"语义，全局回归）。
// 真值锁：tmpdir + DATABASE_URL + vi.resetModules + closeDb 模式，
// 与 tests/db/db.test.ts 完全同型。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmpDbDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'ulw-mutex-'));

/** 用例轮数（控 CI 时长）：10 轮足矣，修复前必丢，修复后必不丢。 */
const ROUNDS = 10;

async function freshEnv(dir: string): Promise<void> {
  process.env.DATABASE_URL = `file:${path.join(dir, 'tic-tac-toe.db')}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  vi.resetModules();
}

async function teardown(dir: string): Promise<void> {
  try {
    const { closeDb } = await import('@/lib/db');
    await closeDb();
  } catch {
    /* module may not have loaded */
  }
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_AUTH_TOKEN;
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('lib/db lost-update mutex (T-C, D9 形态)', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpDbDir();
  });

  afterEach(async () => {
    await teardown(dir);
  });

  it('recordOutcomeForRoom 双并发 X 记局 ROUNDS 轮 → 终值精确 = 2 局 (修复前必丢)', async () => {
    const ROOM = 'mutex-record';
    await freshEnv(dir);
    const { registerOrLoginRoom, recordOutcomeForRoom, resetRecordByRoom, loadRecordByRoom, closeDb } =
      await import('@/lib/db');
    try {
      await registerOrLoginRoom(ROOM);
      const observedFinals: number[] = [];
      for (let i = 0; i < ROUNDS; i++) {
        await resetRecordByRoom(ROOM);
        const settled = await Promise.allSettled([
          recordOutcomeForRoom(ROOM, 'X'),
          recordOutcomeForRoom(ROOM, 'X'),
        ]);
        // 任一 reject 即破坏（事务已自动 rollback 锁住未提交状态），
        // 但即便两条都成功，终值仍可能因 JS 层竞态只是 1。
        const okCount = settled.filter((s) => s.status === 'fulfilled').length;
        expect(okCount).toBe(2);
        const row = await loadRecordByRoom(ROOM);
        expect(row).not.toBeNull();
        const finalTotal = row!.totalGames;
        observedFinals.push(finalTotal);
        // 真值锁：每轮都必须精确 = 2（修复前 E1 60/60 失败）。
        expect(finalTotal).toBe(2);
        expect(row!.xWins).toBe(2);
        expect(row!.currentStreak).toBe(2);
      }
      // 双重保险：所有轮次终值都应是 2，不允许出现 1。
      expect(observedFinals.every((v) => v === 2)).toBe(true);
    } finally {
      await closeDb();
    }
  }, 60_000);

  it('mergeRecordByRoom 双并发累加 → 终值精确 = server + 2 × client (修复前必丢)', async () => {
    const ROOM = 'mutex-merge';
    await freshEnv(dir);
    const { registerOrLoginRoom, upsertRecordByRoom, mergeRecordByRoom, loadRecordByRoom, closeDb } =
      await import('@/lib/db');
    try {
      await registerOrLoginRoom(ROOM);
      // 服务端起始 (2X, 1O, 1D, streak +1)
      await upsertRecordByRoom(ROOM, {
        totalGames: 4,
        xWins: 2,
        oWins: 1,
        draws: 1,
        currentStreak: 1,
      });
      const clientStats = {
        totalGames: 6,
        xWins: 3,
        oWins: 2,
        draws: 1,
        currentStreak: 0,
      } as const;
      const settled = await Promise.allSettled([
        mergeRecordByRoom(ROOM, { ...clientStats }),
        mergeRecordByRoom(ROOM, { ...clientStats }),
      ]);
      const okCount = settled.filter((s) => s.status === 'fulfilled').length;
      expect(okCount).toBe(2);
      const row = await loadRecordByRoom(ROOM);
      expect(row).not.toBeNull();
      // 串行累加路径：server (4,2,1,1,1) → merge #1 累加 client (6,3,2,1,0)
      // → upsert (10, 5, 3, 2, 1) → merge #2 读 (10,5,3,2,1) 累加 client
      // (6,3,2,1,0) → upsert (16, 8, 5, 3, 1)。任意串行序都收敛此值（mutex
      // 保证两个 merge 全量走完才放行下一个）。
      expect(row).toEqual({
        totalGames: 16,
        xWins: 8,
        oWins: 5,
        draws: 3,
        currentStreak: 1,
      });
    } finally {
      await closeDb();
    }
  }, 30_000);

  it('recordOutcomeForRoom 与 resetRecordByRoom 并发 → 终值必须落在任一串行序', async () => {
    // 起始已记一局 (1X, 0O, 0D, streak +1)。
    //
    // 序列化执行的可达终态（两调用整体串行，load 永远读到最新已
    // 提交值）：
    //   - record-then-reset: (2,1,0,0,+2) → (0,0,0,0,0)        → (0,0,0,0,0)
    //   - reset-then-record: (0,0,0,0,0)   → (1,1,0,0,+1)        → (1,1,0,0,+1)
    //
    // 禁止态（不合法串行序可达）：
    //   - (2,1,0,0,+2) — reset 在 record 之后读它，并基于自己的
    //     stale load 计算 (0,0,0,0,0) 然后写；record 的 stale load
    //     写出 (2,1,0,0,+2)；二者 upsert 顺序竞争时该值可能短暂
    //     可见，但终态若停留 (2,1,0,0,+2) 即"reset 没生效"——
    //     与 reset 已执行的事实矛盾。
    //   - (1,1,0,0,+1) — OK
    //   - (1,0,0,0,+1) — 半累加，混态。
    //   - (1,1,0,0,+2) — 混态。
    //   - 任何包含 (totalGames=1, xWins=1, currentStreak=1) 之外的「非两终态」组合。
    //
    // 该用例在修复前的 lib/db.ts 下必产生 failed assertion（E1 同
    // 形态并发写实验 60/60 丢失；tests/db/ta-transaction-feasibility.test.ts
    // 的实测数据作为外部佐证）。
    const ROOM = 'mutex-record-vs-reset';
    await freshEnv(dir);
    const { registerOrLoginRoom, upsertRecordByRoom, recordOutcomeForRoom, resetRecordByRoom, loadRecordByRoom, closeDb } =
      await import('@/lib/db');
    try {
      await registerOrLoginRoom(ROOM);
      await upsertRecordByRoom(ROOM, {
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
      const settled = await Promise.allSettled([
        recordOutcomeForRoom(ROOM, 'X'),
        resetRecordByRoom(ROOM),
      ]);
      const okCount = settled.filter((s) => s.status === 'fulfilled').length;
      expect(okCount).toBe(2);
      const row = await loadRecordByRoom(ROOM);
      expect(row).not.toBeNull();
      const allowed: ReadonlyArray<unknown> = [
        // record-then-reset → reset 清零
        { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
        // reset-then-record → record 在零上行写入第一局
        { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 },
      ];
      const isAllowed = allowed.some(
        (a) => JSON.stringify(a) === JSON.stringify(row),
      );
      // 真值锁：禁止任何中间态（含 stale-load 的 (2,1,0,0,+2) 等）
      expect(isAllowed).toBe(true);
    } finally {
      await closeDb();
    }
  }, 30_000);

  it('异常路径不毒化互斥链：一次失败后紧接的 record 仍能落库（终值 = 1）', async () => {
    const ROOM = 'mutex-poison';
    await freshEnv(dir);
    const { __setCreateClientForTests, registerOrLoginRoom, recordOutcomeForRoom, loadRecordByRoom, closeDb } =
      await import('@/lib/db');
    try {
      // 先用一个真实调用建表 + 建 row，确保行已注册（不然 not-found
      // 会抢先返回、不会触发互斥链内的抛错）。
      await registerOrLoginRoom(ROOM);
      // 关掉 cachedDb 让下一次 getDb() 走我们刚注入的假 client。
      await closeDb();
      const failingExecute = vi.fn(async () => {
        throw new Error('simulated transient failure');
      });
      const failingClient = {
        execute: failingExecute,
        batch: vi.fn(async () => []),
        transaction: vi.fn(async () => {
          throw new Error('transaction not used by fake');
        }),
        close: vi.fn(async () => undefined),
      };
      __setCreateClientForTests(failingClient as unknown as Parameters<typeof __setCreateClientForTests>[0]);
      // 此次调用 getDb() 内 execute 抛错 → 抛错路径走互斥链。
      let firstCallRejected = false;
      try {
        await recordOutcomeForRoom(ROOM, 'X');
      } catch {
        firstCallRejected = true;
      }
      expect(firstCallRejected).toBe(true);
      // 恢复真客户端：再关 cachedDb → 下次 getDb() 走默认 factory。
      await closeDb();
      __setCreateClientForTests(null);
      const result = await recordOutcomeForRoom(ROOM, 'X');
      // 链未被毒化：成功调用写到 1 局（不是 0、不是挂起）。
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stats.totalGames).toBe(1);
      }
      const row = await loadRecordByRoom(ROOM);
      expect(row).toEqual(result.ok ? result.stats : null);
    } finally {
      __setCreateClientForTests(null);
      await closeDb();
    }
  }, 30_000);
});
