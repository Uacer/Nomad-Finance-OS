#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/root/.openclaw/workspace/agent-workspace"
cd "$REPO_DIR"

# Safety: never commit secrets / local runtime artifacts even if misconfigured
# (Most should already be covered by .gitignore)
git reset -q -- .secrets >/dev/null 2>&1 || true

git add -A

# If nothing staged, exit quietly
if git diff --cached --quiet; then
  exit 0
fi

DATE_STR=$(date -u +"%Y-%m-%d")
MSG="chore: daily snapshot ${DATE_STR}"

git commit -m "$MSG"

git push origin main
