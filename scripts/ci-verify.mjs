#!/usr/bin/env node
// scripts/ci-verify.mjs — 主公合并发版波时一条命令核验 CI 侧三项。
// Plan: .omo/plans/ulw-verification-infra-roadmap-20261007.md §七
//   票 4（✅D14：首跑绿口径＋EVIDENCE_DIR 三态核验 D-1 实跑判定）
//   ＋票 10（test:property CI 侧绿核验通道）。
//
// 三项判据：
//   [1] 五必绿＋首跑全绿（L1-33）：取指定 attempt（默认 1）的 job 列表，
//       五个必绿 job（lint/typecheck/test/build/visual-qa）逐一 conclusion=success，
//       且该 attempt 全部 job success——rerun 绿不洗白，非五必绿的追加 BR 探针
//       job 红同判红（docs/anti-patterns.md L1-33；docs/verification-gauntlet.md
//       2026-09-30 验证实践补充①；PR #18 实证 run 36742717954/36745175197）。
//       比对以 jobs API 的 name 字段（显示名）为 CI 实报口径（票 4 对账发现：
//       ruleset 六 BR 探针按 job id 登记与实报显示名错位）。
//   [2] EVIDENCE_DIR 两态判定（D-1）：visual-qa job 日志中探针运行时打印行
//       「QA complete. Screenshots and qa-log.json written to <值>」
//       （tests/qa/visual-qa.mjs:278 打印 process.env.EVIDENCE_DIR）为唯一
//       直接锚——值字面含 ${RUNNER_TEMP}＝不展开；形如 /home/runner/... 的
//       绝对路径＝展开；两态之外的怪值或锚行缺失＝疑＝红；日志缺失/拉不到＝
//       blocked。注意「##[group]Set up job」环境回显段永远显示字面量，不可作
//       判据（PR #18 job 109999826715 日志 L53/L146/L174 实测）——本脚本只认
//       written to 锚行；upload-artifact「N files uploaded」为间接旁证不作判据。
//   [3] test:property step（票 10，ci.yml:56）：test job（Test (Vitest)）的
//       「Run pnpm test:property」step 存在且 conclusion=success，且该 step
//       日志段计数达标（Test Files ≥2 / Tests ≥6，票面机械判据）；step 不存在
//       ＝SKIP（改动未推/CI 未生效——2026-10-08〔7d208fb〕接线前的历史 run 属
//       预期态，醒目标注、不算 fail）。
//
// 主公合并链路（runbook）：
//   push dev → 开 PR → CI 完成后 node scripts/ci-verify.mjs --pr <N>
//   → 总结论 clean 即三项全收口（证据件已自动落 .omo/evidence/）。
//
// 用法：
//   node scripts/ci-verify.mjs --pr <N>                    # 按 PR 号核验其 head 最新 CI run
//   node scripts/ci-verify.mjs --run <id>                  # 直接核验指定 run
//   node scripts/ci-verify.mjs --run <id> --attempt <n>    # 指定 attempt（默认 1）
//
// 退出码：0＝可判项全过（SKIP/blocked 不算 fail，输出醒目标注）；
//         1＝任一可判项红（changed），或 run 元数据/attempt job 列表拉不到
//            （整体无法判——绝不伪造 clean）。零新依赖：node 内置模块＋gh CLI
//            （需 gh auth login 已登录）。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI_YML_PATH = path.join(REPO_ROOT, '.github/workflows/ci.yml');
const EVIDENCE_ROOT = path.join(REPO_ROOT, '.omo/evidence');

const MUST_GREEN_IDS = ['lint', 'typecheck', 'test', 'build', 'visual-qa'];
const VISUAL_QA_JOB_ID = 'visual-qa';
const TEST_JOB_ID = 'test';
const PROPERTY_STEP_NAME = 'Run pnpm test:property'; // 未命名 run step 的 GitHub 实报名（实测 PR #18「Run pnpm test」同款）
const PROPERTY_FILES_BAR = 2; // 票 10 机械判据：Test Files ≥2
const PROPERTY_TESTS_BAR = 6; // 票 10 机械判据：Tests ≥6
const WRITTEN_TO_ANCHOR = 'written to'; // visual-qa.mjs:278 唯一直接锚
const GH_MAX_BUFFER = 32 * 1024 * 1024;

// ---------- 基础工具 ----------

function printHelp() {
  console.log(`ci-verify —— 合并发版波 CI 侧三项核验（一条命令）

主公合并链路（runbook）：
  push dev → 开 PR → CI 完成后 node scripts/ci-verify.mjs --pr <N>
  → 总结论 clean 即三项全收口（证据件已自动落 .omo/evidence/）。

用法：
  node scripts/ci-verify.mjs --pr <N>                    按 PR 号核验其 head 最新 CI run
  node scripts/ci-verify.mjs --run <id>                  直接核验指定 run
  node scripts/ci-verify.mjs --run <id> --attempt <n>    指定 attempt（默认 1＝L1-33 首跑口径）

三项判据：
  [1] 五必绿＋首跑全绿——指定 attempt 的 job 列表里五个必绿 job
      （lint/typecheck/test/build/visual-qa，按显示名比对）逐一 success，
      且该 attempt 全部 job success（rerun 绿不洗白，追加探针红同判红）。
  [2] EVIDENCE_DIR 两态判定——visual-qa job 日志「written to <值>」锚行：
      字面 \${RUNNER_TEMP}＝不展开；/开头绝对路径＝展开；锚缺失＝疑＝红；
      日志拉不到＝blocked。
  [3] test:property step——存在且绿＋计数达标（Test Files ≥2 / Tests ≥6）；
      step 不存在＝SKIP（改动未推/CI 未生效，2026-10-08 接线前的 run 属预期态）。

结论词汇：clean / changed / blocked（＋SKIP）。
退出码：0＝可判项全过（SKIP/blocked 不算 fail）；1＝任一可判项红或整体无法判。
依赖：gh CLI（已登录）＋ node 内置模块，零新依赖。`);
}

function parseArgs(argv) {
  const args = { attempt: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      args.help = true;
    } else if (a === '--pr') {
      const v = argv[(i += 1)];
      if (!/^\d+$/.test(v ?? '')) {
        console.error(`--pr 需要数字参数（得到：${v}）——--help 查看用法`);
        process.exit(1);
      }
      args.pr = v;
    } else if (a === '--run') {
      const v = argv[(i += 1)];
      if (!/^\d+$/.test(v ?? '')) {
        console.error(`--run 需要数字 run id（得到：${v}）——--help 查看用法`);
        process.exit(1);
      }
      args.run = v;
    } else if (a === '--attempt') {
      const v = argv[(i += 1)];
      if (!/^\d+$/.test(v ?? '') || Number(v) < 1) {
        console.error(`--attempt 需要 ≥1 的数字（得到：${v}）——--help 查看用法`);
        process.exit(1);
      }
      args.attempt = Number(v);
    } else {
      console.error(`未知参数：${a}——--help 查看用法`);
      process.exit(1);
    }
  }
  if (!args.help) {
    // --pr 与 --run 恰给其一
    if (args.pr && args.run) {
      console.error('--pr 与 --run 互斥，恰给其一——--help 查看用法');
      process.exit(1);
    }
    if (!args.pr && !args.run) {
      console.error('缺少 --pr <N> 或 --run <id>——--help 查看用法');
      process.exit(1);
    }
  }
  return args;
}

function run(cmd, cmdArgs) {
  return spawnSync(cmd, cmdArgs, { encoding: 'utf8', maxBuffer: GH_MAX_BUFFER });
}

function ghApi(endpoint) {
  const r = run('gh', ['api', endpoint]);
  if (r.status !== 0) {
    throw new Error(`gh api ${endpoint} 失败：${(r.stderr || r.stdout || '').trim().slice(0, 300)}`);
  }
  return JSON.parse(r.stdout);
}

function ghJobLog(runId, jobId) {
  const r = run('gh', ['run', 'view', String(runId), '--job', String(jobId), '--log']);
  if (r.status !== 0 || !r.stdout || !r.stdout.trim()) return null;
  return r.stdout;
}

function repoSlug() {
  const r = run('git', ['-C', REPO_ROOT, 'remote', 'get-url', 'origin']);
  if (r.status !== 0) throw new Error('git remote get-url origin 失败');
  const url = r.stdout.trim();
  const m =
    url.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/) ||
    url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (!m) throw new Error(`无法从 origin URL 解析仓库坐标：${url}`);
  return `${m[1]}/${m[2]}`;
}

// 解析 ci.yml jobs: 段 → Map(jobId → 显示名)。显示名（name:）是 CI 实报
// check 名口径（票 4 对账发现）；无 name: 的 job 以 job id 实报。
function parseCiJobs() {
  if (!existsSync(CI_YML_PATH)) throw new Error(`未找到 ${CI_YML_PATH}`);
  const lines = readFileSync(CI_YML_PATH, 'utf8').split('\n');
  const jobs = new Map();
  let inJobs = false;
  let current = null;
  let named = false;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^\S/.test(line) && !line.startsWith('#')) break; // jobs: 段结束
    const idMatch = line.match(/^  ([a-z0-9][a-z0-9-]*):\s*$/);
    if (idMatch) {
      current = idMatch[1];
      jobs.set(current, null);
      named = false;
      continue;
    }
    if (current && !named) {
      const nameMatch = line.match(/^    name: (.+?)\s*$/);
      if (nameMatch) {
        jobs.set(current, nameMatch[1]);
        named = true;
      }
    }
  }
  for (const [id, name] of jobs) {
    if (!name) jobs.set(id, id);
  }
  return jobs;
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

function excerpt(line, max = 200) {
  const t = line.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// ---------- run 解析与取数 ----------

function resolveRunId(args, slug) {
  if (args.run) return { runId: args.run, how: '--run' };
  const pr = ghApi(`repos/${slug}/pulls/${args.pr}`);
  const sha = pr.head && pr.head.sha;
  if (!sha) throw new Error(`PR #${args.pr} 无 head sha`);
  const runs = ghApi(`repos/${slug}/actions/runs?event=pull_request&head_sha=${sha}&per_page=20`);
  const ciRuns = (runs.workflow_runs || []).filter((x) => x.name === 'CI');
  if (ciRuns.length === 0) {
    throw new Error(
      `PR #${args.pr}（head ${sha.slice(0, 7)}）无 CI run——改动未推或 CI 未触发（dev push 零 CI：docs/verification-gauntlet.md §5.1 豁免清单）`,
    );
  }
  const latest = ciRuns[0]; // 列表按创建时间倒序，取该 head 最新 run
  return { runId: String(latest.id), how: `--pr ${args.pr}（head ${sha.slice(0, 7)}）→ 最新 CI run` };
}

function fetchAttemptJobs(slug, runId, attempt, latestAttempt) {
  try {
    const data = ghApi(`repos/${slug}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`);
    if (!data.jobs || data.jobs.length === 0) throw new Error('attempt job 列表为空');
    return data.jobs;
  } catch (e) {
    throw new Error(
      `attempt=${attempt} job 列表拉取失败（${e.message}）——该 run 最新 run_attempt=${latestAttempt ?? '?'}`,
    );
  }
}

// ---------- 判据 [1] 五必绿＋首跑全绿（L1-33） ----------

function checkFirstRunGreen(jobs, ciJobs, attempt) {
  const byName = new Map(jobs.map((j) => [j.name, j]));
  const five = MUST_GREEN_IDS.map((id) => {
    const display = ciJobs.get(id);
    const job = display ? byName.get(display) : undefined;
    return { id, display, job };
  });
  const fiveBad = five.filter((f) => !f.job || f.job.conclusion !== 'success');
  const reds = jobs.filter((j) => j.conclusion !== 'success');
  const notes = [];
  if (jobs.length !== ciJobs.size) {
    notes.push(`attempt job 数 ${jobs.length} ≠ 当前 ci.yml job 数 ${ciJobs.size}（run 时点 ci.yml 与本地或有漂移，不影响本判定）`);
  }
  const attemptLabel = attempt === 1 ? 'attempt=1（L1-33 首跑口径）' : `attempt=${attempt}（非首跑视图——L1-33 收口仍以 attempt=1 全绿为准）`;
  if (reds.length === 0) {
    const fiveList = five.map((f) => `${f.id}〔${f.display}〕`).join('／');
    return {
      verdict: 'clean',
      line: `clean — ${attemptLabel}共 ${jobs.length} job 全 success；五必绿逐一绿：${fiveList}`,
      evidence: `attempt=${attempt} job 列表 ${jobs.length}/${jobs.length} success（五必绿 ${MUST_GREEN_IDS.join(',')} 全绿）`,
      notes,
    };
  }
  const redList = reds.map((j) => `${j.name}=${j.conclusion}（job id ${j.id}）`).join('、');
  const fivePart = fiveBad.length
    ? `五必绿内红：${fiveBad.map((f) => `${f.id}〔${f.display}〕${f.job ? `=${f.job.conclusion}` : '＝attempt 列表缺失'}`).join('、')}`
    : `五必绿 5 job 本身全绿——红在追加 BR 探针档（L1-33 口径：首跑全绿才算收口，非五必绿子集）`;
  return {
    verdict: 'changed',
    line: `changed — ${attemptLabel}红 ${reds.length} job：${redList}；${fivePart}`,
    evidence: `attempt=${attempt} 红 job：${redList}；${fivePart}`,
    notes,
  };
}

// ---------- 判据 [2] EVIDENCE_DIR 两态判定（D-1） ----------

function twoStateOf(value) {
  if (value.includes('${RUNNER_TEMP}')) return '不展开';
  if (value.startsWith('/')) return '展开';
  return '疑';
}

function checkEvidenceDir(jobs, runId, ciJobs) {
  const display = ciJobs.get(VISUAL_QA_JOB_ID);
  const job = jobs.find((j) => j.name === display);
  if (!job) {
    return {
      verdict: 'blocked',
      line: `blocked — attempt job 列表无「${display}」，日志无从拉起`,
      evidence: `visual-qa job（显示名 ${display}）不在 attempt job 列表`,
    };
  }
  const log = ghJobLog(runId, job.id);
  if (!log) {
    return {
      verdict: 'blocked',
      line: `blocked — visual-qa job（id ${job.id}）日志缺失/拉不到（可能已过保留期），两态判定无从起——不算红`,
      evidence: `gh run view ${runId} --job ${job.id} --log 拉不到有效日志`,
    };
  }
  const anchorLines = log.split('\n').filter((l) => l.includes(WRITTEN_TO_ANCHOR));
  if (anchorLines.length === 0) {
    return {
      verdict: 'changed',
      line: `changed — 疑：日志在但判定锚行（written to，visual-qa.mjs:278）未找到（探针未跑到收尾或打印措辞变更）——判「疑」＝红（票 4 口径）`,
      evidence: `visual-qa job（id ${job.id}）日志无 written to 锚行`,
    };
  }
  const values = [...new Set(anchorLines.map((l) => l.split(WRITTEN_TO_ANCHOR).pop().trim()))];
  const states = [...new Set(values.map(twoStateOf))];
  const first = excerpt(anchorLines[0]);
  if (states.length !== 1 || states[0] === '疑') {
    return {
      verdict: 'changed',
      line: `changed — 疑：锚行取值非两态可判（值：${values.join(' | ').slice(0, 120)}）——判「疑」＝红`,
      evidence: `锚行取值：${values.join(' | ')}\n锚行摘录：${first}`,
    };
  }
  const state = states[0];
  const meaning =
    state === '不展开'
      ? `env 上下文不做 shell 展开（D-1 初判成立；票 4 §5.4 处置指向修 \${{ runner.temp }} 写法）`
      : 'env 已展开为 runner 真实绝对路径';
  return {
    verdict: 'clean',
    line: `clean — 两态判定成功＝「${state}」：${meaning}；锚行摘录：${first}`,
    evidence: `两态判定＝${state}\n锚行（唯一直接锚，运行时打印 process.env.EVIDENCE_DIR）：${first}`,
  };
}

// ---------- 判据 [3] test:property step（票 10） ----------

function parsePropertyCounts(log) {
  const lines = log.split('\n');
  const header = `##[group]Run pnpm test:property`;
  const start = lines.findIndex((l) => l.includes(header));
  if (start === -1) return null;
  const seg = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (l.includes('##[group]') || l.includes('Post job cleanup.')) break;
    seg.push(l);
  }
  const plain = seg.map(stripAnsi).join('\n');
  const files = plain.match(/Test Files\s+(\d+) passed(?:\s*\|\s*(\d+) skipped)?\s*\((\d+)\)/);
  const tests = plain.match(/\bTests\s+(\d+) passed(?:\s*\|\s*(\d+) skipped)?\s*\((\d+)\)/);
  if (!files || !tests) return null;
  return {
    files: Number(files[1]),
    tests: Number(tests[1]),
    filesTotal: Number(files[3]),
    testsTotal: Number(tests[3]),
  };
}

function checkPropertyStep(jobs, runId, ciJobs) {
  const display = ciJobs.get(TEST_JOB_ID);
  const job = jobs.find((j) => j.name === display);
  if (!job) {
    return {
      verdict: 'blocked',
      line: `blocked — attempt job 列表无「${display}」，test:property step 无从核`,
      evidence: `test job（显示名 ${display}）不在 attempt job 列表`,
    };
  }
  const steps = job.steps || [];
  const step = steps.find((s) => s.name === PROPERTY_STEP_NAME);
  if (!step) {
    return {
      verdict: 'SKIP',
      line: `SKIP — step 不存在（改动未推/CI 未生效）：test:property 于 2026-10-08〔7d208fb〕才接线 ci.yml:56，早于该接线的 run 属预期态——不算 fail，醒目标注`,
      evidence: `test job（id ${job.id}）steps 列表无「${PROPERTY_STEP_NAME}」（接线前 run 预期态）`,
    };
  }
  if (step.conclusion !== 'success') {
    return {
      verdict: 'changed',
      line: `changed — step 在但红：${PROPERTY_STEP_NAME}=${step.conclusion}`,
      evidence: `${PROPERTY_STEP_NAME} conclusion=${step.conclusion}`,
    };
  }
  const log = ghJobLog(runId, job.id);
  if (!log) {
    return {
      verdict: 'blocked',
      line: `blocked — step 绿但 test job（id ${job.id}）日志缺失/拉不到，计数无法核`,
      evidence: `step 绿；gh run view ${runId} --job ${job.id} --log 拉不到有效日志`,
    };
  }
  const counts = parsePropertyCounts(log);
  if (!counts) {
    return {
      verdict: 'blocked',
      line: `blocked — step 绿但该 step 日志段未解析出「Test Files / Tests」计数行，计数无法核（疑日志格式漂移）`,
      evidence: `step 绿；日志段内无 Test Files/Tests 计数行`,
    };
  }
  const ok = counts.files >= PROPERTY_FILES_BAR && counts.tests >= PROPERTY_TESTS_BAR;
  const countLine = `Test Files ${counts.files} passed（${counts.filesTotal}） / Tests ${counts.tests} passed（${counts.testsTotal}）`;
  return ok
    ? {
        verdict: 'clean',
        line: `clean — step 绿＋计数达标：${countLine}（判据 ≥${PROPERTY_FILES_BAR} 文件／≥${PROPERTY_TESTS_BAR} 用例）`,
        evidence: `${PROPERTY_STEP_NAME}=success；${countLine}`,
      }
    : {
        verdict: 'changed',
        line: `changed — step 绿但计数不达标：${countLine}（判据 ≥${PROPERTY_FILES_BAR} 文件／≥${PROPERTY_TESTS_BAR} 用例）`,
        evidence: `${PROPERTY_STEP_NAME}=success；${countLine}（不达标）`,
      };
}

// ---------- 输出与证据件 ----------

function todayCompact() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function writeEvidenceFile(args, runId, meta, attempt, slug, results, how) {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const tag = args.pr ? `pr${args.pr}` : `run${runId}`;
  const file = path.join(EVIDENCE_ROOT, `ci-verify-${todayCompact()}-${tag}.md`);
  const heads = {
    1: '五必绿＋首跑全绿（L1-33 首跑绿口径）',
    2: 'EVIDENCE_DIR 两态判定（D-1）',
    3: 'test:property step（票 10）',
  };
  const lines = [];
  lines.push(`# ci-verify 证据件——CI 侧三项核验（${tag}）`);
  lines.push('');
  lines.push(`- 日期：${todayCompact()}（脚本自动落盘）`);
  lines.push(`- 命令：node scripts/ci-verify.mjs ${args.pr ? `--pr ${args.pr}` : `--run ${runId}`}${attempt !== 1 ? ` --attempt ${attempt}` : ''}`);
  lines.push(`- 仓库：${slug}；run 解析：${how}`);
  lines.push(
    `- run 元数据：id=${runId}、event=${meta.event}、branch=${meta.head_branch}、head=${String(meta.head_sha).slice(0, 7)}、创建=${meta.created_at}、最新 run_attempt=${meta.run_attempt}、最新结论=${meta.conclusion}`,
  );
  lines.push(`- 核验口径：attempt=${attempt}${meta.run_attempt > 1 ? `（该 run 存在 rerun，最新 run_attempt=${meta.run_attempt}——L1-33：首跑判定为准，rerun 绿不洗白）` : ''}`);
  lines.push('');
  for (const [n, r] of results.entries()) {
    lines.push(`## [${n + 1}] ${heads[n + 1]}——${r.verdict}`);
    lines.push('');
    lines.push(`${r.line}`);
    if (r.notes && r.notes.length) {
      for (const note of r.notes) lines.push(`（注：${note}）`);
    }
    lines.push('');
    lines.push('证据：');
    lines.push('');
    lines.push(`\`\`\``);
    lines.push(r.evidence || '（无）');
    lines.push(`\`\`\``);
    lines.push('');
  }
  lines.push('## 判定依据（真源指针）');
  lines.push('');
  lines.push('- [1] docs/anti-patterns.md L1-33（PR 门禁收口判据＝run_attempt=1 首跑全绿；rerun 绿与 admin bypass 不算）；docs/verification-gauntlet.md §5.2「五必绿↔11 job 对账表」＋2026-09-30 验证实践补充①；CI 实报口径＝jobs API name 字段（显示名）。');
  lines.push('- [2] docs/verification-gauntlet.md §5.4（EVIDENCE_DIR 三态核验）；唯一直接锚＝tests/qa/visual-qa.mjs:278 运行时打印行；「##[group]Set up job」回显段永远显示字面量不可作判据；upload-artifact「N files uploaded」为间接旁证不作判据。');
  lines.push('- [3] .omo/plans/ulw-verification-infra-roadmap-20261007.md 票 10（step 在 ci.yml:56；计数判据 Test Files ≥2 / Tests ≥6）；step 于 2026-10-08〔7d208fb〕接线，此前 run 属 SKIP 预期态。');
  lines.push('');
  lines.push('关键取数命令（可复跑）：');
  lines.push('');
  lines.push('```bash');
  lines.push(`gh api repos/${slug}/actions/runs/${runId}`);
  lines.push(`gh api repos/${slug}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`);
  lines.push(`gh run view ${runId} --job <visual-qa-job-id> --log | grep "written to"`);
  lines.push(`gh run view ${runId} --job <test-job-id> --log | grep -A3 "Run pnpm test:property"`);
  lines.push('```');
  lines.push('');
  writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
}

// ---------- 主流程 ----------

function fatalBlocked(message) {
  console.log(`总结论：blocked — ${message}`);
  console.log('（整体无法判：run 元数据或 attempt job 列表不可得——exit 1，绝不伪造 clean）');
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let ciJobs;
  let slug;
  try {
    ciJobs = parseCiJobs();
    slug = repoSlug();
  } catch (e) {
    fatalBlocked(`本地前置失败：${e.message}`);
  }
  const missing = MUST_GREEN_IDS.filter((id) => !ciJobs.has(id));
  if (missing.length > 0) {
    fatalBlocked(`ci.yml 缺五必绿 job id：${missing.join(',')}（ci.yml 与本脚本契约漂移，须人工对齐）`);
  }

  let runId;
  let how;
  try {
    ({ runId, how } = resolveRunId(args, slug));
  } catch (e) {
    fatalBlocked(e.message);
  }

  let meta;
  try {
    meta = ghApi(`repos/${slug}/actions/runs/${runId}`);
  } catch (e) {
    fatalBlocked(`run 元数据拉取失败：${e.message}`);
  }
  if (meta.status !== 'completed') {
    fatalBlocked(
      `run ${runId} 状态=${meta.status}（CI 未完成）——等跑完再核；已核元数据：event=${meta.event}、branch=${meta.head_branch}`,
    );
  }

  let jobs;
  try {
    jobs = fetchAttemptJobs(slug, runId, args.attempt, meta.run_attempt);
  } catch (e) {
    fatalBlocked(e.message);
  }

  const r1 = checkFirstRunGreen(jobs, ciJobs, args.attempt);
  const r2 = checkEvidenceDir(jobs, runId, ciJobs);
  const r3 = checkPropertyStep(jobs, runId, ciJobs);
  const results = [r1, r2, r3];

  const rerunNote =
    meta.run_attempt > 1 && args.attempt === 1
      ? `；本 run 存在 rerun（最新 run_attempt=${meta.run_attempt}，最新结论=${meta.conclusion}）——L1-33：首跑判定为准，rerun 绿不洗白`
      : '';
  console.log(`CI 侧三项核验（仓库 ${slug}）`);
  console.log(
    `run ${runId}：event=${meta.event}、branch=${meta.head_branch}、head=${String(meta.head_sha).slice(0, 7)}、创建=${meta.created_at}、最新 run_attempt=${meta.run_attempt}、最新结论=${meta.conclusion}`,
  );
  console.log(`入口：${how}；核验口径：attempt=${args.attempt}（L1-33 首跑绿）${rerunNote}`);
  console.log('');
  results.forEach((r, i) => {
    console.log(`[${i + 1}] ${r.line}`);
    if (r.notes && r.notes.length) {
      for (const note of r.notes) console.log(`    （注：${note}）`);
    }
  });

  const counts = { clean: 0, changed: 0, blocked: 0, SKIP: 0 };
  for (const r of results) counts[r.verdict] += 1;
  const overall = counts.changed > 0 ? 'changed' : counts.blocked > 0 ? 'blocked' : 'clean';
  const evidenceFile = writeEvidenceFile(args, runId, meta, args.attempt, slug, results, how);

  console.log('');
  console.log(
    `总结论：${overall}（明细：clean ${counts.clean} / SKIP ${counts.SKIP} / blocked ${counts.blocked} / changed ${counts.changed}）`,
  );
  console.log(`证据件：${path.relative(REPO_ROOT, evidenceFile)}`);
  process.exit(counts.changed > 0 ? 1 : 0);
}

// 直接执行时跑主流程；被 import 时只暴露解析函数（供 fixture 级单测复用）。
const invokedAsScript =
  process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  main();
}

export { parsePropertyCounts, twoStateOf, stripAnsi, parseCiJobs };
