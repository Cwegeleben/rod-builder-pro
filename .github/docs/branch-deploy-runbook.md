# Branch-based Auto-Deploy (v3.0)

This repo auto-deploys to staging and production based on branch pushes.

- Staging: push or merge to `staging` → deploys to Shopify (staging config) and Fly (staging app)
- Production: push or merge to `production` → deploys to Shopify (prod config) and Fly (prod app)

<!-- BEGIN RBP GENERATED: ci-branch-autodeploy-v1 -->

## How to ship

- Ship to staging: merge/push to `staging`
- Ship to production: merge/push to `production`

## Branch protection (production)

Enable protection on `production`:

- Require at least 1 PR review
- Require status checks to pass (CI)
- Allow administrators to bypass (optional)

Minimal gh CLI example:

```bash
# Protect production branch (adjust owner/repo)
OWNER="<owner>" REPO="<repo>"
# Require 1 review, require status checks, allow admin bypass
# (The GitHub REST API for branch protection is a bit verbose; consider using the UI if preferred.)
# UI path: Settings → Branches → Branch protection rules → Add rule → Branch name pattern: production
```

## Branch ops (if starting from `main`)

If your default branch is `main`, rename it to `production` and create `staging` from it. You can run the script below or use the exact commands.

### Script

`scripts/ci/prepare-branches.sh`

```bash
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
```

### Manual commands

```bash
# Rename local main to production
git branch -m main production
# Push and set upstream
git push origin -u production
# Create staging from production and push
git checkout -b staging production
git push origin -u staging
# Reminder to set default branch in GitHub Settings → Branches
```

## Post-setup checklist

- Set default branch to `production` (Settings → Branches)
- Protect `production` (PR review + CI required; allow admin bypass if desired)
- Secrets present: `SHOPIFY_CLI_PARTNERS_TOKEN`, `FLY_API_TOKEN_STAGING`, `FLY_API_TOKEN_PROD`
- Push a trivial commit to `staging` → confirm Deploy — Staging runs
- Push a trivial commit to `production` → confirm Deploy — Production runs

<!-- END RBP GENERATED: ci-branch-autodeploy-v1 -->
