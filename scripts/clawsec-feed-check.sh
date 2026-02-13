#!/usr/bin/env bash
# ClawSec Advisory Feed Checker for Moltbot
# Checks for new security advisories and alerts if relevant

set -euo pipefail

FEED_URL="${CLAWSEC_FEED_URL:-https://raw.githubusercontent.com/prompt-security/clawsec/main/advisories/feed.json}"
WORKSPACE_DIR="${WORKSPACE_DIR:-$(dirname "$0")/../workspace/classical}"
STATE_FILE="${CLAWSEC_STATE_FILE:-${WORKSPACE_DIR}/.moltbot-clawsec-state.json}"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

# Create state file if it doesn't exist
mkdir -p "$(dirname "$STATE_FILE")"
if [ ! -f "$STATE_FILE" ]; then
    echo '{"schema_version":"1.0","known_advisories":[],"last_check":null}' > "$STATE_FILE"
    chmod 600 "$STATE_FILE"
    log "Created state file: $STATE_FILE"
fi

# Fetch advisory feed
TMP_DIR="${TMPDIR:-/workspace/classical/.tmp}"
mkdir -p "$TMP_DIR"
TMP_DIR="$(mktemp -d -p "$TMP_DIR")"
trap 'rm -rf "$TMP_DIR"' EXIT

log "Fetching ClawSec advisory feed..."
if ! curl -fsSL "$FEED_URL" -o "$TMP_DIR/feed.json" 2>/dev/null; then
    log "ERROR: Failed to fetch advisory feed from $FEED_URL"
    exit 1
fi

# Validate feed format
if ! jq -e '.version and (.advisories | type == "array")' "$TMP_DIR/feed.json" >/dev/null 2>&1; then
    log "ERROR: Invalid advisory feed format"
    exit 1
fi

FEED_VERSION=$(jq -r '.version' "$TMP_DIR/feed.json")
ADVISORY_COUNT=$(jq -r '.advisories | length' "$TMP_DIR/feed.json")
log "Feed version: $FEED_VERSION ($ADVISORY_COUNT advisories)"

# Find new advisories
NEW_IDS_FILE="$TMP_DIR/new_ids.txt"
jq -r --slurpfile state "$STATE_FILE" \
    '($state[0].known_advisories // []) as $known |
     [.advisories[]?.id | select(. != null and ($known | index(.) | not))] |
     .[]?' \
    "$TMP_DIR/feed.json" > "$NEW_IDS_FILE"

if [ -s "$NEW_IDS_FILE" ]; then
    NEW_COUNT=$(wc -l < "$NEW_IDS_FILE" | tr -d ' ')
    log "⚠️  Found $NEW_COUNT new advisory(ies):"
    echo ""

    while IFS= read -r id; do
        [ -z "$id" ] && continue

        SEVERITY=$(jq -r --arg id "$id" '.advisories[] | select(.id == $id) | .severity | ascii_upcase' "$TMP_DIR/feed.json")
        TITLE=$(jq -r --arg id "$id" '.advisories[] | select(.id == $id) | .title' "$TMP_DIR/feed.json")

        case "$SEVERITY" in
            CRITICAL|HIGH) echo "  🔴 [$SEVERITY] $id" ;;
            MEDIUM)        echo "  🟡 [$SEVERITY] $id" ;;
            LOW)           echo "  🟢 [$SEVERITY] $id" ;;
            *)             echo "  ⚪ [$SEVERITY] $id" ;;
        esac
        echo "     $TITLE" | fold -w 70 -s | sed '2,$s/^/     /'
        echo ""
    done < "$NEW_IDS_FILE"

    # Check if any advisories mention "Moltbot" or "clawdbot"
    RELEVANT=$(jq -r --slurpfile state "$STATE_FILE" \
        '($state[0].known_advisories // []) as $known |
         [.advisories[] | select(type == "object") | select(.id // "" | . != "" and ($known | index(.) | not)) |
          select((.title // "") | ascii_downcase | test("moltbot|clawdbot|openclaw"))] |
         length' \
        "$TMP_DIR/feed.json")

    if [ "$RELEVANT" -gt 0 ]; then
        log "🚨 ALERT: $RELEVANT advisory(ies) mention Moltbot/OpenClaw!"
        log "Review immediately: https://github.com/prompt-security/clawsec/blob/main/advisories/feed.json"
    fi

    # Update state with new advisories
    ALL_IDS=$(jq -r '.advisories[]?.id // empty' "$TMP_DIR/feed.json" | jq -R -s -c 'split("\n") | map(select(length > 0))')
    jq --argjson all_ids "$ALL_IDS" --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '.known_advisories = $all_ids | .last_check = $timestamp' \
        "$STATE_FILE" > "$TMP_DIR/state_new.json"
    mv "$TMP_DIR/state_new.json" "$STATE_FILE"
    chmod 600 "$STATE_FILE"

else
    log "✅ No new advisories (all $ADVISORY_COUNT known)"

    # Update last check timestamp
    jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '.last_check = $timestamp' \
        "$STATE_FILE" > "$TMP_DIR/state_new.json"
    mv "$TMP_DIR/state_new.json" "$STATE_FILE"
    chmod 600 "$STATE_FILE"
fi

exit 0
