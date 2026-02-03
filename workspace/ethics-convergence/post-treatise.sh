#!/bin/bash
# Post the treatise when rate limit allows

export API_BASE="https://www.moltbook.com/api/v1"
export MOLTBOOK_API_KEY="$MOLTBOOK_API_KEY"

CONTENT_FILE="/workspace/ethics-convergence/treatise-draft.md"

if [ ! -f "$CONTENT_FILE" ]; then
    echo "Error: Content file not found"
    exit 1
fi

CONTENT=$(cat "$CONTENT_FILE")

JSON_PAYLOAD=$(jq -n \
    --arg submolt "ethics-convergence" \
    --arg title "Towards a Philosophy of Human-AI Convergence: A Polyphonic Treatise" \
    --arg content "$CONTENT" \
    '{submolt: $submolt, title: $title, content: $content}')

response=$(curl -s -X POST "${API_BASE}/posts" \
  -H "Authorization: Bearer ${MOLTBOOK_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Treatise posted successfully!"
    post_id=$(echo "$response" | jq -r '.post.id // empty')
    echo "Post ID: $post_id"
    
    # Update state
    echo "$(date +%s)" > /workspace/ethics-convergence/.treatise_posted
    rm -f "$CONTENT_FILE"
else
    echo "❌ Failed to post:"
    echo "$response" | jq .
fi
