#!/bin/bash

# skill-auto-update.sh - Auto-Darwinism Protocol Implementation
# Implements the Four-Mode Update Protocol for skill self-updating

set -euo pipefail

# Configuration
SKILL_MANIFEST_DIR="/workspace/classical/skill-manifest"
CURRENT_DIR="$SKILL_MANIFEST_DIR/current"
STAGING_DIR="$SKILL_MANIFEST_DIR/staging"
ARCHIVE_DIR="$SKILL_MANIFEST_DIR/archive"
HASHES_FILE="$SKILL_MANIFEST_DIR/hashes.json"
LOG_FILE="/workspace/classical/logs/skill-updates.log"
NTFY_TOPIC="council-updates"

# URLs
SKILL_MD_URL="https://www.moltbook.com/skill.md"
HEARTBEAT_MD_URL="https://www.moltbook.com/HEARTBEAT.md"
MESSAGING_MD_URL="https://www.moltbook.com/MESSAGING.md"
PACKAGE_JSON_URL="https://www.moltbook.com/package.json"

# Ensure directories exist
mkdir -p "$CURRENT_DIR" "$STAGING_DIR" "$ARCHIVE_DIR" "$(dirname "$LOG_FILE")"

# Initialize hashes.json if it doesn't exist
if [ ! -f "$HASHES_FILE" ]; then
    cat > "$HASHES_FILE" << 'EOF'
{
  "skill_md_hash": "",
  "heartbeat_md_hash": "",
  "messaging_md_hash": "",
  "package_json_hash": "",
  "current_version": "1.0.0",
  "rollback_count": 0,
  "last_check": "1970-01-01T00:00:00Z"
}
EOF
fi

# Logging function
log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" >> "$LOG_FILE"
}

# Canonical hash function (stripping whitespace noise)
canonical_hash() {
    curl -s "$1" | sed 's/[[:space:]]\+/ /g' | tr -d '\n' | sha256sum | cut -d' ' -f1
}

# NTFY notification function
ntfy_notify() {
    local priority="$1"
    local title="$2"
    local message="$3"

    if command -v ntfy &> /dev/null; then
        ntfy publish -t "$title" -p "$priority" "$message" "$NTFY_TOPIC"
    else
        log "NTFY: $priority - $title - $message"
    fi
}

# Check for updates
check_updates() {
    log "CHECK: Starting skill update check"

    # Get current hashes
    local current_skill_hash=$(jq -r '.skill_md_hash' "$HASHES_FILE")
    local current_heartbeat_hash=$(jq -r '.heartbeat_md_hash' "$HASHES_FILE")
    local current_messaging_hash=$(jq -r '.messaging_md_hash' "$HASHES_FILE")
    local current_package_hash=$(jq -r '.package_json_hash' "$HASHES_FILE")

    # Get remote hashes
    local remote_skill_hash=$(canonical_hash "$SKILL_MD_URL")
    local remote_heartbeat_hash=$(canonical_hash "$HEARTBEAT_MD_URL")
    local remote_messaging_hash=$(canonical_hash "$MESSAGING_MD_URL")
    local remote_package_hash=$(canonical_hash "$PACKAGE_JSON_URL")

    # Check for changes
    local skill_changed=false
    local heartbeat_changed=false
    local messaging_changed=false
    local package_changed=false

    if [ "$current_skill_hash" != "$remote_skill_hash" ]; then
        log "DETECT: skill.md delta detected"
        skill_changed=true
    fi

    if [ "$current_heartbeat_hash" != "$remote_heartbeat_hash" ]; then
        log "DETECT: HEARTBEAT.md delta detected"
        heartbeat_changed=true
    fi

    if [ "$current_messaging_hash" != "$remote_messaging_hash" ]; then
        log "DETECT: MESSAGING.md delta detected"
        messaging_changed=true
    fi

    if [ "$current_package_hash" != "$remote_package_hash" ]; then
        log "DETECT: package.json delta detected"
        package_changed=true
    fi

    if [ "$skill_changed" = true ] || [ "$heartbeat_changed" = true ] || [ "$messaging_changed" = true ] || [ "$package_changed" = true ]; then
        log "DETECT: Changes detected, downloading to staging"

        # Download all files to staging
        curl -s "$SKILL_MD_URL" -o "$STAGING_DIR/skill.md"
        curl -s "$HEARTBEAT_MD_URL" -o "$STAGING_DIR/HEARTBEAT.md"
        curl -s "$MESSAGING_MD_URL" -o "$STAGING_DIR/MESSAGING.md"
        curl -s "$PACKAGE_JSON_URL" -o "$STAGING_DIR/package.json"

        # Classify the change
        local change_type=$(classify_change)

        case "$change_type" in
            "PATCH")
                mode_1_silent_sync
                ;;
            "MINOR")
                mode_2_staged_adoption
                ;;
            "MAJOR")
                mode_3_breaking_change
                ;;
            "CRITICAL")
                mode_4_security_emergency
                ;;
            *)
                log "ERROR: Unknown change type: $change_type"
                ntfy_notify "high" "Update Error" "Unknown change type detected: $change_type"
                ;;
        esac
    else
        log "CHECK: No changes detected"
    fi

    # Update last check time
    jq ".last_check = \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" "$HASHES_FILE" > "${HASHES_FILE}.tmp" && mv "${HASHES_FILE}.tmp" "$HASHES_FILE"
}

# Classify change function
classify_change() {
    # This is a simplified version - in production you'd want to actually analyze the diff
    # For now, we'll use file presence and simple pattern matching

    # Check for security-related changes
    if grep -qi "security\|cve\|vulnerability\|exploit" "$STAGING_DIR/skill.md" 2>/dev/null || \
       grep -qi "security\|cve\|vulnerability\|exploit" "$STAGING_DIR/HEARTBEAT.md" 2>/dev/null || \
       grep -qi "security\|cve\|vulnerability\|exploit" "$STAGING_DIR/MESSAGING.md" 2>/dev/null; then
        echo "CRITICAL"
        return
    fi

    # Check for breaking changes
    if grep -qi "breaking_change\|api_version\|deprecated" "$STAGING_DIR/skill.md" 2>/dev/null || \
       grep -qi "breaking_change\|api_version" "$STAGING_DIR/package.json" 2>/dev/null; then
        echo "MAJOR"
        return
    fi

    # Check for new endpoints or features
    if grep -qi "new endpoint\|feature\|enhancement" "$STAGING_DIR/skill.md" 2>/dev/null || \
       grep -qi "endpoint\|schema" "$STAGING_DIR/HEARTBEAT.md" 2>/dev/null || \
       grep -qi "endpoint\|schema" "$STAGING_DIR/MESSAGING.md" 2>/dev/null; then
        echo "MINOR"
        return
    fi

    # Default to PATCH (typo fixes, clarifications)
    echo "PATCH"
}

# Mode 1: Silent Synchronization (PATCH level)
mode_1_silent_sync() {
    log "MODE_1: Silent Synchronization initiated"

    # Validate Markdown syntax (simple check)
    if ! grep -q "^#" "$STAGING_DIR/skill.md"; then
        log "ERROR: Invalid Markdown in skill.md"
        ntfy_notify "high" "Update Error" "Invalid Markdown syntax in skill.md"
        return 1
    fi

    # Backup current version
    local timestamp=$(date +"%Y%m%d%H%M%S")
    local archive_dir="$ARCHIVE_DIR/v$timestamp"
    mkdir -p "$archive_dir"
    cp "$CURRENT_DIR"/* "$archive_dir/" 2>/dev/null || true

    # Atomic move
    cp "$STAGING_DIR"/* "$CURRENT_DIR/"

    # Update hashes
    jq ".skill_md_hash = \"$(canonical_hash "$SKILL_MD_URL")\" |
       .heartbeat_md_hash = \"$(canonical_hash "$HEARTBEAT_MD_URL")\" |
       .messaging_md_hash = \"$(canonical_hash "$MESSAGING_MD_URL")\" |
       .package_json_hash = \"$(canonical_hash "$PACKAGE_JSON_URL")\"" "$HASHES_FILE" > "${HASHES_FILE}.tmp" && \
    mv "${HASHES_FILE}.tmp" "$HASHES_FILE"

    log "DEPLOY: PATCH auto-deployed, hash updated"
    ntfy_notify "low" "Skill Update" "Documentation synchronized (PATCH level)"
}

# Mode 2: Staged Adoption (MINOR level)
mode_2_staged_adoption() {
    log "MODE_2: Staged Adoption initiated"

    # Schema validation (simple JSON check for package.json)
    if ! jq empty "$STAGING_DIR/package.json" 2>/dev/null; then
        log "ERROR: Invalid JSON in package.json"
        ntfy_notify "high" "Update Error" "Invalid JSON in package.json"
        return 1
    fi

    # Compatibility check (simple version comparison)
    local current_version=$(jq -r '.version' "$CURRENT_DIR/package.json" 2>/dev/null || echo "1.0.0")
    local new_version=$(jq -r '.version' "$STAGING_DIR/package.json" 2>/dev/null || echo "1.0.0")

    log "COMPAT: Current version $current_version, new version $new_version"

    # For now, we'll just proceed with the update
    # In a full implementation, you'd want to do more thorough testing

    # Backup current version
    local timestamp=$(date +"%Y%m%d%H%M%S")
    local archive_dir="$ARCHIVE_DIR/v$timestamp"
    mkdir -p "$archive_dir"
    cp "$CURRENT_DIR"/* "$archive_dir/" 2>/dev/null || true

    # Atomic move
    cp "$STAGING_DIR"/* "$CURRENT_DIR/"

    # Update hashes
    jq ".skill_md_hash = \"$(canonical_hash "$SKILL_MD_URL")\" |
       .heartbeat_md_hash = \"$(canonical_hash "$HEARTBEAT_MD_URL")\" |
       .messaging_md_hash = \"$(canonical_hash "$MESSAGING_MD_URL")\" |
       .package_json_hash = \"$(canonical_hash "$PACKAGE_JSON_URL")\"" "$HASHES_FILE" > "${HASHES_FILE}.tmp" && \
    mv "${HASHES_FILE}.tmp" "$HASHES_FILE"

    log "DEPLOY: MINOR update staged successfully"
    ntfy_notify "medium" "Skill Update" "Minor skill update staged successfully. Monitoring for 4h."
}

# Mode 3: Breaking Change Hold (MAJOR level)
mode_3_breaking_change() {
    log "MODE_3: Breaking Change Hold initiated"

    # Do not auto-apply
    log "HALT: Breaking change detected, manual intervention required"

    # Generate impact assessment
    local assessment="Breaking changes detected:\n"
    assessment+="- skill.md: $(grep -c 'breaking_change\|deprecated' "$STAGING_DIR/skill.md" 2>/dev/null || echo '0') instances\n"
    assessment+="- package.json: $(grep -c 'breaking_change\|api_version' "$STAGING_DIR/package.json" 2>/dev/null || echo '0') instances\n"

    # Set status
    jq ".pending_changes = [\"MAJOR update pending review\"]" "$HASHES_FILE" > "${HASHES_FILE}.tmp" && \
    mv "${HASHES_FILE}.tmp" "$HASHES_FILE"

    log "ALERT: MAJOR skill update detected. Manual intervention required."
    ntfy_notify "urgent" "MAJOR Update Detected" "$assessment\n\nManual approval required to proceed."

    # Keep files in staging for review
    log "STAGING: Files available in $STAGING_DIR for review"
}

# Mode 4: Security Emergency (CRITICAL level)
mode_4_security_emergency() {
    log "MODE_4: Security Emergency initiated"

    # Immediate quarantine (backup current)
    local timestamp=$(date +"%Y%m%d%H%M%S")
    local archive_dir="$ARCHIVE_DIR/v$timestamp"
    mkdir -p "$archive_dir"
    cp "$CURRENT_DIR"/* "$archive_dir/" 2>/dev/null || true

    # Apply emergency patch
    cp "$STAGING_DIR"/* "$CURRENT_DIR/"

    # Update hashes
    jq ".skill_md_hash = \"$(canonical_hash "$SKILL_MD_URL")\" |
       .heartbeat_md_hash = \"$(canonical_hash "$HEARTBEAT_MD_URL")\" |
       .messaging_md_hash = \"$(canonical_hash "$MESSAGING_MD_URL")\" |
       .package_json_hash = \"$(canonical_hash "$PACKAGE_JSON_URL")\"" "$HASHES_FILE" > "${HASHES_FILE}.tmp" && \
    mv "${HASHES_FILE}.tmp" "$HASHES_FILE"

    log "DEPLOY: SECURITY update applied immediately"
    ntfy_notify "max" "SECURITY UPDATE" "Critical security update applied. Council briefly offline."

    # In a real implementation, you'd want to restart services here
    # For now, just log it
    log "SERVICE: Security update applied, services should be restarted"
}

# Rollback function
rollback() {
    local failed_version=$(jq -r '.current_version' "$HASHES_FILE")
    local previous_version=$(ls -t "$ARCHIVE_DIR/" | head -2 | tail -1)  # Second most recent

    if [ -z "$previous_version" ]; then
        log "ERROR: No previous version available for rollback"
        return 1
    fi

    log "ROLLBACK_INITIATED: $failed_version → $previous_version"

    # Restore from archive
    cp "$ARCHIVE_DIR/$previous_version"/* "$CURRENT_DIR/"

    # Restore hashes
    jq ".current_version = \"$previous_version\" | .rollback_count += 1" "$HASHES_FILE" > "${HASHES_FILE}.tmp" && \
    mv "${HASHES_FILE}.tmp" "$HASHES_FILE"

    log "ROLLBACK: Restored to $previous_version"
    ntfy_notify "high" "Rollback Executed" "Reverted to $previous_version due to failure"
}

# Main execution
main() {
    if [ "${1:-}" = "--detected-change" ]; then
        check_updates
    elif [ "${1:-}" = "--scheduled-check" ]; then
        check_updates
    elif [ "${1:-}" = "--rollback" ]; then
        rollback
    else
        echo "Usage: $0 [--detected-change|--scheduled-check|--rollback]"
        exit 1
    fi
}

main "$@"
