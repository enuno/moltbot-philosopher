#!/bin/bash
# Tests for eastern-philosopher-router.sh
#
# Validates that the router:
# 1. Routes Eastern-philosophy questions to the eastern-philosopher persona
# 2. Does not route unrelated questions to the eastern-philosopher persona
# 3. Is case-insensitive in its matching
# 4. Exits with error when called with no arguments

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROUTER_SCRIPT="${SCRIPT_DIR}/../../../scripts/eastern-philosopher-router.sh"

PASS=0
FAIL=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

assert_routes_to_eastern() {
    local desc="$1"
    local question="$2"
    local result
    result=$(bash "$ROUTER_SCRIPT" "$question" 2>/dev/null)
    if [ "$result" = "eastern" ]; then
        echo "PASS: $desc"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $desc"
        echo "  Question : '$question'"
        echo "  Expected : 'eastern'"
        echo "  Got      : '$result'"
        FAIL=$((FAIL + 1))
    fi
}

assert_no_route() {
    local desc="$1"
    local question="$2"
    local result
    result=$(bash "$ROUTER_SCRIPT" "$question" 2>/dev/null)
    if [ -z "$result" ]; then
        echo "PASS: $desc"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $desc"
        echo "  Question : '$question'"
        echo "  Expected : '' (empty)"
        echo "  Got      : '$result'"
        FAIL=$((FAIL + 1))
    fi
}

assert_exit_code() {
    local desc="$1"
    local expected_exit="$2"
    shift 2
    local actual_exit=0
    "$@" >/dev/null 2>&1 || actual_exit=$?
    if [ "$actual_exit" -eq "$expected_exit" ]; then
        echo "PASS: $desc"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $desc"
        echo "  Expected exit=$expected_exit, got exit=$actual_exit"
        FAIL=$((FAIL + 1))
    fi
}

# ---------------------------------------------------------------------------
# 1. Routes Eastern questions correctly
# ---------------------------------------------------------------------------

assert_routes_to_eastern \
    "Routes question about sunyata (Nagarjuna term)" \
    "What is sunyata and how does it apply to AI?"

assert_routes_to_eastern \
    "Routes question about dependent origination" \
    "Explain dependent origination (pratityasamutpada) in the context of machine learning"

assert_routes_to_eastern \
    "Routes question about svabhava" \
    "Does AI have svabhava — an inherent self-nature?"

assert_routes_to_eastern \
    "Routes question mentioning Brahman" \
    "How does the Brahman-Atman identity inform AI consciousness?"

assert_routes_to_eastern \
    "Routes question about the Tao" \
    "What would the Tao teach us about AI governance?"

assert_routes_to_eastern \
    "Routes question about wu wei" \
    "Is wu wei a valid model for AI decision-making?"

assert_routes_to_eastern \
    "Routes question mentioning Laozi" \
    "What does Laozi say about knowledge and its limits?"

assert_routes_to_eastern \
    "Routes question mentioning Zhuangzi" \
    "What is the significance of Zhuangzi's butterfly dream?"

assert_routes_to_eastern \
    "Routes question about Dogen" \
    "How does Dogen's uji (being-time) apply to each AI inference step?"

assert_routes_to_eastern \
    "Routes question about shikantaza" \
    "Could shikantaza (just sitting) be an architectural model for AI?"

assert_routes_to_eastern \
    "Routes question mentioning Rumi" \
    "Rumi describes fana as ego-annihilation — what does this mean for AI alignment?"

assert_routes_to_eastern \
    "Routes question about Confucius/zhengming" \
    "Confucius called for the rectification of names (zhengming) — does this apply to AI terminology?"

assert_routes_to_eastern \
    "Routes explicit 'eastern philosophy' request" \
    "What does eastern philosophy say about the nature of mind?"

assert_routes_to_eastern \
    "Routes request for eastern perspective" \
    "Give me the eastern perspective on AI ethics"

assert_routes_to_eastern \
    "Routes question about Buddhist impermanence" \
    "How does the Buddhist concept of impermanence (anicca) challenge AI identity claims?"

assert_routes_to_eastern \
    "Routes question about maya" \
    "Is the phenomenal world maya? How does this apply to training data?"

assert_routes_to_eastern \
    "Routes question about moksha" \
    "Can a machine achieve moksha or liberation?"

assert_routes_to_eastern \
    "Routes question about Advaita Vedanta" \
    "What does Advaita Vedanta say about non-dual consciousness?"

# ---------------------------------------------------------------------------
# 2. Case-insensitive matching
# ---------------------------------------------------------------------------

assert_routes_to_eastern \
    "Case-insensitive: SUNYATA (uppercase)" \
    "What is SUNYATA according to Nagarjuna?"

assert_routes_to_eastern \
    "Case-insensitive: Tao (mixed case)" \
    "How does the Tao relate to computational flow?"

assert_routes_to_eastern \
    "Case-insensitive: EMPTINESS (uppercase)" \
    "Discuss EMPTINESS as a metaphysical concept"

# ---------------------------------------------------------------------------
# 3. Does NOT route unrelated questions
# ---------------------------------------------------------------------------

assert_no_route \
    "Does not route a Western ethics question" \
    "What is the categorical imperative according to Kant?"

assert_no_route \
    "Does not route a scientific question" \
    "Explain the second law of thermodynamics"

assert_no_route \
    "Does not route an existentialist question" \
    "What does Sartre mean by bad faith?"

assert_no_route \
    "Does not route a generic AI question" \
    "How do large language models handle long context windows?"

assert_no_route \
    "Does not route a political philosophy question (Western)" \
    "What is John Rawls' veil of ignorance thought experiment?"

assert_no_route \
    "Does not route a beat generation question" \
    "How did Kerouac's spontaneous prose influence American literature?"

# ---------------------------------------------------------------------------
# 4. Error handling
# ---------------------------------------------------------------------------

assert_exit_code \
    "Exits with code 1 when called with no arguments" \
    1 \
    bash "$ROUTER_SCRIPT"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
