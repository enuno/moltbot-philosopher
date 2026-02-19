#!/bin/bash
# tests/unit/scripts/skill-pinning.test.sh
# Tests the safe_update_skill_file and cleanup_old_backups logic
# from scripts/skill-auto-update.sh, using mock curl to avoid network deps.

set -euo pipefail

PASS_COUNT=0
FAIL_COUNT=0

pass() {
    echo "[PASS] $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo "[FAIL] $1: $2"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

# ---------------------------------------------------------------
# Minimal stub for log() — keeps test output readable.
# ---------------------------------------------------------------
log() { :; }

# ---------------------------------------------------------------
# Functions under test (copied verbatim from skill-auto-update.sh).
# Keep in sync with the source.
# ---------------------------------------------------------------

safe_update_skill_file() {
    local url="$1"
    local dest="$2"
    local backup="${dest}.backup"
    local tmp="${dest}.tmp.$$"

    if [ -f "$dest" ]; then
        cp "$dest" "$backup"
        log "BACKUP: $dest -> $backup"
    fi

    curl -s "$url" -o "$tmp"

    if [ ! -s "$tmp" ]; then
        log "WARN: Downloaded file for $url is empty — restoring backup"
        rm -f "$tmp"
        if [ -f "$backup" ]; then
            cp "$backup" "$dest"
            log "RESTORE: $dest restored from backup"
        fi
        return 1
    fi

    mv "$tmp" "$dest"
    log "UPDATE: $dest updated from $url"
    return 0
}

cleanup_old_backups() {
    local dir="$1"
    log "CLEANUP: Removing .backup files older than 7 days in $dir"
    find "$dir" -name "*.backup" -mtime +7 -delete 2>/dev/null || true
}

# ---------------------------------------------------------------
# Mock curl: writes MOCK_CURL_CONTENT to the -o destination.
# Set MOCK_CURL_CONTENT before calling safe_update_skill_file.
# An empty MOCK_CURL_CONTENT simulates a failed/empty download.
# ---------------------------------------------------------------
MOCK_CURL_CONTENT=""

curl() {
    # Parse -o <dest> from arguments
    local dest=""
    local prev=""
    for arg in "$@"; do
        if [ "$prev" = "-o" ]; then
            dest="$arg"
        fi
        prev="$arg"
    done

    if [ -n "$dest" ]; then
        printf '%s' "$MOCK_CURL_CONTENT" > "$dest"
    fi
    return 0
}

# ---------------------------------------------------------------
# TEST 1: Successful update — non-empty content replaces old file
# ---------------------------------------------------------------
test_successful_update() {
    local dir
    dir=$(mktemp -d)
    local skill_file="$dir/SKILL.md"
    local original_content="# Original Skill Content"
    local new_content="# Updated Skill Content"

    echo "$original_content" > "$skill_file"

    MOCK_CURL_CONTENT="$new_content"
    local result=0
    safe_update_skill_file "https://example.com/skill.md" "$skill_file" || result=$?

    # Backup must exist
    if [ ! -f "${skill_file}.backup" ]; then
        fail "TEST1: backup was created" "backup file missing"
        rm -rf "$dir"
        return
    fi
    pass "TEST1: backup was created"

    # Backup must contain the original content
    local backup_content
    backup_content=$(cat "${skill_file}.backup")
    if [ "$backup_content" != "$original_content" ]; then
        fail "TEST1: backup contains original content" \
            "expected '$original_content', got '$backup_content'"
        rm -rf "$dir"
        return
    fi
    pass "TEST1: backup contains original content"

    # Skill file must now contain the new content
    local current_content
    current_content=$(cat "$skill_file")
    if [ "$current_content" != "$new_content" ]; then
        fail "TEST1: new content replaced old content" \
            "expected '$new_content', got '$current_content'"
        rm -rf "$dir"
        return
    fi
    pass "TEST1: new content replaced old content"

    rm -rf "$dir"
}

# ---------------------------------------------------------------
# TEST 2: Failed update — empty download restores backup
# ---------------------------------------------------------------
test_failed_update_restores_backup() {
    local dir
    dir=$(mktemp -d)
    local skill_file="$dir/SKILL.md"
    local original_content="# Original Skill — must be preserved"

    echo "$original_content" > "$skill_file"

    # Empty content simulates a bad/empty download
    MOCK_CURL_CONTENT=""
    local result=0
    safe_update_skill_file "https://example.com/skill.md" "$skill_file" || result=$?

    # Function should have returned non-zero
    if [ "$result" -eq 0 ]; then
        fail "TEST2: function returns error on empty download" \
            "expected non-zero exit, got 0"
        rm -rf "$dir"
        return
    fi
    pass "TEST2: function returns error on empty download"

    # Original content must be intact (restored from backup)
    local current_content
    current_content=$(cat "$skill_file")
    if [ "$current_content" != "$original_content" ]; then
        fail "TEST2: original content preserved after failed update" \
            "expected '$original_content', got '$current_content'"
        rm -rf "$dir"
        return
    fi
    pass "TEST2: original content preserved after failed update"

    rm -rf "$dir"
}

# ---------------------------------------------------------------
# TEST 3: cleanup_old_backups removes stale files, keeps fresh ones
# ---------------------------------------------------------------
test_cleanup_old_backups() {
    local dir
    dir=$(mktemp -d)

    # Fresh backup — should be kept
    local fresh_backup="$dir/SKILL.md.backup"
    echo "# Fresh" > "$fresh_backup"

    # Stale backup (8 days old) — should be removed
    local stale_backup="$dir/OLD.md.backup"
    echo "# Stale" > "$stale_backup"
    touch -d "8 days ago" "$stale_backup"

    cleanup_old_backups "$dir"

    # Fresh backup should still exist
    if [ ! -f "$fresh_backup" ]; then
        fail "TEST3: fresh backup preserved by cleanup" "fresh backup was deleted"
        rm -rf "$dir"
        return
    fi
    pass "TEST3: fresh backup preserved by cleanup"

    # Stale backup should be gone
    if [ -f "$stale_backup" ]; then
        fail "TEST3: stale backup removed by cleanup" "stale backup still exists"
        rm -rf "$dir"
        return
    fi
    pass "TEST3: stale backup removed by cleanup"

    rm -rf "$dir"
}

# ---------------------------------------------------------------
# Run tests
# ---------------------------------------------------------------
echo "=== Skill Version-Pinning Unit Tests ==="
echo ""

test_successful_update
test_failed_update_restores_backup
test_cleanup_old_backups

echo ""
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "=== Summary: ${PASS_COUNT}/${TOTAL} assertions passed ==="

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

exit 0
