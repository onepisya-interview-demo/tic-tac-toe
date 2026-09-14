#!/usr/bin/env bash
# Test suite for scripts/vercel-ignore-build.sh
#
# Replays historical commits and asserts the script's exit code matches the
# expected Vercel behavior:
#   exit 0 = cancel deployment (skip build)
#   exit 1 = proceed with build
#
# Run from repo root: bash scripts/vercel-ignore-build.test.sh

set -euo pipefail

# Extract the script from the current commit (HEAD), not from the historical
# commits we're testing against — we want to verify current behavior.
SCRIPT_PATH="/tmp/vercel-ignore-build-under-test.sh"
git show HEAD:scripts/vercel-ignore-build.sh > "$SCRIPT_PATH"
chmod +x "$SCRIPT_PATH"

if ! [ -s "$SCRIPT_PATH" ]; then
  echo "FAIL: could not extract scripts/vercel-ignore-build.sh from HEAD" >&2
  exit 1
fi

# Test cases: "<sha>|<expected_exit_code>"
# Expected codes derived from prior manual analysis of each commit's
# impact on Vercel build output.
CASES=(
  "7b230b8|1"   # feat(meta): 部署站增 og/twitter 元 → app + public → build
  "20f5d50|0"   # docs(plans): 入库计划档 → only .omo/plans → cancel
  "2879b2f|1"   # feat(meta): 补 og:url + twitter handles → app → build
  "c16e9e8|1"   # feat(meta): A+B+C 多图变体 → app + public → build
  "6daefe3|1"   # feat(meta): 增 1:1 brand mark → app + public → build
  "a3a5ef7|0"   # docs(workflow): 立 PR 协议 → docs only → cancel
  "df8df0e|0"   # docs(workflow) PR #11 → docs only → cancel
  "98e0c1f|0"   # chore(deploy): vercel + protocol → vercel.json + docs → cancel
  "c0063ab|0"   # fix(deploy): vercel.json 字段名 → vercel.json only → cancel
  "5c32b22|0"   # fix(deploy): vercel.json exit code → vercel.json only → cancel
  "84091bd|0"   # fix(deploy): ignoreCommand 增核心过滤 → vercel.json only → cancel
  "ca7e6ad|0"   # ci(workflow): push trigger off → .github only → cancel
  "ba19ce5|0"   # docs: 社交分享卡图 → docs only → cancel
  "575e212|0"   # docs: 变异基线 → docs only → cancel
)

# Stash any uncommitted changes so checkout isn't blocked
STASH_NAME="vercel-ignore-build-test-$$"
git stash push --quiet -m "$STASH_NAME" --include-untracked 2>/dev/null || true

passed=0
failed=0
fail_list=""

for entry in "${CASES[@]}"; do
  sha="${entry%|*}"
  expected="${entry#*|}"

  git checkout --quiet "$sha"
  actual=$(bash "$SCRIPT_PATH" > /dev/null 2>&1; echo $?)

  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $sha exit=$actual"
    passed=$((passed + 1))
  else
    echo "  ✗ $sha expected=$expected actual=$actual"
    failed=$((failed + 1))
    fail_list="$fail_list $sha"
  fi
done

# Restore main + any stashed changes
git checkout --quiet main
git stash pop --quiet 2>/dev/null || true
rm -f "$SCRIPT_PATH"

echo
echo "=== summary ==="
echo "passed: $passed"
echo "failed: $failed"
if [ "$failed" -gt 0 ]; then
  echo "fail_list:$fail_list"
  exit 1
fi
exit 0