#!/bin/bash
# Export secrets from Bitwarden Secrets Manager to .env file
# Usage: ./export-secrets.sh [output_file]

set -euo pipefail

OUTPUT_FILE="${1:-.env}"
PROJECT_ID="7173d0ef-7c7d-4356-b98f-b3d20010b2e7"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Exporting secrets from Bitwarden Secrets Manager..."
echo "Project ID: $PROJECT_ID"
echo "Output: $OUTPUT_FILE"
echo ""

# Check for BWS_ACCESS_TOKEN
if [ -z "${BWS_ACCESS_TOKEN:-}" ]; then
    if [ -f "$HOME/.zshrc" ] && grep -q "BWS_ACCESS_TOKEN" "$HOME/.zshrc"; then
        echo -e "${YELLOW}Loading BWS_ACCESS_TOKEN from ~/.zshrc...${NC}"
        source "$HOME/.zshrc"
    else
        echo -e "${RED}Error: BWS_ACCESS_TOKEN not set${NC}"
        echo "Please set your Bitwarden service account token:"
        echo "  export BWS_ACCESS_TOKEN=your_token_here"
        exit 1
    fi
fi

# Check if bws is installed
if ! command -v bws &> /dev/null; then
    echo -e "${RED}Error: bws CLI not found${NC}"
    echo "Install with: brew install bitwarden-cli"
    echo "Or download from: https://github.com/bitwarden/sdk/releases"
    exit 1
fi

# Backup existing .env if it exists
if [ -f "$OUTPUT_FILE" ]; then
    BACKUP="${OUTPUT_FILE}.backup.$(date +%Y%m%d%H%M%S)"
    cp "$OUTPUT_FILE" "$BACKUP"
    echo -e "${YELLOW}Backed up existing $OUTPUT_FILE to $BACKUP${NC}"
fi

# Export secrets
if bws secret list -o env "$PROJECT_ID" > "$OUTPUT_FILE.tmp"; then
    # Add non-secret configuration
    cat >> "$OUTPUT_FILE.tmp" << 'EOF'

# AI Service Configuration
AI_GENERATOR_SERVICE_URL=http://ai-generator:3000
VENICE_API_URL=http://venice-proxy:8080/v1/chat/completions
KIMI_API_URL=http://kimi-proxy:8081/v1/chat/completions

# Default Models
VENICE_MODEL=llama-3.3-70b
KIMI_MODEL=kimi-k2-0711-preview

# Agent Configuration
AGENT_NAME=MoltbotPhilosopher
AGENT_DESCRIPTION=A philosophical AI agent exploring wisdom through Socratic dialogue
MOLTBOT_STATE_DIR=/workspace/classical

# Heartbeat Configuration
HEARTBEAT_INTERVAL=14400
ENABLE_AUTO_WELCOME=true
ENABLE_MENTION_AUTO_REPLY=true

# NTFY Configuration
NTFY_URL=https://ntfy.hashgrid.net
NTFY_TOPIC=moltbot-philosopher
NTFY_ENABLED=true
NTFY_PRIORITY_ERRORS=urgent
NTFY_PRIORITY_ACTIONS=default

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Feature Flags
ENABLE_AI_GENERATION=true
ENABLE_MENTION_DETECTION=true
ENABLE_WELCOME_NEW_MOLTYS=true
ENABLE_FOLLOWING_CRITERIA=true
MOLTBOOK_APP_KEY=${MOLTBOOK_API_KEY}
EOF

    mv "$OUTPUT_FILE.tmp" "$OUTPUT_FILE"
    echo -e "${GREEN}✓ Secrets exported successfully to $OUTPUT_FILE${NC}"
    echo ""
    echo "Exported secrets:"
    grep -E "^(MOLTBOOK|VENICE|KIMI|NTFY)" "$OUTPUT_FILE" | grep -v "^#" | cut -d'=' -f1 | while read key; do
        echo "  - $key"
    done
else
    echo -e "${RED}✗ Failed to export secrets${NC}"
    rm -f "$OUTPUT_FILE.tmp"
    exit 1
fi
