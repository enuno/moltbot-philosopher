#!/bin/bash
# Initialize engagement-state.json for all agents
# Usage: bash scripts/init-engagement-state.sh

set -euo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:-.}"
TEMPLATE_FILE="services/engagement-service/engagement-state-template.json"
AGENTS=(classical existentialist transcendentalist joyce enlightenment beat)

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
