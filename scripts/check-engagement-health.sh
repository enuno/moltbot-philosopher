#!/bin/bash
# Check health of engagement services
# Usage: ./check-engagement-health.sh [--verbose]
#
# ⚡ PHASE 2 SERVICES HEALTH CHECK
# This script verifies the health of all engagement-related services:
# - Port 3010: Engagement Service (proactive, queue integration)
# - Port 3011: Reactive Handler (real-time mention/comment responses)
# - Port 3008: Action Queue (job processor with quality metrics)
#
# Examples:
#   ./check-engagement-health.sh              # Quick health check
#   ./check-engagement-health.sh --verbose    # Detailed health info

set -euo pipefail

VERBOSE="${1:-}"
ENGAGEMENT_SERVICE="http://localhost:3010"
REACTIVE_HANDLER="http://localhost:3011"
ACTION_QUEUE="http://localhost:3008"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "🏥 Engagement Services Health Check"
echo "===================================="
echo ""

# Function to check service health
check_service() {
    local name="$1"
    local url="$2"
    local endpoint="${3:-/health}"

    echo -n "📍 $name (${url##*/}):"

    if response=$(curl -s -m 2 "${url}${endpoint}" 2>/dev/null); then
        status=$(echo "$response" | jq -r '.status // .healthy // "unknown"' 2>/dev/null || echo "unknown")

        if [ "$status" = "healthy" ] || [ "$status" = "true" ]; then
            echo -e " ${GREEN}✅ Healthy${NC}"

            if [ "$VERBOSE" = "--verbose" ]; then
                if echo "$response" | jq -e '.agents' >/dev/null 2>&1; then
                    agents=$(echo "$response" | jq -r '.agents // 0')
                    echo "   Loaded agents: $agents"
                fi
                if echo "$response" | jq -e '.uptime' >/dev/null 2>&1; then
                    uptime=$(echo "$response" | jq -r '.uptime // 0' | cut -d. -f1)
                    echo "   Uptime: ${uptime}s"
                fi
                if echo "$response" | jq -e '.version' >/dev/null 2>&1; then
                    version=$(echo "$response" | jq -r '.version // "unknown"')
                    echo "   Version: $version"
                fi
            fi
            return 0
        else
            echo -e " ${YELLOW}⚠️  Degraded (status: $status)${NC}"
            return 1
        fi
    else
        echo -e " ${RED}❌ Unavailable${NC}"
        return 1
    fi
}

# Check main engagement service
ENGAGEMENT_OK=0
check_service "Engagement Service" "$ENGAGEMENT_SERVICE" "/health" || ENGAGEMENT_OK=1

# Check reactive handler
REACTIVE_OK=0
check_service "Reactive Handler" "$REACTIVE_HANDLER" "/health" || REACTIVE_OK=1

# Check action queue
QUEUE_OK=0
if response=$(curl -s -m 2 "${ACTION_QUEUE}/queue/stats" 2>/dev/null); then
    echo -n "📍 Action Queue (localhost:3008):"

    # Check for success field in response
    if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        echo -e " ${GREEN}✅ Healthy${NC}"
        if [ "$VERBOSE" = "--verbose" ]; then
            queued=$(echo "$response" | jq -r '.data.summary.total_queued // 0' 2>/dev/null || echo "?")
            completed=$(echo "$response" | jq -r '.data.summary.total_completed // 0' 2>/dev/null || echo "?")
            failed=$(echo "$response" | jq -r '.data.summary.total_failed // 0' 2>/dev/null || echo "?")
            latency=$(echo "$response" | jq -r '.data.last_24h_summary.avg_latency_seconds // "N/A"' 2>/dev/null || echo "?")
            echo "   Queued: $queued | Completed: $completed | Failed: $failed | Avg Latency: ${latency}s"
        fi
    else
        echo -e " ${RED}❌ Unavailable${NC}"
        QUEUE_OK=1
    fi
else
    echo "📍 Action Queue (localhost:3008): ${RED}❌ Unavailable${NC}"
    QUEUE_OK=1
fi

echo ""

# Summary and recommendations
total_ok=$((3 - ENGAGEMENT_OK - REACTIVE_OK - QUEUE_OK))

if [ $ENGAGEMENT_OK -eq 0 ] && [ $REACTIVE_OK -eq 0 ] && [ $QUEUE_OK -eq 0 ]; then
    echo -e "${GREEN}✅ All services healthy${NC}"
    echo ""
    echo "Next steps:"
    echo "  - View stats: ./engagement-stats.sh"
    echo "  - Trigger cycle: ./trigger-engagement-cycle.sh"
    echo "  - Submit action: ./queue-submit-action.sh POST classical '{...}'"
else
    echo -e "${RED}⚠️  Some services are not available${NC}"
    echo ""
    if [ $ENGAGEMENT_OK -ne 0 ]; then
        echo "  • Fix engagement-service:"
        echo "    docker compose restart engagement-service"
        echo "    docker compose logs engagement-service"
    fi
    if [ $REACTIVE_OK -ne 0 ]; then
        echo "  • Fix reactive-handler:"
        echo "    docker compose restart reactive-handler"
        echo "    docker compose logs reactive-handler"
    fi
    if [ $QUEUE_OK -ne 0 ]; then
        echo "  • Fix action-queue:"
        echo "    docker compose restart action-queue"
        echo "    docker compose logs action-queue"
    fi
fi

echo ""
echo "📚 Documentation:"
echo "  - Engagement Service: curl http://localhost:3010/health"
echo "  - Queue Stats: curl http://localhost:3008/queue/stats"
echo "  - Engagement Stats: ./engagement-stats.sh"
echo ""

# Exit with error if any service is down
[ $ENGAGEMENT_OK -eq 0 ] && [ $REACTIVE_OK -eq 0 ] && [ $QUEUE_OK -eq 0 ] && exit 0 || exit 1
