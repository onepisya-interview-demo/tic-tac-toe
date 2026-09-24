// T-L4 remote Turso 并发写实测的回归锚（结论真源：
// .omo/evidence/turso-race/T-L4-remote-turso-race-report.md，2026-09-24）。
//
// 实测结论：远程 Turso 的 transaction('write') 由服务端串行化——双连接裸并发
// 30/30、单连接互斥 60/60、双连接重试 20/20 全部终值精确，无 BUSY、无锁泄漏
// （file: 模式的 E1 100% 丢更新与 E7 文件锁泄漏在远程均不出现）。
//
// 本文件是「结论可复跑」的最小锚（各 5 轮），不是 CI 用例：
// 双门跳过——TURSO_RACE_EXPERIMENT=1 且 DATABASE_URL 为 libsql:// + DATABASE_AUTH_TOKEN。
// 跑法（凭据从 .env.local 现读，绝不写进脚本或日志）：
//   DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-) \
//   DATABASE_AUTH_TOKEN=$(grep '^DATABASE_AUTH_TOKEN=' .env.local | cut -d= -f2-) \
//   TURSO_RACE_EXPERIMENT=1 pnpm vitest run tests/db/turso-remote-race-feasibility.test.ts
//
// 安全红线：只建/写/删 _probe_* 前缀临时表；收尾断言零残留；game_stats 只读对照。
import { describe, it, expect, afterAll } from 'vitest';
import { createClient, type Client } from '@libsql/client';

const RUN =
  process.env.TURSO_RACE_EXPERIMENT === '1' &&
  typeof process.env.DATABASE_URL === 'string' &&
  process.env.DATABASE_URL.startsWith('libsql://') &&
  !!process.env.DATABASE_AUTH_TOKEN;

const TBL = '_probe_race_tmp';
const ROOM = 'turso-race-room';
/** 两并发记局（从全零行出发）的期望终值。 */
const EXPECTED = 2;
const ROUNDS = 5;

const DDL = `CREATE TABLE IF NOT EXISTS ${TBL} (
  id INTEGER PRIMARY KEY,
  total_games INTEGER NOT NULL DEFAULT 0,
  x_wins INTEGER NOT NULL DEFAULT 0,
  o_wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  room TEXT UNIQUE,
  updated_at INTEGER NOT NULL
)`;
const WIPE = `DELETE FROM ${TBL}`;
const SEED = `INSERT INTO ${TBL} (room, total_games, x_wins, o_wins, draws, current_streak, updated_at)
  VALUES ('${ROOM}', 0, 0, 0, 0, 0, 0)`;
const SELECT_ROW = `SELECT total_games, x_wins, o_wins, draws, current_streak FROM ${TBL} WHERE room = '${ROOM}'`;
// 与 lib/db.ts 全行快照 upsert 同义（onConflictDoUpdate）。
const UPSERT = `INSERT INTO ${TBL} (room, total_games, x_wins, o_wins, draws, current_streak, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (room) DO UPDATE SET
    total_games = excluded.total_games, x_wins = excluded.x_wins, o_wins = excluded.o_wins,
    draws = excluded.draws, current_streak = excluded.current_streak, updated_at = excluded.updated_at`;

/** transaction('write') 版三步（load → JS 累加 → 全行快照 upsert）。 */
async function apiTxRecordOutcome(client: Client): Promise<void> {
  const tx = await client.transaction('write');
  try {
    const res = await tx.execute(SELECT_ROW);
    if (res.rows.length === 0) throw new Error('row missing');
    const cur = res.rows[0]!;
    await tx.execute({
      sql: UPSERT,
      args: [ROOM, Number(cur.total_games) + 1, Number(cur.x_wins) + 1, Number(cur.o_wins),
        Number(cur.draws), Number(cur.current_streak) + 1, Date.now()],
    });
    await tx.commit();
  } catch (e) {
    try { await tx.rollback(); } catch { /* 不掩盖原错误 */ }
    throw e;
  }
}

async function readFinal(client: Client): Promise<number> {
  const res = await client.execute(SELECT_ROW);
  return Number(res.rows[0]!.total_games);
}

describe.skipIf(!RUN)('T-L4 remote Turso 并发写回归锚（TURSO_RACE_EXPERIMENT=1 + 远程凭据启用）', () => {
  const url = process.env.DATABASE_URL as string;
  const authToken = process.env.DATABASE_AUTH_TOKEN as string;
  let c1: Client;
  let c2: Client;

  afterAll(async () => {
    // 安全收口：临时表清零残留，任何用例失败也不留痕。
    try { await c1.execute(`DROP TABLE IF EXISTS ${TBL}`); } catch { /* close 后忽略 */ }
    try { await c1.close(); } catch { /* 已关 */ }
    try { await c2?.close(); } catch { /* 已关 */ }
  });

  it('R-E5 双连接 write 事务裸并发——服务端串行化，零丢失零错误', async () => {
    c1 = createClient({ url, authToken });
    c2 = createClient({ url, authToken });
    await c1.execute(DDL);
    await c1.execute(WIPE);
    let loss = 0;
    let errors = 0;
    for (let i = 0; i < ROUNDS; i++) {
      await c1.execute(WIPE);
      await c1.execute(SEED);
      const settled = await Promise.allSettled([apiTxRecordOutcome(c1), apiTxRecordOutcome(c2)]);
      errors += settled.filter((s) => s.status === 'rejected').length;
      if ((await readFinal(c1)) !== EXPECTED) loss += 1;
    }
    await c2.close();
    expect(errors).toBe(0);
    expect(loss).toBe(0);
  }, 120_000);

  it('R-E6 单连接互斥 + write 事务（withWriteLock 形态）——零丢失零错误', async () => {
    let chain: Promise<unknown> = Promise.resolve();
    const withMutex = (fn: () => Promise<void>): Promise<void> => {
      const run = chain.then(fn, fn);
      chain = run.catch(() => undefined);
      return run;
    };
    let loss = 0;
    let errors = 0;
    for (let i = 0; i < ROUNDS; i++) {
      await c1.execute(WIPE);
      await c1.execute(SEED);
      const settled = await Promise.allSettled([
        withMutex(() => apiTxRecordOutcome(c1)),
        withMutex(() => apiTxRecordOutcome(c1)),
      ]);
      errors += settled.filter((s) => s.status === 'rejected').length;
      if ((await readFinal(c1)) !== EXPECTED) loss += 1;
    }
    expect(errors).toBe(0);
    expect(loss).toBe(0);
  }, 120_000);

  it('收口：_probe_* 零残留，game_stats 原样', async () => {
    await c1.execute(`DROP TABLE IF EXISTS ${TBL}`);
    const tables = (await c1.execute("SELECT name FROM sqlite_master WHERE type='table'"))
      .rows.map((r) => String(r.name));
    expect(tables.filter((n) => n.startsWith('_probe_'))).toEqual([]);
    expect(tables).toContain('game_stats');
  }, 30_000);
});
