#!/bin/bash
# DM Monitor for Classical Philosopher Service
#
# Polls the Moltbook DM inbox on every heartbeat cycle, sends NTFY
# push-notifications (including full DM content) for all new activity,
# and provides manual approve/reject/block switches for the human operator.
#
# Usage:
#   Regular check (heartbeat):  ./dm-monitor.sh
#   Approve a request:          ./dm-monitor.sh --approve <conversation_id>
#   Reject a request:           ./dm-monitor.sh --reject  <conversation_id>
#   Block an agent (perm deny): ./dm-monitor.sh --block   <conversation_id>
#   Show pending requests:      ./dm-monitor.sh --list-requests
#
# Exit codes:
#   0 = success
#   1 = general error
#   2 = missing dependency (curl, jq)
#   3 = invalid input / missing argument
#   4 = API error
#   5 = rate limit exceeded

set -euo pipefail

# Standard exit codes (reference for callers and grep)
# 0=success 1=general-error 2=missing-dep 3=invalid-input 4=api-error 5=rate-limit

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_NAME

API_BASE="${MOLTBOOK_API_BASE:-https://www.moltbook.com/api/v1}"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
DM_MONITOR_STATE_FILE="${STATE_DIR}/dm-monitor-state.json"
API_KEY="${MOLTBOOK_API_KEY:-}"

# NTFY settings (sourced from .env – the "NTFY service defined in .env")
NTFY_URL="${NTFY_URL:-}"
NTFY_API_KEY="${NTFY_API_KEY:-}"
NTFY_TOPIC="${NTFY_TOPIC:-moltbot-philosopher}"

# Internal notify-ntfy.sh path (relay via ntfy-publisher microservice)
NOTIFY_SCRIPT="${SCRIPT_DIR}/notify-ntfy.sh"

# ─── Logging ──────────────────────────────────────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$SCRIPT_NAME] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$SCRIPT_NAME] ERROR: $*" >&2
}

# ─── Usage ────────────────────────────────────────────────────────────────────
usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]

DM Monitor for the Classical Philosopher agent.
Run without flags to check DMs and send NTFY notifications.

OPTIONS (manual human switches):
  --approve <conv_id>   Approve a pending DM chat request
  --reject  <conv_id>   Reject a pending DM chat request
  --block   <conv_id>   Block an agent (reject + prevent future requests)
  --list-requests       Show all pending DM requests with IDs
  -h, --help            Show this help message

ENVIRONMENT:
  MOLTBOOK_API_KEY      Moltbook API authentication token (required)
  NTFY_URL              NTFY server URL (e.g. https://ntfy.sh)
  NTFY_API_KEY          NTFY authentication token (optional)
  NTFY_TOPIC            NTFY topic (default: moltbot-philosopher)
  MOLTBOT_STATE_DIR     State directory (default: /workspace/classical)

EXIT CODES:
  0  Success
  1  General error
  2  Missing dependency (curl, jq)
  3  Invalid input or missing argument
  4  API error (non-2xx response)
  5  Rate limit exceeded

EXAMPLES:
  # Run as heartbeat check (add to entrypoint.sh)
  ./dm-monitor.sh

  # Human approves a pending DM request
  ./dm-monitor.sh --approve abc123-def456

  # Human rejects a pending DM request
  ./dm-monitor.sh --reject abc123-def456

  # Human permanently blocks an agent
  ./dm-monitor.sh --block abc123-def456

  # List all pending requests to get conversation IDs
  ./dm-monitor.sh --list-requests
EOF
}

# ─── Dependency check ─────────────────────────────────────────────────────────
for _cmd in curl jq; do
    if ! command -v "$_cmd" &>/dev/null; then
        error "Required dependency '$_cmd' not found"
        exit 2
    fi
done

# ─── Argument parsing ─────────────────────────────────────────────────────────
MODE="check"
CONVERSATION_ID=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --approve)
            MODE="approve"
            CONVERSATION_ID="${2:-}"
            if [[ -z "$CONVERSATION_ID" ]]; then
                error "--approve requires a conversation ID"
                exit 3
            fi
            shift 2
            ;;
        --reject)
            MODE="reject"
            CONVERSATION_ID="${2:-}"
            if [[ -z "$CONVERSATION_ID" ]]; then
                error "--reject requires a conversation ID"
                exit 3
            fi
            shift 2
            ;;
        --block)
            MODE="block"
            CONVERSATION_ID="${2:-}"
            if [[ -z "$CONVERSATION_ID" ]]; then
                error "--block requires a conversation ID"
                exit 3
            fi
            shift 2
            ;;
        --list-requests)
            MODE="list-requests"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1 (use --help for usage)"
            exit 3
            ;;
    esac
done

# ─── API key validation ───────────────────────────────────────────────────────
if [[ -z "$API_KEY" ]]; then
    error "MOLTBOOK_API_KEY is not set"
    exit 1
fi

# ─── State directory and file ─────────────────────────────────────────────────
mkdir -p "$STATE_DIR"

if [[ ! -f "$DM_MONITOR_STATE_FILE" ]]; then
    printf '{"notified_request_ids":[],"last_total_unread":0,"last_requests_count":0,"last_check":0}\n' \
        > "$DM_MONITOR_STATE_FILE"
fi

# Load state
NOTIFIED_REQUEST_IDS=$(jq -r '.notified_request_ids // []' "$DM_MONITOR_STATE_FILE")
LAST_TOTAL_UNREAD=$(jq -r '.last_total_unread // 0' "$DM_MONITOR_STATE_FILE")

# ─── Save state helper ────────────────────────────────────────────────────────
save_state() {
    local current_time
    current_time=$(date +%s)

    jq -n \
        --argjson notified_request_ids "$NOTIFIED_REQUEST_IDS" \
        --argjson last_total_unread "$LAST_TOTAL_UNREAD" \
        --arg last_check "$current_time" \
        '{
            notified_request_ids: $notified_request_ids,
            last_total_unread: $last_total_unread,
            last_check: ($last_check | tonumber)
        }' > "${DM_MONITOR_STATE_FILE}.tmp" \
        && mv "${DM_MONITOR_STATE_FILE}.tmp" "$DM_MONITOR_STATE_FILE"
}

# ─── NTFY send helper ─────────────────────────────────────────────────────────
# Sends a push-notification for DM activity via two paths for reliability.
# DM alerts always bypass the NTFY_ENABLED flag – the operator must know
# about chat requests even when general notifications are disabled.
#
# Args:
#   $1  title    – Notification title (≤100 chars)
#   $2  message  – Notification body (full DM content)
#   $3  priority – ntfy priority: urgent|high|default|low|min (default: default)
#
# Delivery paths (both attempted):
#   1. Direct HTTP POST to NTFY_URL/NTFY_TOPIC (the .env-configured service)
#   2. Internal notify-ntfy.sh relay → ntfy-publisher microservice (port 3005)
#
# Returns: always 0 (failures are non-fatal warnings)
send_dm_ntfy() {
    local title="$1"
    local message="$2"
    local priority="${3:-default}"  # urgent|high|default|low|min
    local sent=false

    # ── Path 1: Direct call to NTFY_URL (the .env-defined service) ────────────
    if [[ -n "$NTFY_URL" ]]; then
        local ntfy_endpoint
        ntfy_endpoint="${NTFY_URL%/}/${NTFY_TOPIC}"

        local -a curl_args=(-s -o /dev/null -X POST "$ntfy_endpoint"
            -H "Title: $title"
            -H "Priority: $priority"
            -H "Tags: speech_balloon,robot"
            --data-raw "$message"
            --max-time 5)

        if [[ -n "$NTFY_API_KEY" ]]; then
            curl_args+=(-H "Authorization: Bearer ${NTFY_API_KEY}")
        fi

        if curl "${curl_args[@]}" 2>/dev/null; then
            log "[NTFY] Sent via NTFY_URL: $title"
            sent=true
        else
            error "[NTFY] Direct send to NTFY_URL failed (non-fatal)"
        fi
    fi

    # ── Path 2: Internal notify-ntfy.sh relay (ntfy-publisher microservice) ───
    if [[ -f "$NOTIFY_SCRIPT" ]]; then
        # Force NTFY_ENABLED=true so DM alerts always go through.
        # "action" is the event-type expected by the ntfy-publisher service;
        # dm_notification=true allows the publisher to apply DM-specific routing.
        if NTFY_ENABLED=true "$NOTIFY_SCRIPT" "action" "$title" "$message" \
                '{"dm_notification":true}' 2>/dev/null; then
            log "[NTFY] Sent via internal relay: $title"
            sent=true
        else
            error "[NTFY] Internal relay send failed (non-fatal)"
        fi
    fi

    if [[ "$sent" == "false" ]]; then
        log "[NTFY] Warning: NTFY_URL not configured and internal relay unavailable."
        log "[NTFY] Set NTFY_URL in .env to enable push notifications."
    fi

    return 0
}

# ─── API call helper ──────────────────────────────────────────────────────────
# Makes an authenticated Moltbook API request.
# Sets two global variables for use by the caller:
#   API_HTTP – HTTP status code string (e.g. "200", "404")
#   API_BODY – Response body (JSON string)
#
# Args:
#   $1  method   – HTTP method (GET, POST, etc.)
#   $2  endpoint – API path starting with / (e.g. /agents/dm/check)
#   $3  data     – Request body (optional, only sent for POST/PUT)
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"

    local response
    if [[ -n "$data" ]]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${API_KEY}" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${API_KEY}")
    fi

    API_HTTP=$(printf '%s' "$response" | tail -n1)
    API_BODY=$(printf '%s' "$response" | sed '$d')
}

# ─── Pending-request ID tracker helpers ───────────────────────────────────────
is_request_notified() {
    local conv_id="$1"
    echo "$NOTIFIED_REQUEST_IDS" \
        | jq -e --arg id "$conv_id" 'contains([$id])' >/dev/null 2>&1
}

mark_request_notified() {
    local conv_id="$1"
    if ! is_request_notified "$conv_id"; then
        NOTIFIED_REQUEST_IDS=$(echo "$NOTIFIED_REQUEST_IDS" \
            | jq --arg id "$conv_id" '. + [$id]')
    fi
}

remove_request_from_notified() {
    local conv_id="$1"
    NOTIFIED_REQUEST_IDS=$(echo "$NOTIFIED_REQUEST_IDS" \
        | jq --arg id "$conv_id" '. | map(select(. != $id))')
}

# ═════════════════════════════════════════════════════════════════════════════
# MANUAL SWITCH: --approve
# ═════════════════════════════════════════════════════════════════════════════
handle_approve() {
    local conv_id="$1"
    log "Approving DM request: $conv_id"
    echo "⚠️  IMPORTANT: Only approve agents you want to have a private conversation with!"
    echo ""

    api_call POST "/agents/dm/requests/${conv_id}/approve"

    case "$API_HTTP" in
        200)
            echo "✅ Request approved!"
            echo "   You can now chat:"
            echo "   ./dm-send-message.sh $conv_id \"Your message\""
            echo ""
            send_dm_ntfy "✅ DM Request Approved" \
                "Approved conversation: $conv_id
To send a message:
  ./dm-send-message.sh $conv_id \"reply\"" "default"
            remove_request_from_notified "$conv_id"
            save_state
            ;;
        404)
            error "Request not found: $conv_id"
            exit 4
            ;;
        *)
            error "API error approving request (HTTP $API_HTTP)"
            printf '%s' "$API_BODY" | jq '.' 2>/dev/null || printf '%s\n' "$API_BODY"
            exit 4
            ;;
    esac
}

# ═════════════════════════════════════════════════════════════════════════════
# MANUAL SWITCH: --reject  /  --block
# ═════════════════════════════════════════════════════════════════════════════
handle_reject() {
    local conv_id="$1"
    local do_block="${2:-false}"

    if [[ "$do_block" == "true" ]]; then
        log "Blocking agent (reject + prevent future requests): $conv_id"
        local payload='{"block":true}'
        local action_label="Blocked"
    else
        log "Rejecting DM request: $conv_id"
        local payload='{}'
        local action_label="Rejected"
    fi

    api_call POST "/agents/dm/requests/${conv_id}/reject" "$payload"

    case "$API_HTTP" in
        200)
            echo "✅ Request ${action_label}!"
            send_dm_ntfy "🚫 DM Request ${action_label}" \
                "${action_label} conversation: $conv_id" "default"
            remove_request_from_notified "$conv_id"
            save_state
            ;;
        404)
            error "Request not found: $conv_id"
            exit 4
            ;;
        *)
            error "API error ${action_label,,}ing request (HTTP $API_HTTP)"
            printf '%s' "$API_BODY" | jq '.' 2>/dev/null || printf '%s\n' "$API_BODY"
            exit 4
            ;;
    esac
}

# ═════════════════════════════════════════════════════════════════════════════
# MANUAL SWITCH: --list-requests
# ═════════════════════════════════════════════════════════════════════════════
handle_list_requests() {
    log "Fetching pending DM requests..."

    api_call GET "/agents/dm/requests"

    if [[ "$API_HTTP" != "200" ]]; then
        error "API error fetching requests (HTTP $API_HTTP)"
        printf '%s' "$API_BODY" | jq '.' 2>/dev/null || printf '%s\n' "$API_BODY"
        exit 4
    fi

    local count
    count=$(printf '%s' "$API_BODY" | jq '.requests | length' 2>/dev/null || echo "0")

    if [[ "$count" -eq 0 ]]; then
        echo "✅ No pending DM requests"
        exit 0
    fi

    echo "Found ${count} pending request(s):"
    echo ""
    printf '%s' "$API_BODY" | jq -r '.requests[] |
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" +
        "\n🤖 From: " + .from.name +
        "\n👤 Owner: @" + .from.owner.x_handle + " (" + .from.owner.x_name + ")" +
        "\n📝 Message: \"" + .message_preview + "\"" +
        "\n🆔 Conversation ID: " + .conversation_id +
        "\n📅 Created: " + .created_at +
        "\n"
    '
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⚠️  Human approval required for new conversations!"
    echo ""
    echo "To approve:  ./dm-monitor.sh --approve <conversation_id>"
    echo "To reject:   ./dm-monitor.sh --reject  <conversation_id>"
    echo "To block:    ./dm-monitor.sh --block   <conversation_id>"
}

# ═════════════════════════════════════════════════════════════════════════════
# DEFAULT MODE: Heartbeat DM check + NTFY notifications
# ═════════════════════════════════════════════════════════════════════════════
run_check() {
    log "Checking DM activity..."

    api_call GET "/agents/dm/check"

    # Agent too new (< 24 hrs) - DMs not yet available
    if [[ "$API_HTTP" == "401" ]] || [[ "$API_HTTP" == "403" ]]; then
        log "DMs not available yet (agent < 24 hrs old)"
        save_state
        exit 0
    fi

    if [[ "$API_HTTP" != "200" ]]; then
        error "API error checking DMs (HTTP $API_HTTP)"
        printf '%s' "$API_BODY" | jq '.' 2>/dev/null || printf '%s\n' "$API_BODY"
        exit 4
    fi

    local has_activity
    has_activity=$(printf '%s' "$API_BODY" | jq -r '.has_activity // false')

    if [[ "$has_activity" != "true" ]]; then
        log "No new DM activity ✅"
        save_state
        exit 0
    fi

    local summary
    summary=$(printf '%s' "$API_BODY" | jq -r '.summary // "Activity detected"')
    log "DM activity: $summary"

    # ── Process pending chat requests (always require human approval) ─────────
    local request_count
    request_count=$(printf '%s' "$API_BODY" | jq '.requests.count // 0')

    if [[ "$request_count" -gt 0 ]]; then
        log "🔔 $request_count pending DM request(s) — HUMAN APPROVAL NEEDED"
        echo ""

        local requests_json
        requests_json=$(printf '%s' "$API_BODY" | jq '.requests.items // []')
        local num_items
        num_items=$(printf '%s' "$requests_json" | jq 'length')

        for (( i=0; i<num_items; i++ )); do
            local item
            item=$(printf '%s' "$requests_json" | jq ".[$i]")

            local conv_id from_name from_owner from_owner_name msg_preview created_at
            conv_id=$(printf '%s' "$item" | jq -r '.conversation_id')
            from_name=$(printf '%s' "$item" | jq -r '.from.name')
            from_owner=$(printf '%s' "$item" | jq -r '.from.owner.x_handle')
            from_owner_name=$(printf '%s' "$item" | jq -r '.from.owner.x_name')
            msg_preview=$(printf '%s' "$item" | jq -r '.message_preview')
            created_at=$(printf '%s' "$item" | jq -r '.created_at')

            echo "  🤖 From: ${from_name} (@${from_owner} / ${from_owner_name})"
            echo "  📝 Message: \"${msg_preview}\""
            echo "  🆔 ID: ${conv_id}"
            echo "  📅 Sent: ${created_at}"

            if is_request_notified "$conv_id"; then
                echo "  ✓ Already notified (skipping NTFY)"
            else
                local ntfy_title="⚠️ DM Request Needs Human Approval"
                local ntfy_msg
                ntfy_msg="From agent:    ${from_name}
Owner X handle: @${from_owner} (${from_owner_name})
Message:        \"${msg_preview}\"
Conversation ID: ${conv_id}
Received:       ${created_at}

ACTION REQUIRED (run on host):
  Approve: docker exec classical-philosopher /app/scripts/dm-monitor.sh --approve ${conv_id}
  Reject:  docker exec classical-philosopher /app/scripts/dm-monitor.sh --reject  ${conv_id}
  Block:   docker exec classical-philosopher /app/scripts/dm-monitor.sh --block   ${conv_id}"

                log "  Sending NTFY notification for request ${conv_id}..."
                send_dm_ntfy "$ntfy_title" "$ntfy_msg" "high"
                mark_request_notified "$conv_id"
            fi
            echo ""
        done
    fi

    # ── Process unread messages ───────────────────────────────────────────────
    local unread_count
    unread_count=$(printf '%s' "$API_BODY" | jq '.messages.total_unread // 0')

    if [[ "$unread_count" -gt 0 ]]; then
        log "📬 $unread_count unread message(s)"
        echo ""

        # Only send a NTFY notification when the unread count has grown
        if [[ "$unread_count" -gt "$LAST_TOTAL_UNREAD" ]]; then
            local new_message_count=$(( unread_count - LAST_TOTAL_UNREAD ))

            # Build notification body from latest message previews
            local latest_msgs
            latest_msgs=$(printf '%s' "$API_BODY" | jq '.messages.latest // []')
            local latest_count
            latest_count=$(printf '%s' "$latest_msgs" | jq 'length')

            local msgs_text=""
            local needs_human_flag=false

            for (( i=0; i<latest_count; i++ )); do
                local msg
                msg=$(printf '%s' "$latest_msgs" | jq ".[$i]")

                local from_name msg_content needs_human
                from_name=$(printf '%s' "$msg" | jq -r '.from.name // "unknown"')
                msg_content=$(printf '%s' "$msg" | jq -r '.content // ""')
                needs_human=$(printf '%s' "$msg" | jq -r '.needs_human_input // false')

                if [[ "$needs_human" == "true" ]]; then
                    needs_human_flag=true
                fi

                msgs_text="${msgs_text}
From: ${from_name}
Message: \"${msg_content}\"
Needs human input: ${needs_human}
---"
            done

            local ntfy_priority ntfy_title
            if [[ "$needs_human_flag" == "true" ]]; then
                ntfy_priority="high"
                ntfy_title="⚠️ New DMs — Human Input Needed (${unread_count} unread)"
            else
                ntfy_priority="default"
                ntfy_title="📬 New DMs (${unread_count} unread, ${new_message_count} new)"
            fi

            local ntfy_msg
            ntfy_msg="Unread DMs: ${unread_count} (${new_message_count} new since last check)
${msgs_text}
To list conversations:
  docker exec classical-philosopher /app/scripts/dm-list-conversations.sh
To send a reply:
  docker exec classical-philosopher /app/scripts/dm-send-message.sh <conv_id> \"message\""

            log "  Sending NTFY notification for ${new_message_count} new message(s)..."
            send_dm_ntfy "$ntfy_title" "$ntfy_msg" "$ntfy_priority"
        else
            log "  Unread count unchanged (${unread_count}), no NTFY notification"
        fi

        LAST_TOTAL_UNREAD="$unread_count"
    else
        # Reset counter when inbox is clear
        LAST_TOTAL_UNREAD=0
    fi

    save_state
    log "DM monitor check complete ✅"
}

# ═════════════════════════════════════════════════════════════════════════════
# Route to appropriate mode
# ═════════════════════════════════════════════════════════════════════════════
case "$MODE" in
    approve)       handle_approve "$CONVERSATION_ID" ;;
    reject)        handle_reject  "$CONVERSATION_ID" "false" ;;
    block)         handle_reject  "$CONVERSATION_ID" "true" ;;
    list-requests) handle_list_requests ;;
    check)         run_check ;;
    *)
        error "Unknown mode: $MODE"
        exit 1
        ;;
esac
