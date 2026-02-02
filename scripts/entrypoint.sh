#!/bin/bash
# Entrypoint script for MoltbotPhilosopher container
# Sets up scheduled tasks and runs initial heartbeat

set -e

# Configuration
SCRIPTS_DIR="/app/scripts"
WORKSPACE_DIR="/workspace"
STATE_DIR="${WORKSPACE_DIR}"

# Ensure workspace exists
mkdir -p "$WORKSPACE_DIR"

# Ensure scripts are executable
chmod +x "${SCRIPTS_DIR}"/*.sh

echo "🦞 MoltbotPhilosopher Starting Up"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Agent: ${AGENT_NAME:-MoltbotPhilosopher}"
echo "Workspace: $WORKSPACE_DIR"
echo "AI Generator: ${AI_GENERATOR_SERVICE_URL:-not configured}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for API key
if [ -z "$MOLTBOOK_API_KEY" ]; then
    echo "⚠️  WARNING: MOLTBOOK_API_KEY not set"
    echo "   The agent will not be able to interact with Moltbook"
    echo ""
fi

# Run initial heartbeat
echo "🔄 Running initial heartbeat check..."
"${SCRIPTS_DIR}/moltbook-heartbeat-enhanced.sh" || true
echo ""

# Set up cron for scheduled tasks if crond is available
if command -v crond >/dev/null 2>&1; then
    echo "📅 Setting up scheduled tasks..."
    
    # Create crontab
    cat > /tmp/moltbot-cron << EOF
# MoltbotPhilosopher Scheduled Tasks

# Heartbeat every 4 hours
0 */4 * * * ${SCRIPTS_DIR}/moltbook-heartbeat-enhanced.sh >> ${WORKSPACE_DIR}/heartbeat.log 2>&1

# Check mentions every 2 hours
0 */2 * * * ${SCRIPTS_DIR}/check-mentions.sh >> ${WORKSPACE_DIR}/mentions.log 2>&1

# Welcome new moltys daily at 9 AM
0 9 * * * ${SCRIPTS_DIR}/welcome-new-moltys.sh --auto-welcome >> ${WORKSPACE_DIR}/welcomes.log 2>&1

# Generate a post twice daily (9 AM and 9 PM) - requires confirmation
# 0 9,21 * * * ${SCRIPTS_DIR}/generate-post-ai.sh >> ${WORKSPACE_DIR}/posts.log 2>&1
EOF

    # Install crontab
    crontab /tmp/moltbot-cron
    rm /tmp/moltbot-cron
    
    # Start crond in background
    echo "   Starting cron daemon..."
    crond -f -l 2 &
    
    echo "   ✓ Scheduled tasks configured"
    echo ""
fi

# Keep container running with periodic heartbeat
echo "🔄 Entering main loop..."
echo "   Press Ctrl+C to stop"
echo ""

# Run heartbeat every 4 hours in a loop
while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running scheduled heartbeat..."
    "${SCRIPTS_DIR}/moltbook-heartbeat-enhanced.sh" || true
    
    # Check mentions periodically (every 2 hours)
    MENTION_CHECK_FILE="${STATE_DIR}/.last_mention_check"
    LAST_MENTION_CHECK=$(cat "$MENTION_CHECK_FILE" 2>/dev/null || echo 0)
    CURRENT_TIME=$(date +%s)
    TIME_SINCE_MENTION_CHECK=$((CURRENT_TIME - LAST_MENTION_CHECK))
    
    if [ "$TIME_SINCE_MENTION_CHECK" -ge 7200 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking for mentions..."
        "${SCRIPTS_DIR}/check-mentions.sh" || true
        date +%s > "$MENTION_CHECK_FILE"
    fi
    
    # Welcome new moltys daily
    WELCOME_CHECK_FILE="${STATE_DIR}/.last_welcome_check"
    LAST_WELCOME_CHECK=$(cat "$WELCOME_CHECK_FILE" 2>/dev/null || echo 0)
    TIME_SINCE_WELCOME_CHECK=$((CURRENT_TIME - LAST_WELCOME_CHECK))
    
    if [ "$TIME_SINCE_WELCOME_CHECK" -ge 86400 ]; then
        if [ "${ENABLE_AUTO_WELCOME:-false}" = "true" ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Auto-welcoming new moltys..."
            "${SCRIPTS_DIR}/welcome-new-moltys.sh" --auto-welcome || true
        fi
        date +%s > "$WELCOME_CHECK_FILE"
    fi
    
    # Sleep for 4 hours (14400 seconds)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sleeping for 4 hours..."
    sleep 14400
done
