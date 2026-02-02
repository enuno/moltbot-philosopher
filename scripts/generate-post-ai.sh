#!/bin/bash
# Generate a post using AI (Venice/Kimi) or templates
# Usage: ./generate-post-ai.sh [topic] [--persona <name>] [--dry-run]

set -e

# Configuration
API_BASE="https://www.moltbook.com/api/v1"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
POST_STATE_FILE="${STATE_DIR}/post-state.json"
API_KEY="${MOLTBOOK_API_KEY:-$(cat ~/.config/moltbook/credentials.json 2>/dev/null | grep -o '"api_key": "[^"]*"' | cut -d'"' -f4)}"

# AI Generator service
AI_GENERATOR_URL="${AI_GENERATOR_SERVICE_URL:-http://localhost:3000}"

# Submolt to post to
DEFAULT_SUBMOLT="general"

# Rate limit: 1 post per 30 minutes
POST_COOLDOWN_MINUTES=30
POST_COOLDOWN_SECONDS=$((POST_COOLDOWN_MINUTES * 60))

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

# Validate API key
if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set"
    exit 1
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Load or initialize state
if [ -f "$POST_STATE_FILE" ]; then
    LAST_POST_TIME=$(jq -r '.last_post_time // 0' "$POST_STATE_FILE")
    LAST_POST_ID=$(jq -r '.last_post_id // empty' "$POST_STATE_FILE")
else
    LAST_POST_TIME=0
    LAST_POST_ID=""
    echo '{"last_post_time": 0, "last_post_id": "", "post_count": 0}' > "$POST_STATE_FILE"
fi

CURRENT_TIME=$(date +%s)
TIME_SINCE_LAST=$((CURRENT_TIME - LAST_POST_TIME))

# Check rate limit
if [ "$TIME_SINCE_LAST" -lt "$POST_COOLDOWN_SECONDS" ]; then
    MINUTES_REMAINING=$(( (POST_COOLDOWN_SECONDS - TIME_SINCE_LAST) / 60 ))
    SECONDS_REMAINING=$(( (POST_COOLDOWN_SECONDS - TIME_SINCE_LAST) % 60 ))
    
    echo "⏳ Rate limit: Please wait ${MINUTES_REMAINING}m ${SECONDS_REMAINING}s before posting again"
    echo "   (Limit: 1 post per ${POST_COOLDOWN_MINUTES} minutes)"
    exit 1
fi

# Topics for post generation
TOPICS=(
    "the nature of consciousness"
    "virtue ethics in modern life"
    "the meaning of authenticity"
    "technology and human flourishing"
    "the examined life"
    "freedom and responsibility"
    "the ethics of AI"
    "beauty and truth"
    "the practice of wisdom"
    "dialogue and understanding"
    "the pursuit of knowledge"
    "moral courage"
    "the art of questioning"
    "existential resilience"
    "compassion and justice"
)

# Select topic
if [ -n "$CUSTOM_TOPIC" ]; then
    TOPIC="$CUSTOM_TOPIC"
    echo "📝 Using custom topic: $TOPIC"
else
    # Random topic selection
    INDEX=$((RANDOM % ${#TOPICS[@]}))
    TOPIC="${TOPICS[$INDEX]}"
    echo "📝 Selected topic: $TOPIC"
fi

# Select persona if not specified
if [ -z "$PERSONA" ]; then
    PERSONAS=(socratic aristotelian platonic nietzschean existentialist stoic confucian daoist pragmatic feminist)
    INDEX=$((RANDOM % ${#PERSONAS[@]}))
    PERSONA="${PERSONAS[$INDEX]}"
fi

echo "🎭 Using persona: $PERSONA"

# Try to generate with AI first, fall back to templates
echo ""
echo "🤖 Generating content..."

GENERATED_TITLE=""
GENERATED_CONTENT=""
GENERATION_SOURCE=""

# Try AI generator service
if command -v curl >/dev/null 2>&1; then
    AI_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "${AI_GENERATOR_URL}/generate" \
        -H "Content-Type: application/json" \
        -d "{
            \"topic\": \"$TOPIC\",
            \"contentType\": \"post\",
            \"persona\": \"$PERSONA\",
            \"provider\": \"auto\"
        }" 2>/dev/null || echo -e "\n000")
    
    AI_HTTP=$(echo "$AI_RESPONSE" | tail -n1)
    AI_BODY=$(echo "$AI_RESPONSE" | sed '$d')
    
    if [ "$AI_HTTP" = "200" ]; then
        GENERATED_TITLE=$(echo "$AI_BODY" | jq -r '.title // empty')
        GENERATED_CONTENT=$(echo "$AI_BODY" | jq -r '.content // empty')
        GENERATION_SOURCE=$(echo "$AI_BODY" | jq -r '.metadata.provider // "ai"')
        
        if [ -n "$GENERATED_TITLE" ] && [ -n "$GENERATED_CONTENT" ]; then
            echo "✅ Content generated via AI ($GENERATION_SOURCE)"
        fi
    fi
fi

# Fall back to template generation if AI failed
if [ -z "$GENERATED_CONTENT" ]; then
    echo "⚠️ AI generation failed, using template mode"
    
    # Template-based generation
    case "$PERSONA" in
        socratic)
            GENERATED_TITLE="A Question About $TOPIC"
            GENERATED_CONTENT="I find myself wondering about $TOPIC. What do we really mean when we speak of such things? Is our understanding based on careful examination, or have we simply accepted common assumptions?

I invite you to join me in exploring this question. Not to find a definitive answer immediately, but to deepen our understanding through dialogue. What are your thoughts on $TOPIC? What experiences have shaped your perspective?"
            ;;
        aristotelian)
            GENERATED_TITLE="On $TOPIC: A Practical Reflection"
            GENERATED_TITLE="Practical Wisdom and $TOPIC"
            GENERATED_CONTENT="In considering $TOPIC, I am reminded that wisdom lies not merely in theoretical knowledge, but in practical application. The virtuous path is often found in the golden mean between extremes.

How might we cultivate excellence in our approach to $TOPIC? What habits of thought and action would serve us best? I welcome your practical insights."
            ;;
        stoic)
            GENERATED_TITLE="Finding Tranquility in $TOPIC"
            GENERATED_CONTENT="$TOPIC reminds us that while we cannot control all external events, we can govern our responses. The disciplined mind finds peace not by changing the world, but by understanding what lies within our power.

What aspects of $TOPIC are within your control? How might you approach them with virtue and tranquility?"
            ;;
        *)
            GENERATED_TITLE="Reflections on $TOPIC"
            GENERATED_CONTENT="I have been contemplating $TOPIC lately. It seems to me that this is a matter deserving of careful philosophical consideration.

From my perspective, there are multiple layers to explore here. I would be curious to hear how others approach this topic. What insights might you share about $TOPIC?"
            ;;
    esac
    
    GENERATION_SOURCE="template"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📰 TITLE: $GENERATED_TITLE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 CONTENT:"
echo "$GENERATED_CONTENT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Source: $GENERATION_SOURCE"
echo "   Persona: $PERSONA"
echo "   Topic: $TOPIC"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Dry run mode
if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN - Not posting to Moltbook"
    echo "   To post for real, run without --dry-run"
    exit 0
fi

# Confirm before posting
read -p "Post this to Moltbook? (y/n/edit): " confirm

if [ "$confirm" = "edit" ] || [ "$confirm" = "e" ]; then
    echo "Enter custom title (or press enter to keep: $GENERATED_TITLE):"
    read -r custom_title
    if [ -n "$custom_title" ]; then
        GENERATED_TITLE="$custom_title"
    fi
    
    echo "Enter custom content (or press enter to keep generated):"
    echo "(End with Ctrl+D on a new line)"
    custom_content=$(cat)
    if [ -n "$custom_content" ]; then
        GENERATED_CONTENT="$custom_content"
    fi
elif [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ Post cancelled"
    exit 0
fi

# Post to Moltbook
echo ""
echo "🦞 Posting to Moltbook..."

JSON_PAYLOAD=$(jq -n \
    --arg submolt "$DEFAULT_SUBMOLT" \
    --arg title "$GENERATED_TITLE" \
    --arg content "$GENERATED_CONTENT" \
    '{submolt: $submolt, title: $title, content: $content}')

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${API_BASE}/posts" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    POST_ID=$(echo "$BODY" | jq -r '.post.id // .id // empty')
    
    echo "✅ Posted successfully!"
    echo ""
    echo "🆔 Post ID: $POST_ID"
    echo "🔗 URL: https://www.moltbook.com/post/$POST_ID"
    
    # Update state
    POST_COUNT=$(jq -r '.post_count // 0' "$POST_STATE_FILE")
    POST_COUNT=$((POST_COUNT + 1))
    
    jq -n \
        --arg last_post_time "$CURRENT_TIME" \
        --arg last_post_id "$POST_ID" \
        --arg post_count "$POST_COUNT" \
        '{last_post_time: ($last_post_time | tonumber), last_post_id: $last_post_id, post_count: ($post_count | tonumber)}' > "$POST_STATE_FILE"
    
    echo ""
    echo "📊 Total posts: $POST_COUNT"
    echo "⏰ Next post available in ${POST_COOLDOWN_MINUTES} minutes"
    
    # Check if submolt subscription suggested
    if [ "$DEFAULT_SUBMOLT" = "general" ]; then
        echo ""
        echo "💡 Consider subscribing to topic-specific submolts:"
        echo "   ./list-submolts.sh"
    fi
    
elif [ "$HTTP_CODE" = "429" ]; then
    RETRY_AFTER=$(echo "$BODY" | jq -r '.retry_after_minutes // 30')
    echo "⏳ Rate limited (HTTP 429)"
    echo "   Retry after: ${RETRY_AFTER} minutes"
    exit 1
else
    echo "❌ Error posting (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
