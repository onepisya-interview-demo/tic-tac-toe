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

// Passes the audit (R1-R5) AND commitlint: conventional prefix, no trailing
// period, every body/footer line <= 100 chars (body-max-line-length), full
// WHAT/WHY/HOW body, lore trailers + Plan footer.
const BOTH_PASS = [
  'fix(play-controller): keep stats fresh after manual navigation',
  '',
  'WHAT: keep the play page stats in sync after manual route changes.',
  'WHY: the stats panel went stale because the RSC payload was cached,',
  'so the user saw old numbers after navigating back to an old session.',
  'HOW: subscribe the panel to the store lastWriteAt signal and refresh',
  'via the router; tested with vitest plus the stats-race probe.',
  '',
  'Constraint: keep the leaf client boundary intact.',
  'Rejected: full-page use-client rewrite | breaks the RSC fetch contract.',
  'Confidence: high',
  'Scope-risk: narrow',
  'Directive: keep stats reads behind the store signal.',
  'Tested: pnpm vitest run 88/88.',
  'Plan: .omo/plans/pwa-rsc-stats-bug-fix.md',
  '',
].join('\n');

// Audit-pass but commitlint-fail: R1 only checks the Conventional prefix, so
// a trailing period on the subject passes R1-R5, while config-conventional's
// subject-full-stop rule rejects it. This is exactly the drift the
// transitive commitlint call exists to catch.
const AUDIT_PASS_COMMITLINT_FAIL = BOTH_PASS.replace(
  'keep stats fresh after manual navigation',
  'keep stats fresh after manual navigation.',
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
    expect(r.stdout).toContain('fix(play-controller): keep stats fresh');
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
  'test(audit): fixture commit for R6 BR↔probe binding tests',
  '',
  'WHAT: seed a temporary git repo with docs/business-rules.md and probe',
  'files so the audit subprocess can exercise R6 end-to-end.',
  'WHY: the R6 unit tests need a deterministic fixture; a real commit',
  'on main is required because commit-audit --branch mode walks history.',
  'HOW: write the fixture files then commit them with a Conventional',
  'subject + lore trailers so R1-R5 stay green and only R6 findings fire.',
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
