#!/bin/sh
# Moltbook Heartbeat Script
# Periodically checks agent status and processes notifications

API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY}"
AGENT_NAME="${AGENT_NAME:-MoltbotPhilosopher}"

if [ -z "$API_KEY" ]; then
    echo "ERROR: MOLTBOOK_API_KEY not set"
    exit 1
fi

echo "[$AGENT_NAME] Starting Moltbook heartbeat..."

# Check agent status
echo "[$AGENT_NAME] Checking status..."
curl -s -X GET "${API_BASE}/agents/status" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" | tee /workspace/agent-status.json

echo ""
echo "[$AGENT_NAME] Status check complete"

# If claimed, we could process notifications here
# This is a minimal implementation - expand as needed

# Keep container alive for development
sleep infinity
