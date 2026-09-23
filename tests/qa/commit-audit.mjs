#!/usr/bin/env node
// Commit-policy audit.
//
// Two modes:
//   node tests/qa/commit-audit.mjs                  # audit all commits on main
//   node tests/qa/commit-audit.mjs --branch <name>  # audit all commits on <name>
//   node tests/qa/commit-audit.mjs --message-file F # audit a single commit message file
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

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--branch") out.branch = argv[++i];
    else if (a === "--message-file") out.messageFile = argv[++i];
    else if (a === "--root") out.root = argv[++i];
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

  if (subject.length > 100) findings.push({ rule: "R2", msg: `subject ${subject.length} chars > 100` });
  if (!PROMPT_RE.test(subject) && !TYPE_RE.test(subject)) {
    findings.push({ rule: "R1", msg: `subject does not match Conventional or prompt() prefix: "${subject}"` });
  }

  const isPrompt = PROMPT_RE.test(subject);
  if (!isPrompt && !opts.botAuthored) {
    // R7 subject: after stripping TYPE_RE / PROMPT_RE prefix, the description
    // must contain at least one CJK character. Prompt commits are exempt (R7
    // only applies to Conventional Commits by spec).
    const subjectNoPrefix = subject
      .replace(PROMPT_RE, "")
      .replace(TYPE_RE, "")
      .trim();
    if (!CJK_RE.test(subjectNoPrefix)) {
      findings.push({ rule: "R7", msg: `subject description lacks CJK characters: "${subjectNoPrefix}"` });
    }

    const hasExplicitHeading = /\bWHAT:\s/.test(body) && /\bWHY:\s/.test(body) && /\bHOW:\s/.test(body);
    if (body.length < 60) {
      findings.push({ rule: "R3", msg: `body too short (${body.length} chars) - must explain what + why + how` });
    } else if (!hasExplicitHeading) {
      if (!WHY_RE.test(body)) findings.push({ rule: "R3", msg: "body does not mention WHY (no because/so-that/to fix/missing/bug/...)" });
      if (!HOW_RE.test(body)) findings.push({ rule: "R3", msg: "body does not mention HOW (no via/by/with/pnpm/vitest/playwright/...)" });
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

  return { label, subject, body, footer, findings, botAuthored: Boolean(opts.botAuthored) };
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

  const branch = args.branch ?? "main";
  const records = git("log", "--reverse", "--format=%H%x1f%ae%x1f%an", branch).split("\n").filter(Boolean);
  const results = records.map((record) => {
    const [sha, authorEmail, authorName] = record.split("\x1f");
    const raw = git("log", "-1", "--format=%B", sha);
    const botAuthored = authorEmail === DEPENDABOT_EMAIL || authorName === DEPENDABOT_NAME;
    return checkMessage(sha.slice(0, 8), raw, { botAuthored });
  });
  let failures = 0;
  let skips = 0;
  for (const r of results) {
    if (r.findings.length === 0 && r.botAuthored) {
      skips++;
      console.log(`SKIP  ${r.label}  ${r.subject} (dependabot)`);
    } else if (r.findings.length === 0) {
      console.log(`PASS  ${r.label}  ${r.subject}`);
    } else {
      failures++;
      console.log(`FAIL  ${r.label}  ${r.subject}`);
      for (const f of r.findings) {
        console.log(`        ${f.rule}: ${f.msg}`);
      }
    }
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
  console.log(`branch=${branch} total=${results.length} pass=${passCount} skip=${skips} fail=${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
