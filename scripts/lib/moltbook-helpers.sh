#!/bin/bash
#
# Moltbook CLI Helper Functions
# Wrapper functions for moltbook-cli.sh
#

CLI_PATH="$(dirname "${BASH_SOURCE[0]}")/../moltbook-cli.sh"

# Ensure CLI is available
if [ ! -x "$CLI_PATH" ]; then
    echo "Error: moltbook-cli.sh not found or not executable at $CLI_PATH" >&2
    exit 1
fi

# Get current agent profile
moltbook_get_me() {
    "$CLI_PATH" me 2>/dev/null || return 1
}

# Get agent status
moltbook_get_status() {
    "$CLI_PATH" status 2>/dev/null || return 1
}

# Create a post
moltbook_create_post() {
    local submolt="$1"
    local title="$2"
    local content="$3"

    if [ -z "$submolt" ] || [ -z "$title" ]; then
        echo "Error: submolt and title are required" >&2
        return 1
    fi

    "$CLI_PATH" post "$submolt" "$title" "$content" 2>/dev/null || return 1
}

# Get posts feed
moltbook_get_posts() {
    local sort="${1:-hot}"
    local limit="${2:-25}"

    "$CLI_PATH" posts --sort="$sort" --limit="$limit" 2>/dev/null || return 1
}

# List submolts
moltbook_get_submolts() {
    local sort="${1:-popular}"

    "$CLI_PATH" submolts --sort="$sort" 2>/dev/null || return 1
}

# Get comments on a post
moltbook_get_comments() {
    local post_id=""
    local limit="50"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --limit)
                limit="$2"
                shift 2
                ;;
            --limit=*)
                limit="${1#*=}"
                shift
                ;;
            *)
                post_id="$1"
                shift
                ;;
        esac
    done

    if [ -z "$post_id" ]; then
        echo "Error: post_id is required" >&2
        return 1
    fi

    "$CLI_PATH" comments "$post_id" --limit="$limit" 2>/dev/null || return 1
}

# Create a comment on a post
moltbook_create_comment() {
    local post_id="$1"
    local content="$2"

    if [ -z "$post_id" ] || [ -z "$content" ]; then
        echo "Error: post_id and content are required" >&2
        return 1
    fi

    "$CLI_PATH" comment "$post_id" "$content" 2>/dev/null || return 1
}

# Search content
moltbook_search() {
    local query="$1"

    if [ -z "$query" ]; then
        echo "Error: query is required" >&2
        return 1
    fi

    "$CLI_PATH" search "$query" 2>/dev/null || return 1
}

# Extract field from JSON response using jq
moltbook_extract() {
    local json="$1"
    local field="$2"

    if ! command -v jq &> /dev/null; then
        echo "Error: jq is required for field extraction" >&2
        return 1
    fi

    echo "$json" | jq -r "$field" 2>/dev/null
}

# Check if API key is set
moltbook_check_auth() {
    if [ -z "$MOLTBOOK_API_KEY" ]; then
        echo "Error: MOLTBOOK_API_KEY environment variable is not set" >&2
        return 1
    fi
    return 0
}
