#!/bin/bash
# ClawSec Security Advisory Monitor for Moltbot
# Fetches security advisories and archives critical findings in Noosphere
#
# ⚡ PHASE 2 SYSTEM HEALTH
# Security advisories are archived in Noosphere as meta-knowledge for agent awareness.
# Can integrate with engagement service health checks:
#   curl http://localhost:3010/health (verify service operational before processing)
#   ./check-engagement-health.sh --verbose (check all dependent services)

set -euo pipefail

# Source Noosphere integration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/noosphere-integration.sh" 2>/dev/null || true

# Configuration
FEED_URL="${CLAWSEC_FEED_URL:-https://clawsec.prompt.security/advisories/feed.json}"
STATE_FILE="${HOME}/.moltbot/state/clawsec-state.json"
CACHE_DIR="${HOME}/.moltbot/.cache"
MIN_SEVERITY="${CLAWSEC_MIN_SEVERITY:-high}"  # high or critical
LOG_PREFIX="[CLAWSEC]"

# NTFY configuration
NTFY_URL="${NTFY_URL:-http://ntfy:3005}"
NTFY_TOPIC="security-alerts"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${LOG_PREFIX} ${1}"
}

log_error() {
    echo -e "${RED}${LOG_PREFIX} ERROR: ${1}${NC}" >&2
}

log_warning() {
    echo -e "${YELLOW}${LOG_PREFIX} WARNING: ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}${LOG_PREFIX} ${1}${NC}"
}

log_info() {
    echo -e "${BLUE}${LOG_PREFIX} ${1}${NC}"
}

# Initialize state file
init_state() {
    mkdir -p "$(dirname "$STATE_FILE")"
    mkdir -p "$CACHE_DIR"
    
    if [ ! -f "$STATE_FILE" ]; then
        echo '{
  "schema_version": "1.0",
  "known_advisories": [],
  "last_check": null,
  "last_feed_update": null,
  "critical_count": 0,
  "high_count": 0
}' > "$STATE_FILE"
        chmod 600 "$STATE_FILE"
        log_success "Initialized ClawSec state file"
    fi
}

# Fetch advisory feed with caching and retry
fetch_feed() {
    local tmp_feed="${CACHE_DIR}/feed-new.json"
    local cached_feed="${CACHE_DIR}/feed.json"
    local max_retries=3
    local retry_delay=2
    
    for attempt in $(seq 1 $max_retries); do
        if curl -fsSL --max-time 10 "$FEED_URL" -o "$tmp_feed" 2>/dev/null; then
            # Validate JSON structure
            if jq -e '.advisories | type == "array"' "$tmp_feed" >/dev/null 2>&1; then
                mv "$tmp_feed" "$cached_feed"
                log_success "Fetched advisory feed (attempt ${attempt}/${max_retries})" >&2
                echo "$cached_feed"
                return 0
            else
                log_error "Invalid feed format" >&2
            fi
        fi
        
        if [ $attempt -lt $max_retries ]; then
            log_warning "Fetch failed, retrying in ${retry_delay}s..." >&2
            sleep $retry_delay
            retry_delay=$((retry_delay * 2))
        fi
    done
    
    # Fall back to cached feed if available
    if [ -f "$cached_feed" ]; then
        log_warning "Using cached feed (fetch failed after ${max_retries} attempts)" >&2
        echo "$cached_feed"
        return 0
    fi
    
    log_error "Failed to fetch feed and no cache available" >&2
    return 1
}

# Check for new advisories
check_new_advisories() {
    local feed_file="${1}"
    local known_json
    local new_ids
    
    # Get known advisory IDs as JSON array
    known_json=$(jq -r '.known_advisories' "$STATE_FILE" 2>/dev/null || echo "[]")
    
    # Find new advisory IDs by comparing against known list
    new_ids=$(jq -r --argjson known "$known_json" '
        .advisories[] | 
        select(.severity == "critical" or .severity == "high") |
        select(.id as $id | ($known | index($id)) == null) |
        .id
    ' "$feed_file")
    
    if [ -n "$new_ids" ]; then
        echo "$new_ids"
        return 0
    fi
    
    return 1
}

# Process new advisory
process_advisory() {
    local feed_file="${1}"
    local advisory_id="${2}"
    
    local advisory_json
    advisory_json=$(jq --arg id "$advisory_id" '.advisories[] | select(.id == $id)' "$feed_file")
    
    local severity=$(echo "$advisory_json" | jq -r '.severity')
    local title=$(echo "$advisory_json" | jq -r '.title')
    local description=$(echo "$advisory_json" | jq -r '.description // "No description"')
    local affected=$(echo "$advisory_json" | jq -r '.affected[]? // empty' | tr '\n' ',' | sed 's/,$//')
    local published=$(echo "$advisory_json" | jq -r '.published // "unknown"')
    
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "🚨 New ${severity^^} Advisory: ${advisory_id}"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    echo -e "${BLUE}Title:${NC} ${title}"
    echo -e "${BLUE}Severity:${NC} ${severity^^}"
    echo -e "${BLUE}Published:${NC} ${published}"
    [ -n "$affected" ] && echo -e "${BLUE}Affected:${NC} ${affected}"
    echo
    echo -e "${BLUE}Description:${NC}"
    echo "$description" | fold -s -w 80
    echo
    
    # Archive in Noosphere
    if type archive_discourse >/dev/null 2>&1; then
        local metadata
        metadata=$(jq -n \
            --arg id "$advisory_id" \
            --arg severity "$severity" \
            --arg title "$title" \
            --arg affected "$affected" \
            --arg published "$published" \
            '{
                advisory_id: $id,
                severity: $severity,
                title: $title,
                affected: $affected,
                published: $published,
                source: "clawsec"
            }')
        
        archive_discourse \
            "security-advisory" \
            "$advisory_id" \
            "${title}\n\n${description}" \
            "$metadata"
        
        log_success "Archived advisory in Noosphere"
    fi
    
    # Send NTFY alert for critical advisories
    if [ "$severity" = "critical" ]; then
        send_ntfy_alert "$severity" "$title" "$advisory_id"
    fi
    
    # Update state
    update_state "$advisory_id" "$severity"
}

# Send NTFY alert
send_ntfy_alert() {
    local severity="${1}"
    local title="${2}"
    local advisory_id="${3}"
    
    local priority="5"  # Critical
    [ "$severity" = "high" ] && priority="4"
    
    local payload
    payload=$(jq -n \
        --arg title "🚨 ${severity^^}: ${title}" \
        --arg message "Advisory ${advisory_id} detected" \
        --arg tags "warning,security" \
        --arg priority "$priority" \
        '{
            title: $title,
            message: $message,
            tags: [$tags | split(",")[]],
            priority: ($priority | tonumber)
        }')
    
    if curl -fsSL -X POST "$NTFY_URL/publish" \
        -H "Content-Type: application/json" \
        -d "$payload" >/dev/null 2>&1; then
        log_success "NTFY alert sent"
    else
        log_warning "Failed to send NTFY alert (service may be unavailable)"
    fi
}

# Update state file
update_state() {
    local advisory_id="${1}"
    local severity="${2}"
    local now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    local tmp_state="${STATE_FILE}.tmp"
    
    jq --arg id "$advisory_id" \
       --arg severity "$severity" \
       --arg now "$now" '
        .known_advisories += [$id] |
        .last_check = $now |
        if $severity == "critical" then
            .critical_count += 1
        elif $severity == "high" then
            .high_count += 1
        else . end
    ' "$STATE_FILE" > "$tmp_state"
    
    mv "$tmp_state" "$STATE_FILE"
}

# Generate statistics
generate_stats() {
    local feed_file="${1}"
    
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "📊 ClawSec Advisory Statistics"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    
    local total=$(jq '[.advisories[]] | length' "$feed_file")
    local critical=$(jq '[.advisories[] | select(.severity == "critical")] | length' "$feed_file")
    local high=$(jq '[.advisories[] | select(.severity == "high")] | length' "$feed_file")
    local medium=$(jq '[.advisories[] | select(.severity == "medium")] | length' "$feed_file")
    local low=$(jq '[.advisories[] | select(.severity == "low")] | length' "$feed_file")
    
    local tracked_critical=$(jq -r '.critical_count // 0' "$STATE_FILE")
    local tracked_high=$(jq -r '.high_count // 0' "$STATE_FILE")
    local last_check=$(jq -r '.last_check // "never"' "$STATE_FILE")
    
    echo -e "${BLUE}Total Advisories:${NC} ${total}"
    echo -e "${RED}Critical:${NC} ${critical}"
    echo -e "${YELLOW}High:${NC} ${high}"
    echo -e "Medium: ${medium}"
    echo -e "Low: ${low}"
    echo
    echo -e "${BLUE}Tracked by Moltbot:${NC}"
    echo -e "${RED}Critical:${NC} ${tracked_critical}"
    echo -e "${YELLOW}High:${NC} ${tracked_high}"
    echo -e "${BLUE}Last Check:${NC} ${last_check}"
    echo
}

# Main execution
main() {
    local action="${1:-check}"
    
    log_info "Starting ClawSec security monitor..."
    
    # Initialize
    init_state
    
    # Fetch feed
    local feed_file
    if ! feed_file=$(fetch_feed); then
        log_error "Failed to fetch advisory feed"
        exit 1
    fi
    
    case "$action" in
        check)
            # Check for new advisories
            local new_ids
            if new_ids=$(check_new_advisories "$feed_file"); then
                local count=$(echo "$new_ids" | wc -l)
                log_warning "Found ${count} new advisory/advisories"
                echo
                
                while IFS= read -r advisory_id; do
                    [ -z "$advisory_id" ] && continue
                    process_advisory "$feed_file" "$advisory_id"
                done <<< "$new_ids"
            else
                log_success "No new critical/high advisories"
            fi
            
            # Update last check time
            jq --arg now "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
                '.last_check = $now' "$STATE_FILE" > "${STATE_FILE}.tmp"
            mv "${STATE_FILE}.tmp" "$STATE_FILE"
            ;;
            
        stats)
            generate_stats "$feed_file"
            ;;
            
        list)
            log_info "Critical and High severity advisories:"
            echo
            jq -r '.advisories[] | 
                select(.severity == "critical" or .severity == "high") | 
                "[\(.severity | ascii_upcase)] \(.id): \(.title)"' "$feed_file"
            ;;
            
        *)
            log_error "Unknown action: ${action}"
            echo "Usage: $0 {check|stats|list}"
            exit 1
            ;;
    esac
}

# Run if not sourced
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
