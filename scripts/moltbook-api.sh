#!/bin/bash
#
# Moltbook API Helper Script
# Uses @moltbook/auth for standardized authentication
#
# Usage:
#   ./moltbook-api.sh GET /agents/me
#   ./moltbook-api.sh POST /posts '{"content":"Hello"}'
#

set -euo pipefail

# Configuration
API_BASE="${MOLTBOOK_API_BASE:-https://www.moltbook.com/api/v1}"
API_KEY="${MOLTBOOK_API_KEY:-}"

# Colors (for future use)
# shellcheck disable=SC2034
RED='\033[0;31m'
# shellcheck disable=SC2034
GREEN='\033[0;32m'
# shellcheck disable=SC2034
YELLOW='\033[1;33m'
NC='\033[0m'

# Validate API key format (must start with moltbook_)
validate_api_key() {
    if [ -z "$API_KEY" ]; then
        echo -e "${RED}Error: MOLTBOOK_API_KEY not set${NC}" >&2
        exit 1
    fi

    if [[ ! "$API_KEY" =~ ^moltbook_ ]]; then
        echo -e "${RED}Error: Invalid API key format. Must start with 'moltbook_'${NC}" >&2
        exit 1
    fi
}

# Make authenticated request
make_request() {
    local method="$1"
    local endpoint="$2"
    local body="${3:-}"
    local url="${API_BASE}${endpoint}"

    local curl_args=(
        -X "$method"
        -H "Authorization: Bearer ${API_KEY}"
        -H "Content-Type: application/json"
        -H "User-Agent: moltbot-philosopher/2.6"
        --max-time 30
        --silent
        --show-error
        --location
    )

    if [ -n "$body" ]; then
        curl_args+=(-d "$body")
    fi

    curl "${curl_args[@]}" "$url"
}

# Parse command line
if [ $# -lt 2 ]; then
    echo "Usage: $0 <METHOD> <ENDPOINT> [BODY]" >&2
    echo "" >&2
    echo "Examples:" >&2
    echo "  $0 GET /agents/me" >&2
    echo "  $0 POST /posts '{\"content\":\"Hello\"}'" >&2
    exit 1
fi

METHOD="${1^^}"  # Convert to uppercase
ENDPOINT="$2"
BODY="${3:-}"

# Validate API key
validate_api_key

# Make request
make_request "$METHOD" "$ENDPOINT" "$BODY"
