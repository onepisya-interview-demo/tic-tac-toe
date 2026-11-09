#!/usr/bin/env node
// Commit-policy audit.
//
// Modes:
//   node tests/qa/commit-audit.mjs                  # audit all commits on main
//   node tests/qa/commit-audit.mjs --branch <name>  # audit all commits on <name>
//   node tests/qa/commit-audit.mjs --message-file F # audit a single commit message file
//   node tests/qa/commit-audit.mjs --staged         # R8 scan of staged added lines (pre-commit hook)
//
// Exit 0 when all checks pass; exit 1 when any fail.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));


// English and Chinese bodies share the same WHY/HOW policy. English tokens
// keep word boundaries; Chinese keyphrases are matched literally because
// JavaScript `\b` does not fire around CJK ideographs. Keep Chinese entries
// at two or more characters so a stray character cannot satisfy the policy.
const TYPE_RE = /^(feat|fix|refactor|test|docs|chore|build|ci|perf)(\([^)]+\))?!?: /;
const PROMPT_RE = /^prompt\([^)]+\)!?: /;

// R7 (中文语言规则，2026-09-23 入档) — subject 描述部分（剥掉 TYPE_RE / PROMPT_RE
// 前缀后）必须含至少一个 CJK 字符。阈值取最小门槛「≥1 CJK」以防误杀标识符密集
// 的中文 subject，例如「refactor(store): 抽取 resetStore helper 统一 11 处 setState
// 重置块」必须 PASS。CJK 范围取基本平面加扩展 A，99% 现代中文落地。
const CJK_RE = /[\u3400-\u9fff]/;

// Trailer 豁免清单：枚举 + 路径 footer 不进 R7 自由文本校验。
const TRAILER_ENUM_OR_PATH_KEYS = new Set(["Confidence", "Scope-risk", "Plan"]);

const ENGLISH_WHY_TOKENS = [
  "because", "so that", "in order to", "to fix", "to enable", "to support",
  "to allow", "to make", "missing", "broken", "broke", "failing", "fail\\b",
  "dead code", "was a no-op", "the user", "requirement", "bug\\b", "problem",
  "requested", "asked for", "overrides", "forbid", "policy", "explicit",
  "without", "to avoid", "in favor", "instead", "to stop", "to prevent",
  "to land", "to ship", "to satisfy", "need\\w*", "necessary", "muddies",
  "drift", "regression", "prevent", "avoid", "satisfy", "wanted", "to keep",
  "to surface", "to capture", "unbreaks", "existed", "allowed", "risk",
  "fragile", "brittle", "wrong", "no-op", "trigger\\w*", "caused",
  "cause\\w*", "root cause", "oversight", "premature", "lazy", "prior",
];
const CJK_WHY_KEYPHRASES = [
  "因为", "由于", "为了", "满足", "修复", "用户要求", "用户希望", "缺失",
  "暴露", "防止", "阻止", "错误", "故障", "不一致", "不够", "避免", "风险",
  "失败", "拒绝", "不允许", "依赖", "依赖项", "缺口", "不符合", "违反",
  "拦截", "防御", "覆盖", "全量", "要求", "希望", "问题", "前提", "原因",
  "动机", "诉求", "决策", "取舍",
];
const ENGLISH_HOW_TOKENS = [
  "via", "by adding", "by using", "by writ", "by replacing", "with a",
  "with an", "tested", "verified", "pnpm", "vitest", "playwright",
  "useEffect", "useState", "setTimeout", "commitlint", "hook", "rebase",
  "rebased", "loader", "component", "module", "function", "helper",
  "pattern", "envelope", "emit\\w*", "synthesize", "synthesized",
  "layer\\w*", "API surface", "using", "calling", "renamed", "rewrote",
  "rename\\w*", "moved to", "moved from", "replaces", "creates", "created",
  "shipped", "ships", "ship\\b", "lands", "land\\b", "captures",
  "capture\\w*", "wrap", "wrapped", "wraps", "reads", "reads from",
  "consumes", "consume", "exposes", "expose", "exports", "export\\w*",
  "invokes", "invoke\\w*", "calls", "call\\b", "parses", "parse\\b",
  "fires", "fire\\b", "schedules", "schedule\\w*", "delays", "delay\\w*",
  "throttl\\w*", "debounc\\w*", "hydrat\\w*", "render\\w*", "mount\\w*",
  "scroll\\w*", "click\\w*", "handler", "provider", "router\\w*",
  "middleware", "guard\\b", "validator", "validat\\w*", "lint\\b", "tsc\\b",
  "eslint\\b", "format\\w*", "snapshot\\w*", "screenshot\\w*", "mocks",
  "mock\\w*", "stub\\w*", "fixture", "assert\\w*", "probe\\b", "wait\\b",
  "await\\w*", "promise\\b",
];
const CJK_HOW_KEYPHRASES = [
  "通过", "使用", "验证", "测试", "钩子", "脚本", "命令", "重写", "备份",
  "提交", "审计", "改写", "扩展", "拦截", "重命名", "增加", "修改", "删除",
  "调整", "锁定", "引入", "安装", "调用", "部署", "触发", "运行", "执行",
  "打包", "接入", "纳入", "加载", "注入", "对齐", "合并", "拆分", "回放",
  "整理", "对接", "导出", "落地", "排查", "诊断", "定位", "修复", "覆盖",
  "加固", "起效", "生效", "打通", "扫一遍", "补上", "新加",
];

const WHY_RE = new RegExp(
  `\\b(?:${ENGLISH_WHY_TOKENS.join("|")})\\b|(?:${CJK_WHY_KEYPHRASES.join("|")})`,
  "i",
);
const HOW_RE = new RegExp(
  `\\b(?:${ENGLISH_HOW_TOKENS.join("|")})\\b|(?:${CJK_HOW_KEYPHRASES.join("|")})`,
  "i",
);
const TRAILER_KEY = /^(Constraint|Rejected|Confidence|Scope-risk|Directive|Tested|Not-tested|Plan|Refs|Closes|Fixes|Breaking|See-also|Co-authored-by|Signed-off-by|Reviewer|Reviewed-by):\s/;

// Dependabot squash merges are authored by GitHub's bot and can never carry
// the human lore trailers this policy requires. Branch mode SKIPs R3-R5 for
// them (R1/R2 subject checks stay enforced); --message-file mode - the human
// commit entry point - is never exempted. Identity-based, not subject-based,
// so a human message cannot borrow the exemption.
const DEPENDABOT_EMAIL = "dependabot[bot]@users.noreply.github.com";
const DEPENDABOT_NAME = "dependabot[bot]";

// GitHub squash merge（2026-10-25 补，第四类机器产物豁免）——GitHub 端 squash
// 与网页提交的 committer 恒为 "GitHub <noreply@github.com>"：subject 是 PR 标题
// 原文（含 "(#N)" 后缀），正文是成员提交消息机器拼接，Conventional 前缀与
// lore trailers 均非提交时刻可承载。identity-based 判据（committer 面，与
// Dependabot 的 author 面同构）；branch/range 模式全 per-commit 规则豁免（同
// merge commit 豁免面），--message-file 钩子路径结构性不可达（main() 调
// checkMessage 无此 opt）。实证：4ac5acf（PR #22 squash 产物，dev 终审 fail=1）
// 即此豁免缺口。
const GITHUB_COMMITTER_EMAIL = "noreply@github.com";

// Historical exemption baseline for branch / range mode (--message-file hook
// path is never exempted). Three classes, each keyed on a distinct dimension
// so a single token cannot borrow multiple exemptions:
//   1. Merge commits - GitHub's PR-merge bot generates them with subject
//      "Merge pull request #N from owner/branch"; they carry no human
//      message and no lore trailers by construction. Detected by subject
//      pattern (constructive: machine-generated, never human-authored).
//   2. Dependabot commits - GitHub's bot authors them (identity-based,
//      not subject-based, so a human cannot borrow the exemption). Extends
//      the existing ae02a33 R3-R5 exemption to R7 subject and trailer CJK
//      via the same `botAuthored` short-circuit below.
//   3. Pre-rule-adoption debt - commits authored before R7's adoption
//      date (2026-09-23, chore(audit) 3068b22a) cannot have violated R7
//      because R7 did not yet exist; grandfather them in branch mode only.
//      Author-date based (time anchor), orthogonal to subject / author.
//      This class now carries two anchors, each grandfathering its own
//      rule surface: R7_ADOPTION_DATE exempts R7 (CJK subject / trailer);
//      R3_STRICT_ADOPTION_DATE exempts only the R3 explicit-token
//      requirement (keyword fallback stays for pre-anchor history).
//
// The three classes absorb the 164 existing per-commit R1-R5/R7 failures
// without changing the rule semantics for any commit authored on or after
// 2026-09-23. R6 (repo-state check) and the --message-file hook path
// (human commit entry point) are intentionally untouched.
const R7_ADOPTION_DATE = "2026-09-23";
// R3 严格化（显式 WHAT:/WHY:/HOW: token 硬要求）采纳锚点，语义仿 R7_ADOPTION_DATE：
// 日级 <= 比较（ISO-8601 日字符串字典序），采纳日整日视为旧账的保守读法。仅用于
// branch/range 模式旧账豁免（preR3StrictAdoption）——锚点及之前的散文正文仍走
// WHY_RE/HOW_RE 关键词祖父分支；--message-file 钩子路径永不豁免（main() 调
// checkMessage 无第三参，opts.preR3StrictAdoption 恒 falsy，结构性不可达）。
const R3_STRICT_ADOPTION_DATE = "2026-10-24";
const MERGE_COMMIT_RE = /^Merge pull request #\d+ /;

// R8（注释增量门禁，2026-10-25 入档；注释分诊 rollout 台账 §三）——对六目录
// (app/components/lib/db/scripts/tests) 的 ts/tsx/mjs/js/cjs 新增行做注释形态
// 检查。blocking 三子集只检 `//` 行注释形态：B1 注释掉的死代码（代码形状版，
// 存量零命中）、B2 阶段叙述（收紧版，存量零命中）、B3 eslint 抑制指令缺
// ` -- ` 描述（ESLint 官方语法；存量 7 处皆无描述、不溯及，只拦增量新增行）。
// JSX 与块注释形态入 advisory 面（A2 二期，本版不实现）。advisory：A1 banner
// （半角；含决策编号/判据/票号回链的白名单跳过，纯分隔线存量不拦、只监控
// 增量）＋M3' 无标记注释占比报表（剔除留格标记后计算，纯报表、无阻断、不
// 预留收紧）。正则与存量 dry-run 结论逐字取自注释分诊方案 v2 §3.2 M1
// (.omo/plans/comment-triage-practice-v2-20261024.md)，不得自行放宽或收紧。
// 触发面：--staged 增量模式（pre-commit hook 调用，读 git diff --cached -U0
// 新增行）＋branch/range 模式对采纳日之后 commit 的逐笔 added-line 扫描；
// --message-file 模式（commit-msg hook 路径）行为完全不变、不跑 R8。
//
// R8 shell 扩展（2026-11-09 入档，sh 门禁波；台账 .omo/plans/sh-gate-wave-20261109.md）：
// 扫描组扩至 .sh（同六目录）。shell 注释以行首 `#` 计（shebang 除外）：B2 阶段
// 叙述 shell 形态入 blocking（dry-run 全历史 152 条 .sh 新增行零命中）；B1 注释
// 掉的命令形状仅入 advisory——宽词表形状在历史上仅有的 4 处命中全部是
// `#   exit 0 = ...` 式 exit 语义契约注释（至今仍在 vercel 双脚本），历史精确率
// 0/4，无法构造存量零误报的 blocking 形状，落 advisory 只监控；A1 banner `#`
// 形态入 advisory（零命中）；B3 eslint 抑制指令对 shell 无意义（n/a——shell 用
// shellcheck 自己的 `# shellcheck disable=SCxxxx` 指令面，不在本波）。祖父：.sh
// 面独立锚点 R8_SHELL_ADOPTION_DATE=2026-11-09（作者日期日级严格 <，采纳日当日
// 即生效）——与 JS 面 R8_ADOPTION_DATE 的整日祖父保守读法刻意不同：shell 面随
// 本波当日落地、--staged 面同刻起即强制，branch 面当日不豁免保持两面对称（沙箱
// 边界已钉死：2026-11-08 豁免／2026-11-09 必罚）。锚点前存量（最后一笔 .sh
// commit fa0d4e9=2026-10-25）整段祖父，扩展对存量零追溯。
const R8_ADOPTION_DATE = "2026-10-25";
// R8 shell 扩展独立锚点（2026-11-09）：语义与 JS 面锚点的差异见上——JS 面 `<=`
// 整日祖父（规则当日 22:30 才落地，当日早些的 commit 无法合规）；shell 面本波
// 当日落地即当日生效，比较取严格 `<`（采纳日当日不豁免）。两锚点各自祖父
// 自己的规则面：preR8Adoption 管 `//` 族，preR8ShellAdoption 管 `#` 族。
const R8_SHELL_ADOPTION_DATE = "2026-11-09";
const R8_SCAN_PATH_RE = /^(app|components|lib|db|scripts|tests)\/.*\.(ts|tsx|mjs|js|cjs|sh)$/;
const R8_DEAD_CODE_RE = /^\s*\/\/\s*((const|let|var|import|export)\s+\w+.*[;{(]\s*$|console\.\w+\(|return\s+[\w.'"`]+;\s*$)/;
const R8_PHASE_NARRATION_RE = /\/\/\s*(Phase|Step)\s*\d/;
// 判据词以 [-] 写法拆开，避免本文件自身新增行命中 B3（语义等价）。
const R8_ESLINT_DISABLE_RE = /eslint[-]disable/;
const R8_BANNER_RE = /\/\/\s*(={5,}|-{5,}|\*{5,})/;
// 留格标记口径（A1 白名单与 M3' 报表共用，方案 §3.2 M3'）：决策编号族＋BR 号＋
// plan 回链＋判据回链；`// BR:` 头与 JSDoc/块注释契约形态由 scanR8 按行形态识别。
const R8_RETENTION_RE = /(W-R|案[①②③]|L1-\d|D-\d|票 ?\d|BR-\d|\.omo\/plans\/|判据)/;
// R8 shell 扩展正则（2026-11-09，取舍见上）：B2 shell 形态与 JS 版同构（`#` 替
// `//`），仅施加于 .sh 文件的行首 `#` 注释行——字符串内的 `#` 不计（红线：存量
// 零误报，比 JS 版更保守的行首锚定）；B1 shell 命令形状仅 advisory，词表只收
// 注释掉后几乎必为死代码的命令（排除 exit/echo 等契约说明常用词，dry-run 佐证
// 见台账）；A1 banner shell 形态同 JS 判据（=,-,* 五连以上）。
const R8_SHELL_PHASE_NARRATION_RE = /#\s*(Phase|Step)\s*\d/;
const R8_SHELL_DEAD_CODE_RE = /^\s*#\s*(git|pnpm|npm|npx|curl|wget|rm|cp|mv|chmod|chown|sudo|kill)\b/;
const R8_SHELL_BANNER_RE = /#\s*(={5,}|-{5,}|\*{5,})/;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--branch") out.branch = argv[++i];
    else if (a === "--message-file") out.messageFile = argv[++i];
    else if (a === "--range") out.range = argv[++i];
    else if (a === "--root") out.root = argv[++i];
    else if (a === "--staged") out.staged = true;
  }
  return out;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", cwd: process.cwd() }).trimEnd();
}

function parseMessage(raw) {
  const [firstLine, ...rest] = raw.split("\n");
  const subject = firstLine;
  const lines = rest;
  const bodyLines = [];
  const trailerLines = [];
  let i = 0;
  // Skip leading blanks after the subject line. We only switch into trailer
  // mode when a real TRAILER_KEY line appears; blank lines stay in body so
  // multi-paragraph bodies do not get prematurely truncated.
  while (i < lines.length && lines[i].trim() === "") i++;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (TRAILER_KEY.test(line)) {
      trailerLines.push(line);
    } else if (trailerLines.length > 0) {
      trailerLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }
  while (trailerLines.length > 0 && trailerLines[trailerLines.length - 1].trim() === "") trailerLines.pop();
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") bodyLines.pop();
  const body = bodyLines.join("\n").trim();
  const footer = trailerLines.join("\n").trim();
  return { subject, body, footer, raw };
}

function checkMessage(label, raw, opts = {}) {
  const { subject, body, footer } = parseMessage(raw);
  const findings = [];

  // Merge commits are GitHub-generated PR-merge records; they carry no
  // human-authored message by construction, so every per-commit rule
  // (R1 prefix, R2 length, R3 body, R4 trailers, R5 footer, R7 CJK) is
  // structurally inapplicable. Short-circuit with empty findings so the
  // branch loop prints a SKIP line tagged "(merge commit)" and the
  // historical exemption baseline stays honest. Branch mode only; the
  // --message-file hook path is unreachable here because main() routes
  // --message-file to its own branch before calling checkMessage at all.
  if (opts.isMerge) {
    return { label, subject, body, footer, findings: [], mergeCommit: true };
  }

  // GitHub squash / web commits (GITHUB_COMMITTER_EMAIL above): skip every
  // per-commit rule in branch mode, mirroring the merge-commit surface.
  if (opts.githubCommitted) {
    return { label, subject, body, footer, findings: [], githubCommitted: true };
  }

  if (subject.length > 100) findings.push({ rule: "R2", msg: `subject ${subject.length} chars > 100` });
  if (!PROMPT_RE.test(subject) && !TYPE_RE.test(subject)) {
    findings.push({ rule: "R1", msg: `subject does not match Conventional or prompt() prefix: "${subject}"` });
  }

  const isPrompt = PROMPT_RE.test(subject);
  if (!isPrompt && !opts.botAuthored) {
    // R7 subject: after stripping TYPE_RE / PROMPT_RE prefix, the description
    // must contain at least one CJK character. Prompt commits are exempt (R7
    // only applies to Conventional Commits by spec). Pre-rule-adoption debt:
    // commits authored before R7_ADOPTION_DATE cannot have violated R7
    // because R7 did not yet exist; the check is skipped for them in
    // branch / range mode only (the --message-file hook path is never
    // exempted, so new commits are always held to the live rule).
    const subjectNoPrefix = subject
      .replace(PROMPT_RE, "")
      .replace(TYPE_RE, "")
      .trim();
    if (!opts.preR7Adoption && !CJK_RE.test(subjectNoPrefix)) {
      findings.push({ rule: "R7", msg: `subject description lacks CJK characters: "${subjectNoPrefix}"` });
    }

    // R3 严格化（2026-10-24 采纳）：docs/commit-policy.md §正文 schema 的
    // WHAT/WHY/HOW 三段由可选捷径升为硬要求——缺任一显式 token 即 FAIL，
    // finding 列出缺失 token 清单。散文关键词启发式（WHY_RE/HOW_RE）退役为
    // branch/range 模式采纳日前旧账的祖父分支（preR3StrictAdoption，仿
    // preR7Adoption；--message-file 路径无此 opt，恒走严格门）。token 形态
    // 同行/独占行均认（/\bWHAT:\s/），行长排版归 commitlint 与排版硬规则。
    const missingHeadings = [
      ["WHAT:", /\bWHAT:\s/],
      ["WHY:", /\bWHY:\s/],
      ["HOW:", /\bHOW:\s/],
    ].filter(([, re]) => !re.test(body)).map(([tok]) => tok);
    if (body.length < 60) {
      findings.push({ rule: "R3", msg: `body too short (${body.length} chars) - must explain what + why + how` });
    } else if (missingHeadings.length > 0) {
      if (opts.preR3StrictAdoption) {
        if (!WHY_RE.test(body)) findings.push({ rule: "R3", msg: "body does not mention WHY (no because/so-that/to fix/missing/bug/...)" });
        if (!HOW_RE.test(body)) findings.push({ rule: "R3", msg: "body does not mention HOW (no via/by/with/pnpm/vitest/playwright/...)" });
      } else {
        findings.push({ rule: "R3", msg: `body lacks explicit WHAT:/WHY:/HOW: tokens (missing ${missingHeadings.join(" ")}) - keyword fallback is pre-2026-10-24 branch-mode history only` });
      }
    }

    if (!/\bConfidence:\s*(low|medium|high)\b/i.test(footer)) {
      findings.push({ rule: "R4", msg: "missing trailer: Confidence: low|medium|high" });
    }
    if (!/\bScope-risk:\s*(narrow|moderate|broad)\b/i.test(footer)) {
      findings.push({ rule: "R4", msg: "missing trailer: Scope-risk: narrow|moderate|broad" });
    }
    if (!/^Plan:\s+\S+/m.test(footer)) {
      findings.push({ rule: "R5", msg: "missing footer: Plan: .omo/plans/<slug>.md" });
    }

    // R7 trailer: free-text trailer values must contain at least one CJK
    // character. Enum trailers (Confidence / Scope-risk) and the Plan: path
    // footer are exempt - they carry machine-consumed tokens, not prose.
    // Pre-rule-adoption debt exempts free-text trailer CJK the same way
    // it exempts subject CJK above (symmetric grandfathering).
    if (!opts.preR7Adoption) {
      for (const tLine of footer.split("\n")) {
        const m = /^([A-Z][\w-]*):\s*(.*)$/.exec(tLine.trim());
        if (!m) continue;
        const key = m[1];
        const value = m[2];
        if (TRAILER_ENUM_OR_PATH_KEYS.has(key)) continue;
        if (!CJK_RE.test(value)) {
          findings.push({ rule: "R7", msg: `trailer "${key}:" value lacks CJK characters: "${value}"` });
        }
      }
    }
  }

  return { label, subject, body, footer, findings, botAuthored: Boolean(opts.botAuthored), mergeCommit: false };
}


// R6 (BR ↔ probe two-way binding). Repo-state check that runs only in
// --branch mode (per-commit --message-file mode skips it). Walks the
// probe column of every BR row in docs/business-rules.md and verifies
// each backtick-quoted path (a) exists in the repo and (b) the file's
// first 20 lines mention the BR number. Rows whose probe column carries
// "⚠ 未探针化" are exempt (decree-level "no probe yet" markers stay
// under doc-level constraint, not the mechanical audit).
function auditBrProbeBinding(repoRoot) {
  const findings = [];
  const mdPath = path.join(repoRoot, "docs", "business-rules.md");
  let raw;
  try {
    raw = readFileSync(mdPath, "utf8");
  } catch {
    return findings;
  }
  for (const row of parseBrRows(raw)) {
    if (row.exempt) continue;
    for (const probe of row.probes) {
      const absPath = path.join(repoRoot, probe);
      if (!existsSync(absPath)) {
        findings.push({ rule: "R6", msg: `${row.br}: probe file not found: ${probe}` });
        continue;
      }
      let headText;
      try {
        headText = readFileSync(absPath, "utf8").split("\n").slice(0, 20).join("\n");
      } catch {
        continue;
      }
      if (!headText.includes(row.br)) {
        findings.push({ rule: "R6", msg: `${row.br}: probe file ${probe} header missing BR reference (first 20 lines do not contain ${row.br})` });
      }
    }
  }
  return findings;
}

// Parse the BR table in docs/business-rules.md. Returns one entry per
// BR-N row: { br, probes, exempt }. Rows are identified by a leading
// "| BR-N |" header cell; the probe column is the LAST cell. Path tokens
// are extracted from backticks. Exemption is detected when the probe
// column carries "⚠ 未探针化" (kept as a comment-only marker).
function parseBrRows(md) {
  const rows = [];
  for (const line of md.split("\n")) {
    const m = /^\|\s*(BR-\d+)\s*\|/.exec(line);
    if (!m) continue;
    const br = m[1];
    // Markdown tables wrap every row in `|`; trim the wrapping pipes before
    // splitting so the probe column is the last non-empty cell, not the
    // empty trailing fragment a raw split would yield.
    const cells = line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
    const probeCell = cells[cells.length - 1] ?? "";
    const exempt = /⚠\s*未探针化/.test(probeCell);
    if (exempt) {
      rows.push({ br, probes: [], exempt: true });
      continue;
    }
    const probes = [];
    const re = /`([^`]+)`/g;
    let pm;
    while ((pm = re.exec(probeCell)) !== null) {
      probes.push(pm[1]);
    }
    rows.push({ br, probes, exempt: false });
  }
  return rows;
}

// Parse a `git diff -U0` style patch into per-file added lines with target-side
// line numbers. Only `+` payload lines count; deletions do not advance the
// target counter; hunk headers carry the start line for `no`.
function parseAddedLines(diff) {
  const files = [];
  let cur = null;
  let lineNo = 0;
  for (const raw of diff.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
    if (hunk) {
      lineNo = Number(hunk[1]) - 1;
      continue;
    }
    if (raw.startsWith("+++ b/")) {
      cur = { path: raw.slice(6), lines: [] };
      files.push(cur);
      continue;
    }
    if (!cur) continue;
    if (raw.startsWith("+")) {
      lineNo += 1;
      cur.lines.push({ no: lineNo, text: raw.slice(1) });
    }
  }
  return files;
}

// R8 scan of one diff's added lines. Returns blocking findings (B1/B2/B3),
// advisory notes (A1) and the M3' unmarked-comment ratio counters. Blocking
// regexes self-describe the `//` comment shape and are applied line-level,
// exactly as the dry-run validated them. M3' counts all comment forms (line,
// block, JSDoc continuation) in the denominator; retention-marked lines,
// `// BR:` heads and block/JSDoc-form lines count as marked（留格），so the
// unmarked remainder answers "how many added comments carry no triage marker
// at all" — pure observation, no threshold.
function scanR8(diff, opts = {}) {
  const findings = [];
  const notes = [];
  let commentLines = 0;
  let markedLines = 0;
  for (const file of parseAddedLines(diff)) {
    if (!R8_SCAN_PATH_RE.test(file.path)) continue;
    // shell 面祖父：作者日期早于 R8_SHELL_ADOPTION_DATE 的 commit 跳过整个
    // `#` 族（规则尚不存在），`//` 族不受此 opt 影响、仍按 R8_ADOPTION_DATE
    // 各自祖父。--staged 面不传此 opt（同 JS 面：钩子路径永不豁免）。
    if (file.path.endsWith(".sh") && opts.preR8ShellAdoption) continue;
    for (const { no, text } of file.lines) {
      // R8 shell 面（2026-11-09 扩展）：.sh 走 `#` 注释形态族后 continue，
      // `//` 族检查结构性不可达——双向零交叉：.ts 里的 `#`（字符串/模板字面
      // 量）与 .sh 里的 `//`（URL 等）互不触发。shebang 不是分诊面注释，
      // 不计入 M3' 分母。blocking 仅 B2；B1/A1 为 advisory（取舍见正则处）。
      if (file.path.endsWith(".sh")) {
        const isShellComment = /^\s*#/.test(text);
        const isShebang = /^\s*#!\//.test(text);
        if (isShellComment && !isShebang) {
          commentLines += 1;
          if (R8_RETENTION_RE.test(text)) {
            markedLines += 1;
          }
        }
        if (isShellComment && R8_SHELL_PHASE_NARRATION_RE.test(text)) {
          findings.push({ rule: "R8", msg: `B2 phase narration: ${file.path}:${no}: ${text.trim()}` });
        }
        if (R8_SHELL_DEAD_CODE_RE.test(text)) {
          notes.push(`B1 shell commented-out command shape (advisory): ${file.path}:${no}: ${text.trim()}`);
        }
        if (isShellComment && R8_SHELL_BANNER_RE.test(text) && !R8_RETENTION_RE.test(text)) {
          notes.push(`A1 banner without retention backlink (advisory): ${file.path}:${no}: ${text.trim()}`);
        }
        continue;
      }
      const isBlockForm = /^\s*\/\*/.test(text) || /^\s*\*/.test(text) || text.includes("{/*");
      if (/^\s*\/\//.test(text) || isBlockForm) {
        commentLines += 1;
        if (isBlockForm || R8_RETENTION_RE.test(text) || /^\s*\/\/\s*BR:/.test(text)) {
          markedLines += 1;
        }
      }
      if (R8_DEAD_CODE_RE.test(text)) {
        findings.push({ rule: "R8", msg: `B1 commented-out code shape: ${file.path}:${no}: ${text.trim()}` });
      }
      if (R8_PHASE_NARRATION_RE.test(text)) {
        findings.push({ rule: "R8", msg: `B2 phase narration: ${file.path}:${no}: ${text.trim()}` });
      }
      if (R8_ESLINT_DISABLE_RE.test(text) && !text.includes(" -- ")) {
        findings.push({ rule: "R8", msg: `B3 eslint suppression directive lacks " -- " description: ${file.path}:${no}` });
      }
      if (R8_BANNER_RE.test(text) && !R8_RETENTION_RE.test(text)) {
        notes.push(`A1 banner without retention backlink (advisory): ${file.path}:${no}: ${text.trim()}`);
      }
    }
  }
  return { findings, notes, commentLines, markedLines, unmarked: commentLines - markedLines };
}

function main() {
  if (args.messageFile) {
    const raw = readFileSync(args.messageFile, "utf8");
    const r = checkMessage(args.messageFile, raw);
    if (r.findings.length === 0) {
      // Second, independent checkpoint: commitlint mirrors this audit's policy
      // in commitlint.config.cjs plus the config-conventional standard rules
      // the R1-R5 regexes do not model (subject-full-stop, type-case,
      // body-max-line-length, ...). The audit stays canonical (see
      // .omo/plans/commit-policy-enforcement.md): its findings gate the spawn, and a commitlint rejection
      // still surfaces as an audit failure. Branch mode above does not
      // re-lint history; this runs on message-file invocations only.
      try {
        execFileSync("pnpm", ["exec", "commitlint", "--edit", args.messageFile], {
          stdio: "inherit",
          cwd: process.cwd(),
        });
      } catch (err) {
        console.error(`FAIL  ${r.label}  ${r.subject}`);
        const errno = err && typeof err === "object" && "code" in err ? String(err.code) : "";
        if (errno === "ENOENT") {
          console.error("        commitlint: could not be executed (pnpm/commitlint missing from PATH or node_modules); fix the install - failing closed");
        } else {
          console.error("        commitlint: rejected the message (rule output above)");
        }
        process.exit(1);
      }
      console.log(`PASS  ${r.label}  ${r.subject}`);
      process.exit(0);
    }
    console.error(`FAIL  ${r.label}  ${r.subject}`);
    for (const f of r.findings) {
      console.error(`        ${f.rule}: ${f.msg}`);
    }
    process.exit(1);
  }

  // R8 staged mode: incremental comment gate for the pre-commit hook. Reads
  // added lines from `git diff --cached -U0`; the --message-file branch above
  // returns before reaching here, so the commit-msg hook path is structurally
  // unchanged. Exit contract for the hook (see .git/hooks/pre-commit): 0 +
  // "R8-STAGED: PASS" = clean; 1 + "R8-STAGED: FAIL" = blocking violations
  // (fail-closed at the hook); 3 = the guard itself could not scan — the hook
  // fails open on anything that is not an explicit verdict.
  if (args.staged) {
    let r8;
    try {
      r8 = scanR8(git("diff", "--cached", "-U0"));
    } catch (err) {
      console.error(`[r8-guard] --staged scan crashed: ${err && err.message ? err.message : String(err)}`);
      process.exit(3);
    }
    for (const n of r8.notes) console.log(`NOTE  R8  ${n}`);
    for (const f of r8.findings) console.log(`FAIL  R8  ${f.msg}`);
    if (r8.commentLines > 0) {
      console.log(`R8 report M3': added comment lines=${r8.commentLines} marked=${r8.markedLines} unmarked=${r8.unmarked} (pure report, no threshold)`);
    }
    if (r8.findings.length > 0) {
      console.log("R8-STAGED: FAIL");
      process.exit(1);
    }
    console.log("R8-STAGED: PASS");
    process.exit(0);
  }

  // Branch / range mode: choose ref from --range (any git ref expression
  // such as origin/main..HEAD, HEAD~5..HEAD, or a branch name) and fall
  // back to --branch or "main" for backward compatibility. The ref is
  // printed verbatim in the summary line so CI logs make the audited
  // surface self-describing.
  const ref = args.range ?? args.branch ?? "main";
  const records = git("log", "--reverse", "--format=%H%x1f%ae%x1f%an%x1f%aI%x1f%ce", ref)
    .split("\n").filter(Boolean);
  const results = records.map((record) => {
    const [sha, authorEmail, authorName, authorDate, committerEmail] = record.split("\x1f");
    const raw = git("log", "-1", "--format=%B", sha);
    const subject = raw.split("\n")[0];
    const botAuthored = authorEmail === DEPENDABOT_EMAIL || authorName === DEPENDABOT_NAME;
    const githubCommitted = committerEmail === GITHUB_COMMITTER_EMAIL;
    const isMerge = MERGE_COMMIT_RE.test(subject);
    // Compare date prefixes (YYYY-MM-DD), not full ISO timestamps: the
    // audit must answer "was this commit authored before R7 took effect?",
    // and R7's adoption happened partway through 2026-09-23 (the rule
    // landed at 22:30 that day). Treating the entire adoption day as
    // pre-R7 grandfathering is the conservative reading of the plan
    // ("规则采纳日之前的旧账"): commits from earlier on that day could
    // not have complied with a rule that did not exist yet. ISO-8601
    // day strings sort lexicographically, so a string compare suffices.
    const preR7Adoption = authorDate.slice(0, 10) <= R7_ADOPTION_DATE;
    // Same day-level `<=` semantics for the R3 explicit-token anchor: the
    // whole adoption day (2026-10-24) is grandfathered so earlier commits
    // from that day keep the keyword fallback in branch / range mode.
    const preR3StrictAdoption = authorDate.slice(0, 10) <= R3_STRICT_ADOPTION_DATE;
    // R8 anchor, same day-level `<=` semantics: the whole adoption day
    // (2026-10-25) is grandfathered. Pre-adoption commits skip the R8 scan
    // silently (mirroring the preR7Adoption skip, no SKIP line) so the branch
    // summary shape stays byte-stable for grandfathered history; only
    // post-adoption commits get their added lines scanned, and merge commits
    // are structurally exempt (a merge diff is not a human-authored
    // increment).
    const preR8Adoption = authorDate.slice(0, 10) <= R8_ADOPTION_DATE;
    // R8 shell 面独立锚点（2026-11-09），日级严格 `<`：与上面 JS 面 `<=` 的差异
    // 理由见 R8_SHELL_ADOPTION_DATE 常量处。作用于 scanR8 内 `#` 族的豁免开关，
    // 不影响本行 JS 面扫描的进入条件（一笔 commit 两族可各自祖父/各自生效）。
    const preR8ShellAdoption = authorDate.slice(0, 10) < R8_SHELL_ADOPTION_DATE;
    const result = checkMessage(sha.slice(0, 8), raw, { botAuthored, isMerge, preR7Adoption, preR3StrictAdoption, githubCommitted });
    if (!preR8Adoption && !isMerge) {
      const r8 = scanR8(git("show", "--format=", "-U0", sha), { preR8ShellAdoption });
      result.findings.push(...r8.findings);
      if (r8.notes.length > 0) result.r8Notes = r8.notes;
      if (r8.commentLines > 0) {
        result.r8Report = `added comment lines=${r8.commentLines} marked=${r8.markedLines} unmarked=${r8.unmarked}`;
      }
    }
    return result;
  });
  let failures = 0;
  let skips = 0;
  for (const r of results) {
    if (r.mergeCommit) {
      skips++;
      console.log(`SKIP  ${r.label}  ${r.subject} (merge commit)`);
    } else if (r.findings.length === 0 && r.botAuthored) {
      skips++;
      console.log(`SKIP  ${r.label}  ${r.subject} (dependabot)`);
    } else if (r.findings.length === 0 && r.githubCommitted) {
      skips++;
      console.log(`SKIP  ${r.label}  ${r.subject} (github committer)`);
    } else if (r.findings.length === 0) {
      console.log(`PASS  ${r.label}  ${r.subject}`);
    } else {
      failures++;
      console.log(`FAIL  ${r.label}  ${r.subject}`);
      for (const f of r.findings) {
        console.log(`        ${f.rule}: ${f.msg}`);
      }
    }
    // R8 advisory surface for post-adoption commits only (undefined for all
    // grandfathered history, so existing output stays byte-identical).
    if (r.r8Notes) {
      for (const n of r.r8Notes) console.log(`NOTE  R8       ${n}`);
    }
    if (r.r8Report) console.log(`        R8 report M3': ${r.r8Report} (pure report)`);
  }

  // R6 (BR ↔ probe two-way binding): repo-state check, --branch mode only.
  // Decoupled from the per-commit `failures` counter used for the `pass` math:
  // the R6 count is added to `failures` AFTER `pass` is computed, so the
  // existing branch-mode summary shape (total / pass / skip / fail) keeps
  // describing the commit walk; `failures` reflects R6 too so the exit code
  // is FAIL when either dimension breaks.
  const passCount = results.length - failures - skips;
  for (const f of auditBrProbeBinding(process.cwd())) {
    failures++;
    console.log(`FAIL  R6       ${f.msg}`);
    console.log(`        R6: ${f.msg}`);
  }

  console.log("");
  console.log(`ref=${ref} total=${results.length} pass=${passCount} skip=${skips} fail=${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
