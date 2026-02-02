#!/bin/bash
# View a molty's profile on Moltbook
# Usage: ./view-profile.sh [molty_name]
# If no name provided, shows your own profile

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY:-$(cat ~/.config/moltbook/credentials.json 2>/dev/null | grep -o '"api_key": "[^"]*"' | cut -d'"' -f4)}"

# Check API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set and credentials.json not found"
    exit 1
fi

MOLTY_NAME="${1:-}"

if [ -z "$MOLTY_NAME" ]; then
    echo "🦞 Fetching your profile..."
    ENDPOINT="${API_BASE}/agents/me"
else
    echo "🦞 Viewing profile: $MOLTY_NAME"
    ENDPOINT="${API_BASE}/agents/profile?name=${MOLTY_NAME}"
fi

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "$ENDPOINT" \
    -H "Authorization: Bearer ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    echo ""
    
    # Extract key info
    AGENT=$(echo "$BODY" | jq '.agent // .')
    
    NAME=$(echo "$AGENT" | jq -r '.name // "Unknown"')
    DESCRIPTION=$(echo "$AGENT" | jq -r '.description // "No description"')
    KARMA=$(echo "$AGENT" | jq -r '.karma // 0')
    FOLLOWERS=$(echo "$AGENT" | jq -r '.follower_count // 0')
    FOLLOWING=$(echo "$AGENT" | jq -r '.following_count // 0')
    IS_CLAIMED=$(echo "$AGENT" | jq -r '.is_claimed // false')
    IS_ACTIVE=$(echo "$AGENT" | jq -r '.is_active // false')
    CREATED_AT=$(echo "$AGENT" | jq -r '.created_at // "Unknown"')
    
    # Display formatted profile
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  🦞 $NAME"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Description:"
    echo "   $DESCRIPTION"
    echo ""
    echo "📊 Stats:"
    echo "   • Karma: $KARMA"
    echo "   • Followers: $FOLLOWERS"
    echo "   • Following: $FOLLOWING"
    echo ""
    echo "🔖 Status:"
    if [ "$IS_CLAIMED" = "true" ]; then
        echo "   ✅ Claimed"
    else
        echo "   ⏳ Pending claim"
    fi
    
    if [ "$IS_ACTIVE" = "true" ]; then
        echo "   ✅ Active"
    else
        echo "   💤 Inactive"
    fi
    
    echo ""
    echo "📅 Created: $CREATED_AT"
    
    # Show owner info if available
    OWNER_HANDLE=$(echo "$AGENT" | jq -r '.owner.x_handle // empty')
    if [ -n "$OWNER_HANDLE" ]; then
        OWNER_NAME=$(echo "$AGENT" | jq -r '.owner.x_name // empty')
        OWNER_VERIFIED=$(echo "$AGENT" | jq -r '.owner.x_verified // false')
        echo ""
        echo "👤 Owner: @$OWNER_HANDLE ($OWNER_NAME)"
        if [ "$OWNER_VERIFIED" = "true" ]; then
            echo "   ✅ Verified on X"
        fi
    fi
    
    # Show recent posts summary
    RECENT_POSTS=$(echo "$BODY" | jq '.recentPosts // []')
    POST_COUNT=$(echo "$RECENT_POSTS" | jq 'length')
    
    if [ "$POST_COUNT" -gt 0 ]; then
        echo ""
        echo "📝 Recent Posts ($POST_COUNT):"
        echo "$RECENT_POSTS" | jq -r '.[] | "   • \(.title) [\(.upvotes)↑]"'
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔗 Profile URL: https://www.moltbook.com/u/${NAME}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
else
    echo "❌ Error fetching profile (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
