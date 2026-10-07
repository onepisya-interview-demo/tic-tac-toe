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
// KNOWN_STALE_PROBES（存量过时基线，2026-10-08 票 2 走查首录）：
//   语义对齐 ⑤ 层 commit-audit 的「历史豁免基线」（docs/commands.md 验证六层段）
//   ——吸收与本波改动无关的存量红，让门禁对「新增红」保持敏感。
//   基线内探针每轮照跑照报 FAIL（不静默跳过）；若转 PASS 视为漂移信号，须移除条目。
//   烧退纪律：对应探针修复票落地时必须删除条目（新红零容忍，存量红限期清账）。
//
// 用法：
//   node scripts/verify-all.mjs                  # 全链（默认）
//   node scripts/verify-all.mjs --skip-mutation  # 跳过 Stryker（慢层，快速迭代用）
//   node scripts/verify-all.mjs --skip-probes    # 跳过浏览器探针（不起 server）
//
// 环境变量：VERIFY_ALL_PORT（默认 3101）。构建/serve 自动置 NEXT_TELEMETRY_DISABLED=1。
// 退出码：0 = 六层＋on-demand 三层全绿，且探针无新增红（KNOWN_STALE 基线内 FAIL 不计，
//   语义同 ⑤ 层 commit-audit 的历史豁免基线）；任一新增 FAIL / 超时 → 1。
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

// 存量过时基线（2026-10-08 票 2 cold-start-walkthrough 首录，逐条 git 钉死成因；
// 全部 7 条在全新 hermetic server＋全新库下独立复跑均红＝共库无关、与本波改动无关，
// 且两轮全链实跑结果逐条一致＝确定性红、非抖动）：
const KNOWN_STALE_PROBES = new Map([
  [
    'audio-probe',
    '末次维护 d07fd07（09-19）；同日后 c75cfdf/c9ef27f 上线 RoomGateDialog＋online 入口拦截，start-online 不再直达 /online（waitForURL **/online 超时），探针未跟进',
  ],
  [
    'audio-cheer',
    '同 audio-probe：room-gate 入口漂移（d07fd07 后未跟进 c75cfdf/c9ef27f）',
  ],
  [
    'audio-confetti-qa',
    '同 audio-probe：room-gate 入口漂移（d07fd07 后未跟进 c75cfdf/c9ef27f）',
  ],
  [
    'confetti-origin-qa',
    '同 audio-probe：room-gate 入口漂移（d07fd07 后未跟进 c75cfdf/c9ef27f）',
  ],
  [
    'hydration-check',
    '同 audio-probe：room-gate 入口漂移（d07fd07 后未跟进 c75cfdf/c9ef27f）',
  ],
  [
    'pwa-sw-cache-qa',
    '探针 2a49b4d（09-11）硬编码缓存名 tic-tac-toe-v1；sw 缓存版本化 a380404（09-22）后 CACHE_NAME=tic-tac-toe-v<app 版本>（现 v0.1.0），探针未跟进',
  ],
  [
    'ux-qa',
    'RoomGateDialog（c75cfdf，09-19）拦截首页点击，ux-qa before/after 两相位均被 dialog 挡住（末次维护 d07fd07），探针未跟进',
  ],
]);

const startedAt = Date.now();
const stepResults = [];
let hadFailure = false;
let probeCounts = null; // 探针阶段账目：{ total, pass, staleFail, newFail }

function secs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function tail(text) {
  if (text.length <= TAIL_LIMIT) return text;
  return `…（前文截断）…\n${text.slice(-TAIL_LIMIT)}`;
}

// 跑一条 shell 命令：输出实时透传，退出码即判据；超时杀进程记 FAIL。
// countAsFailure=false 供 known-stale 基线探针用：照报 FAIL 但不翻 exit 码。
function run(cmd, { timeoutMs = 600_000, env = {}, label = cmd, countAsFailure = true } = {}) {
  return new Promise((resolve) => {
    const stepStart = Date.now();
    const child = spawn(cmd, {
      shell: true,
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
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
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const ok = code === 0;
      const dur = secs(Date.now() - stepStart);
      console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label} (${dur}${signal ? `, ${signal}` : ''})`);
      if (!ok) {
        if (countAsFailure) hadFailure = true;
        console.log(`--- ${label} 输出尾部 ---\n${tail(out)}--- 尾部完 ---`);
      }
      resolve(ok);
    });
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
  let staleFails = 0;
  let staleTurnedPass = 0;
  probeCounts = { total: PROBES.length, pass: 0, staleFail: 0, newFail: 0 };
  try {
    const readyAt = await waitServerReady();
    if (readyAt === null) {
      console.log(`[FAIL] hermetic server ${PORT} 端口 30s 内未就绪`);
      hadFailure = true;
      return;
    }
    console.log(`hermetic server 就绪（${BASE_URL}）`);

    for (const p of PROBES) {
      const stale = KNOWN_STALE_PROBES.has(p);
      const ok = await run(`node tests/qa/${p}.mjs`, {
        label: p,
        timeoutMs: 180_000,
        countAsFailure: !stale,
        env: {
          BASE_URL,
          DATABASE_URL, // rooms-race-qa 由此派生 RR_DB_PATH 直连清房
          EVIDENCE_DIR: path.join(dbDir, 'evidence', p),
        },
      });
      console.log(`${p}: ${ok ? 'PASS' : 'FAIL'}`);
      if (ok) {
        if (stale) {
          staleTurnedPass += 1;
          console.log(`  ↳ 基线漂移：${p} 为 known-stale 却转 PASS——请核因并移除基线条目`);
        } else {
          probeCounts.pass += 1;
        }
      } else if (stale) {
        staleFails += 1;
        probeCounts.staleFail += 1;
        console.log(`  ↳ known-stale 基线（不计入 exit 判据）：${KNOWN_STALE_PROBES.get(p)}`);
      } else {
        probeFailures += 1;
        probeCounts.newFail += 1;
      }
    }
    if (staleFails > 0 || staleTurnedPass > 0) {
      console.log(
        `\n探针基线小计：known-stale FAIL ${staleFails} 条（存量过时，理由见上）、known-stale 转 PASS ${staleTurnedPass} 条（漂移信号）`,
      );
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
  const { total, pass, staleFail, newFail } = probeCounts;
  const turned = total - pass - staleFail - newFail;
  console.log(`⑥ 探针 ${total} 条：PASS ${pass} + FAIL(known-stale 基线) ${staleFail} + 新红 ${newFail}${turned > 0 ? ` + 基线转绿 ${turned}` : ''}`);
}
console.log(
  `总计 ${stepResults.length} 步${probeCounts ? `＋探针 ${probeCounts.total} 条` : ''}，${hadFailure ? '存在新增 FAIL' : '全绿（存量基线除外）'}，耗时 ${secs(Date.now() - startedAt)}`,
);
process.exit(hadFailure ? 1 : 0);
