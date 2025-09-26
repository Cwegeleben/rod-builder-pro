#!/usr/bin/env bash
set -euo pipefail

# Rename main -> production (if main exists)
if git show-ref --verify --quiet refs/heads/main; then
  git branch -m main production
fi

# Ensure remote default branch
git push origin -u production

# Create staging from production if not present
if ! git ls-remote --exit-code --heads origin staging >/dev/null 2>&1; then
  git checkout -b staging production
  git push origin -u staging
fi

echo "Reminder: set default branch to 'production' in GitHub Settings."