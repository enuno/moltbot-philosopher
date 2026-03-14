#!/bin/bash
#
# Database Backup Script for Moltbot
# Backs up both noosphere and action_queue databases
# Maintains: 7 daily backups + 2 weekly backups + 1 monthly backup
#
# Usage: bash scripts/db-backup.sh
#        bash scripts/db-backup.sh --list
#        bash scripts/db-backup.sh --cleanup-only
#        bash scripts/db-backup.sh --restore <backup-file>
#
# Cron setup:
#   # Daily backup at 2 AM UTC
#   0 2 * * * cd /home/elvis/.moltbot && bash scripts/db-backup.sh >> /var/log/moltbot-backup.log 2>&1
#

set -euo pipefail

# Configuration
BACKUP_DIR="${HOME}/.moltbot/backups/db"
POSTGRES_CONTAINER="noosphere-postgres"
POSTGRES_USER="noosphere_admin"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme_noosphere_2026}"
TIMESTAMP=$(date +%Y-%m-%d)
DATETIME=$(date +%Y-%m-%d_%H-%M-%S)

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

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if postgres container is running
check_postgres() {
    if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
        log_error "PostgreSQL container '$POSTGRES_CONTAINER' is not running"
        exit 1
    fi
}

# Backup a database
backup_database() {
    local db_name="$1"
    local backup_file="${BACKUP_DIR}/${db_name}-backup-${TIMESTAMP}.sql"

    log_info "Backing up database: $db_name"

    # Export the database
    if PGPASSWORD="$POSTGRES_PASSWORD" docker exec "$POSTGRES_CONTAINER" \
        pg_dump -U "$POSTGRES_USER" -d "$db_name" -F plain > "$backup_file"; then
        log_success "Database '$db_name' backed up to: ${backup_file#$HOME/}"
        return 0
    else
        log_error "Failed to backup database '$db_name'"
        rm -f "$backup_file"
        return 1
    fi
}

# Cleanup old backups following retention policy
cleanup_old_backups() {
    log_info "Cleaning up old backups..."

    local db_names=("noosphere" "action_queue")

    for db in "${db_names[@]}"; do
        local dir_prefix="${BACKUP_DIR}/${db}-backup"

        # Find all backup files for this database
        local all_backups=()
        while IFS= read -r -d '' file; do
            all_backups+=("$file")
        done < <(find "$BACKUP_DIR" -name "${db}-backup-*.sql" -print0 | sort -z -r)

        if [ ${#all_backups[@]} -eq 0 ]; then
            log_warning "No existing backups found for $db"
            continue
        fi

        # Parse dates and categorize backups
        local daily_files=()
        local weekly_files=()
        local monthly_files=()
        local to_delete=()
        local today=$(date +%Y-%m-%d)
        local today_sec=$(date +%s)

        for file in "${all_backups[@]}"; do
            local basename=$(basename "$file" ".sql")
            local date_part="${basename#${db}-backup-}"
            local file_date=$(date -d "$date_part" +%s 2>/dev/null || echo "0")
            local days_old=$(( ($today_sec - $file_date) / 86400 ))
            local day_of_week=$(date -d "$date_part" +%u 2>/dev/null || echo "0")  # 1=Monday, 7=Sunday

            # Daily: Keep 7 most recent daily backups (7 days)
            if [ $days_old -lt 7 ]; then
                if [ ${#daily_files[@]} -lt 7 ]; then
                    daily_files+=("$file")
                    continue
                fi
            fi

            # Weekly: Keep last 2 Sundays (one week apart)
            # Sunday = 7, so keep Sundays from 7-14 days ago and 14-21 days ago
            if [ "$day_of_week" -eq 7 ] && [ $days_old -ge 7 ] && [ $days_old -lt 21 ]; then
                if [ ${#weekly_files[@]} -lt 2 ]; then
                    weekly_files+=("$file")
                    continue
                fi
            fi

            # Monthly: Keep 1 backup from the 28th of each month
            local day_of_month=$(date -d "$date_part" +%d 2>/dev/null || echo "0")
            if [ "$day_of_month" -eq 28 ]; then
                if [ ${#monthly_files[@]} -lt 1 ]; then
                    monthly_files+=("$file")
                    continue
                fi
            fi

            # Mark for deletion
            to_delete+=("$file")
        done

        # Delete old backups
        for file in "${to_delete[@]}"; do
            if rm "$file"; then
                log_info "Deleted old backup: ${file#$HOME/}"
            else
                log_warning "Failed to delete: ${file#$HOME/}"
            fi
        done

        # Print retained backups
        log_info "Retention for $db:"
        log_info "  Daily (7): ${#daily_files[@]} retained"
        log_info "  Weekly (2): ${#weekly_files[@]} retained"
        log_info "  Monthly (1): ${#monthly_files[@]} retained"
    done
}

# List all backups
list_backups() {
    log_info "Available backups:"
    echo ""

    if [ ! -d "$BACKUP_DIR" ]; then
        log_warning "Backup directory does not exist yet"
        return
    fi

    local count=0
    while IFS= read -r file; do
        local size=$(du -h "$file" | cut -f1)
        local date=$(basename "$file" | sed 's/.*-backup-//;s/.sql//')
        printf "  %-30s %s\n" "${file#$HOME/}" "$size"
        ((count++))
    done < <(find "$BACKUP_DIR" -name "*.sql" -type f | sort -r)

    if [ $count -eq 0 ]; then
        log_warning "No backups found"
    else
        echo ""
        log_info "Total backups: $count"
    fi
}

# Restore from a backup
restore_database() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi

    # Extract database name from filename
    local basename=$(basename "$backup_file" ".sql")
    local db_name="${basename%-backup*}"

    log_warning "This will restore database '$db_name' from: ${backup_file#$HOME/}"
    read -p "Type 'YES' to confirm restore: " confirm

    if [ "$confirm" != "YES" ]; then
        log_info "Restore cancelled"
        return 0
    fi

    log_info "Restoring database: $db_name"

    if PGPASSWORD="$POSTGRES_PASSWORD" docker exec -i "$POSTGRES_CONTAINER" \
        psql -U "$POSTGRES_USER" -d "$db_name" < "$backup_file"; then
        log_success "Database '$db_name' restored from backup"
    else
        log_error "Failed to restore database '$db_name'"
        exit 1
    fi
}

# Main execution
check_postgres

case "${1:-backup}" in
    backup)
        log_info "Starting database backups at $(date)"
        if backup_database "noosphere" && backup_database "action_queue"; then
            cleanup_old_backups
            log_success "Database backups completed successfully"
        else
            log_error "Backup failed"
            exit 1
        fi
        ;;
    --list)
        list_backups
        ;;
    --cleanup-only)
        cleanup_old_backups
        ;;
    --restore)
        if [ -z "${2:-}" ]; then
            log_error "Usage: $0 --restore <backup-file>"
            echo "Available backups:"
            list_backups
            exit 1
        fi
        restore_database "$2"
        ;;
    --help|-h)
        cat <<'EOF'
Database Backup Script for Moltbot

Usage:
    bash scripts/db-backup.sh                    # Run backup with cleanup
    bash scripts/db-backup.sh --list             # List all backups
    bash scripts/db-backup.sh --cleanup-only     # Only cleanup old backups
    bash scripts/db-backup.sh --restore <file>   # Restore from backup
    bash scripts/db-backup.sh --help             # Show this help

Retention Policy:
    - 7 daily backups (last 7 days)
    - 2 weekly backups (last 2 Sundays)
    - 1 monthly backup (28th of month)

Cron Setup (daily 2 AM UTC):
    0 2 * * * cd /home/elvis/.moltbot && bash scripts/db-backup.sh >> /var/log/moltbot-backup.log 2>&1

Example:
    bash scripts/db-backup.sh                                    # Full backup
    bash scripts/db-backup.sh --restore ~/.moltbot/backups/db/noosphere-backup-2026-03-01.sql
EOF
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '--help' for usage information"
        exit 1
        ;;
esac
