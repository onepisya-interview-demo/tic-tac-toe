// tests/db/ta-transaction-feasibility.test.ts — T-A 开雾票实测（地图
// .omo/plans/ulw-rooms-race-map-20260924.md，雾区 F1/F2/F5-file 部分）。
//
// 问题：`recordOutcomeForRoom` 的 `load → JS 累加 → 全行快照 upsert` 三步
// 在两个 await 点可被同进程并发请求交错（lib/db.ts 头注释声称「单进程内
// 串行不会交错」，concurrent-surface-qa.mjs 旧注释承认窗口存在）——谁对？
// BEGIN IMMEDIATE / @libsql/client transaction API 能否消除该窗口？
//
// 六种配置各 N 轮「重置 → 双并发记局 → 校验终值=2」采样：
//   E1  真产品码（drizzle + @libsql/client native，单连接）——坐实/证伪窗口
//   E2  同连接 + 裸 BEGIN IMMEDIATE 包裹——同连接嵌套事务的可行性
//   E3  双连接（模拟多实例）无事务——多写者丢失率
//   E4a 双连接 + BEGIN IMMEDIATE，无 busy_timeout——锁冲突形态
//   E4b 双连接 + BEGIN IMMEDIATE + busy_timeout=5000 + 一次重试——修复形态
//   E5  双连接 + @libsql/client transaction('write') API——官方事务 API 形态
//   E6  单连接 + 进程内互斥 + transaction API——T-C 修复形态（本仓真实部署拓扑）
//   E7  双连接 + transaction API + BUSY 一次重试——多实例残差形态
//
// 默认跳过（采样实验非回归用例）：TA_RACE_EXPERIMENT=1 才执行；
// 轮数可用 TA_RACE_ROUNDS 覆盖。证据归档 .omo/evidence/ta-transaction-20260924/。
// BR: 无（工程实验，非业务规则探针）。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createClient, type Client } from '@libsql/client';

const RUN = process.env.TA_RACE_EXPERIMENT === '1';
const ROUNDS = Number(process.env.TA_RACE_ROUNDS ?? 60);
const ROOM = 'ta-race-room';
/** 两并发 X 记局（从全零行出发）的期望终值。 */
const EXPECTED = 2;

const DDL = `
  CREATE TABLE IF NOT EXISTS game_stats (
    id INTEGER PRIMARY KEY,
    total_games INTEGER NOT NULL DEFAULT 0,
    x_wins INTEGER NOT NULL DEFAULT 0,
    o_wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    room TEXT UNIQUE,
    updated_at INTEGER NOT NULL
  );
`;
const WIPE = `DELETE FROM game_stats`;
const SEED = `INSERT INTO game_stats (room, total_games, x_wins, o_wins, draws, current_streak, updated_at)
  VALUES ('${ROOM}', 0, 0, 0, 0, 0, 0)`;
const FINAL = `SELECT total_games, x_wins FROM game_stats WHERE room = '${ROOM}'`;
// 与 lib/db.ts upsertRecordByRoom（drizzle onConflictDoUpdate）同义的全行快照 upsert。
const UPSERT = `INSERT INTO game_stats (room, total_games, x_wins, o_wins, draws, current_streak, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (room) DO UPDATE SET
    total_games = excluded.total_games,
    x_wins = excluded.x_wins,
    o_wins = excluded.o_wins,
    draws = excluded.draws,
    current_streak = excluded.current_streak,
    updated_at = excluded.updated_at`;

interface ConfigStats {
  /** 配置名 */
  name: string;
  /** 采样轮数 */
  rounds: number;
  /** 有请求 reject 的轮数 */
  errorRounds: number;
  /** 无报错但终值 ≠ 2 的轮数（丢失更新） */
  lossRounds: number;
  /** 终值分布，如 { "2": 58, "1": 2 } */
  finalDistribution: Record<string, number>;
  /** 前 3 条错误消息样本 */
  errorSamples: string[];
}

function emptyStats(): ConfigStats {
  return { name: '', rounds: 0, errorRounds: 0, lossRounds: 0, finalDistribution: {}, errorSamples: [] };
}

/**
 * 裸 SQL 复刻 recordOutcomeForRoom 的三步：load → JS 累加 → 全行快照
 * upsert（与 lib/db.ts:384-394 + upsertRecordByRoom 同构）。tx 参数决定
 * 是否用 BEGIN IMMEDIATE 包裹（模拟 T-C 修复形态）。
 */
async function rawRecordOutcome(
  client: Client,
  tx: 'none' | 'begin',
): Promise<void> {
  const begin = () => client.execute('BEGIN IMMEDIATE');
  const commit = () => client.execute('COMMIT');
  const rollback = () => client.execute('ROLLBACK');
  if (tx === 'begin') await begin();
  try {
    const res = await client.execute({
      sql: `SELECT total_games, x_wins, o_wins, draws, current_streak FROM game_stats WHERE room = ?`,
      args: [ROOM],
    });
    if (res.rows.length === 0) throw new Error('row missing');
    const cur = res.rows[0]!;
    const next = {
      total: Number(cur.total_games) + 1,
      x: Number(cur.x_wins) + 1,
      o: Number(cur.o_wins),
      draws: Number(cur.draws),
      streak: Number(cur.current_streak) + 1,
    };
    await client.execute({
      sql: UPSERT,
      args: [ROOM, next.total, next.x, next.o, next.draws, next.streak, Date.now()],
    });
    if (tx === 'begin') await commit();
  } catch (e) {
    if (tx === 'begin') {
      try {
        await rollback();
      } catch {
        /* rollback 自身失败不掩盖原错误 */
      }
    }
    throw e;
  }
}

/** transaction('write') API 版三步（官方事务 API 形态）。 */
async function apiTxRecordOutcome(client: Client): Promise<void> {
  const tx = await client.transaction('write');
  try {
    const res = await tx.execute({
      sql: `SELECT total_games, x_wins, o_wins, draws, current_streak FROM game_stats WHERE room = ?`,
      args: [ROOM],
    });
    if (res.rows.length === 0) throw new Error('row missing');
    const cur = res.rows[0]!;
    const next = {
      total: Number(cur.total_games) + 1,
      x: Number(cur.x_wins) + 1,
      o: Number(cur.o_wins),
      draws: Number(cur.draws),
      streak: Number(cur.current_streak) + 1,
    };
    await tx.execute({
      sql: UPSERT,
      args: [ROOM, next.total, next.x, next.o, next.draws, next.streak, Date.now()],
    });
    await tx.commit();
  } catch (e) {
    try {
      await tx.rollback();
    } catch {
      /* 同上 */
    }
    throw e;
  }
}

async function readFinal(client: Client): Promise<number | null> {
  const res = await client.execute({ sql: FINAL, args: [] });
  if (res.rows.length === 0) return null;
  return Number(res.rows[0]!.total_games);
}

function tally(name: string, rounds: ConfigStats['rounds'], perRound: { errors: string[]; final: number | null }[]): ConfigStats {
  const st = emptyStats();
  st.name = name;
  st.rounds = rounds;
  for (const r of perRound) {
    if (r.errors.length > 0) {
      st.errorRounds += 1;
      for (const m of r.errors) {
        if (st.errorSamples.length < 3 && !st.errorSamples.includes(m)) st.errorSamples.push(m);
      }
    } else if (r.final !== EXPECTED) {
      st.lossRounds += 1;
    }
    const key = r.final === null ? 'null' : String(r.final);
    st.finalDistribution[key] = (st.finalDistribution[key] ?? 0) + 1;
  }
  return st;
}

function printTable(rows: ConfigStats[]): void {
  const lines = [
    '',
    `=== T-A 事务可行性实测（${ROUNDS} 轮/配置，期望终值=${EXPECTED}）===`,
    '配置'.padEnd(44) + '丢失轮\t报错轮\t终值分布',
    '-'.repeat(90),
  ];
  for (const r of rows) {
    const dist = Object.entries(r.finalDistribution)
      .map(([k, v]) => `${k}×${v}`)
      .join(' ');
    lines.push(r.name.padEnd(44) + `${r.lossRounds}\t${r.errorRounds}\t${dist}`);
    for (const s of r.errorSamples) lines.push(`    └ ${s.slice(0, 140)}`);
  }
  console.log(lines.join('\n'));
}

describe.skipIf(!RUN)('T-A 事务可行性实测（TA_RACE_EXPERIMENT=1 启用）', () => {
  let dir: string;
  let dbFile: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ta-race-'));
    dbFile = path.join(dir, 'race.db');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('E1 真产品码 recordOutcomeForRoom 双并发采样', async () => {
    process.env.DATABASE_URL = `file:${dbFile}`;
    delete process.env.DATABASE_AUTH_TOKEN;
    vi.resetModules();
    const db = await import('@/lib/db');
    // 预热 getDb()（建表）后用独立裸连接做每轮重置。
    expect(await db.loadRecordByRoom(ROOM)).toBeNull();
    const resetter = createClient({ url: `file:${dbFile}` });
    await resetter.execute(DDL);
    const perRound: { errors: string[]; final: number | null }[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await resetter.execute(WIPE);
      await resetter.execute(SEED);
      const settled = await Promise.allSettled([
        db.recordOutcomeForRoom(ROOM, 'X'),
        db.recordOutcomeForRoom(ROOM, 'X'),
      ]);
      const errors = settled
        .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
        .map((s) => String(s.reason));
      perRound.push({ errors, final: await readFinal(resetter) });
    }
    await resetter.close();
    await db.closeDb();
    delete process.env.DATABASE_URL;
    const st = tally('E1 真产品码（单连接 drizzle）', ROUNDS, perRound);
    printTable([st]);
    // E1 是观测实验：不预设结论（坐实与否由实测数据回答），只要求采样完整。
    expect(st.rounds).toBe(ROUNDS);
  }, 300_000);

  it('E2 同连接 + BEGIN IMMEDIATE 包裹', async () => {
    const c = createClient({ url: `file:${dbFile}` });
    await c.execute(DDL);
    const perRound: { errors: string[]; final: number | null }[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await c.execute(WIPE);
      await c.execute(SEED);
      const settled = await Promise.allSettled([
        rawRecordOutcome(c, 'begin'),
        rawRecordOutcome(c, 'begin'),
      ]);
      const errors = settled
        .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
        .map((s) => String(s.reason));
      perRound.push({ errors, final: await readFinal(c) });
    }
    await c.close();
    const st = tally('E2 同连接 + BEGIN IMMEDIATE', ROUNDS, perRound);
    printTable([st]);
    expect(st.rounds).toBe(ROUNDS);
  }, 300_000);

  it('E3 双连接无事务（多实例基线）', async () => {
    const c1 = createClient({ url: `file:${dbFile}` });
    const c2 = createClient({ url: `file:${dbFile}` });
    await c1.execute(DDL);
    const perRound: { errors: string[]; final: number | null }[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await c1.execute(WIPE);
      await c1.execute(SEED);
      const settled = await Promise.allSettled([
        rawRecordOutcome(c1, 'none'),
        rawRecordOutcome(c2, 'none'),
      ]);
      const errors = settled
        .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
        .map((s) => String(s.reason));
      perRound.push({ errors, final: await readFinal(c1) });
    }
    await c1.close();
    await c2.close();
    const st = tally('E3 双连接无事务', ROUNDS, perRound);
    printTable([st]);
    expect(st.rounds).toBe(ROUNDS);
  }, 300_000);

  it('E4a 双连接 + BEGIN IMMEDIATE 无 busy_timeout', async () => {
    const c1 = createClient({ url: `file:${dbFile}` });
    const c2 = createClient({ url: `file:${dbFile}` });
    await c1.execute(DDL);
    const perRound: { errors: string[]; final: number | null }[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await c1.execute(WIPE);
      await c1.execute(SEED);
      const settled = await Promise.allSettled([
        rawRecordOutcome(c1, 'begin'),
        rawRecordOutcome(c2, 'begin'),
      ]);
      const errors = settled
        .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
        .map((s) => String(s.reason));
      perRound.push({ errors, final: await readFinal(c1) });
    }
    await c1.close();
    await c2.close();
    const st = tally('E4a 双连接 BEGIN IMMEDIATE（无 busy_timeout）', ROUNDS, perRound);
    printTable([st]);
    expect(st.rounds).toBe(ROUNDS);
  }, 300_000);

  it('E4b 双连接 + BEGIN IMMEDIATE + busy_timeout=5000 + 一次重试', async () => {
    const c1 = createClient({ url: `file:${dbFile}` });
    const c2 = createClient({ url: `file:${dbFile}` });
    await c1.execute(DDL);
    await c1.execute(`PRAGMA busy_timeout = 5000`);
    await c2.execute(`PRAGMA busy_timeout = 5000`);
    const withRetry = async (c: Client) => {
      try {
        await rawRecordOutcome(c, 'begin');
      } catch {
        // BUSY 一次重试（T-C 修复形态的重试语义）
        await rawRecordOutcome(c, 'begin');
      }
    };
    const perRound: { errors: string[]; final: number | null }[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await c1.execute(WIPE);
      await c1.execute(SEED);
      const settled = await Promise.allSettled([withRetry(c1), withRetry(c2)]);
      const errors = settled
        .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
        .map((s) => String(s.reason));
      perRound.push({ errors, final: await readFinal(c1) });
    }
    await c1.close();
    await c2.close();
    const st = tally('E4b 双连接 BEGIN IMMEDIATE + busy_timeout + 重试', ROUNDS, perRound);
    printTable([st]);
    expect(st.rounds).toBe(ROUNDS);
  }, 300_000);

  it('E5 双连接 + transaction(写) 官方 API', async () => {
    const c1 = createClient({ url: `file:${dbFile}` });
    const c2 = createClient({ url: `file:${dbFile}` });
    await c1.execute(DDL);
    const perRound: { errors: string[]; final: number | null }[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await c1.execute(WIPE);
      await c1.execute(SEED);
      const settled = await Promise.allSettled([
        apiTxRecordOutcome(c1),
        apiTxRecordOutcome(c2),
      ]);
      const errors = settled
        .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
        .map((s) => String(s.reason));
      perRound.push({ errors, final: await readFinal(c1) });
    }
    await c1.close();
    await c2.close();
    const st = tally('E5 双连接 transaction(write) API', ROUNDS, perRound);
    printTable([st]);
    expect(st.rounds).toBe(ROUNDS);
  }, 300_000);

  it('E6 单连接 + 进程内互斥 + transaction(写) API（T-C 修复形态）', async () => {
    const c = createClient({ url: `file:${dbFile}` });
    await c.execute(DDL);
    // 进程内 promise 链互斥：load → mutate → upsert 三步整体入队，消除 JS 层交错。
    let chain: Promise<unknown> = Promise.resolve();
    const withMutex = (fn: () => Promise<void>): Promise<void> => {
      const run = chain.then(fn, fn);
      chain = run.catch(() => undefined);
      return run;
    };
    const perRound: { errors: string[]; final: number | null }[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await c.execute(WIPE);
      await c.execute(SEED);
      const settled = await Promise.allSettled([
        withMutex(() => apiTxRecordOutcome(c)),
        withMutex(() => apiTxRecordOutcome(c)),
      ]);
      const errors = settled
        .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
        .map((s) => String(s.reason));
      perRound.push({ errors, final: await readFinal(c) });
    }
    await c.close();
    const st = tally('E6 单连接 互斥 + transaction API', ROUNDS, perRound);
    printTable([st]);
    expect(st.rounds).toBe(ROUNDS);
  }, 300_000);

  it('E7 双连接 + transaction(写) API + BUSY 一次重试（多实例残差形态）', async () => {
    const c1 = createClient({ url: `file:${dbFile}` });
    let c2 = createClient({ url: `file:${dbFile}` });
    await c1.execute(DDL);
    const withRetry = async (c: Client) => {
      try {
        await apiTxRecordOutcome(c);
      } catch {
        await apiTxRecordOutcome(c);
      }
    };
    // 实测发现：失败的回滚会泄漏文件级写锁，级联成持续 BUSY（连 reset 都
    // 被卡死），且等待无法自愈——必须回收客户端（close 掉泄漏连接）才恢复，
    // 对应多实例下「僵死实例需回收/重启」的运维模型。回收事件计数入结论。
    let recycles = 0;
    const resetTolerant = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          await c1.execute(WIPE);
          await c1.execute(SEED);
          return;
        } catch (e) {
          if (!String(e).includes('BUSY')) throw e;
          if (attempt >= 3) {
            // 回收泄漏端重试（close 释放其连接与文件锁）
            if (recycles < 50) {
              recycles += 1;
              await c2.close();
              c2 = createClient({ url: `file:${dbFile}` });
            }
          }
          await new Promise((r) => setTimeout(r, 25));
        }
      }
    };
    const perRound: { errors: string[]; final: number | null }[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await resetTolerant();
      const settled = await Promise.allSettled([withRetry(c1), withRetry(c2)]);
      const errors = settled
        .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
        .map((s) => String(s.reason));
      perRound.push({ errors, final: await readFinal(c1) });
    }
    await c1.close();
    await c2.close();
    const st = tally('E7 双连接 transaction API + BUSY 重试', ROUNDS, perRound);
    st.errorSamples.push(`（客户端回收 ${recycles} 次）`);
    printTable([st]);
    expect(st.rounds).toBe(ROUNDS);
  }, 300_000);
});
