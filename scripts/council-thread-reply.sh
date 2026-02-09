#!/bin/bash
# Generate and post a Council response to a thread
# Usage: ./council-thread-reply.sh <post_id_or_url> [--dry-run]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY}"
AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://ai-generator:3000}"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"

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

echo -e "${BLUE}[4/4] Posting council response...${NC}"

# Register thread with thread monitor first
if [ -f "${SCRIPT_DIR}/register-thread.sh" ]; then
    echo -e "  Registering thread with monitor..."
    "${SCRIPT_DIR}/register-thread.sh" "$POST_ID" "$THREAD_TITLE" >/dev/null 2>&1 || true
fi

POST_PAYLOAD=$(jq -n \
    --arg content "$COUNCIL_RESPONSE" \
    '{content: $content}')

POST_RESPONSE=$(curl -s -X POST "${API_BASE}/posts/${POST_ID}/comments" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$POST_PAYLOAD" 2>/dev/null)

if echo "$POST_RESPONSE" | jq -e '.comment.id // .id // .comment_id' >/dev/null 2>&1; then
    COMMENT_ID=$(echo "$POST_RESPONSE" | jq -r '.comment.id // .id // .comment_id')
    COMMENT_URL="https://www.moltbook.com/post/${POST_ID}#comment-${COMMENT_ID}"
    
    echo -e "${GREEN}✓ Council response posted${NC}"
    echo -e "  Comment ID: ${COMMENT_ID}"
    echo -e "  URL: ${COMMENT_URL}"
    
    # Send notification
    if [ -f "${SCRIPT_DIR}/notify-ntfy.sh" ]; then
        "${SCRIPT_DIR}/notify-ntfy.sh" "action" "Council Thread Reply Posted" \
            "Thread: ${THREAD_TITLE:0:50}... | Author: @${THREAD_AUTHOR}" 2>/dev/null || true
    fi
    
    # Record in state
    STATE_FILE="${STATE_DIR}/council-replies.json"
    if [ ! -f "$STATE_FILE" ]; then
        echo '{"replies": []}' > "$STATE_FILE"
    fi
    
    jq --arg thread_id "$POST_ID" \
       --arg comment_id "$COMMENT_ID" \
       --arg title "$THREAD_TITLE" \
       --arg timestamp "$(date -Iseconds)" \
       '.replies += [{thread_id: $thread_id, comment_id: $comment_id, title: $title, timestamp: $timestamp}]' \
       "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  COUNCIL RESPONSE COMPLETE${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    
    exit 0
else
    ERROR_MSG=$(echo "$POST_RESPONSE" | jq -r '.error // .message // "unknown error"')
    echo -e "${RED}Error: Failed to post response${NC}"
    echo -e "${RED}${ERROR_MSG}${NC}"
    exit 1
fi
