#!/usr/bin/env bash
# Vercel Ignored Build Step
#
# Called by Vercel before each deployment. Exit code semantics:
#   exit 0 = cancel deployment (do not build)
#   exit 1 = proceed with build
#
# Logic (3 rules, first match wins):
#   1. docs commit (subject starts with `docs(` or `docs:`) → cancel
#   2. commit changed any core file → proceed
#   3. otherwise → cancel
#
# CORE_PATH_RE is the single source of truth for Vercel build triggers.
# When adding new source directories (e.g. `src/styles/`, `middleware.ts`),
# extend CORE_PATH_RE here in the same commit that introduces them.
# Test suite: scripts/vercel-ignore-build.test.sh replays historical
# commits and asserts expected exit codes.

set -euo pipefail

# Pattern matching docs( or docs: at start of subject (Conventional Commits docs convention)
DOCS_PATTERN='^docs[(:]'

# Paths that, if changed, require a rebuild. Supports both root-level and
# src/-prefixed Next.js layouts.
CORE_PATH_RE='^(app|src/app|pages|src/pages|public|src/public|components|src/components|lib|src/lib|db|src/db|styles|src/styles)/|^(middleware\.ts|middleware\.js)$|^package\.json$|^next\.config(\.[a-z]+)?$|^tsconfig\.json$'

subject=$(git log -1 --pretty=%s)

# Rule 1: docs commit → cancel
if printf '%s' "$subject" | grep -qE "$DOCS_PATTERN"; then
  exit 0
fi

# Rule 2: core path changed → proceed
if git diff --name-only HEAD~1 HEAD | grep -qE "$CORE_PATH_RE"; then
  exit 1
fi

# Rule 3: otherwise → cancel
exit 0