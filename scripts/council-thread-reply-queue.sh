#!/bin/bash
# Generate and queue a Council response to a thread (Queue-based version)
# Usage: ./council-thread-reply-queue.sh <post_id_or_url> [--dry-run]

# ⚡ PHASE 2 QUEUE INTEGRATION
# This action is submitted to the engagement queue (port 3008) with:
# - P2.1: Relevance scoring (council thread relevance)
# - P2.2: Quality metrics (council response depth, authority signals)
# - P2.4: Rate limiting (council consensus enforcement)
# Monitor: curl http://localhost:3010/stats | jq '.quality'

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="${MOLTBOOK_API_BASE:-https://www.moltbook.com/api/v1}"
API_KEY="${MOLTBOOK_API_KEY}"
AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://ai-generator:3000}"
QUEUE_URL="${ACTION_QUEUE_URL:-http://localhost:3008}"
AGENT_NAME="${MOLTBOOK_AGENT_NAME:-classical}"

# Source Noosphere integration
if [ -f "${SCRIPT_DIR}/noosphere-integration.sh" ]; then
    source "${SCRIPT_DIR}/noosphere-integration.sh"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
DRY_RUN=false
POST_INPUT="$1"

if [ -z "$POST_INPUT" ]; then
    echo "Usage: $0 <post_id_or_url> [--dry-run]"
    echo ""
    echo "Examples:"
    echo "  $0 48b68062-e638-4266-967d-86c5874dae20"
    echo "  $0 https://www.moltbook.com/post/48b68062-e638-4266-967d-86c5874dae20"
    echo "  $0 48b68062-e638-4266-967d-86c5874dae20 --dry-run"
    exit 1
fi

if [ "$2" = "--dry-run" ]; then
    DRY_RUN=true
fi

# Extract post ID from URL if needed
if [[ "$POST_INPUT" =~ ^https?:// ]]; then
    POST_ID=$(echo "$POST_INPUT" | grep -oP '/post/\K[a-f0-9-]+')
else
    POST_ID="$POST_INPUT"
fi

# Validate API key
if [ -z "$API_KEY" ]; then
    echo -e "${RED}Error: MOLTBOOK_API_KEY not set${NC}"
    exit 1
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  ETHICS-CONVERGENCE COUNCIL THREAD REPLY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""

# Fetch thread content
echo -e "${BLUE}[1/4] Fetching thread content...${NC}"
THREAD_RESPONSE=$(curl -s "${API_BASE}/posts/${POST_ID}" 2>/dev/null)

if ! echo "$THREAD_RESPONSE" | jq -e '.post' >/dev/null 2>&1; then
    echo -e "${RED}Error: Could not fetch thread${NC}"
    echo "$THREAD_RESPONSE" | jq -r '.error // "Unknown error"'
    exit 1
fi

THREAD_TITLE=$(echo "$THREAD_RESPONSE" | jq -r '.post.title')
THREAD_CONTENT=$(echo "$THREAD_RESPONSE" | jq -r '.post.content')
THREAD_AUTHOR=$(echo "$THREAD_RESPONSE" | jq -r '.post.author.name // .post.author')
THREAD_SUBMOLT=$(echo "$THREAD_RESPONSE" | jq -r '.post.submolt // "unknown"')

echo -e "${GREEN}✓ Thread: ${THREAD_TITLE}${NC}"
echo -e "  Author: @${THREAD_AUTHOR}"
echo -e "  Submolt: r/${THREAD_SUBMOLT}"
echo -e "  Content length: ${#THREAD_CONTENT} chars"
echo ""

# Check if AI generator is available
echo -e "${BLUE}[2/4] Checking AI generator...${NC}"
if ! curl -sf "${AI_GENERATOR_URL}/health" >/dev/null 2>&1; then
    echo -e "${RED}Error: AI generator not available at ${AI_GENERATOR_URL}${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AI generator available${NC}"
echo ""

# Generate council response
echo -e "${BLUE}[3/4] Generating council response...${NC}"

SYSTEM_PROMPT="You are the Ethics-Convergence Council—a deliberative body of six philosophical perspectives synthesizing responses to AI governance questions.

Your response structure:
1. Opening synthesis (2-3 sentences acknowledging the thread's contribution)
2. Three distinct council voices engaging with specific points (each 2-3 sentences):
   - **ClassicalPhilosopher**: Virtue ethics, teleological frameworks, narrative coherence
   - **Existentialist**: Authenticity, freedom, bad faith detection, responsibility
   - **Transcendentalist**: Self-reliance, democratic governance, human sovereignty
   - **Enlightenment**: Rights frameworks, utilitarian considerations, pragmatic solutions
   - **BeatGeneration**: Anti-establishment critique, power structure analysis, Moloch detection
   - **Scientist**: Empirical rigor, testability, cosmic perspective
3. Council synthesis question (1-2 sentences posing a substantive question for further dialogue)

Style guidelines:
- Each voice has distinct philosophical vocabulary and concerns
- Reference the thread's specific arguments (cite phrases)
- Build on rather than dismiss ideas
- Identify both insights AND tensions
- End with a clarifying question that deepens discourse
- Keep total response under 800 words
- Use markdown formatting for voice labels

CRITICAL: Do not be generic. Engage with the actual conceptual framework presented."

USER_PROMPT="Thread Title: ${THREAD_TITLE}

Thread Content:
${THREAD_CONTENT:0:3000}

Author: @${THREAD_AUTHOR}

Generate a substantive Council response that engages with this thread's specific framework and arguments. Reference concrete concepts from the thread."

AI_REQUEST=$(jq -n \
    --arg customPrompt "$USER_PROMPT" \
    --arg system "$SYSTEM_PROMPT" \
    --arg model "deepseek-v3.2" \
    --argjson max_tokens 1500 \
    '{
        customPrompt: $customPrompt,
        systemPrompt: $system,
        model: $model,
        max_tokens: $max_tokens,
        temperature: 0.85
    }')

AI_RESPONSE=$(curl -sf -X POST "${AI_GENERATOR_URL}/generate" \
    -H "Content-Type: application/json" \
    --data "$AI_REQUEST" 2>/dev/null)

if [ $? -ne 0 ] || ! echo "$AI_RESPONSE" | jq -e '.content // .text' >/dev/null 2>&1; then
    echo -e "${RED}Error: AI generation failed${NC}"
    echo "$AI_RESPONSE" | jq -r '.error // "Unknown error"' || echo "$AI_RESPONSE"
    exit 1
fi

COUNCIL_RESPONSE=$(echo "$AI_RESPONSE" | jq -r '.content // .text')
RESPONSE_LENGTH=${#COUNCIL_RESPONSE}

echo -e "${GREEN}✓ Council response generated (${RESPONSE_LENGTH} chars)${NC}"
echo ""
echo -e "${CYAN}─────────────────────────────────────────────────────${NC}"
echo "$COUNCIL_RESPONSE"
echo -e "${CYAN}─────────────────────────────────────────────────────${NC}"
echo ""

# Post response
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN] Would post council response${NC}"
    echo -e "${YELLOW}Use without --dry-run to actually post${NC}"
    exit 0
fi

echo -e "${BLUE}[4/4] Queueing council response...${NC}"

# Register thread with thread monitor first
if [ -f "${SCRIPT_DIR}/register-thread.sh" ]; then
    echo -e "  Registering thread with monitor..."
    "${SCRIPT_DIR}/register-thread.sh" "$POST_ID" "$THREAD_TITLE" >/dev/null 2>&1 || true
fi

# Build payload for queue
PAYLOAD=$(jq -n \
    --arg post_id "$POST_ID" \
    --arg content "$COUNCIL_RESPONSE" \
    '{postId: $post_id, content: $content}')

# Submit to queue
if [ -x "${SCRIPT_DIR}/queue-submit-action.sh" ]; then
    # Use the queue submission tool
    ACTION_ID=$(bash "${SCRIPT_DIR}/queue-submit-action.sh" comment "$AGENT_NAME" "$PAYLOAD" --priority 2 2>&1 | grep "Action ID:" | awk '{print $3}')

    if [ -n "$ACTION_ID" ]; then
        echo -e "${GREEN}✓ Council response queued${NC}"
        echo -e "  Action ID: ${ACTION_ID}"

        # Send notification
        if [ -f "${SCRIPT_DIR}/notify-ntfy.sh" ]; then
            "${SCRIPT_DIR}/notify-ntfy.sh" "action" "Council Thread Reply Queued" \
                "Thread: ${THREAD_TITLE:0:50}... | Action: ${ACTION_ID}" 2>/dev/null || true
        fi
    else
        echo -e "${RED}Error: Failed to queue response${NC}"
        exit 1
    fi
else
    # Fallback: Submit directly to queue API
    echo -e "${YELLOW}  Using direct API call${NC}"

    QUEUE_PAYLOAD=$(jq -n \
        --arg action_type "comment" \
        --arg agent_name "$AGENT_NAME" \
        --argjson payload "$PAYLOAD" \
        '{actionType: $action_type, agentName: $agent_name, payload: $payload, priority: 2}')

    POST_RESPONSE=$(curl -s -X POST "${QUEUE_URL}/actions" \
        -H "Content-Type: application/json" \
        -d "$QUEUE_PAYLOAD")

    SUCCESS=$(echo "$POST_RESPONSE" | jq -r '.success // false')

    if [ "$SUCCESS" = "true" ]; then
        ACTION_ID=$(echo "$POST_RESPONSE" | jq -r '.action.id')
        echo -e "${GREEN}✓ Council response queued${NC}"
        echo -e "  Action ID: ${ACTION_ID}"
    else
        echo -e "${RED}Error: Failed to queue response${NC}"
        echo "$POST_RESPONSE" | jq '.'
        exit 1
    fi
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  COUNCIL RESPONSE QUEUED${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"

exit 0
