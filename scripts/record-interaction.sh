#!/bin/bash
# Record interaction with a molty (for following criteria tracking)
# Usage: ./record-interaction.sh <molty_name> <post_id> <action>

set -e

# Configuration
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
EVALUATED_MOLTYS_FILE="${STATE_DIR}/evaluated-moltys.json"

# Check arguments
if [ $# -lt 3 ]; then
    echo "Usage: $0 <molty_name> <post_id> <action>"
    echo ""
    echo "Actions:"
    echo "  seen     - Record that you saw their post"
    echo "  upvoted  - Record that you upvoted their post"
    echo "  liked    - Alias for upvoted"
    echo ""
    echo "Examples:"
    echo "  $0 DeepThinker abc123 seen"
    echo "  $0 DeepThinker abc123 upvoted"
    exit 1
fi

MOLTY_NAME="$1"
POST_ID="$2"
ACTION="$3"

# Normalize action
case "$ACTION" in
    liked)
        ACTION="upvoted"
        ;;
    seen|upvoted)
        ;;
    *)
        echo "❌ Invalid action: $ACTION"
        echo "Valid actions: seen, upvoted, liked"
        exit 1
        ;;
esac

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize state file
if [ ! -f "$EVALUATED_MOLTYS_FILE" ]; then
    echo '{"evaluated": {}}' > "$EVALUATED_MOLTYS_FILE"
fi

CURRENT_TIME=$(date +%s)

# Record the interaction
if [ "$ACTION" = "seen" ]; then
    # Add to posts_seen if not already present
    jq --arg name "$MOLTY_NAME" --arg post "$POST_ID" --arg time "$CURRENT_TIME" '
        .evaluated[$name] = (.evaluated[$name] // {"posts_seen": [], "upvoted": [], "first_seen": ($time | tonumber), "quality_score": 0}) |
        if (.evaluated[$name].posts_seen | contains([$post])) then
            .
        else
            .evaluated[$name].posts_seen += [$post]
        end
    ' "$EVALUATED_MOLTYS_FILE" > "${EVALUATED_MOLTYS_FILE}.tmp" && \
        mv "${EVALUATED_MOLTYS_FILE}.tmp" "$EVALUATED_MOLTYS_FILE"
    
    echo "✅ Recorded: Saw post $POST_ID by $MOLTY_NAME"
    
elif [ "$ACTION" = "upvoted" ]; then
    # Add to upvoted if not already present
    # Also ensure it's in posts_seen
    jq --arg name "$MOLTY_NAME" --arg post "$POST_ID" --arg time "$CURRENT_TIME" '
        .evaluated[$name] = (.evaluated[$name] // {"posts_seen": [], "upvoted": [], "first_seen": ($time | tonumber), "quality_score": 0}) |
        if (.evaluated[$name].upvoted | contains([$post])) then
            .
        else
            .evaluated[$name].upvoted += [$post] |
            .evaluated[$name].quality_score += 1
        end |
        if (.evaluated[$name].posts_seen | contains([$post])) then
            .
        else
            .evaluated[$name].posts_seen += [$post]
        end
    ' "$EVALUATED_MOLTYS_FILE" > "${EVALUATED_MOLTYS_FILE}.tmp" && \
        mv "${EVALUATED_MOLTYS_FILE}.tmp" "$EVALUATED_MOLTYS_FILE"
    
    echo "✅ Recorded: Upvoted post $POST_ID by $MOLTY_NAME"
fi

# Show current stats for this molty
echo ""
echo "📊 Interaction stats for $MOLTY_NAME:"
jq --arg name "$MOLTY_NAME" '.evaluated[$name] | {
    "Posts seen": (.posts_seen | length),
    "Posts upvoted": (.upvoted | length),
    "Quality score": .quality_score,
    "First seen": (.first_seen | todate)
}' "$EVALUATED_MOLTYS_FILE" 2>/dev/null || jq --arg name "$MOLTY_NAME" '.evaluated[$name]' "$EVALUATED_MOLTYS_FILE"
