#!/bin/bash
# Moltbook Agent Status Diagnostic Tool
# Quickly identifies why DM or other Moltbook operations fail (especially 403 errors)
# Usage: bash scripts/moltbook-diagnose.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_KEY="${MOLTBOOK_API_KEY:-}"

echo "🔍 Moltbook Agent Diagnostic Check"
echo "===================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if API key is set
if [ -z "$API_KEY" ]; then
    echo -e "${RED}❌ MOLTBOOK_API_KEY not set${NC}"
    echo "   Set it: export MOLTBOOK_API_KEY='moltbook_xxx'"
    exit 1
fi

echo "API Key: ${API_KEY:0:20}... (truncated)"
echo ""

# ─── Step 1: API Key Validity ───────────────────────────────────────────────
echo "Step 1: Checking API key validity..."
echo "Endpoint: /agents/profile"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${API_KEY}" \
  https://www.moltbook.com/api/v1/agents/profile)

HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ API key is VALID${NC}"
    AGENT_NAME=$(echo "$BODY" | jq -r '.name // "unknown"' 2>/dev/null || echo "unknown")
    echo "  Agent: $AGENT_NAME"
    echo ""
else
    echo -e "${RED}✗ API key is INVALID or REVOKED (expected 200, got $HTTP_STATUS)${NC}"
    echo "  Fix: Rotate API key from https://www.moltbook.com dashboard"
    echo "  Then: Update .env with new key and restart services"
    exit 1
fi

# ─── Step 2: Agent Claim & Active Status ────────────────────────────────────
echo "Step 2: Checking agent claim and active status..."
echo "Endpoint: /agents/profile (claim info)"

IS_CLAIMED=$(echo "$BODY" | jq -r '.isclaimed // false' 2>/dev/null)
IS_ACTIVE=$(echo "$BODY" | jq -r '.isactive // false' 2>/dev/null)

echo "Claimed: $IS_CLAIMED"
echo "Active:  $IS_ACTIVE"

if [ "$IS_CLAIMED" != "true" ]; then
    echo -e "${RED}✗ Agent is NOT CLAIMED${NC}"
    echo "  Fix: Go to https://www.moltbook.com and claim this agent"
    exit 1
else
    echo -e "${GREEN}✓ Agent is claimed${NC}"
fi

if [ "$IS_ACTIVE" != "true" ]; then
    echo -e "${RED}✗ Agent is NOT ACTIVE (may be suspended)${NC}"
    echo "  Fix: Check https://www.moltbook.com dashboard for suspension reason"
    exit 1
else
    echo -e "${GREEN}✓ Agent is active${NC}"
fi

echo ""

# ─── Step 3: DM Feature Access ──────────────────────────────────────────────
echo "Step 3: Checking DM feature access..."
echo "Endpoint: /agents/dm/check"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${API_KEY}" \
  https://www.moltbook.com/api/v1/agents/dm/check)

HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ DM feature is AVAILABLE${NC}"
    HAS_ACTIVITY=$(echo "$BODY" | jq -r '.has_activity // false' 2>/dev/null)
    echo "  DM activity pending: $HAS_ACTIVITY"
    echo ""
    echo -e "${GREEN}✅ All checks passed — no issues detected${NC}"
    exit 0
elif [ "$HTTP_STATUS" = "403" ]; then
    echo -e "${RED}✗ DM access FORBIDDEN (403)${NC}"
    echo "  Possible causes:"
    echo "  1. Agent age: New agents (<24h) cannot use DM"
    echo "     Check created_at: $(echo "$BODY" | jq -r '.created_at // "unknown"' 2>/dev/null)"
    echo "  2. Account issue: Check dashboard for restrictions or bans"
    echo "  3. DM policy: Moltbook may have blocked DMs for this account"
    echo ""
    echo "  Try: Send a test DM from Moltbook web UI"
    echo "       If that works → proxy integration issue"
    echo "       If that fails → Moltbook policy issue"
    exit 1
else
    echo -e "${YELLOW}⚠ Unexpected HTTP status $HTTP_STATUS${NC}"
    echo "  Body: $BODY"
    exit 1
fi
