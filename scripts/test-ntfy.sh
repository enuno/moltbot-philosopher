#!/bin/bash
# Test script for NTFY integration
# Usage: ./test-ntfy.sh [type] [title] [message]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NTFY_SCRIPT="${SCRIPT_DIR}/notify-ntfy.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Moltbot-Philosopher NTFY Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if notify-ntfy.sh exists
if [ ! -f "$NTFY_SCRIPT" ]; then
    echo -e "${RED}✗ notify-ntfy.sh not found at $NTFY_SCRIPT${NC}"
    exit 1
fi

echo -e "${GREEN}✓ notify-ntfy.sh found${NC}"

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠ jq not found - some tests may fail${NC}"
fi

# Test 1: Check NTFY_ENABLED
echo ""
echo "Test 1: Checking NTFY_ENABLED..."
if [ "${NTFY_ENABLED:-false}" = "true" ]; then
    echo -e "${GREEN}✓ NTFY_ENABLED=true${NC}"
else
    echo -e "${YELLOW}⚠ NTFY_ENABLED=${NTFY_ENABLED:-not set}${NC}"
    echo "  Notifications will be skipped (expected in test mode)"
fi

# Test 2: Test each notification type
echo ""
echo "Test 2: Testing notification types..."

TYPES=("action" "error" "heartbeat" "security")
for type in "${TYPES[@]}"; do
    echo "  Testing $type notification..."
    if "$NTFY_SCRIPT" "$type" "Test $type" "This is a test $type notification from Moltbot" '{"tags":["test"]}'; then
        echo -e "    ${GREEN}✓ $type notification sent${NC}"
    else
        echo -e "    ${RED}✗ $type notification failed${NC}"
    fi
    sleep 1
done

# Test 3: Test with metadata
echo ""
echo "Test 3: Testing with metadata..."
"$NTFY_SCRIPT" "action" "Test with URL" "Click to view Moltbook" \
    '{"clickUrl":"https://moltbook.com","tags":["test","metadata"]}' && \
    echo -e "${GREEN}✓ Notification with metadata sent${NC}" || \
    echo -e "${RED}✗ Notification with metadata failed${NC}"

# Test 4: Test title truncation
echo ""
echo "Test 4: Testing title truncation (>100 chars)..."
LONG_TITLE="This is a very long title that exceeds the ntfy limit of 100 characters and should be truncated by the script automatically"
"$NTFY_SCRIPT" "action" "$LONG_TITLE" "Testing truncation" && \
    echo -e "${GREEN}✓ Long title handled${NC}" || \
    echo -e "${RED}✗ Long title handling failed${NC}"

# Test 5: Test disabled mode
echo ""
echo "Test 5: Testing disabled mode..."
if NTFY_ENABLED=false "$NTFY_SCRIPT" "action" "Should Skip" "This should be skipped"; then
    echo -e "${GREEN}✓ Disabled mode works correctly${NC}"
else
    echo -e "${RED}✗ Disabled mode had issues${NC}"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test Suite Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To view notifications, check:"
echo "  - Your ntfy app (topic: moltbot-philosopher)"
echo "  - Fallback logs: docker exec moltbot-ntfy-publisher tail /logs/ntfy-fallback.jsonl"
echo ""

# If in dry-run mode, remind user
if [ "${NTFY_ENABLED:-false}" != "true" ]; then
    echo -e "${YELLOW}Note: NTFY_ENABLED is not 'true' - notifications were logged but not sent${NC}"
    echo "To enable, set NTFY_ENABLED=true in your .env file"
fi
