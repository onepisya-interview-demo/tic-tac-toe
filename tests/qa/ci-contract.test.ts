// tests/qa/ci-contract.test.ts — 票 4（✅D14）CI 契约断言（2026-10-08）
// 机械对账用例：解析 .github/workflows/ci.yml + docs/verification-gauntlet.md，
// 四组断言（验证基建路线图 §七 票 4 动作①②③⑤ 的可静态判定面）：
//   A. BASE_URL 契约——每个探针 job 的探针 step 显式携带
//      BASE_URL=http://localhost:<port>，且端口与本 job 起 server 的 PORT 一致
//      （裸 pnpm start → Next.js 默认 3000）。教训：rooms-race job 漏传 BASE_URL
//      自进 CI 起约 6.3 天未绿（a2a667d 修复，anti-patterns L1-32）。含注入对照
//      臂：剥掉一个 BASE_URL 后断言本检查器会咬（防假绿——检查器自身须可证伪）。
//   B. 豁免清单在档——verification-gauntlet.md §5.1 显式承载「dev push 零 CI」
//      豁免条目＋C6 悬置锚＋L1-32 教训锚（「dev push 零 CI」从结构性盲区升为
//      显式豁免条目，豁免不翻案）。
//   C. 对账表 ↔ ci.yml job 集合双向一致——§5.2 表行 job id 集合＝ci.yml job id
//      集合（「五必绿 ↔ 11 job」对账表的防漂移断言；job 增删须同步表）。
//   D. run_attempt=1 首跑绿口径在档——verification-gauntlet.md 验证实践补充①
//      ＋ anti-patterns L1-33 编号在档（收口判据不得静默漂移；rerun 绿与 admin
//      bypass 混过不算数——PR #18 流程实证）。
// EVIDENCE_DIR 三态核验（票 4 动作④）：D-1 已于 2026-10-21 终判＝「展开」
// （PR #22 run 39582362835，ci-verify [2] clean），断言定版为 describe E
// （job 级 env 禁 runner——c451ee5 非法写法教训）＋ describe F（step 级写法契约）
// （见 verification-gauntlet.md §5.4 修复与定版回执）。
//
// 真源：docs/verification-gauntlet.md §3.6/§5；docs/anti-patterns.md L1-32/L1-33
// （编号引用，去行号防漂移）；.omo/decisions-20261001.md ✅D14 卡。
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, "..", "..", "..");

function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const CI_YML = readRepo(join(".github", "workflows", "ci.yml"));
const GAUNTLET_MD = readRepo(join("docs", "verification-gauntlet.md"));
const ANTIPATTERNS_MD = readRepo(join("docs", "anti-patterns.md"));

const NEXT_DEFAULT_PORT = 3000;

// —— ci.yml 轻量解析（同 probe-reconciliation.test.ts 范式：正则兜底、不引 YAML 依赖）——

/** job id＝两空格缩进 `<id>:`（与验收 grep -cE "^  [a-z0-9-]+:$" 同形；下划线不进字符类，on.pull_request 天然不误计）。返回 id → job body。 */
function parseJobBodies(ciSrc: string): Map<string, string> {
  const jobs = new Map<string, string>();
  const lines = ciSrc.split("\n");
  let cur: string | null = null;
  const body: string[] = [];
  for (const line of lines) {
    const m = /^  ([a-z0-9-]+):$/.exec(line);
    if (m) {
      if (cur) jobs.set(cur, body.join("\n"));
      cur = m[1];
      body.length = 0;
    } else if (cur) {
      body.push(line);
    }
  }
  if (cur) jobs.set(cur, body.join("\n"));
  return jobs;
}

/** 判定器：对任意 ci.yml 文本产出 BASE_URL 契约违例清单（真实源与注入源走同一条路——检查器可证伪的前提）。 */
function baseUrlViolations(ciSrc: string): string[] {
  const violations: string[] = [];
  for (const [id, body] of parseJobBodies(ciSrc)) {
    const hasServer = /pnpm start/.test(body);
    if (!hasServer) continue;
    const portMatch = /PORT=(\d+)/.exec(body);
    const serverPort = portMatch ? Number(portMatch[1]) : NEXT_DEFAULT_PORT;
    // 探针 step＝run 行内 `node tests/qa/<name>.mjs`（探针 job 判定面）
    const runLines = body.split("\n").filter((l) => /tests\/qa\/[a-z0-9-]+\.mjs/.test(l));
    for (const line of runLines) {
      const probe = /tests\/qa\/([a-z0-9-]+\.mjs)/.exec(line)?.[1] ?? "<unknown>";
      const base = /BASE_URL=http:\/\/localhost:(\d+)/.exec(line);
      if (!base) {
        violations.push(`job ${id}: 探针 ${probe} 未显式携带 BASE_URL`);
      } else if (Number(base[1]) !== serverPort) {
        violations.push(
          `job ${id}: 探针 ${probe} BASE_URL=:${base[1]} 与 server 端口 :${serverPort} 不一致`,
        );
      }
    }
  }
  return violations;
}

// —— verification-gauntlet.md §5 解析 ——

/** 取 `## 5.` 起至下一个 `## ` 或文末的节文本。 */
function section5(md: string): string {
  const start = md.indexOf("## 5.");
  expect(start, "verification-gauntlet.md 应含 §5（票 4 落档节）").toBeGreaterThan(-1);
  const next = md.indexOf("\n## ", start + 1);
  return md.slice(start, next === -1 ? undefined : next + 1);
}

/** §5.2 对账表行 job id（行形 `| <n> | <job-id> | …`）。 */
function reconcileTableJobIds(md: string): string[] {
  const sec = section5(md);
  const ids: string[] = [];
  for (const line of sec.split("\n")) {
    const m = /^\| \d+ \| ([a-z0-9-]+) \|/.exec(line);
    if (m) ids.push(m[1]);
  }
  return ids;
}

describe("ci-contract A: BASE_URL 契约（L1-32 / a2a667d 教训的静态断言面）", () => {
  it("每个探针 job：显式 BASE_URL 且端口与起 server 的 PORT 一致", () => {
    expect(baseUrlViolations(CI_YML)).toEqual([]);
  });

  it("探针 job 计数 ≥7（visual-qa＋六个 BR 探针 job——契约覆盖面非空且非孤例）", () => {
    let probeJobs = 0;
    for (const [, body] of parseJobBodies(CI_YML)) {
      if (/pnpm start/.test(body) && /tests\/qa\/[a-z0-9-]+\.mjs/.test(body)) probeJobs += 1;
    }
    expect(probeJobs).toBeGreaterThanOrEqual(7);
  });

  it("注入对照：剥掉 rooms-race 的 BASE_URL → 判定器必报违例（检查器可证伪）", () => {
    const mutated = CI_YML.replace(
      "run: BASE_URL=http://localhost:3101 pnpm exec node tests/qa/rooms-race-qa.mjs",
      "run: pnpm exec node tests/qa/rooms-race-qa.mjs",
    );
    expect(mutated, "注入前提：rooms-race run 行形未变则注入臂失义").not.toBe(CI_YML);
    expect(baseUrlViolations(mutated)).toContain(
      "job rooms-race: 探针 rooms-race-qa.mjs 未显式携带 BASE_URL",
    );
  });

  it("注入对照：BASE_URL 端口与 server 端口错位 → 判定器必报违例", () => {
    const mutated = CI_YML.replace(
      "run: BASE_URL=http://localhost:3199 pnpm exec node tests/qa/home-return-qa.mjs",
      "run: BASE_URL=http://localhost:3000 pnpm exec node tests/qa/home-return-qa.mjs",
    );
    expect(mutated, "注入前提：home-return-qa run 行形未变则注入臂失义").not.toBe(CI_YML);
    expect(baseUrlViolations(mutated)).toContain(
      "job home-return-qa: 探针 home-return-qa.mjs BASE_URL=:3000 与 server 端口 :3199 不一致",
    );
  });
});

describe("ci-contract B: CI 触发面豁免清单显式在档（动作①）", () => {
  it("§5.1 承载「dev push」豁免条目＋C6 悬置锚＋L1-32 教训锚", () => {
    const sec = section5(GAUNTLET_MD);
    expect(sec).toMatch(/### 5\.1 CI 触发面豁免清单/);
    expect(sec).toMatch(/^\| dev push \|/m);
    expect(sec).toMatch(/C6/);
    expect(sec).toMatch(/L1-32/);
  });
});

describe("ci-contract C: 五必绿↔11 job 对账表与 ci.yml job 集合双向一致（动作⑤）", () => {
  it("对账表行 job id 集合＝ci.yml job id 集合（双向相等，防 job 增删后表漂移）", () => {
    const ciIds = [...parseJobBodies(CI_YML).keys()].sort();
    const tableIds = [...new Set(reconcileTableJobIds(GAUNTLET_MD))].sort();
    expect(ciIds.length).toBeGreaterThan(0);
    expect(tableIds).toEqual(ciIds);
  });
});

describe("ci-contract D: run_attempt=1 首跑绿收口判据在档（动作②，L1-33 口径）", () => {
  it("verification-gauntlet.md 验证实践补充承载 run_attempt=1 判据", () => {
    expect(GAUNTLET_MD).toMatch(/run_attempt=1/);
  });

  it("anti-patterns L1-33 编号在档（口径真源不漂移）", () => {
    expect(ANTIPATTERNS_MD).toMatch(/^### L1-33：/m);
  });
});

// —— E. job 级 env 上下文白名单（2026-10-21 D-1 修正案防线）——
// 教训：c451ee5 把 7 处探针 job 的 env.EVIDENCE_DIR 改成 ${{ runner.temp }}，
// 而 GitHub Actions 的 job 级 env 仅允许 github/needs/strategy/matrix/vars/
// secrets/inputs（官方 contexts availability 表），runner 上下文只在 step 级键
// 可用——整个 ci.yml 被判 invalid：push 建 0s 失败 run（38509360622
// "Unrecognized named-value: 'runner'"×7），pull_request 静默不触发（PR #22
// CI 全缺，根因排查见当日本席回执）。本断言把「job 级 env 禁 runner」钉为
// 层①机械防线，同类写法再进仓即红。

/** 判定器：job 级 env（4 空格 `env:` 段，至 `steps:` 止）值里不得引用 `runner.` 上下文。 */
function jobEnvRunnerViolations(ciSrc: string): string[] {
  const violations: string[] = [];
  for (const [id, body] of parseJobBodies(ciSrc)) {
    let inEnv = false;
    for (const line of body.split("\n")) {
      if (/^    env:$/.test(line)) {
        inEnv = true;
        continue;
      }
      if (/^    steps:$/.test(line)) {
        inEnv = false;
        continue;
      }
      if (inEnv && /^\s{6}[A-Za-z_]+:.*\$\{\{[^}]*runner\./.test(line)) {
        violations.push(`job ${id}: job 级 env 禁引用 runner 上下文（step 级 env 或 run 内 $RUNNER_TEMP 才可用）: ${line.trim()}`);
      }
    }
  }
  return violations;
}

describe("ci-contract E: job 级 env 禁 runner 上下文（D-1 修正案防线，2026-10-21）", () => {
  it("ci.yml 所有 job 级 env 值零 runner. 引用", () => {
    expect(jobEnvRunnerViolations(CI_YML)).toEqual([]);
  });

  it("注入对照：job 级 env 添 runner.temp → 判定器必报违例（检查器可证伪）", () => {
    const mutated = CI_YML.replace(
      "    env:\n      NEXT_TELEMETRY_DISABLED: 1",
      "    env:\n      NEXT_TELEMETRY_DISABLED: 1\n      EVIDENCE_DIR: ${{ runner.temp }}/injected",
    );
    expect(mutated, "注入前提：首个 job env 段行形未变则注入臂失义").not.toBe(CI_YML);
    expect(jobEnvRunnerViolations(mutated).length).toBeGreaterThan(0);
  });
});

// —— F. 探针 step 级 EVIDENCE_DIR 写法契约（2026-10-21 D-1 终判「展开」后定版，VF-S54 连动收口）——
// 终判依据：PR #22 run 39582362835，ci-verify 判据 [2] clean（env 展开为
// /home/runner/work/_temp/<name> 真路径，锚行见 §5.4）。本节拦两态回退：
// ①探针 step 丢 EVIDENCE_DIR；②写法回退 shell 字面量 ${RUNNER_TEMP}（D-1 起点
// 病灶）。job 级非法写法由 describe E 拦。

function evidenceDirViolations(ciSrc: string): string[] {
  const violations: string[] = [];
  const lines = ciSrc.split("\n");
  const probeRun = /^\s{8}run: BASE_URL=http:\/\/localhost:\d+ pnpm exec node (tests\/qa\/[a-z0-9-]+\.mjs)$/;
  for (let i = 0; i < lines.length; i += 1) {
    const m = probeRun.exec(lines[i]);
    if (!m) continue;
    let found: string | null = null;
    for (let j = i - 1; j >= 0 && /^\s{8}/.test(lines[j]); j -= 1) {
      const em = /^\s{10}EVIDENCE_DIR:\s*(.+?)\s*$/.exec(lines[j]);
      if (em) {
        found = em[1];
        break;
      }
    }
    if (found === null) {
      violations.push(`探针 step（${m[1]}）缺 step 级 env.EVIDENCE_DIR`);
    } else if (!/^\$\{\{ ?runner\.temp ?\}\}\/[a-z0-9-]+$/.test(found)) {
      violations.push(`探针 step（${m[1]}）EVIDENCE_DIR 非 \${{ runner.temp }}/<name> 写法：${found}`);
    }
  }
  return violations;
}

describe("ci-contract F: 探针 step 级 EVIDENCE_DIR 写法契约（D-1 终判定版，2026-10-21）", () => {
  it("全部探针 step：step 级 env 携带 ${{ runner.temp }}/<name> 写法的 EVIDENCE_DIR", () => {
    expect(evidenceDirViolations(CI_YML)).toEqual([]);
  });

  it("注入对照：剥掉 visual-qa 的 step 级 EVIDENCE_DIR → 判定器必报（检查器可证伪）", () => {
    const mutated = CI_YML.replace(
      '        env:\n          EVIDENCE_DIR: ${{ runner.temp }}/visual-qa\n',
      "",
    );
    expect(mutated, "注入前提：visual-qa step env 块行形未变则注入臂失义").not.toBe(CI_YML);
    expect(evidenceDirViolations(mutated).length).toBeGreaterThan(0);
  });
});
