#!/usr/bin/env node
// ttl-probe-seed.mjs — zz-ttl-probe TTL 边界造数脚本（最小入仓档）。
//
// 由来（✅D15 / 路线图票 6）：2026-09-30「TTL 边界造数-触发-对照」全流程
// 当时以一次性脚本直操生产库完成，仅存过程叙述（.omo/research-verification-trust-20260930.md §一.3），
// 本件按「最小票」把该流程钉成可复跑脚本，防流程失传。cron 线已 10-04 终验
// 关账（✅D28），本件无时效性复测义务。
//
// 语义背景（lib/db.ts purgeStaleRooms）：每日 cron（03:00Z）删
// `updated_at < now - 30d` 的 game_stats 行（严格小于，等于不删）；
// `updated_at` 为 epoch 毫秒（drizzle timestamp_ms）。
//
// 09-30 流程的两条教训固化在此：
// 1. 锚点口径：行龄以「执行时刻 now」为锚推算——「正好 30 天」的行只在
//    造数瞬间等于 cutoff，之后随时落入删除侧（当时 purge 晚于造数 40 秒、
//    cutoff 推进，「正好 30 天」行也被删，行为正确、系预期表设计误差非 bug）。
// 2. 留证设计：永远带一行「次日必过线」种子，让下一个 cron 窗口的
//    deletedCount ≥ 1 有实证（两阶段验证：当天手动验删除逻辑、次日 cron 验定时器）。
//
// 安全兜底（内置断言，不可绕过）：
// - 本脚本只允许触碰 room 值以 `zz-ttl-probe` 为前缀的行——
//   assertProbeRoom() 在每次写库前强制校验，非前缀即抛错拒绝执行。
// - 默认 dry-run：不带 --apply 时零数据库连接、只打印计划。
// - --apply 需显式 DATABASE_URL（拒绝落回应用默认 ./data 路径——本脚本
//   历史上直指生产库，必须由调用者亲指目标）。
// - 幂等：room UNIQUE + ON CONFLICT DO UPDATE，重复执行覆盖同一批行。
//
// 清尾（不在本脚本内执行，仅存档当时获主公授权的双条件形态）：
//   DELETE FROM game_stats WHERE room LIKE 'zz-ttl-probe%';
//   （09-30 手动 purge 曾连带删过库内真实过期陈货——本脚本造数面
//   只碰前缀行，真实数据零接触；自然过期亦可等 cron 删。）
//
// 用法：
//   node scripts/ttl-probe-seed.mjs --dry-run            # 只读计划（默认同此）
//   DATABASE_URL=file:/tmp/x.db node scripts/ttl-probe-seed.mjs --apply
//
// Plan: .omo/plans/ulw-verification-infra-roadmap-20261007.md §七票 6
import { createClient } from '@libsql/client';

export const PROBE_ROOM_PREFIX = 'zz-ttl-probe';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 边界种子集（09-30 梯子的最小复刻）：
// - fresh        0 天       —— 新鲜行，永不删（对照组）
// - due-tomorrow 29 天      —— 次日必过线（教训 2：cron 日志留证行）
// - exact-30d    30 天      —— 边界行（教训 1：只在造数瞬间等于 cutoff）
// - over-line    31 天      —— 已过线（下一个窗口即删）
const SEED_PLAN = [
  { tag: 'A-fresh', daysAgo: 0 },
  { tag: 'B-due-tomorrow', daysAgo: 29 },
  { tag: 'C-exact-30d', daysAgo: 30 },
  { tag: 'D-over-line', daysAgo: 31 },
];

// 内置表名前缀断言：非 zz-ttl-probe 前缀即拒绝执行（每次写库前强制过闸）。
export function assertProbeRoom(room) {
  if (
    typeof room !== 'string' ||
    !room.startsWith(PROBE_ROOM_PREFIX)
  ) {
    throw new Error(
      `refuse: room "${room}" 不带 ${PROBE_ROOM_PREFIX} 前缀——本脚本只允许触碰探针前缀行`,
    );
  }
  return room;
}

export function buildSeedRows(now = Date.now()) {
  return SEED_PLAN.map(({ tag, daysAgo }) => {
    const room = assertProbeRoom(`${PROBE_ROOM_PREFIX}-${tag}`);
    const updatedAt = new Date(now - daysAgo * MS_PER_DAY);
    return {
      room,
      updatedAtMs: updatedAt.getTime(),
      updatedAtIso: updatedAt.toISOString(),
      daysAgo,
      note:
        daysAgo === 0
          ? '对照新鲜行：任何窗口都不删'
          : daysAgo < 30
            ? `再过 ${30 - daysAgo} 天过线：下个 cron 窗口留证行`
            : daysAgo === 30
              ? '边界行：仅造数瞬间等于 cutoff，此后随时落入删除侧'
              : '已过线：下个删除窗口即删',
    };
  });
}

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
)`;

function printPlan(rows, mode) {
  console.log(`ttl-probe-seed（模式：${mode}）`);
  console.log(`前缀断言：只碰 ${PROBE_ROOM_PREFIX}* 行（非前缀即拒绝执行）`);
  console.log('计划行（stats 全零，room 即标识）：');
  for (const r of rows) {
    console.log(
      `  - ${r.room}  updated_at=${r.updatedAtIso}  (${r.daysAgo}d ago)  ${r.note}`,
    );
  }
}

async function apply(rows) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('--apply 需显式 DATABASE_URL（不落回应用默认路径）');
  }
  const db = createClient(
    url.startsWith('http') || url.startsWith('libsql')
      ? { url, authToken: process.env.DATABASE_AUTH_TOKEN }
      : { url },
  );
  await db.execute(DDL);
  for (const r of rows) {
    assertProbeRoom(r.room); // 写库前逐行过闸
    await db.execute({
      sql: `INSERT INTO game_stats (room, updated_at)
            VALUES (?, ?)
            ON CONFLICT(room) DO UPDATE SET updated_at = excluded.updated_at`,
      args: [r.room, r.updatedAtMs],
    });
  }
  const back = await db.execute(
    `SELECT room, updated_at FROM game_stats WHERE room LIKE '${PROBE_ROOM_PREFIX}%'`,
  );
  console.log(`已写入 ${rows.length} 行；回读 ${back.rows.length} 行前缀行：`);
  for (const row of back.rows) {
    console.log(`  - ${row.room}  updated_at=${row.updated_at}`);
  }
  db.close();
}

async function main() {
  const args = process.argv.slice(2);
  const applyMode = args.includes('--apply');
  const explicitDryRun = args.includes('--dry-run');
  if (applyMode && explicitDryRun) {
    throw new Error('--apply 与 --dry-run 互斥');
  }
  const rows = buildSeedRows(); // dry-run 也全程走前缀断言（构造即校验）
  if (!applyMode) {
    printPlan(rows, explicitDryRun ? '--dry-run' : '默认 dry-run（未传 --apply）');
    console.log('零数据库连接；带 --apply 才写库（需显式 DATABASE_URL）。');
    return;
  }
  printPlan(rows, '--apply');
  await apply(rows);
}

// 直接执行入口（import 时不自动跑 main，便于断言单测/拒绝路径演示）。
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error(String(err?.message ?? err));
    process.exit(1);
  });
}
