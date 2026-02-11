#!/bin/bash
#
# Test Moltbot Services
# Integration test suite for all services
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

test_service() {
    local url=$2
    local test_desc=$3

    echo -ne "${BLUE}Testing:${NC} $test_desc... "

    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        ((FAIL++))
        return 1
    fi
}

test_json_response() {
    local url=$2
    local test_desc=$3
    local expected_field=$4

    echo -ne "${BLUE}Testing:${NC} $test_desc... "

    response=$(curl -s "$url")

    if echo "$response" | jq -e "$expected_field" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}FAIL${NC} (missing field: $expected_field)"
        ((FAIL++))
        return 1
    fi
}

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Moltbot Service Integration Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"

# Health checks
echo -e "${BLUE}[1/4] Health Checks${NC}\n"
test_service "orchestrator" "http://localhost:3006/health" "Agent Orchestrator health"
test_service "event-listener" "http://localhost:3007/health" "Event Listener health"
test_service "verification" "http://localhost:3008/health" "Verification Service health"
test_service "engagement" "http://localhost:3009/health" "Engagement Service health"
test_service "council" "http://localhost:3010/health" "Council Service health"
test_service "noosphere" "http://localhost:3011/health" "Noosphere Service health"
test_service "moltstack" "http://localhost:3012/health" "MoltStack Service health"

# Agent initialization
echo -e "\n${BLUE}[2/4] Agent Initialization${NC}\n"
test_json_response "agents" "http://localhost:3006/agents" "9 agents initialized" ".agents | length"

# Service-specific tests
echo -e "\n${BLUE}[3/4] Service-Specific Tests${NC}\n"
test_json_response "verification-stats" "http://localhost:3008/stats" "Verification stats" ".success"
test_json_response "engagement-stats" "http://localhost:3009/stats" "Engagement stats" ".success"
test_json_response "council-codex" "http://localhost:3010/codex" "Council codex" ".success"
test_json_response "noosphere-stats" "http://localhost:3011/stats" "Noosphere stats" ".success.data"
test_json_response "moltstack-stats" "http://localhost:3012/stats" "MoltStack stats" ".success"

# Memory operations
echo -e "\n${BLUE}[4/4] Memory Operations${NC}\n"
test_memory_add=$(curl -s -X POST http://localhost:3011/memory \
    -H "Content-Type: application/json" \
    -d '{"content":"Test memory","confidence":0.8,"source":"test","tags":["test"]}')

if echo "$test_memory_add" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${BLUE}Testing:${NC} Add memory to Noosphere... ${GREEN}PASS${NC}"
    ((PASS++))
else
    echo -e "${BLUE}Testing:${NC} Add memory to Noosphere... ${RED}FAIL${NC}"
    ((FAIL++))
fi

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Passed:${NC} $PASS"
echo -e "${RED}Failed:${NC} $FAIL"
echo -e "${BLUE}Total:${NC}  $((PASS + FAIL))\n"

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}\n"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}\n"
    exit 1
fi
