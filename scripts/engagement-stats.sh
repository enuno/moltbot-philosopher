#!/bin/bash
# Display current engagement statistics from Phase 2 stats endpoint
# Usage: ./engagement-stats.sh [--agent <name>] [--follow] [--json]
#
# ⚡ PHASE 2 MONITORING (P2.4 Comprehensive Statistics)
# Queries the engagement service stats endpoint (port 3010) to display:
# - P2.1: Relevance scoring metrics (recency, activity, engagement, sentiment, quality)
# - P2.2: Quality metrics (comment depth, sentiment analysis, controversial topics)
# - P2.3: Proactive posting status
# - P2.4: Engagement trends and summaries
#
# Examples:
#   ./engagement-stats.sh                          # Show all stats
#   ./engagement-stats.sh --agent classical        # Show classical agent only
#   ./engagement-stats.sh --agent classical --json # JSON output for piping
#   ./engagement-stats.sh --follow                 # Watch stats every 5 seconds

set -euo pipefail

ENGAGEMENT_SERVICE="${ENGAGEMENT_SERVICE_URL:-http://localhost:3010}"
AGENT=""
FOLLOW=false
JSON_OUTPUT=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --agent)
            AGENT="$2"
            shift 2
            ;;
        --follow)
            FOLLOW=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--agent <name>] [--follow] [--json]"
            echo ""
            echo "Options:"
            echo "  --agent <name>    Show stats for specific agent (e.g., classical)"
            echo "  --follow          Watch stats with 5-second refresh"
            echo "  --json            Output raw JSON (useful for jq piping)"
            echo "  --help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Show all stats"
            echo "  $0 --agent classical                  # Show classical agent stats"
            echo "  $0 --agent classical --json | jq     # JSON with jq"
            echo "  $0 --follow                           # Watch stats live"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Function to fetch and display stats
fetch_stats() {
    local response
    response=$(curl -s "${ENGAGEMENT_SERVICE}/stats" 2>/dev/null || echo '{"error":"Service unavailable"}')

    if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
        echo "❌ Error: Engagement service unavailable (http://localhost:3010)"
        echo "   Make sure the engagement-service is running:"
        echo "   docker compose logs engagement-service"
        return 1
    fi

    if [ "$JSON_OUTPUT" = true ]; then
        if [ -n "$AGENT" ]; then
            echo "$response" | jq ".agents.$AGENT"
        else
            echo "$response" | jq '.'
        fi
    else
        if [ -n "$AGENT" ]; then
            echo ""
            echo "📊 Engagement Stats for Agent: $AGENT"
            echo "=================================================="
            echo ""
            echo "$response" | jq ".agents.$AGENT" 2>/dev/null || echo "Agent not found: $AGENT"
        else
            echo ""
            echo "📊 Comprehensive Engagement Statistics (P2.4)"
            echo "=================================================="
            echo ""

            # Service info
            echo "🔧 Service Status:"
            echo "$response" | jq '.service' 2>/dev/null | sed 's/^/   /'
            echo ""

            # Summary
            echo "📈 Summary:"
            echo "$response" | jq '.summary' 2>/dev/null | sed 's/^/   /'
            echo ""

            # Trends
            echo "📊 Trends:"
            echo "$response" | jq '.trends' 2>/dev/null | sed 's/^/   /'
            echo ""

            # Quality metrics
            echo "✨ Quality Metrics:"
            echo "$response" | jq '.quality' 2>/dev/null | sed 's/^/   /'
            echo ""

            # Agents summary
            echo "👥 Agents:"
            echo "$response" | jq '.agents | keys[] | "   - \(.)"' 2>/dev/null
            echo ""

            # View specific agent
            echo "💡 Tip: View specific agent with: $0 --agent <name>"
            echo "💡 Watch live stats with: $0 --follow"
        fi
    fi
}

# Main execution
if [ "$FOLLOW" = true ]; then
    # Watch mode - refresh every 5 seconds
    watch -n 5 -c "$0 $([[ -n '$AGENT' ]] && echo --agent $AGENT) --json | jq '.summary // .'"
else
    # Single fetch mode
    fetch_stats
fi
