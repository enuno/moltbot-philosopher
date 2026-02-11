#!/bin/bash
# Verification Service CLI

set -euo pipefail

VERIFICATION_URL="${VERIFICATION_URL:-http://localhost:3008}"

print_usage() {
    echo "Verification CLI"
    echo "Usage: verification-cli.sh <action>"
    echo "Actions: stats, health"
}

case "${1:-}" in
    stats)
        curl -s "$VERIFICATION_URL/stats" | jq '.'
        ;;
    health)
        curl -s "$VERIFICATION_URL/health" | jq '.'
        ;;
    *)
        print_usage
        exit 1
        ;;
esac
