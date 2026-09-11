import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
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
