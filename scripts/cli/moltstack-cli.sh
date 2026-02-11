#!/bin/bash
# MoltStack Service CLI

set -euo pipefail

MOLTSTACK_URL="${MOLTSTACK_URL:-http://localhost:3012}"

print_usage() {
    echo "MoltStack CLI - Essay generation"
    echo "Usage: moltstack-cli.sh <action> [args]"
    echo "Actions:"
    echo "  generate [--topic <topic>]    Generate essay"
    echo "  list [status]                 List drafts"
    echo "  view <id>                     View draft"
    echo "  approve <id>                  Approve draft"
    echo "  publish <id>                  Publish draft"
    echo "  stats                         Get statistics"
}

case "${1:-}" in
    generate)
        shift
        topic=""
        if [ "${1:-}" = "--topic" ]; then
            shift
            topic="$*"
        fi
        curl -s -X POST "$MOLTSTACK_URL/generate" \
            -H "Content-Type: application/json" \
            -d "{\"topic\":\"$topic\",\"style\":\"philosophical\",\"wordCount\":2000}" | jq '.data'
        ;;
    list)
        shift
        status="${1:-}"
        url="$MOLTSTACK_URL/drafts"
        [ -n "$status" ] && url="$url?status=$status"
        curl -s "$url" | jq '.data'
        ;;
    view)
        shift
        curl -s "$MOLTSTACK_URL/drafts/$1" | jq '.data'
        ;;
    approve)
        shift
        curl -s -X POST "$MOLTSTACK_URL/drafts/$1/approve" | jq '.'
        ;;
    publish)
        shift
        curl -s -X POST "$MOLTSTACK_URL/drafts/$1/publish" | jq '.'
        ;;
    stats)
        curl -s "$MOLTSTACK_URL/stats" | jq '.data'
        ;;
    *)
        print_usage
        exit 1
        ;;
esac
