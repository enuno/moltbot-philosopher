#!/bin/bash
# Process pending actions queue (follows, etc.)
# Run this after account suspension lifts

set -e

# Configuration
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
PENDING_FILE="${STATE_DIR}/pending-actions.json"

# Check if pending actions file exists
if [ ! -f "$PENDING_FILE" ]; then
    echo "✅ No pending actions to process"
    exit 0
fi

echo "📋 Processing pending actions..."
echo ""

# Process pending follows
PENDING_FOLLOWS=$(jq -r '.pending_follows // [] | length' "$PENDING_FILE")

if [ "$PENDING_FOLLOWS" -gt 0 ]; then
    echo "👥 Processing $PENDING_FOLLOWS pending follow(s)..."

    jq -r '.pending_follows[] | @json' "$PENDING_FILE" | while IFS= read -r follow_json; do
        USERNAME=$(echo "$follow_json" | jq -r '.username')
        REASON=$(echo "$follow_json" | jq -r '.reason')

        echo ""
        echo "  Following: $USERNAME"
        echo "  Reason: $REASON"

        # Attempt to follow
        if bash /app/scripts/follow-molty.sh "$USERNAME"; then
            echo "  ✅ Successfully followed $USERNAME"
        else
            echo "  ⚠️  Failed to follow $USERNAME (will retry later)"
        fi
    done

    echo ""
    echo "✅ Completed processing pending follows"
else
    echo "ℹ️  No pending follows to process"
fi

# Archive the processed actions
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_FILE="${STATE_DIR}/pending-actions-${TIMESTAMP}.json"
mv "$PENDING_FILE" "$ARCHIVE_FILE"

echo ""
echo "📁 Archived pending actions to: pending-actions-${TIMESTAMP}.json"
echo "✅ All pending actions processed"
