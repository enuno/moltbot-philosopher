# Auto-Darwinism Workflow Deployment Guide

**Created**: 2026-02-11
**Status**: Ready for deployment
**PR**: #5 - feature/auto-darwinism-workflow

## Overview

The Auto-Darwinism workflow is a GitHub Actions-based agentic workflow that:

- **Monitors**: All 5 official Moltbook skill files + API spec
- **Audits**: API compliance against `services/moltbook-client/`
- **Classifies**: Changes using 4-mode protocol (PATCH/MINOR/MAJOR/CRITICAL)
- **Automates**: PR creation with proper priority and labels
- **Secures**: Read-only permissions, network isolation, command allowlisting

## Deployment Checklist

### 1. Merge the PR

```bash
# Review PR #5
gh pr view 5

# Merge when ready
gh pr merge 5 --squash --delete-branch
```

### 2. Compile the Lock File

The workflow uses gh-aw (GitHub Agentic Workflows). After merging, compile:

```bash
# Checkout main
git checkout main
git pull

# Install gh-aw if needed
# gh extension install github/gh-aw

# Compile the workflow
gh aw compile .github/workflows/moltbot-auto-darwinism.md

# This creates .github/workflows/moltbot-auto-darwinism.lock.yml
```

### 3. Commit and Push Lock File

```bash
git add .github/workflows/moltbot-auto-darwinism.lock.yml
git commit -m "chore: add compiled Auto-Darwinism workflow lock file"
git push
```

### 4. Configure Repository Secrets

Required secrets:

```bash
# Add via GitHub UI or CLI
gh secret set MOLTBOOK_API_KEY --body "moltbook_your_key_here"
gh secret set NTFY_URL --body "https://ntfy.sh"
gh secret set NTFY_API_KEY --body "your_ntfy_token" # Optional
```

**Security Note**: Never commit these values. They should only be in GitHub Secrets.

### 5. Enable Workflow

```bash
# Enable the workflow in GitHub Actions
gh workflow enable moltbot-auto-darwinism

# View status
gh workflow view moltbot-auto-darwinism
```

### 6. Test Run

```bash
# Manual trigger for testing
gh workflow run moltbot-auto-darwinism

# Watch the run
gh run watch

# Or view logs
gh run list --workflow=moltbot-auto-darwinism
gh run view [RUN_ID]
```

## Architecture Details

### Execution Schedule

- **Cron**: Daily at 6:00 AM UTC (`0 6 * * *`)
- **Manual**: `workflow_dispatch` trigger available

### Six Phases

**Phase 1: Daily Health Check**

- Fetches all 5 Moltbook skill files
- Computes SHA-256 hashes
- Generates unified diffs for drift

**Phase 2: API Compliance Audit**

- Fetches GitHub API spec
- Cross-references against `services/moltbook-client/`
- Checks endpoints, auth, rate limits
- Watches for new endpoints (`/agents/:id/challenges`, `/dm/*`, `/moderation/*`)

**Phase 3: Change Classification**

- Uses 4-mode protocol:
  - **CRITICAL** (Mode 4): Security/CVE/auth changes → Non-draft PR + urgent NTFY
  - **MAJOR** (Mode 3): Breaking changes → PR for review + high NTFY
  - **MINOR** (Mode 2): New endpoints → Standard PR + medium NTFY
  - **PATCH** (Mode 1): Typos/docs → Draft PR + low NTFY

**Phase 4: Update Execution**

- Applies appropriate file updates
- Validates with `pnpm test` / `pnpm test:ci`

**Phase 5: PR Creation**

- Uses gh-aw safe-outputs
- Creates labeled, priority-tagged PRs
- Includes compliance reports and rollback instructions

**Phase 6: Failure Diagnostics**

- Creates GitHub issues on test failures
- Full diagnostic context included

### Security Features

- **Read-only permissions**: No direct write access
- **Network isolation**: Only `*.moltbook.com`, `raw.githubusercontent.com`, GitHub APIs
- **Bash allowlisting**: Every shell command enumerated in frontmatter
- **No secret leakage**: NTFY references topics only
- **Rollback-ready**: Preserves previous versions

### Integration with Existing Scripts

The workflow runtime-imports `.github/shared-instructions.md` for project context.

It integrates with:

- `scripts/skill-auto-update.sh` - 4-mode protocol source
- `scripts/notify-ntfy.sh` - Alert system
- `services/moltbook-client/` - API implementation

## Monitoring

### Check Workflow Status

```bash
# List recent runs
gh run list --workflow=moltbot-auto-darwinism --limit 10

# View specific run
gh run view [RUN_ID]

# View logs
gh run view [RUN_ID] --log
```

### NTFY Alerts

Subscribe to topics:

- `council-updates` - All Auto-Darwinism events
- Priority levels: low (PATCH), medium (MINOR), high (MAJOR), urgent (CRITICAL)

### GitHub Notifications

- **PRs**: Labeled with `auto-darwinism`, `skill-update`, `automation`
- **Issues**: Created on failure with `diagnostics` label
- **Draft PRs**: PATCH-level changes for batch review

## Expected Behavior

**No Changes Detected**:

```
✅ Daily Health Check passed
✅ API Compliance verified
ℹ️ No action required
```

**PATCH Changes** (Mode 1):

```
📝 Documentation updates detected
→ Creating draft PR for batch review
→ NTFY low priority alert sent
```

**MINOR Changes** (Mode 2):

```
✨ New endpoints detected: /agents/:id/challenges
→ Creating PR for review
→ NTFY medium priority alert sent
→ Tests passing
```

**MAJOR Changes** (Mode 3):

```
⚠️ Breaking API changes detected
→ Creating PR requiring human review
→ NTFY high priority alert sent
→ Rollback instructions included
```

**CRITICAL Changes** (Mode 4):

```
🚨 Security update: CVE-2026-12345
→ Creating urgent PR (non-draft)
→ NTFY urgent alert sent
→ Immediate review required
```

## Troubleshooting

### Workflow Won't Start

```bash
# Check if enabled
gh workflow view moltbot-auto-darwinism

# Enable if needed
gh workflow enable moltbot-auto-darwinism

# Check secrets
gh secret list
```

### Compilation Fails

```bash
# Check gh-aw installation
gh extension list | grep aw

# Reinstall if needed
gh extension remove gh-aw
gh extension install github/gh-aw
```

### Tests Failing

The workflow will:

1. Create a GitHub issue with diagnostics
2. Not create a PR (prevents broken code)
3. Include test output in issue

### Network Errors

Check allowlisted domains in frontmatter:

- `*.moltbook.com`
- `raw.githubusercontent.com`
- GitHub APIs (default)

### Rate Limits

The workflow respects:

- GitHub API rate limits (authenticated)
- Moltbook API rate limits (via secrets)

## Rollback Procedure

If an Auto-Darwinism update causes issues:

```bash
# Find the PR that introduced the change
gh pr list --label auto-darwinism --state merged

# Revert the PR
git revert [MERGE_COMMIT]
git push

# Or use the rollback script
./scripts/skill-auto-update.sh --rollback
```

## Maintenance

### Update Workflow

```bash
# Edit the workflow
vim .github/workflows/moltbot-auto-darwinism.md

# Recompile
gh aw compile .github/workflows/moltbot-auto-darwinism.md

# Commit both files
git add .github/workflows/moltbot-auto-darwinism.{md,lock.yml}
git commit -m "chore: update Auto-Darwinism workflow"
git push
```

### Add New Monitored Files

Edit frontmatter:

```yaml
tools:
  bash:
    - "curl -sL https://www.moltbook.com/NEW_FILE.md"
    - "cat skills/moltbook/NEW_FILE.md"
```

Then recompile.

### Adjust Classification Logic

Edit Phase 3 in the workflow markdown to modify:

- Change classification criteria
- Priority levels
- Alert destinations

## Success Metrics

✅ **Working Correctly**:

- Daily runs complete without errors
- PRs created for detected changes
- Tests pass before PR creation
- NTFY alerts sent appropriately
- No false positives

❌ **Needs Attention**:

- Workflow failing repeatedly
- PRs created for no changes (too sensitive)
- No PRs when changes exist (too loose)
- Test failures blocking valid updates
- Alert spam (incorrect priority)

## Related Documentation

- [GitHub Actions Workflows](https://docs.github.com/en/actions)
- [gh-aw Documentation](https://github.com/github/gh-aw)
- [Auto-Darwinism Protocol](../scripts/skill-auto-update.sh)
- [Moltbook Skill Files](https://www.moltbook.com/skill.md)
- [Moltbook API Spec](https://github.com/moltbook/api)

## Next Enhancements

Future improvements to consider:

- [ ] Add Slack/Discord integration
- [ ] Custom classification rules per file
- [ ] Automatic rollback on test failures
- [ ] Changelog generation
- [ ] Version bump automation
- [ ] Multi-repository support
