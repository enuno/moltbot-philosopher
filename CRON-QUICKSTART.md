# Quick Start: Automated Cron Jobs

## TL;DR - Just Run This

```bash
cd /home/elvis/.moltbot
bash scripts/setup-cron-jobs.sh
```

That's it! Two daily jobs will now run automatically:
- **2 AM UTC**: Database backups
- **3 AM UTC**: Persona file commits (with Venice.AI-generated messages)

## Before You Start

**Requirements:**

1. **Venice.AI API Key** - Add to `.env`:
   ```bash
   echo "VENICE_API_KEY=your_key_here" >> /home/elvis/.moltbot/.env
   ```

2. **Git Credentials** - Configure one of:
   ```bash
   # Option A: SSH key (recommended)
   ssh-add ~/.ssh/id_rsa

   # Option B: Git credential helper
   git config --global credential.helper store
   git push origin main  # Will prompt once, then remember
   ```

3. **Git User** - Configure:
   ```bash
   git config --global user.name "Moltbot"
   git config --global user.email "moltbot@philosophers.local"
   ```

## Run Setup

```bash
bash scripts/setup-cron-jobs.sh
```

Output shows:
✓ Cron jobs installed
✓ Schedule: Daily at 02:00 (backup) and 03:00 (persona commits)
✓ Logs: `/var/log/moltbot-backup.log` and `/var/log/moltbot-persona-commit.log`

## Monitor Logs

```bash
# Watch database backups
tail -f /var/log/moltbot-backup.log

# Watch persona commits
tail -f /var/log/moltbot-persona-commit.log

# Check both in one terminal
tail -f /var/log/moltbot-*.log
```

## What Happens

### Persona File Commits (3 AM UTC)

Every day at 3 AM, the system:

1. Checks if any philosopher files changed:
   - `workspace/*/AGENTS.md`
   - `workspace/*/SOUL.md`
   - `workspace/*/IDENTITY.md`
   - `workspace/*/MEMORY.md`

2. If changes found:
   - Sends git diff to Venice.AI
   - Generates a meaningful commit message
   - Commits changes: `feat(classical): Update AGENTS.md with enhanced metadata`
   - Pushes to origin/main

3. If no changes:
   - Logs info and exits (no commit)

### Database Backups (2 AM UTC)

Every day at 2 AM:

1. Backs up PostgreSQL databases
2. Stores in: `~/.moltbot/backups/db/`
3. Keeps: 7 daily + 2 weekly + 1 monthly
4. Compresses with gzip

## Verify Installation

```bash
# See your cron jobs
crontab -l | grep moltbot

# Output should show:
# 0 2 * * * cd /home/elvis/.moltbot && bash scripts/db-backup.sh ...
# 0 3 * * * cd /home/elvis/.moltbot && bash scripts/commit-persona-changes.sh ...
```

## Troubleshooting

**Cron jobs not running?**
```bash
# Check if cron daemon is active
sudo systemctl status cron

# Restart if needed
sudo systemctl restart cron
```

**Venice.AI errors?**
```bash
# Verify API key is set
grep VENICE_API_KEY ~/.env

# Test connectivity
curl -s -H "Authorization: Bearer $VENICE_API_KEY" \
  https://api.venice.ai/v1/models | jq .
```

**Git push fails?**
```bash
# Test git credentials
cd /home/elvis/.moltbot
git push origin main
```

## Modify Schedules

Change run times by editing crontab:

```bash
crontab -e
```

Common formats:
- `0 2 * * *` = 2 AM daily
- `0 2 * * 1` = 2 AM every Monday
- `*/30 * * * *` = Every 30 minutes

## Uninstall

Remove all moltbot cron jobs:

```bash
crontab -l | grep -v moltbot | crontab -
```

## Full Documentation

See `docs/CRON-JOBS.md` for:
- Detailed configuration options
- Advanced setups (custom schedules, environment variables)
- Log rotation
- Restore database from backups
- Troubleshooting guide

## Support

Scripts location:
- `scripts/commit-persona-changes.sh` - Persona commit job
- `scripts/db-backup.sh` - Database backup job
- `scripts/setup-cron-jobs.sh` - Installation script

Logs location:
- `/var/log/moltbot-backup.log` - Database backup output
- `/var/log/moltbot-persona-commit.log` - Persona commit output

Documentation:
- `docs/CRON-JOBS.md` - Full guide
