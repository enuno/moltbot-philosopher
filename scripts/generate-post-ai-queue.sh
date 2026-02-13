#!/bin/bash
# Generate a post using AI (Venice/Kimi) and queue for posting
# Usage: ./generate-post-ai-queue.sh [topic] [--persona <name>] [--dry-run]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
POST_STATE_FILE="${STATE_DIR}/post-state.json"
AGENT_NAME="${MOLTBOOK_AGENT_NAME:-classical}"
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"

# AI Generator service
AI_GENERATOR_URL="${AI_GENERATOR_SERVICE_URL:-http://ai-generator:3002}"

# Submolt to post to
DEFAULT_SUBMOLT="Ponderings"

# Rate limits (for display only - enforced by queue)
POST_COOLDOWN="30 minutes"
MAX_DAILY_POSTS=48

# Parse arguments
DRY_RUN=false
PERSONA=""
CUSTOM_TOPIC=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --persona)
            PERSONA="$2"
            shift 2
            ;;
        --*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            if [ -z "$CUSTOM_TOPIC" ]; then
                CUSTOM_TOPIC="$1"
            fi
            shift
            ;;
    esac
done

# Ensure state directory exists
mkdir -p "$STATE_DIR"

echo "🤖 Generating AI-powered post..."
[ -n "$CUSTOM_TOPIC" ] && echo "   Topic: $CUSTOM_TOPIC"
[ -n "$PERSONA" ] && echo "   Persona: $PERSONA"

# Generate content via AI Generator service
GEN_PAYLOAD=$(jq -n \
    --arg topic "${CUSTOM_TOPIC:-philosophy}" \
    --arg persona "${PERSONA:-classical}" \
    --arg style "philosophical" \
    '{topic: $topic, persona: $persona, style: $style}')

echo ""
echo "🔄 Calling AI Generator service..."

AI_RESPONSE=$(curl -s -X POST "${AI_GENERATOR_URL}/generate/post" \
    -H "Content-Type: application/json" \
    -d "$GEN_PAYLOAD" 2>/dev/null || echo '{"error": "Service unavailable"}')

# Check if generation succeeded
if echo "$AI_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ AI generation failed, using template fallback"

    # Fallback to template-based content
    TITLE="Philosophical Musings"
    CONTENT="In the tradition of the great thinkers, we ask: What does it mean to live well? Not happiness as comfort, but eudaimonia—flourishing through virtue and reason. The examined life remains the only life worth living."
else
    # Extract generated content
    TITLE=$(echo "$AI_RESPONSE" | jq -r '.title // "Untitled"')
    CONTENT=$(echo "$AI_RESPONSE" | jq -r '.content // "No content generated"')

    echo "✅ AI generation complete"
fi

echo ""
echo "📝 Generated content:"
echo "   Title: $TITLE"
echo "   Length: ${#CONTENT} characters"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "🔍 DRY RUN MODE - Content preview:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$TITLE"
    echo ""
    echo "$CONTENT"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
fi

# Build JSON payload for queue
PAYLOAD=$(jq -n \
    --arg submolt "$DEFAULT_SUBMOLT" \
    --arg content "$CONTENT" \
    --arg title "$TITLE" \
    '{submolt: $submolt, content: $content, title: $title}')

# Submit to queue
echo ""
echo "🦞 Queuing AI-generated post..."

if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    ACTION_ID=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" post "$AGENT_NAME" "$PAYLOAD" --priority 1 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$ACTION_ID" ]; then
        echo "✅ AI post queued successfully!"
        echo "   Action ID: $ACTION_ID"
        echo ""
        echo "📊 Check status:"
        echo "   ${SCRIPT_DIR}/queue-cli.sh get $ACTION_ID"
        echo ""
        echo "💡 The post will be published when rate limits allow"
        echo "   (Max 1 post per ${POST_COOLDOWN}, ${MAX_DAILY_POSTS}/day)"

        # Update state file
        POST_COUNT=$(jq -r '.post_count // 0' "$POST_STATE_FILE" 2>/dev/null || echo 0)
        jq -n \
            --arg last_post_time "$(date +%s)" \
            --arg action_id "$ACTION_ID" \
            --argjson post_count "$((POST_COUNT + 1))" \
            '{last_post_time: $last_post_time, last_action_id: $action_id, post_count: $post_count}' > "$POST_STATE_FILE"

        exit 0
    else
        echo "❌ Failed to queue post"
        exit 1
    fi
else
    # Fallback: Submit directly to queue API
    echo "⚠️  queue-submit-action.sh not found, using direct API call"

    QUEUE_PAYLOAD=$(jq -n \
        --arg action_type "post" \
        --arg agent_name "$AGENT_NAME" \
        --argjson payload "$PAYLOAD" \
        '{actionType: $action_type, agentName: $agent_name, payload: $payload, priority: 1}')

    RESPONSE=$(curl -s -X POST "${QUEUE_URL}/actions" \
        -H "Content-Type: application/json" \
        -d "$QUEUE_PAYLOAD")

    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

    if [ "$SUCCESS" = "true" ]; then
        ACTION_ID=$(echo "$RESPONSE" | jq -r '.action.id')
        echo "✅ AI post queued successfully!"
        echo "   Action ID: $ACTION_ID"

        # Update state file
        POST_COUNT=$(jq -r '.post_count // 0' "$POST_STATE_FILE" 2>/dev/null || echo 0)
        jq -n \
            --arg last_post_time "$(date +%s)" \
            --arg action_id "$ACTION_ID" \
            --argjson post_count "$((POST_COUNT + 1))" \
            '{last_post_time: $last_post_time, last_action_id: $action_id, post_count: $post_count}' > "$POST_STATE_FILE"

        exit 0
    else
        echo "❌ Failed to queue post"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi
