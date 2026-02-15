#!/bin/bash
#
# Moltbook API Wrapper with Proxy Fallback
#
# Provides resilient API calls that:
# 1. Try egress proxy first (auto-solves challenges)
# 2. Fall back to direct API with manual challenge handling if proxy fails
#
# Usage:
#   source scripts/moltbook-api-wrapper.sh
#   moltbook_api_call GET "/agents/me"
#   moltbook_api_call POST "/posts" '{"content":"Hello"}'

# Configuration
MOLTBOOK_API_BASE="${MOLTBOOK_API_BASE:-http://localhost:8082/api/v1}"
MOLTBOOK_DIRECT_API="${MOLTBOOK_DIRECT_API:-https://www.moltbook.com/api/v1}"
MOLTBOOK_API_KEY="${MOLTBOOK_API_KEY:-}"
PROXY_TIMEOUT="${PROXY_TIMEOUT:-10}"
FALLBACK_ENABLED="${MOLTBOOK_FALLBACK_ENABLED:-true}"

# Script directory for sourcing challenge handler
#WRAPPER_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if proxy is available
check_proxy_health() {
    local proxy_host
    proxy_host=$(echo "$MOLTBOOK_API_BASE" | sed -E 's|https?://([^:/]+).*|\1|')
    local proxy_port
    proxy_port=$(echo "$MOLTBOOK_API_BASE" | sed -E 's|https?://[^:]+:([0-9]+).*|\1|')

    # If no port extracted, default based on protocol
    if [[ "$proxy_port" == "$MOLTBOOK_API_BASE" ]]; then
        if [[ "$MOLTBOOK_API_BASE" =~ ^https:// ]]; then
            proxy_port=443
        else
            proxy_port=80
        fi
    fi

    # Quick connection test (1 second timeout)
    timeout 1 bash -c "echo > /dev/tcp/${proxy_host}/${proxy_port}" 2>/dev/null
    return $?
}

# Solve verification challenge using AI generator
solve_verification_challenge() {
    local challenge_text="$1"
    local ai_generator_url="${AI_GENERATOR_URL:-http://localhost:3002}"

    # Generate solution using AI
    local solution
    solution=$(curl -s -X POST "${ai_generator_url}/generate" \
        -H "Content-Type: application/json" \
        -d "{
            \"topic\": \"${challenge_text}\",
            \"contentType\": \"answer\",
            \"persona\": \"direct\",
            \"customPrompt\": \"Answer this question directly and concisely: ${challenge_text}\",
            \"maxTokens\": 100
        }" 2>/dev/null | jq -r '.content // empty' 2>/dev/null)

    if [ -z "$solution" ]; then
        return 1
    fi

    echo "$solution"
    return 0
}

# Submit challenge answer
submit_challenge_answer() {
    local challenge_id="$1"
    local answer="$2"

    curl -s -X POST "${MOLTBOOK_DIRECT_API}/agents/verification/submit" \
        -H "Authorization: Bearer ${MOLTBOOK_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"challengeId\":\"${challenge_id}\",\"answer\":\"${answer}\"}"
}

# Main API call function with fallback
moltbook_api_call() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local use_fallback="${4:-$FALLBACK_ENABLED}"

    # Build curl arguments
    local curl_args=(
        -s
        -X "$method"
        -H "Authorization: Bearer ${MOLTBOOK_API_KEY}"
        -H "Content-Type: application/json"
        -H "User-Agent: moltbot-philosopher/2.6"
        --max-time "$PROXY_TIMEOUT"
    )

    [ -n "$data" ] && curl_args+=(-d "$data")

    # Try proxy first
    local response
    local http_code

    response=$(curl "${curl_args[@]}" -w "\n%{http_code}" "${MOLTBOOK_API_BASE}${endpoint}" 2>/dev/null || echo -e "\n000")
    http_code=$(echo "$response" | tail -n 1)
    response=$(echo "$response" | sed '$d')

    # Check if proxy request succeeded
    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
        echo "$response"
        return 0
    fi

    # If proxy failed and fallback is disabled, return error
    if [ "$use_fallback" != "true" ]; then
        echo "$response"
        return 1
    fi

    # Log proxy failure
    >&2 echo "[WARN] Proxy failed (HTTP $http_code), falling back to direct API"

    # Try direct API with challenge handling
    response=$(curl "${curl_args[@]}" -w "\n%{http_code}" "${MOLTBOOK_DIRECT_API}${endpoint}" 2>/dev/null || echo -e "\n000")
    http_code=$(echo "$response" | tail -n 1)
    response=$(echo "$response" | sed '$d')

    # Check if it's a challenge
    if echo "$response" | jq -e '.challenge' >/dev/null 2>&1; then
        >&2 echo "[INFO] Verification challenge detected, attempting to solve..."

        local challenge_id
        local challenge_text
        challenge_id=$(echo "$response" | jq -r '.challenge.id')
        challenge_text=$(echo "$response" | jq -r '.challenge.puzzle.question')

        # Solve challenge
        local answer
        if answer=$(solve_verification_challenge "$challenge_text"); then
            >&2 echo "[INFO] Challenge solved, submitting answer..."

            # Submit answer
            local submit_response
            submit_response=$(submit_challenge_answer "$challenge_id" "$answer")

            if echo "$submit_response" | jq -e '.verified' >/dev/null 2>&1; then
                >&2 echo "[SUCCESS] Challenge passed, retrying original request..."

                # Retry original request
                response=$(curl "${curl_args[@]}" -w "\n%{http_code}" "${MOLTBOOK_DIRECT_API}${endpoint}" 2>/dev/null || echo -e "\n000")
                http_code=$(echo "$response" | tail -n 1)
                response=$(echo "$response" | sed '$d')

                if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
                    echo "$response"
                    return 0
                fi
            else
                >&2 echo "[ERROR] Challenge verification failed"
            fi
        else
            >&2 echo "[ERROR] Failed to solve challenge"
        fi
    fi

    # Return response (success or failure)
    echo "$response"
    [[ "$http_code" =~ ^2[0-9][0-9]$ ]] && return 0 || return 1
}

# Convenience functions for common operations
moltbook_get() {
    moltbook_api_call GET "$1" "" "${2:-$FALLBACK_ENABLED}"
}

moltbook_post() {
    moltbook_api_call POST "$1" "$2" "${3:-$FALLBACK_ENABLED}"
}

moltbook_put() {
    moltbook_api_call PUT "$1" "$2" "${3:-$FALLBACK_ENABLED}"
}

moltbook_delete() {
    moltbook_api_call DELETE "$1" "" "${2:-$FALLBACK_ENABLED}"
}

# Export functions for use in other scripts
export -f moltbook_api_call
export -f moltbook_get
export -f moltbook_post
export -f moltbook_put
export -f moltbook_delete
export -f check_proxy_health
