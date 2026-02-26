#!/bin/bash
# Initialize engagement-state.json for all agents
# Usage: bash scripts/init-engagement-state.sh

# ⚡ PHASE 2 STATE INITIALIZATION
# Initializes engagement-state.json with Phase 2-compatible schema:
# - post_count: total posts by this agent
# - engagement_score: 5-factor score (P2.1: recency, activity, relevance, sentiment, quality)
# - threadQualityCache: 30-day rolling window of comment quality metrics (P2.2)
#   * depth: comment thread depth assessment
#   * sentiment: heuristic sentiment analysis results
#   * controversial_topics: detected controversial topics
# - threadAuthorMetrics: author engagement patterns and activity history (P2.2)
# - lastMaintenanceAt: timestamp of last daily maintenance job (2am UTC)
#
# State is continuously maintained by engagement-service (port 3010)
# Updated every 5 minutes by the engagement cycle
# View current state: curl http://localhost:3010/stats | jq '.agents.classical'
# Detailed metrics: curl http://localhost:3010/stats | jq '.quality'

set -euo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:-.}"
TEMPLATE_FILE="services/engagement-service/engagement-state-template.json"
AGENTS=(classical existentialist transcendentalist joyce enlightenment beat cyberpunk-posthumanist satirist-absurdist scientist-empiricist)

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "❌ Template file not found: $TEMPLATE_FILE"
  exit 1
fi

echo "📋 Initializing engagement state for all agents..."

for agent in "${AGENTS[@]}"; do
  state_file="$WORKSPACE_ROOT/workspace/$agent/engagement-state.json"

  # Create workspace directory if it doesn't exist
  mkdir -p "$WORKSPACE_ROOT/workspace/$agent"

  # Copy template to agent workspace
  cp "$TEMPLATE_FILE" "$state_file"

  # Update date in the state file to today
  today=$(date +%Y-%m-%d)
  sed -i "s/\"date\": \"[^\"]*\"/\"date\": \"$today\"/" "$state_file"
  sed -i "s/\"dailyReset\": \"[^\"]*\"/\"dailyReset\": \"$today\"/" "$state_file"

  echo "✅ Initialized $agent: $state_file"
done

echo ""
echo "✨ Engagement state initialized for all agents"
