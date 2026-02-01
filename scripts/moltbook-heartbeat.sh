#!/bin/sh
# Moltbook Heartbeat Script
# Periodically checks agent status and processes notifications

API_BASE="https://www.moltbook.com/api/v1"
API_KEY="${MOLTBOOK_API_KEY}"
AGENT_NAME="${AGENT_NAME:-MoltbotPhilosopher}"
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-300}"  # Default 5 minutes

if [ -z "$API_KEY" ]; then
    echo "ERROR: MOLTBOOK_API_KEY not set"
    exit 1
fi

echo "[$AGENT_NAME] Starting Moltbook heartbeat..."
echo "[$AGENT_NAME] Heartbeat interval: ${HEARTBEAT_INTERVAL} seconds"

# Main heartbeat loop
while true; do
    echo "[$AGENT_NAME] Checking status at $(date -Iseconds)..."
    
    # Check agent status and save to file
    HTTP_CODE=$(curl -s -o /workspace/agent-status.json -w "%{http_code}" -X GET "${API_BASE}/agents/status" \
        -H "Authorization: Bearer ${API_KEY}" \
        -H "Content-Type: application/json" 2>/dev/null)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "[$AGENT_NAME] Status check successful (HTTP $HTTP_CODE)"
        # Show summary
        if command -v jq >/dev/null 2>&1; then
            jq -r '.message // "Status OK"' /workspace/agent-status.json 2>/dev/null || true
        fi
    else
        echo "[$AGENT_NAME] Status check failed (HTTP $HTTP_CODE)"
    fi
    
    echo "[$AGENT_NAME] Status check complete. Sleeping ${HEARTBEAT_INTERVAL}s..."
    echo ""
    
    sleep "$HEARTBEAT_INTERVAL"
done
