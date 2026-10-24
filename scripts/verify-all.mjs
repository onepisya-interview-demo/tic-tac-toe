#!/usr/bin/env node
// scripts/verify-all.mjs — 一条命令全链走查（票 2 cold-start-walkthrough 副产物固化）。
// Plan: .omo/plans/ulw-verification-infra-roadmap-20261007.md §七 票 2
//
// 默认模式 = 全链：
//   六层（①vitest ②typecheck ③lint ④build ⑤commit-audit ⑥20 浏览器探针）
//   ＋ on-demand 三层（coverage / mutation / property）。
// 探针走 hermetic :3101 范式（docs/commands.md「浏览器探针启动范式」）：
//   临时 sqlite 库 + 生产构建 server，逐探针实跑。
//
// 20 探针清单 = tests/qa/*.mjs 全集减 4：
//   - commit-audit.mjs（⑤层门禁工具，非浏览器探针）
//   - merge-sync-qa.mjs / sync-qa.mjs（头注 DISABLED，ulw-name-login-one-truth W2/W3 退役面）
//   - prod-smoke.mjs（票 17 生产冒烟——目标为生产 3t.onepis.net 只读，
//     绝不进本 hermetic 循环；生产面复跑另行随验证波起算）
// 新增探针或解 DISABLED 时须同步本清单；清单项缺文件立即报错，防静默漂移。
//
// KNOWN_STALE 基线记档（票 18 清账，2026-10-09）：
//   2026-10-08 票 2 走查曾录 7 支存量过时红（入口漂移族 5 支＋pwa-sw-cache-qa
//   缓存名＋ux-qa dialog 相位）入 KNOWN_STALE_PROBES 基线——照跑照报 FAIL 不计
//   exit，语义对齐 ⑤ 层 commit-audit 的「历史豁免基线」。2026-10-09 票 18 探针
//   修复票落地（70789de 五支入口对齐／c27b4e7 pwa＋ux／a0bcaaf offline 检测面），
//   七支全修复、零退役（PROBES 清单 20 支不变），按烧退纪律删除全部条目、豁免
//   机制随之移除：层⑥验收语义回到「探针全绿」（docs/verification-gauntlet.md
//   层⑥记档）——任一探针 FAIL 即 exit 1，新红零容忍。
//
// 用法：
//   node scripts/verify-all.mjs                  # 全链（默认）
//   node scripts/verify-all.mjs --skip-mutation  # 跳过 Stryker（慢层，快速迭代用）
//   node scripts/verify-all.mjs --skip-probes    # 跳过浏览器探针（不起 server）
//
// 环境变量：VERIFY_ALL_PORT（默认 3101）。构建/serve 自动置 NEXT_TELEMETRY_DISABLED=1。
// 退出码：0 = 六层＋on-demand 三层全绿＋⑥ 20 探针全 PASS；任一 FAIL / 超时 → 1。
// 前提：pnpm install 已跑；Playwright Chromium 已装（pnpm exec playwright install chromium）。

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.VERIFY_ALL_PORT ?? 3101);
const BASE_URL = `http://localhost:${PORT}`;
const SKIP_MUTATION = process.argv.includes('--skip-mutation');
const SKIP_PROBES = process.argv.includes('--skip-probes');

const PROBES = [
  'anonymous-first-game-qa',
  'audio-cheer',
  'audio-confetti-qa',
  'audio-probe',
  'confetti-origin-qa',
  'home-return-qa',
  'hydration-check',
  'offline-mode-qa',
  'offline-qa',
  'offline-result-qa',
  'one-identity-qa',
  'one-screen-qa',
  'online-direct-qa',
  'pwa-sw-cache-qa',
  'result-celebration-qa',
  'result-fresh-qa',
  'room-reset-qa',
  'rooms-race-qa',
  'ux-qa',
  'visual-qa',
];

const TAIL_LIMIT = 40 * 1024; // 失败时回显的输出尾部上限（字节）

const startedAt = Date.now();
const stepResults = [];
let hadFailure = false;
let probeCounts = null; // 探针阶段账目：{ total, pass, newFail, notRun }

function secs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function tail(text) {
  if (text.length <= TAIL_LIMIT) return text;
  return `…（前文截断）…\n${text.slice(-TAIL_LIMIT)}`;
}

// 跑一条 shell 命令：输出实时透传，退出码即判据；超时杀进程组记 FAIL。
// （曾设 countAsFailure=false 供 known-stale 基线探针照报 FAIL 不翻 exit——
//   票 18 清账后基线移除，任一 FAIL 即计败，参数随之退役。）
// 超时纪律（评审问题③修复）：spawn detached 让 sh 成为进程组组长，超时
// 杀整组（pnpm/vitest fork 出的孙进程一并清）；另设 5s 兜底——即使管道
// 仍被组外进程持有、'close' 迟迟不来，也到点强制记 FAIL resolve，头注
// 「超时 → exit 1」永不挂死（原版只杀直接子进程：孤儿孙进程持有 stdout
// 管道写端时 'close' 永不触发、promise 永久 pending，评审实验钉死）。
function run(cmd, { timeoutMs = 600_000, env = {}, label = cmd } = {}) {
  return new Promise((resolve) => {
    const stepStart = Date.now();
    const child = spawn(cmd, {
      shell: true,
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      out += d;
      process.stderr.write(d);
    });
    let settled = false;
    let killFallback = null;
    const timer = setTimeout(() => {
      // 杀整个进程组（直接子＋全部后代）；组已消失则退回单杀直接子。
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
      // 兜底：组外进程仍持有管道、'close' 不来时，到点强制记 FAIL resolve。
      killFallback = setTimeout(() => settle(null, 'SIGKILL', true), 5_000);
    }, timeoutMs);
    function settle(code, signal, timedOut = false) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killFallback) clearTimeout(killFallback);
      const ok = code === 0 && !timedOut;
      const dur = secs(Date.now() - stepStart);
      console.log(
        `[${ok ? 'PASS' : 'FAIL'}] ${label} (${dur}${signal ? `, ${signal}` : ''}${timedOut ? ', timeout' : ''})`,
      );
      if (!ok) {
        hadFailure = true;
        console.log(`--- ${label} 输出尾部 ---\n${tail(out)}--- 尾部完 ---`);
      }
      resolve(ok);
    }
    child.on('close', (code, signal) => settle(code, signal));
  });
}

async function recordStep(label, fn) {
  const ok = await fn();
  stepResults.push({ label, ok });
  return ok;
}

async function waitServerReady(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.ok) return Date.now();
    } catch {
      // 未就绪，继续轮询
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

// 探针阶段：起 hermetic server → 逐探针跑 → 关 server。
// 任一探针失败不中断后续探针（走查需要全量结果图）。
async function probeStage() {
  for (const p of PROBES) {
    if (!existsSync(path.join(REPO_ROOT, 'tests', 'qa', `${p}.mjs`))) {
      console.log(`[FAIL] 探针清单漂移：tests/qa/${p}.mjs 不存在（清单与在档探针需同步）`);
      hadFailure = true;
      return;
    }
  }

  const occupied = await fetch(`${BASE_URL}/`).then(
    () => true,
    () => false,
  );
  if (occupied) {
    console.log(`[FAIL] 端口 :${PORT} 已被占用——先停掉在跑的 server 再走查（hermetic 库必须由本进程自带）`);
    hadFailure = true;
    return;
  }

  const dbDir = mkdtempSync(path.join(tmpdir(), 'verify-all-'));
  const DATABASE_URL = `file:${path.join(dbDir, 'hermetic.db')}`;
  const serverEnv = {
    ...process.env,
    DATABASE_URL,
    PORT: String(PORT),
    NEXT_TELEMETRY_DISABLED: '1',
  };
  console.log(`\n=== ⑥ 浏览器探针（hermetic ${BASE_URL}，库 ${DATABASE_URL}）===`);
  const server = spawn('pnpm', ['start'], {
    cwd: REPO_ROOT,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  let probeFailures = 0;
  // notRun 初始＝全量：server 未就绪提前 return 时汇总如实报「未执行 N」，
  // 不把 0 执行误算为任何一种结果（票 18 勘误：原「基线转绿 20」减法推导误报）。
  probeCounts = { total: PROBES.length, pass: 0, newFail: 0, notRun: PROBES.length };
  try {
    const readyAt = await waitServerReady();
    if (readyAt === null) {
      console.log(`[FAIL] hermetic server ${PORT} 端口 30s 内未就绪`);
      hadFailure = true;
      return;
    }
    console.log(`hermetic server 就绪（${BASE_URL}）`);

    for (const p of PROBES) {
      const ok = await run(`node tests/qa/${p}.mjs`, {
        label: p,
        timeoutMs: 180_000,
        env: {
          BASE_URL,
          DATABASE_URL, // rooms-race-qa 由此派生 RR_DB_PATH 直连清房
          EVIDENCE_DIR: path.join(dbDir, 'evidence', p),
        },
      });
      console.log(`${p}: ${ok ? 'PASS' : 'FAIL'}`);
      probeCounts.notRun -= 1;
      if (ok) {
        probeCounts.pass += 1;
      } else {
        probeFailures += 1;
        probeCounts.newFail += 1;
      }
    }
  } finally {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* 进程组可能已退出 */
    }
    await new Promise((r) => setTimeout(r, 500));
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      /* 同上 */
    }
  }

  if (probeFailures === 0) {
    rmSync(dbDir, { recursive: true, force: true });
  } else {
    console.log(`\n探针证据保留于（失败排查用）：${dbDir}`);
  }
}

console.log(`verify-all — 全链走查（${REPO_ROOT}）`);
console.log(
  `模式：全链默认${SKIP_MUTATION ? '，跳过 mutation' : ''}${SKIP_PROBES ? '，跳过探针' : ''}；node ${process.version}；端口 :${PORT}`,
);

// 六层 ①-⑤（docs/commands.md 原命令）；任一失败即中止后续（探针依赖 ④ 的产物）。
const layersOk =
  (await recordStep('① pnpm vitest run', () => run('pnpm vitest run'))) &&
  (await recordStep('② pnpm typecheck', () => run('pnpm typecheck'))) &&
  (await recordStep('③ pnpm lint', () => run('pnpm lint'))) &&
  (await recordStep('④ pnpm build', () => run('pnpm build', { env: { NEXT_TELEMETRY_DISABLED: '1' } }))) &&
  (await recordStep(
    '⑤ commit-audit --range origin/main..HEAD',
    () => run('node tests/qa/commit-audit.mjs --range origin/main..HEAD'),
  ));

if (layersOk) {
  // on-demand 三层（docs/verification-gauntlet.md §2 三层全量补跑——走查场景不分 scope）。
  const onDemandOk =
    (await recordStep('on-demand coverage', () => run('pnpm test:coverage'))) &&
    (!SKIP_MUTATION
      ? await recordStep('on-demand mutation', () => run('pnpm test:mutation'))
      : (console.log('[SKIP] on-demand mutation（--skip-mutation）'), true)) &&
    (await recordStep('on-demand property', () => run('pnpm test:property')));
  if (!onDemandOk) hadFailure = true;

  if (!SKIP_PROBES) {
    await probeStage();
  } else {
    console.log('[SKIP] ⑥ 浏览器探针（--skip-probes）');
  }
} else {
  console.log('\n六层 ①-⑤ 有 FAIL——跳过 on-demand 三层与探针（走查中止）');
}

console.log('\n=== 走查汇总 ===');
for (const { label, ok } of stepResults) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}
if (probeCounts) {
  const { total, pass, newFail, notRun } = probeCounts;
  console.log(
    `⑥ 探针 ${total} 条：PASS ${pass} + FAIL ${newFail}${notRun > 0 ? ` + 未执行 ${notRun}（server 未就绪，走查中止）` : ''}`,
  );
}
console.log(
  `总计 ${stepResults.length} 步${probeCounts ? `＋探针 ${probeCounts.total} 条` : ''}，${hadFailure ? '存在 FAIL' : '全绿'}，耗时 ${secs(Date.now() - startedAt)}`,
);
process.exit(hadFailure ? 1 : 0);
