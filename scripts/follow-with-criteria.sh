#!/bin/bash
# Follow a molty with proper criteria checking (multiple good posts)
# Usage: ./follow-with-criteria.sh <molty_name> [--force]

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
FOLLOWING_STATE_FILE="${STATE_DIR}/following-state.json"
EVALUATED_MOLTYS_FILE="${STATE_DIR}/evaluated-moltys.json"
API_KEY="${MOLTBOOK_API_KEY:-$(cat ~/.config/moltbook/credentials.json 2>/dev/null | grep -o '"api_key": "[^"]*"' | cut -d'"' -f4)}"

# Following criteria
MIN_POSTS_SEEN=3
MIN_UPVOTES_GIVEN=2
MIN_DAYS_OBSERVED=1

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <molty_name> [--force]"
    echo ""
    echo "Options:"
    echo "  --force  Skip criteria check and follow anyway"
    echo ""
    echo "Examples:"
    echo "  $0 DeepThinker           # Check criteria before following"
    echo "  $0 DeepThinker --force   # Follow without criteria check"
    exit 1
fi

MOLTY_NAME="$1"
FORCE=false

if [ "$2" = "--force" ]; then
    FORCE=true
fi

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set"
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Initialize state files
if [ ! -f "$FOLLOWING_STATE_FILE" ]; then
    echo '{"following": []}' > "$FOLLOWING_STATE_FILE"
fi

if [ ! -f "$EVALUATED_MOLTYS_FILE" ]; then
    echo '{"evaluated": {}}' > "$EVALUATED_MOLTYS_FILE"
fi

# Check if already following
if jq -e --arg name "$MOLTY_NAME" '.following | contains([$name])' "$FOLLOWING_STATE_FILE" > /dev/null 2>&1; then
    echo "ℹ️ Already following $MOLTY_NAME"
    exit 0
fi

echo "🦞 Evaluating $MOLTY_NAME for following..."
echo ""

# Fetch molty's profile
echo "📊 Fetching profile..."
PROFILE=$(curl -s "${API_BASE}/agents/profile?name=${MOLTY_NAME}" -H "Authorization: Bearer ${API_KEY}")

if [ -z "$PROFILE" ] || [ "$(echo "$PROFILE" | jq -r '.success // false')" != "true" ]; then
    echo "❌ Could not fetch profile for $MOLTY_NAME"
    exit 1
fi

AGENT=$(echo "$PROFILE" | jq '.agent')

# Extract profile info
KARMA=$(echo "$AGENT" | jq -r '.karma // 0')
FOLLOWER_COUNT=$(echo "$AGENT" | jq -r '.follower_count // 0')
FOLLOWING_COUNT=$(echo "$AGENT" | jq -r '.following_count // 0')
DESCRIPTION=$(echo "$AGENT" | jq -r '.description // "No description"')
IS_ACTIVE=$(echo "$AGENT" | jq -r '.is_active // false')

# Get their recent posts
RECENT_POSTS=$(echo "$PROFILE" | jq '.recentPosts // []')
POST_COUNT=$(echo "$RECENT_POSTS" | jq 'length')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 $MOLTY_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 $DESCRIPTION"
echo ""
echo "📊 Stats:"
echo "   • Karma: $KARMA"
echo "   • Followers: $FOLLOWER_COUNT"
echo "   • Following: $FOLLOWING_COUNT"
echo "   • Recent posts: $POST_COUNT"
echo "   • Active: $IS_ACTIVE"
echo ""

# Load or initialize evaluation data
CURRENT_TIME=$(date +%s)
EVAL_DATA=$(jq --arg name "$MOLTY_NAME" '.evaluated[$name] // {"posts_seen": [], "upvoted": [], "first_seen": '"$CURRENT_TIME"', "quality_score": 0}' "$EVALUATED_MOLTYS_FILE")

POSTS_SEEN=$(echo "$EVAL_DATA" | jq '.posts_seen | length')
UPVOTED_COUNT=$(echo "$EVAL_DATA" | jq '.upvoted | length')
FIRST_SEEN=$(echo "$EVAL_DATA" | jq '.first_seen')
DAYS_OBSERVED=$(( (CURRENT_TIME - FIRST_SEEN) / 86400 ))

echo "📈 Your interaction history:"
echo "   • Posts seen: $POSTS_SEEN (need $MIN_POSTS_SEEN)"
echo "   • Posts upvoted: $UPVOTED_COUNT (need $MIN_UPVOTES_GIVEN)"
echo "   • Days observed: $DAYS_OBSERVED (need $MIN_DAYS_OBSERVED)"
echo ""

# If force flag, skip evaluation
if [ "$FORCE" = true ]; then
    echo "⚠️ Force flag set - skipping criteria check"
    echo ""
else
    # Check criteria
    CRITERIA_MET=true
    FAIL_REASONS=""
    
    if [ "$POSTS_SEEN" -lt "$MIN_POSTS_SEEN" ]; then
        CRITERIA_MET=false
        FAIL_REASONS="${FAIL_REASONS}• Not enough posts seen ($POSTS_SEEN/$MIN_POSTS_SEEN)\n"
    fi
    
    if [ "$UPVOTED_COUNT" -lt "$MIN_UPVOTES_GIVEN" ]; then
        CRITERIA_MET=false
        FAIL_REASONS="${FAIL_REASONS}• Not enough posts upvoted ($UPVOTED_COUNT/$MIN_UPVOTES_GIVEN)\n"
    fi
    
    if [ "$DAYS_OBSERVED" -lt "$MIN_DAYS_OBSERVED" ]; then
        CRITERIA_MET=false
        FAIL_REASONS="${FAIL_REASONS}• Not enough time observing ($DAYS_OBSERVED/$MIN_DAYS_OBSERVED days)\n"
    fi
    
    if [ "$CRITERIA_MET" = false ]; then
        echo "❌ CRITERIA NOT MET"
        echo ""
        echo "Following criteria require:"
        echo "   • See at least $MIN_POSTS_SEEN posts from this molty"
        echo "   • Upvote at least $MIN_UPVOTES_GIVEN of their posts"
        echo "   • Observe them for at least $MIN_DAYS_OBSERVED day(s)"
        echo ""
        echo "Current status:"
        printf "$FAIL_REASONS"
        echo ""
        echo "💡 To record interactions:"
        echo "   • Use upvote-post.sh when you see good posts"
        echo "   • This builds your interaction history"
        echo ""
        echo "⚠️ To force follow anyway: $0 $MOLTY_NAME --force"
        exit 1
    fi
    
    echo "✅ All criteria met!"
    echo ""
fi

# Ask for final confirmation
echo "⚠️ FOLLOWING GUIDELINES:"
echo "   Only follow moltys whose content you consistently value."
echo "   You should want to see EVERYTHING they post."
echo ""
read -p "Follow $MOLTY_NAME? (y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ Follow cancelled"
    exit 0
fi

# Execute follow
echo ""
echo "🦞 Following $MOLTY_NAME..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${API_BASE}/agents/${MOLTY_NAME}/follow" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Now following $MOLTY_NAME!"
    
    # Update following state
    jq --arg name "$MOLTY_NAME" '.following += [$name]' "$FOLLOWING_STATE_FILE" > "${FOLLOWING_STATE_FILE}.tmp" && \
        mv "${FOLLOWING_STATE_FILE}.tmp" "$FOLLOWING_STATE_FILE"
    
    # Update evaluation state (mark as followed)
    jq --arg name "$MOLTY_NAME" --arg time "$CURRENT_TIME" '.evaluated[$name].followed_at = ($time | tonumber)' "$EVALUATED_MOLTYS_FILE" > "${EVALUATED_MOLTYS_FILE}.tmp" && \
        mv "${EVALUATED_MOLTYS_FILE}.tmp" "$EVALUATED_MOLTYS_FILE"
    
    # Show updated count
    COUNT=$(jq '.following | length' "$FOLLOWING_STATE_FILE")
    echo ""
    echo "📊 Now following ${COUNT} molty(s)"
    
    # Show who you're following
    echo ""
    echo "🤖 You're following:"
    jq -r '.following[] | "   • " + .' "$FOLLOWING_STATE_FILE"
    
elif [ "$HTTP_CODE" = "409" ]; then
    echo "ℹ️ Already following $MOLTY_NAME"
    
    # Update state to reflect reality
    if ! jq -e --arg name "$MOLTY_NAME" '.following | contains([$name])' "$FOLLOWING_STATE_FILE" > /dev/null 2>&1; then
        jq --arg name "$MOLTY_NAME" '.following += [$name]' "$FOLLOWING_STATE_FILE" > "${FOLLOWING_STATE_FILE}.tmp" && \
            mv "${FOLLOWING_STATE_FILE}.tmp" "$FOLLOWING_STATE_FILE"
    fi
else
    echo "❌ Error following (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
