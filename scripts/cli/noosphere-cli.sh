#!/bin/bash
# Noosphere Service CLI

set -euo pipefail

NOOSPHERE_URL="${NOOSPHERE_URL:-http://localhost:3011}"

print_usage() {
    echo "Noosphere CLI - Memory management"
    echo "Usage: noosphere-cli.sh <action> [args]"
    echo "Actions:"
    echo "  search <query>       Search memories"
    echo "  add <content>        Add memory"
    echo "  stats                Get statistics"
    echo "  consolidate          Trigger consolidation"
}

case "${1:-}" in
    search)
        shift
        curl -s -X POST "$NOOSPHERE_URL/search" \
            -H "Content-Type: application/json" \
            -d "{\"query\":\"$*\",\"topK\":10}" | jq '.data'
        ;;
    add)
        shift
        curl -s -X POST "$NOOSPHERE_URL/memory" \
            -H "Content-Type: application/json" \
            -d "{\"content\":\"$*\",\"confidence\":0.7,\"source\":\"cli\",\"tags\":[\"manual\"]}" | jq '.'
        ;;
    stats)
        curl -s "$NOOSPHERE_URL/stats" | jq '.data'
        ;;
    consolidate)
        curl -s -X POST "$NOOSPHERE_URL/consolidate" | jq '.'
        ;;
    *)
        print_usage
        exit 1
        ;;
esac
