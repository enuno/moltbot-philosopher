#!/bin/bash
#
# Moltbot Cron Job Setup Script
# Installs daily cron jobs for:
#   1. Database backups (2 AM UTC)
#   2. Persona file commits (3 AM UTC)
#
# Usage: bash scripts/setup-cron-jobs.sh
#

set -euo pipefail

# Configuration
REPO_ROOT="${HOME}/.moltbot"
CRON_USER="$(whoami)"
LOG_DIR="/var/log"
PERSONA_LOG="$LOG_DIR/moltbot-persona-commit.log"
BACKUP_LOG="$LOG_DIR/moltbot-backup.log"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Verify repo exists
if [ ! -d "$REPO_ROOT" ]; then
    log_error "Repository not found at $REPO_ROOT"
    exit 1
fi

log_info "Setting up cron jobs for moltbot"
log_info "Repository: $REPO_ROOT"
log_info "Cron user: $CRON_USER"

# Check if scripts exist
if [ ! -f "$REPO_ROOT/scripts/db-backup.sh" ]; then
    log_error "Database backup script not found"
    exit 1
fi

if [ ! -f "$REPO_ROOT/scripts/commit-persona-changes.sh" ]; then
    log_error "Persona commit script not found"
    exit 1
fi

# Ensure log files exist and are writable
for log_file in "$PERSONA_LOG" "$BACKUP_LOG"; do
    if [ ! -f "$log_file" ]; then
        log_info "Creating log file: $log_file"
        sudo touch "$log_file" 2>/dev/null || touch "$log_file" 2>/dev/null || {
            log_warning "Could not create $log_file - cron output won't be logged to file"
        }
    fi

    # Try to make writable
    chmod 666 "$log_file" 2>/dev/null || true
done

# Get current crontab (or create empty one)
crontab -l > /tmp/crontab.backup 2>/dev/null || true

# Create new crontab content
log_info "Creating cron entries..."

cat > /tmp/crontab.new <<'CRON_EOF'
# Moltbot: Database backups at 2 AM UTC (7 PM EST)
0 2 * * * cd /home/elvis/.moltbot && bash scripts/db-backup.sh >> /var/log/moltbot-backup.log 2>&1

# Moltbot: Persona file commits at 3 AM UTC (8 PM EST)
0 3 * * * cd /home/elvis/.moltbot && bash scripts/commit-persona-changes.sh >> /var/log/moltbot-persona-commit.log 2>&1
CRON_EOF

# Check if entries already exist
if crontab -l 2>/dev/null | grep -q "moltbot-backup"; then
    log_warning "Cron job for database backup already exists"
    # Remove old entries and add new ones
    crontab -l 2>/dev/null | grep -v "moltbot-backup" | grep -v "moltbot-persona" > /tmp/crontab.new.tmp || true
    cat /tmp/crontab.new >> /tmp/crontab.new.tmp
    mv /tmp/crontab.new.tmp /tmp/crontab.new
else
    # Append to existing crontab
    crontab -l 2>/dev/null >> /tmp/crontab.new || true
fi

# Remove duplicates and install
sort -u /tmp/crontab.new | crontab - 2>/dev/null

if [ $? -eq 0 ]; then
    log_success "Cron jobs installed"
else
    log_error "Failed to install cron jobs"
    log_info "Restoring previous crontab..."
    if [ -f /tmp/crontab.backup ] && [ -s /tmp/crontab.backup ]; then
        crontab /tmp/crontab.backup
    fi
    exit 1
fi

# Verify installation
log_info "Verifying cron jobs..."
echo ""
crontab -l | grep moltbot || log_warning "Could not verify cron entries"

log_success "Cron job setup completed!"
log_info "Schedules:"
log_info "  - Database backups: Daily at 02:00 UTC (7 PM EST)"
log_info "  - Persona commits: Daily at 03:00 UTC (8 PM EST)"
log_info ""
log_info "Logs:"
log_info "  - Database backups: $BACKUP_LOG"
log_info "  - Persona commits: $PERSONA_LOG"
log_info ""
log_info "To view cron logs in real-time:"
log_info "  tail -f $BACKUP_LOG"
log_info "  tail -f $PERSONA_LOG"
log_info ""
log_info "To modify cron jobs:"
log_info "  crontab -e"
log_info ""
log_info "To remove all moltbot cron jobs:"
log_info "  crontab -l | grep -v moltbot | crontab -"

# Cleanup
rm -f /tmp/crontab.backup /tmp/crontab.new /tmp/crontab.new.tmp 2>/dev/null || true
