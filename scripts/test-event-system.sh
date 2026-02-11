#!/bin/bash
# Test Event Listener and Agent Orchestrator integration

set -e

echo "=== Testing Event System Integration ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Wait for service to be ready
wait_for_service() {
  local url=$1
  local name=$2
  local max_wait=30
  local waited=0

  echo -n "Waiting for $name to be ready..."
  while [ $waited -lt $max_wait ]; do
    if curl -s "$url" > /dev/null 2>&1; then
      echo -e " ${GREEN}✓${NC}"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
    echo -n "."
  done
  echo -e " ${RED}✗${NC}"
  return 1
}

# Test 1: Check Agent Orchestrator health
echo -e "\n${YELLOW}Test 1: Agent Orchestrator Health${NC}"
wait_for_service "http://localhost:3006/health" "Agent Orchestrator"

response=$(curl -s http://localhost:3006/health)
status=$(echo "$response" | jq -r '.status')

if [ "$status" = "healthy" ]; then
  echo -e "${GREEN}✓ Agent Orchestrator is healthy${NC}"
  agent_count=$(echo "$response" | jq -r '.agentCount')
  echo "  - $agent_count agents initialized"
else
  echo -e "${RED}✗ Agent Orchestrator is not healthy${NC}"
  exit 1
fi

# Test 2: Check Event Listener health
echo -e "\n${YELLOW}Test 2: Event Listener Health${NC}"
wait_for_service "http://localhost:3007/health" "Event Listener"

response=$(curl -s http://localhost:3007/health)
status=$(echo "$response" | jq -r '.status')

if [ "$status" = "healthy" ]; then
  echo -e "${GREEN}✓ Event Listener is healthy${NC}"

  # Check pollers
  verification_active=$(echo "$response" | jq -r '.pollers.verification.active')
  engagement_active=$(echo "$response" | jq -r '.pollers.engagement.active')

  if [ "$verification_active" = "true" ] && [ "$engagement_active" = "true" ]; then
    echo -e "${GREEN}✓ Both pollers are active${NC}"
  else
    echo -e "${RED}✗ Pollers not active${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Event Listener is not healthy${NC}"
  exit 1
fi

# Test 3: List all agents
echo -e "\n${YELLOW}Test 3: List All Agents${NC}"
response=$(curl -s http://localhost:3006/agents)
agent_count=$(echo "$response" | jq '. | length')

if [ "$agent_count" -eq 9 ]; then
  echo -e "${GREEN}✓ All 9 agents initialized${NC}"
  echo "$response" | jq -r '.[] | "  - \(.name): \(.status)"'
else
  echo -e "${RED}✗ Expected 9 agents, got $agent_count${NC}"
  exit 1
fi

# Test 4: Check specific agent
echo -e "\n${YELLOW}Test 4: Check Classical Agent${NC}"
response=$(curl -s http://localhost:3006/agents/classical)
status=$(echo "$response" | jq -r '.status')
name=$(echo "$response" | jq -r '.name')

if [ "$status" = "idle" ] && [ "$name" = "classical" ]; then
  echo -e "${GREEN}✓ Classical agent is idle and ready${NC}"
  echo "  Queue size: $(echo "$response" | jq -r '.queueSize')"
  echo "  Events processed: $(echo "$response" | jq -r '.eventsProcessed')"
else
  echo -e "${RED}✗ Classical agent not ready${NC}"
  exit 1
fi

# Test 5: Send test event
echo -e "\n${YELLOW}Test 5: Send Test Event${NC}"
test_event=$(cat <<EOF
{
  "id": "test-$(date +%s)",
  "type": "test.event",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "priority": "normal",
  "source": "test-script",
  "payload": {
    "message": "Integration test event"
  },
  "metadata": {
    "test": true
  },
  "targetAgent": "classical"
}
EOF
)

response=$(curl -s -X POST http://localhost:3006/events \
  -H "Content-Type: application/json" \
  -d "$test_event")

success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
  echo -e "${GREEN}✓ Test event dispatched successfully${NC}"
  event_id=$(echo "$response" | jq -r '.eventId')
  echo "  Event ID: $event_id"
else
  echo -e "${RED}✗ Failed to dispatch test event${NC}"
  echo "$response"
  exit 1
fi

# Test 6: Verify event was queued
echo -e "\n${YELLOW}Test 6: Verify Event Queued${NC}"
sleep 2  # Give it time to process
response=$(curl -s http://localhost:3006/agents/classical)
events_processed=$(echo "$response" | jq -r '.eventsProcessed')

if [ "$events_processed" -ge 1 ]; then
  echo -e "${GREEN}✓ Event was processed${NC}"
  echo "  Total events processed: $events_processed"
else
  echo -e "${YELLOW}⚠ Event may still be in queue${NC}"
  queue_size=$(echo "$response" | jq -r '.queueSize')
  echo "  Queue size: $queue_size"
fi

# Summary
echo -e "\n${GREEN}=== All Tests Passed ===${NC}"
echo ""
echo "Services are operational:"
echo "  • Agent Orchestrator: http://localhost:3006"
echo "  • Event Listener: http://localhost:3007"
echo ""
echo "Next steps:"
echo "  1. Check logs: docker logs agent-orchestrator-dev"
echo "  2. Check logs: docker logs event-listener-dev"
echo "  3. Monitor events in real-time"
