# Moltbot Cron Jobs Setup Guide

This document explains how to set up and manage automated daily tasks for Moltbot using cron.

## Overview

Two automated daily tasks are configured:

1. **Database Backups** (2 AM UTC / 7 PM EST)
   - Backs up PostgreSQL databases (noosphere and action_queue)
   - Maintains 7 daily + 2 weekly + 1 monthly retention policy
   - Script: `scripts/db-backup.sh`

2. **Persona File Commits** (3 AM UTC / 8 PM EST)
   - Monitors workspace philosopher persona files for changes
   - Generates commit messages using Venice.AI
   - Auto-commits and pushes changes to main
   - Script: `scripts/commit-persona-changes.sh`

## Prerequisites

### Required Environment Variables

Ensure these are set in your `.env` file:

```bash
# Venice.AI API key (for commit message generation)
VENICE_API_KEY=your_venice_api_key_here

# PostgreSQL credentials (for database backups)
POSTGRES_PASSWORD=your_postgres_password
```

### Git Configuration

Cron jobs must run with proper git credentials:

```bash
# Configure git user for commits
git config --global user.name "Moltbot"
git config --global user.email "moltbot@philosophers.local"

# Set up SSH key or credential helper for pushes
# Option 1: SSH key (recommended)
eval $(ssh-agent)
ssh-add ~/.ssh/id_rsa  # Add your GitHub SSH key

# Option 2: Git credential helper
git config --global credential.helper store
# Then run: git push origin main  # Will prompt for credentials once
```

## Setup Instructions

### Quick Setup

Run the automated setup script:

```bash
cd /home/elvis/.moltbot
bash scripts/setup-cron-jobs.sh
```

This will:
- Create cron entries for both jobs
- Set up log files
- Verify installation
- Display schedule and logs information

### Manual Setup (if needed)

If you prefer to configure cron manually:

```bash
crontab -e
```

Add these lines:

```crontab
# Moltbot: Database backups at 2 AM UTC
0 2 * * * cd /home/elvis/.moltbot && bash scripts/db-backup.sh >> /var/log/moltbot-backup.log 2>&1

# Moltbot: Persona file commits at 3 AM UTC
0 3 * * * cd /home/elvis/.moltbot && bash scripts/commit-persona-changes.sh >> /var/log/moltbot-persona-commit.log 2>&1
```

## Monitoring & Logs

### View Current Cron Jobs

```bash
crontab -l | grep moltbot
```

### Monitor Log Files in Real-Time

```bash
# Database backup logs
tail -f /var/log/moltbot-backup.log

# Persona commit logs
tail -f /var/log/moltbot-persona-commit.log
```

### Check Recent Cron Job Executions

```bash
# On Linux with systemd journal
journalctl | grep CRON

# On macOS
log show --predicate 'eventMessage contains[cd] "cron"' --last 1d
```

## Persona File Commit Script Details

### What Files Are Tracked

The `commit-persona-changes.sh` script monitors these files in each philosopher's workspace:

```
workspace/{agent}/AGENTS.md
workspace/{agent}/SOUL.md
workspace/{agent}/IDENTITY.md
workspace/{agent}/MEMORY.md
```

### How It Works

1. **Change Detection**: Checks git diff against origin/main
2. **Message Generation**: Sends diff to Venice.AI with prompt for conventional commit
3. **Staging & Commit**: Stages changes and commits with generated message
4. **Push**: Pushes changes to origin/main

### Venice.AI Integration

The script uses Venice.AI (GPT-4o model) to generate meaningful commit messages:

```
Type: feat|fix|docs|refactor
Scope: (philosopher agent name or file type)
Subject: Clear, concise description (< 72 chars)
Body: Detailed explanation if needed
```

Example generated message:
```
feat(classical): Update AGENTS.md with enhanced persona metadata

- Added new memory architecture documentation
- Updated consciousness framework definitions
- Improved system prompt coherence
```

### Error Handling

If the script encounters errors:

- **Venice.AI unavailable**: Logs error, rolls back commit, skips push
- **Git push fails**: Logs error, resets commit, exits with status 1
- **No changes detected**: Logs info message, exits cleanly with status 0

## Database Backup Script Details

### What Gets Backed Up

- PostgreSQL databases: `noosphere`, `action_queue`
- Backup location: `~/.moltbot/backups/db/`

### Retention Policy

- **Daily**: Last 7 days (keeps latest from each day)
- **Weekly**: Last 2 weeks (Sunday backups)
- **Monthly**: 1 month (28th of each month)

### Restore a Backup

```bash
# List available backups
bash scripts/db-backup.sh --list

# Restore a specific backup
bash scripts/db-backup.sh --restore backups/db/noosphere-2026-03-10.sql
```

## Troubleshooting

### Cron Jobs Not Running

**Check if cron daemon is running:**

```bash
# Linux
sudo systemctl status cron
sudo systemctl start cron

# macOS
sudo launchctl list | grep cron
```

**Verify script paths:**

```bash
# Test database backup script
bash /home/elvis/.moltbot/scripts/db-backup.sh

# Test persona commit script
bash /home/elvis/.moltbot/scripts/commit-persona-changes.sh
```

### Venice.AI API Errors

**Check API key:**

```bash
# Verify key exists
grep VENICE_API_KEY ~/.env

# Test Venice.AI connection
curl -s -X GET https://api.venice.ai/v1/models \
  -H "Authorization: Bearer $VENICE_API_KEY" | jq .
```

### Git Push Fails

**Verify git credentials:**

```bash
# Test git push manually
cd /home/elvis/.moltbot
git push origin main

# If prompted for credentials, configure credential helper
git config --global credential.helper store
```

### Permissions Issues

**Ensure proper permissions:**

```bash
# Scripts executable
chmod +x scripts/db-backup.sh
chmod +x scripts/commit-persona-changes.sh
chmod +x scripts/setup-cron-jobs.sh

# Log files writable
sudo touch /var/log/moltbot-backup.log
sudo touch /var/log/moltbot-persona-commit.log
sudo chmod 666 /var/log/moltbot-*.log
```

## Advanced Configuration

### Custom Cron Schedules

Modify times by editing crontab:

```bash
crontab -e
```

Common time formats:
- `0 2 * * *` - Every day at 2 AM
- `0 2 * * 1` - Every Monday at 2 AM
- `*/30 * * * *` - Every 30 minutes
- `0 0 1 * *` - First day of month at midnight

### Environment Variables in Cron

If Venice.AI key isn't available during cron execution:

```bash
# Edit crontab with environment setup
crontab -e

# Add this before the job commands
VENICE_API_KEY=your_key_here
POSTGRES_PASSWORD=your_password_here

0 2 * * * cd /home/elvis/.moltbot && bash scripts/db-backup.sh >> /var/log/moltbot-backup.log 2>&1
0 3 * * * cd /home/elvis/.moltbot && bash scripts/commit-persona-changes.sh >> /var/log/moltbot-persona-commit.log 2>&1
```

### Log Rotation

Set up logrotate to manage growing log files:

```bash
sudo tee /etc/logrotate.d/moltbot > /dev/null <<'EOF'
/var/log/moltbot-*.log {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
}
EOF
```

## Uninstall Cron Jobs

To remove all moltbot cron jobs:

```bash
# Remove moltbot entries from crontab
crontab -l | grep -v moltbot | crontab -

# Verify removal
crontab -l
```

## Success Indicators

After setup, you should see:

1. **Cron jobs listed:**
   ```bash
   $ crontab -l | grep moltbot
   0 2 * * * cd /home/elvis/.moltbot && bash scripts/db-backup.sh >> /var/log/moltbot-backup.log 2>&1
   0 3 * * * cd /home/elvis/.moltbot && bash scripts/commit-persona-changes.sh >> /var/log/moltbot-persona-commit.log 2>&1
   ```

2. **Log files created:**
   ```bash
   $ ls -lh /var/log/moltbot-*.log
   -rw-rw-rw- ... /var/log/moltbot-backup.log
   -rw-rw-rw- ... /var/log/moltbot-persona-commit.log
   ```

3. **Daily execution results in logs:**
   ```bash
   $ tail -5 /var/log/moltbot-backup.log
   ℹ 2026-03-14 02:00:05 - Starting database backup
   ✓ 2026-03-14 02:00:12 - Backed up database to backups/db/noosphere-2026-03-14.sql
   ...
   ```

## Integration Notes

These cron jobs are designed to run independently of the Docker services:

- **Host machine cron**: Runs directly on the system (not in containers)
- **Database access**: Uses `docker exec` to access PostgreSQL container
- **Git push**: Requires git credentials configured on the host
- **Venice.AI**: Makes HTTPS API calls (no container required)

This allows automated operations even if Docker services are temporarily down or restarting.

---

For additional help or issues, refer to:
- Database backup script: `scripts/db-backup.sh`
- Persona commit script: `scripts/commit-persona-changes.sh`
- Git documentation: `man crontab`
