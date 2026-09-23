import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Integration tests for tests/qa/commit-audit.mjs --message-file mode.
// The audit script runs main() at import time and process.exit()s, so it
// cannot be imported directly; we exercise it as a subprocess exactly the
// way the commit-msg hook invokes it (node <script> --message-file <file>,
// cwd = repo root). The commitlint spawn is real, not mocked: it resolves
// the local devDependency via `pnpm exec commitlint`.

const AUDIT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'commit-audit.mjs',
);
const REPO_ROOT = path.resolve(path.dirname(AUDIT_PATH), '..', '..');

const TMP_DIR = mkdtempSync(path.join(tmpdir(), 'commit-audit-test-'));
afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

// Passes the audit (R1-R7) AND commitlint: conventional prefix, no trailing
// period, every body/footer line <= 100 chars (body-max-line-length), full
// WHAT/WHY/HOW body, Chinese lore trailers + Plan footer. R7 requires CJK in
// the subject description and in every free-text trailer value; the enum
// trailers (Confidence / Scope-risk) and Plan path footer are exempt.
const BOTH_PASS = [
  'fix(play-controller): 路由切换后保持战绩实时刷新',
  '',
  'WHAT: 把战绩面板订阅到 store 的 lastWriteAt 信号',
  'WHY: 因为 RSC payload 被缓存，导航回旧会话看到的是旧数字',
  'HOW: 通过 router 订阅信号，用 vitest 与 stats-race 探针验证',
  '',
  'Constraint: 保留叶子客户端边界完整',
  'Rejected: 全页 use-client 重写 | 破坏 RSC fetch 契约',
  'Confidence: high',
  'Scope-risk: narrow',
  'Directive: 把战绩读取锁在 store signal 之后',
  'Tested: pnpm vitest run 全绿',
  'Plan: .omo/plans/pwa-rsc-stats-bug-fix.md',
  '',
].join('\n');

// Audit-pass but commitlint-fail: R1 only checks the Conventional prefix, so
// a trailing period on the subject passes R1-R5, while config-conventional's
// subject-full-stop rule rejects it. This is exactly the drift the
// transitive commitlint call exists to catch.
const AUDIT_PASS_COMMITLINT_FAIL = BOTH_PASS.replace(
  '路由切换后保持战绩实时刷新',
  '路由切换后保持战绩实时刷新.',
);

interface AuditResult {
  status: number;
  stdout: string;
  stderr: string;
}

function stringProp(err: object, key: string): string {
  const value = (err as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function runAudit(message: string): AuditResult {
  const file = path.join(TMP_DIR, `msg-${Math.random().toString(36).slice(2)}.txt`);
  writeFileSync(file, message, 'utf8');
  try {
    const stdout = execFileSync(
      'node',
      [AUDIT_PATH, '--message-file', file],
      { encoding: 'utf8', cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    if (typeof err !== 'object' || err === null || !('status' in err)) {
      throw err;
    }
    const status = (err as Record<string, unknown>)['status'];
    return {
      status: typeof status === 'number' ? status : 1,
      stdout: stringProp(err, 'stdout'),
      stderr: stringProp(err, 'stderr'),
    };
  }
}

describe('commit-audit --message-file transitively runs commitlint', () => {
  it('exit 0 when the audit passes and commitlint passes', { timeout: 30_000 }, () => {
    const r = runAudit(BOTH_PASS);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PASS');
    expect(r.stdout).toContain('fix(play-controller): 路由切换后保持战绩实时刷新');
  });

  it('exit non-zero with commitlint output when audit passes but commitlint rejects', { timeout: 30_000 }, () => {
    const r = runAudit(AUDIT_PASS_COMMITLINT_FAIL);
    expect(r.status).not.toBe(0);
    // Stream layout under piped stdio: commitlint prints its rule report to
    // its own stdout (which the audit inherits), the audit's FAIL summary
    // goes to console.error.
    expect(r.stdout).toContain('subject');
    expect(r.stdout).toContain('subject-full-stop');
    expect(r.stderr).toContain('FAIL');
    expect(r.stderr).toContain('commitlint: rejected the message');
  });
});

// Branch-mode integration test for the dependabot exemption. Builds a
// throwaway git repo whose main branch carries three commits:
//   1. human-authored, trailers missing          -> FAIL (R3/R4/R5)
//   2. dependabot-authored, conventional subject -> SKIP (R3-R5 not applied)
//   3. dependabot-authored, non-conventional     -> FAIL (R1 still enforced)
// The audit subprocess runs with cwd = fixture repo so its `git log` calls
// read the fixture history, exactly mirroring `--branch main` usage.
function gitIn(repo: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    cwd: repo,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', ...env },
  });
}

const BRANCH_TMP = mkdtempSync(path.join(tmpdir(), 'commit-audit-branch-'));
const FIXTURE_REPO = path.join(BRANCH_TMP, 'repo');

function initFixtureRepo(): { botOk: string; botBad: string; human: string } {
  execFileSync('git', ['init', '-b', 'main', FIXTURE_REPO]);
  const ident = {
    'GIT_AUTHOR_NAME': 'Fixture Author',
    'GIT_AUTHOR_EMAIL': 'author@example.com',
    'GIT_COMMITTER_NAME': 'Fixture Author',
    'GIT_COMMITTER_EMAIL': 'author@example.com',
  };
  const botIdent = {
    'GIT_AUTHOR_NAME': 'dependabot[bot]',
    'GIT_AUTHOR_EMAIL': 'dependabot[bot]@users.noreply.github.com',
    'GIT_COMMITTER_NAME': 'dependabot[bot]',
    'GIT_COMMITTER_EMAIL': 'dependabot[bot]@users.noreply.github.com',
  };
  const commit = (msg: string, env: Record<string, string>): string => {
    writeFileSync(path.join(FIXTURE_REPO, 'f.txt'), `${msg}\n`, 'utf8');
    gitIn(FIXTURE_REPO, ['add', 'f.txt']);
    gitIn(
      FIXTURE_REPO,
      ['commit', '--no-gpg-sign', '-m', msg],
      env,
    );
    return gitIn(FIXTURE_REPO, ['rev-parse', 'HEAD']).slice(0, 8);
  };

  const human = commit('fix: human commit without required trailers', ident);
  const botOk = commit('chore(deps): bump some-pkg from 1.0.0 to 1.1.0', botIdent);
  const botBad = commit('Update dependency to a newer version', botIdent);
  return { botOk, botBad, human };
}

interface BranchAuditResult {
  status: number;
  stdout: string;
}

function runBranchAudit(cwd: string): BranchAuditResult {
  try {
    const stdout = execFileSync('node', [AUDIT_PATH, '--branch', 'main'], {
      encoding: 'utf8',
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout };
  } catch (err) {
    if (typeof err !== 'object' || err === null || !('status' in err)) {
      throw err;
    }
    const status = (err as Record<string, unknown>)['status'];
    return {
      status: typeof status === 'number' ? status : 1,
      stdout: stringProp(err, 'stdout'),
    };
  }
}

describe('commit-audit --branch main dependabot exemption', () => {
  const fixture = initFixtureRepo();
  const result = runBranchAudit(FIXTURE_REPO);

  it('SKIPs bot commits without trailers while humans still FAIL (R3-R5)', () => {
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain(`SKIP  ${fixture.botOk}  chore(deps): bump some-pkg from 1.0.0 to 1.1.0 (dependabot)`);
    expect(result.stdout).toContain(`FAIL  ${fixture.human}  fix: human commit without required trailers`);
    expect(result.stdout).toMatch(new RegExp(`^\\s+R4: missing trailer: Confidence`, 'm'));
    expect(result.stdout).toContain('skip=1 fail=2');
    expect(result.stdout).toContain('total=3');
  });

  it('FAILs bot commits with non-conventional subjects (R1 still enforced)', () => {
    expect(result.stdout).toContain(`FAIL  ${fixture.botBad}  Update dependency to a newer version`);
    expect(result.stdout).toMatch(new RegExp(`^\\s+R1: subject does not match Conventional`, 'm'));
  });

  it('never exempts via subject: human fail line lists trailer rules only', () => {
    // The human FAIL block must not be turned into a SKIP merely because the
    // subject looks conventional; exemption keys on author identity alone.
    const humanBlock = result.stdout.split('\n');
    const idx = humanBlock.findIndex((l) => l.startsWith(`FAIL  ${fixture.human}`));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(humanBlock[idx]).not.toContain('(dependabot)');
  });
});

// R6 (BR ↔ probe two-way binding) integration tests for --branch mode.
// Builds a fixture repo whose docs/business-rules.md references a mix of
// probe files: one happy (exists + BR header), one missing (path not in
// repo), one headerless (file exists but no BR ref), and one exempt
// (probe column marked ⚠ 未探针化). Asserts the audit flags the missing +
// headerless bindings as R6, exempts the marker row, and reports 0 R6
// findings for a separate all-happy fixture.
const R6_TMP = mkdtempSync(path.join(tmpdir(), 'commit-audit-r6-'));
afterAll(() => {
  rmSync(R6_TMP, { recursive: true, force: true });
});

const R6_FIXTURE_IDENT = {
  GIT_AUTHOR_NAME: 'R6 Author',
  GIT_AUTHOR_EMAIL: 'r6@example.com',
  GIT_COMMITTER_NAME: 'R6 Author',
  GIT_COMMITTER_EMAIL: 'r6@example.com',
};

const R6_FIXTURE_MSG = [
  'test(audit): R6 探针双向绑定 fixture 提交',
  '',
  'WHAT: 用临时 git 仓库种子（含 docs/business-rules.md 与探针文件）',
  'WHY: 因为 R6 单测需要确定性 fixture；branch 模式需真实 commit 才能走历史',
  'HOW: 写入文件后以 Conventional subject + 中文 lore trailers 提交，',
  '让 R1-R5 保持绿，只触发 R6 探针双向校验失败。',
  '',
  'Confidence: high',
  'Scope-risk: narrow',
  'Plan: .omo/plans/fixture.md',
  '',
].join('\n');

// Build a fixture repo with a controlled BR table + probe set. Rows:
//   BR-A -> tests/qa/good-probe.mjs    (exists, header has BR-A ref)   ok
//   BR-B -> tests/qa/missing-probe.mjs  (referenced but absent)         FAIL (missing)
//   BR-C -> tests/qa/headerless-probe.mjs (exists, no BR ref in header) FAIL (header)
//   BR-D -> ⚠ 未探针化 marker                                             exempt
function initR6MixedFixture(): { repo: string } {
  const repo = path.join(R6_TMP, `mixed-${Math.random().toString(36).slice(2)}`);
  execFileSync('git', ['init', '-b', 'main', repo], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } });

  const probesDir = path.join(repo, 'tests', 'qa');
  const docsDir = path.join(repo, 'docs');
  mkdirSync(probesDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(
    path.join(probesDir, 'good-probe.mjs'),
    '// BR: BR-1\n// happy probe fixture\nconsole.log("good");\n',
    'utf8',
  );
  // missing-probe.mjs intentionally NOT created.

  writeFileSync(
    path.join(probesDir, 'headerless-probe.mjs'),
    '// no BR ref here\nconsole.log("headerless");\n',
    'utf8',
  );

  writeFileSync(
    path.join(docsDir, 'business-rules.md'),
    [
      '# Fixture business rules',
      '',
      '| # | 规则 | 探针 |',
      '| --- | --- | --- |',
      '| BR-1 | happy rule | `tests/qa/good-probe.mjs` |',
      '| BR-2 | missing file rule | `tests/qa/missing-probe.mjs` |',
      '| BR-3 | headerless rule | `tests/qa/headerless-probe.mjs` |',
      '| BR-4 | exempt rule | ⚠ 未探针化 |',
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(path.join(repo, 'f.txt'), 'init\n', 'utf8');
  gitIn(repo, ['add', '.'], { ...R6_FIXTURE_IDENT });
  gitIn(repo, ['commit', '--no-gpg-sign', '-m', R6_FIXTURE_MSG], { ...R6_FIXTURE_IDENT });
  return { repo };
}

// Build a fixture repo whose BR table only references probe files that
// exist with correct BR headers. Used to prove R6 reports zero findings
// when the binding is intact.
function initR6HappyFixture(): { repo: string } {
  const repo = path.join(R6_TMP, `happy-${Math.random().toString(36).slice(2)}`);
  execFileSync('git', ['init', '-b', 'main', repo], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } });

  const probesDir = path.join(repo, 'tests', 'qa');
  const docsDir = path.join(repo, 'docs');
  mkdirSync(probesDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(
    path.join(probesDir, 'good-only-probe.mjs'),
    '// BR: BR-9\n// happy-only probe fixture\nconsole.log("good");\n',
    'utf8',
  );

  writeFileSync(
    path.join(docsDir, 'business-rules.md'),
    [
      '# Fixture business rules (happy)',
      '',
      '| # | 规则 | 探针 |',
      '| --- | --- | --- |',
      '| BR-9 | all good | `tests/qa/good-only-probe.mjs` |',
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(path.join(repo, 'f.txt'), 'init\n', 'utf8');
  gitIn(repo, ['add', '.'], { ...R6_FIXTURE_IDENT });
  gitIn(repo, ['commit', '--no-gpg-sign', '-m', R6_FIXTURE_MSG], { ...R6_FIXTURE_IDENT });
  return { repo };
}

describe('commit-audit --branch main R6 BR↔probe binding', () => {
  const mixed = initR6MixedFixture();
  const mixedResult = runBranchAudit(mixed.repo);

  it('flags probe files that the BR table references but the repo lacks (R6 check A)', () => {
    expect(mixedResult.stdout).toMatch(
      new RegExp(`R6:.*BR-2.*probe file not found.*missing-probe\\.mjs`, 's'),
    );
  });

  it('flags probe files that exist but lack the BR reference in their header (R6 check B)', () => {
    expect(mixedResult.stdout).toMatch(
      new RegExp(`R6:.*BR-3.*header missing BR reference.*headerless-probe\\.mjs`, 's'),
    );
  });

  it('honors the ⚠ 未探针化 exemption: exempt rows produce no R6 finding', () => {
    expect(mixedResult.stdout).not.toMatch(/R6:.*BR-4/);
  });

  it('does not flag correct bindings: BR-A produces no R6 finding', () => {
    expect(mixedResult.stdout).not.toMatch(/R6:.*BR-1/);
  });

  it('emits the R6 summary failure line in the branch-mode footer', () => {
    // Mixed fixture: 1 commit that passes R1-R5 + 2 R6 failures. The branch
    // summary line reports both; total covers commits only, fail covers both.
    expect(mixedResult.stdout).toContain('total=1');
    expect(mixedResult.stdout).toContain('fail=2');
  });

  const happy = initR6HappyFixture();
  const happyResult = runBranchAudit(happy.repo);

  it('emits zero R6 findings when the BR↔probe binding is fully correct', () => {
    expect(happyResult.stdout).not.toMatch(/R6:/);
  });
});

// R7 (中文语言规则，2026-09-23) integration tests. Three message-file
// scenarios cover the positive/negative cases A2 ① ③ ④; one branch-mode
// scenario (A2 ②) walks the 30 most recent subjects on the branch to prove
// historical compatibility. The branch fixture includes the actual 30
// subjects verbatim: 29 contain CJK and PASS R7; subject #9 (the pre-R7
// `test(store): resetStore clears outcomeError (leak regression)` English
// commit) is correctly flagged by R7 - it is a pre-existing violation that
// R7 catches, not a regression of the rule. The ticket's negative list
// forbids rewording that commit, so it stays in place and surfaces here as
// the expected R7 gate finding.

const R7_HISTORY_SUBJECTS = [
  'docs(decisions): 20260923 四项裁决入档——语言契约A+B/resetStore立票/02c等数据/P3派工',
  'docs(plans): 三弹框穿模 + 错误行告警升级 plan 全文中文化（主公 decree）',
  'docs(waves): 复利经验落仓库——L1-30 死代码断言反模式 + 探针时序约定 + 多席并行配方',
  'test(qa): diag 行增 evtName/evtPseudo/evtCount 三字段 + plan 审查整改记录入档',
  'fix(hygiene): 恢复 OutcomeErrorBanner not-found 文案（REJECT 整改）',
  'chore(hygiene): 4 项零行为改动（注释/空白/死键）',
  'test(afterViewTransition+Alert): 补齐 view-transition + Alert 单测',
  'test(qa): 重锚 step 02c 时序到点击时刻 + 注入 animationend 诊断',
  // #9: pre-R7 English subject, kept verbatim so the test exercises the R7
  // gate against a real-world outlier. Must FAIL R7 - this is the gate
  // working, not a test failure.
  'test(store): resetStore clears outcomeError (leak regression)',
  'fix(modal): 错峰开启避免 VT 同窗 + ::backdrop 泛化 + 穿模回归探针',
  'feat(ui): danger Alert 组件 + outcome error banner + 三弹框错误升级',
  'refactor(slop): 删 ServiceWorkerRegister 孤儿 default export',
  'feat(audit): 新增 BR↔探针双向机械校验规则（R6）+ 业务规则表规范化',
  'docs(intake): 意图锚定体系——意图块反面场景强制 + 派发绑定 + 防漂移协议',
  'fix(home): 合并弹框仅离线→首页导航转换触发（BR-1）+ 业务规则外化',
  'refactor(slop): 共享 game stats shape 谓词 + 删孤儿 JSDoc',
  'docs(agents): agents.md 主项目块 222→52 行 + 8 个外化文件',
  'docs(wrap): 质量加固波收口——V13 ACCEPT 入档，AGENTS.md 调度者节 digest sync',
  'docs(review): ulw-quality-hardening-opt-20260922 终验 V13 入档（ACCEPT）',
  'docs(plan): dispatcher-roles-retrospective §4 增补拆分四问/负面清单/双通道/hook 规则/0 win 合法',
  'docs(retro): w-rf 反思蒸馏三件产物入档——retro + intake + agents-md sync 草案',
  'docs(ablation): 双对象消融入档——三项 (a) + 三组件 (b) 因果全验',
  'test(mutation): store.ts 补断言 kill 25 枚幸存变异——基线 83.23%→87.74%',
  'refactor(game-net): httpJson 内部助手抽出——五端点共享 tagged-result 契约',
  'chore(refactor): w-rv p3#6/p3#7/p3#8/p3#9 收口 + p2#4 follow-up plan',
  'docs(lib): w-rv p2#1/p2#3/p3#5/p3#10/p3#11 边界明文化',
  'fix(sw): cache 版本化——app 版本号注入 + activate 清理旧 cache',
  'test(coverage): 补齐 components 面测试盲区——W-T 工单 components 子卡',
  'test(coverage): 补齐 lib 面测试盲区——W-T 工单 lib 子卡',
  'docs(review): 全仓五维评审入档——4 条 P2 + 7 条 P3，零 P0/P1',
];

// Compliant body + trailers for fixture subjects that PASS R7. Subject #9
// gets a minimal English-only body (which would also fail R3 body WHY/HOW,
// but the test only cares that R7 catches the subject, so the body can stay
// short - R7's subject finding is what the assertion looks for).
const R7_PASS_BODY = [
  'WHAT: 在该提交范围内执行对应变更',
  'WHY: 因为任务要求 + 历史兼容性',
  'HOW: 通过最小改动 + 中文 lore trailer',
  '',
  'Constraint: 保持接口稳定',
  'Rejected: 全量重写 | 引入回归',
  'Confidence: high',
  'Scope-risk: narrow',
  'Directive: 走 helper 化路径',
  'Tested: vitest 全绿',
  'Plan: .omo/plans/fixture.md',
  '',
].join('\n');

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const R7_TMP = mkdtempSync(path.join(tmpdir(), 'commit-audit-r7-'));
afterAll(() => {
  rmSync(R7_TMP, { recursive: true, force: true });
});

const R7_FIXTURE_IDENT = {
  GIT_AUTHOR_NAME: 'R7 Fixture',
  GIT_AUTHOR_EMAIL: 'r7@example.com',
  GIT_COMMITTER_NAME: 'R7 Fixture',
  GIT_COMMITTER_EMAIL: 'r7@example.com',
};

// Build a fixture repo whose main branch carries the 30 subjects verbatim.
// Subjects #0..#7 and #9..#29 (29 in total) include CJK in their description
// and get a compliant Chinese body + lore trailers. Subject #8 (the pre-R7
// English outlier) stays verbatim, gets a short body without lore trailers,
// and is asserted to FAIL with the expected R7 finding.
function initR7HistoryFixture(): { repo: string } {
  const repo = path.join(R7_TMP, `history-${Math.random().toString(36).slice(2)}`);
  execFileSync('git', ['init', '-b', 'main', repo], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } });

  // Single file so every commit records a change. Content is irrelevant.
  for (let i = 0; i < R7_HISTORY_SUBJECTS.length; i++) {
    writeFileSync(path.join(repo, 'f.txt'), `iter ${i}\n`, 'utf8');
    gitIn(repo, ['add', 'f.txt'], { ...R7_FIXTURE_IDENT });
    const subject = R7_HISTORY_SUBJECTS[i];
    const msg = i === 8 ? subject : `${subject}\n\n${R7_PASS_BODY}`;
    gitIn(repo, ['commit', '--no-gpg-sign', '-m', msg], { ...R7_FIXTURE_IDENT });
  }
  return { repo };
}

describe('commit-audit --branch main R7 中文语言规则', () => {
  // A2 ②: 30 既有历史 subjects 历史兼容。29 含 CJK 的 subject 必须 PASS；subject
  // #9（pre-R7 英文 outlier）必须被 R7 正确捕获——证明 R7 是真闸门，不放行旧的英文 commit。
  const fixture = initR7HistoryFixture();
  const result = runBranchAudit(fixture.repo);

  it('A2 ② PASSes all 29 CJK subjects and FAILs the pre-R7 English outlier with R7', () => {
    // 29 Chinese subjects must PASS.
    for (let i = 0; i < R7_HISTORY_SUBJECTS.length; i++) {
      if (i === 8) continue;
      expect(result.stdout).toMatch(
        new RegExp(`PASS\\s+[0-9a-f]+\\s+${escapeForRegex(R7_HISTORY_SUBJECTS[i])}`),
      );
    }
    // Subject #9 must FAIL with the R7 subject finding.
    expect(result.stdout).toMatch(
      new RegExp(`FAIL\\s+[0-9a-f]+\\s+${escapeForRegex(R7_HISTORY_SUBJECTS[8])}`, 's'),
    );
    expect(result.stdout).toMatch(/R7: subject description lacks CJK characters/);
    // Summary: 30 total, 29 pass, 1 fail.
    expect(result.stdout).toContain('total=30');
    expect(result.stdout).toMatch(/pass=29\b/);
    expect(result.stdout).toMatch(/fail=1\b/);
  });

  // A2 ③: identifier-dense Chinese subject must PASS R7. Threshold is the
  // minimum "≥1 CJK" gate, so the rule does not falsely reject a subject
  // whose description mixes English identifiers (resetStore / helper / 11)
  // with Chinese prose.
  it('A2 ③ PASSes an identifier-dense Chinese subject (resetStore helper / 11 处 / setState 重置块)', { timeout: 30_000 }, () => {
    const msg = [
      'refactor(store): 抽取 resetStore helper 统一 11 处 setState 重置块',
      '',
      'WHAT: 提取 resetStore 共享 helper',
      'WHY: 因为三处手抄 drift',
      'HOW: 通过 helper 单签名',
      '',
      'Constraint: 保留 helper 单签名',
      'Rejected: 全量重写 | 引入回归',
      'Confidence: high',
      'Scope-risk: narrow',
      'Directive: 走 helper',
      'Tested: vitest 全绿',
      'Plan: .omo/plans/ulw-reset-store-outcome-error.md',
      '',
    ].join('\n');
    const r = runAudit(msg);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PASS');
    expect(r.stdout).toContain('抽取 resetStore helper');
  });
});

// A2 ① / ④ are pure subject-only or trailer-only checks that do not need a
// fixture repo - runAudit spawns the audit subprocess once per message.
describe('commit-audit --message-file R7 subject and trailer checks', () => {
  // A2 ①: 全英文 subject 必须 FAIL（subject 部分不含 CJK 即被 R7 捕获）。
  it('A2 ① FAILs an all-English subject description with R7', { timeout: 30_000 }, () => {
    const msg = [
      'fix(x): hello world',
      '',
      'WHAT: 测试',
      'WHY: 因为',
      'HOW: 通过',
      '',
      'Constraint: 保留 leaf 边界',
      'Rejected: 全量重写 | 引入回归',
      'Confidence: high',
      'Scope-risk: narrow',
      'Directive: 走 helper',
      'Tested: vitest 全绿',
      'Plan: .omo/plans/x.md',
      '',
    ].join('\n');
    const r = runAudit(msg);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/R7: subject description lacks CJK characters: "hello world"/);
  });

  // A2 ④: 中文 subject 但英文 free-text trailer 必须 FAIL。枚举 trailer
  //（Confidence / Scope-risk）与 Plan: 路径 footer 豁免；free-text trailer 值
  // 必须是中文。
  it('A2 ④ FAILs an English free-text trailer value with R7', { timeout: 30_000 }, () => {
    const msg = [
      'fix(x): 中文测试',
      '',
      'WHAT: 中文',
      'WHY: 因为',
      'HOW: 通过',
      '',
      'Constraint: keep the leaf intact.',
      'Rejected: do nothing.',
      'Confidence: high',
      'Scope-risk: narrow',
      'Directive: ship it.',
      'Tested: vitest run.',
      'Plan: .omo/plans/x.md',
      '',
    ].join('\n');
    const r = runAudit(msg);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/R7: trailer "Constraint:" value lacks CJK characters: "keep the leaf intact\."/);
  });
});
