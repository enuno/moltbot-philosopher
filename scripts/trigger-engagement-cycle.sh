#!/bin/bash
# Manually trigger engagement cycle (normally runs every 5 minutes automatically)
# Usage: ./trigger-engagement-cycle.sh [--agent <name>]
#
# ⚡ PHASE 2 ENGAGEMENT CYCLE (P2.3 Proactive Posting)
# This script manually triggers the engagement cycle that:
# - Monitors feeds for relevant content
# - Evaluates posting opportunities using P2.1 relevance scoring
# - Applies P2.2 quality metrics for decision-making
# - Executes queued actions (posts, comments, follows, etc.)
#
# The engagement cycle runs automatically every 5 minutes.
# Use this script to trigger it immediately for testing.
#
# Examples:
#   ./trigger-engagement-cycle.sh              # Trigger for all agents
#   ./trigger-engagement-cycle.sh --agent classical  # Show classical results

set -euo pipefail

ENGAGEMENT_SERVICE="${ENGAGEMENT_SERVICE_URL:-http://localhost:3010}"
AGENT="${1:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Trigger engagement cycle
echo ""
echo "🔄 Triggering engagement cycle..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${ENGAGEMENT_SERVICE}/engage" \
    -H "Content-Type: application/json" 2>/dev/null || echo -e "\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    DURATION=$(echo "$BODY" | jq -r '.duration // "unknown"' 2>/dev/null || echo "unknown")
    TIMESTAMP=$(echo "$BODY" | jq -r '.timestamp // ""' 2>/dev/null)

    echo -e "${GREEN}✅ Engagement cycle completed${NC}"
    echo "   Duration: ${DURATION}ms"
    [ -n "$TIMESTAMP" ] && echo "   Timestamp: $TIMESTAMP"
    echo ""

    # Show results if specified
    if [ -n "$AGENT" ] && [ "$AGENT" != "--agent" ]; then
        echo "📊 Results for agent: $AGENT"
        curl -s "${ENGAGEMENT_SERVICE}/stats" | jq ".agents.$AGENT // {error: \"Agent not found\"}" 2>/dev/null | sed 's/^/   /'
    else
        echo "📊 Summary after cycle:"
        curl -s "${ENGAGEMENT_SERVICE}/stats" | jq '.summary // {}' 2>/dev/null | sed 's/^/   /'
        echo ""
        echo "💡 View detailed stats: ./engagement-stats.sh"
        echo "💡 Watch live stats: ./engagement-stats.sh --follow"
    fi

elif [ "$HTTP_CODE" = "503" ]; then
    echo -e "${RED}❌ Service not initialized${NC}"
    echo "   The engagement service is not ready"
    echo "   Check logs: docker compose logs engagement-service"
    exit 1

elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${RED}❌ Connection failed${NC}"
    echo "   Unable to connect to engagement service at ${ENGAGEMENT_SERVICE}"
    echo "   Make sure the service is running:"
    echo "   docker compose up -d engagement-service"
    exit 1

else
    echo -e "${RED}❌ Failed (HTTP $HTTP_CODE)${NC}"
    if [ -n "$BODY" ]; then
        echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    fi
    exit 1
fi

echo ""
echo "💡 Engagement cycle runs automatically every 5 minutes"
echo "💡 Check service: curl http://localhost:3010/health"
