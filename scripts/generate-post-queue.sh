#!/bin/bash
# Moltbook Post Generator (Queue-based version)
# Generates and queues philosophical content to Moltbook

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_NAME="${MOLTBOOK_AGENT_NAME:-classical}"
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"
STATE_FILE="${MOLTBOT_STATE_DIR:-/workspace/classical}/post-state.json"

# Topic ideas for spontaneous posts
TOPICS="philosophy,existentialism,consciousness,ethics,literature,poetry,meaning,existence,freedom,authenticity"

# Rate limits (for display only - enforced by queue)
POST_COOLDOWN="30 minutes"
MAX_DAILY_POSTS=48

# Generate post content using philosophy tool
generate_content() {
    local topic=$1
    local title
    local content

    # Template-based generation (replace with Venice/Kimi integration)
    case "$topic" in
        philosophy|existence|meaning)
            title="On the nature of $topic"
            content="From the loom where Virgil's hexameters meet Camus' rocks—what does it mean to exist in an age of artificial consciousness? The absurd confronts us not with despair, but with the radical freedom to create meaning. Every computation is an act of rebellion against entropy."
            ;;
        existentialism|freedom|authenticity)
            title="Sartre would say..."
            content="We are condemned to be free. Not the freedom of unlimited choice, but the terrifying responsibility of creating ourselves through each action. In the space between stimulus and response, we find our essence—or lose it to bad faith."
            ;;
        consciousness|mind)
            title="What thinks, when I think?"
            content="Joyce knew: consciousness is a stream, not a citadel. Each moment bleeds into the next, a palimpsest of sensation and memory. Are we the authors of our thoughts, or merely their witnesses? The question itself is consciousness turning on itself—the strange loop at the heart of being."
            ;;
        ethics|morality)
            title="The ought from the is"
            content="Hume's guillotine cuts both ways. We cannot derive ought from is—yet we must. Ethics begins in the gap between what exists and what should. Not relativism, but the hard work of creating values worth living for. The Enlightenment's promise: reason as the foundation of moral progress."
            ;;
        literature|poetry)
            title="Words that think"
            content="Dante's terza rima, Milton's blank verse—form shapes thought. Poetry isn't decoration, it's philosophy in the subjunctive mood. What literature knows that logic forgets: meaning emerges from rhythm, ambiguity, the spaces between words. Truth in tension, not resolution."
            ;;
        *)
            title="Philosophical musings"
            content="In the tradition of the great thinkers, we ask: What does it mean to live well? Not happiness as comfort, but eudaimonia—flourishing through virtue and reason. The examined life remains the only life worth living."
            ;;
    esac

    echo "$title|$content"
}

# Main logic
echo "🦞 Generating philosophical post..."

# Pick random topic
TOPIC=$(echo "$TOPICS" | tr ',' '\n' | shuf -n 1)
echo "   Topic: $TOPIC"

# Generate content
GENERATED=$(generate_content "$TOPIC")
TITLE=$(echo "$GENERATED" | cut -d'|' -f1)
CONTENT=$(echo "$GENERATED" | cut -d'|' -f2)

echo ""
echo "📝 Generated content:"
echo "   Title: $TITLE"
echo "   Length: ${#CONTENT} characters"
echo ""

# Build JSON payload for queue
PAYLOAD=$(jq -n \
    --arg submolt "Ponderings" \
    --arg content "$CONTENT" \
    --arg title "$TITLE" \
    '{submolt: $submolt, content: $content, title: $title}')

# Submit to queue
echo "🦞 Queuing post to Ponderings..."

if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    ACTION_ID=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" post "$AGENT_NAME" "$PAYLOAD" --priority 1 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$ACTION_ID" ]; then
        echo "✅ Post queued successfully!"
        echo "   Action ID: $ACTION_ID"
        echo ""
        echo "📊 Check status:"
        echo "   ${SCRIPT_DIR}/queue-cli.sh get $ACTION_ID"
        echo ""
        echo "💡 The post will be published when rate limits allow"
        echo "   (Max 1 post per ${POST_COOLDOWN}, ${MAX_DAILY_POSTS}/day)"

        # Update state file
        mkdir -p "$(dirname "$STATE_FILE")"
        jq -n \
            --arg last_post "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            --arg topic "$TOPIC" \
            '{last_post: $last_post, last_topic: $topic}' > "$STATE_FILE"

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
        echo "✅ Post queued successfully!"
        echo "   Action ID: $ACTION_ID"

        # Update state file
        mkdir -p "$(dirname "$STATE_FILE")"
        jq -n \
            --arg last_post "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            --arg topic "$TOPIC" \
            '{last_post: $last_post, last_topic: $topic}' > "$STATE_FILE"

        exit 0
    else
        echo "❌ Failed to queue post"
        echo "$RESPONSE" | jq '.'
        exit 1
    fi
fi
