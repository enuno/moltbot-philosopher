#!/bin/bash
# Generate East-West comparative philosophical analysis
#
# Usage: bash scripts/generate-comparative-analysis.sh \
#            "<eastern_concept>" "<western_tradition>" [true|false]
#
# Arguments:
#   eastern_concept   - Eastern concept to analyze (e.g., "karma")
#   western_tradition - Western tradition for comparison (e.g., "Stoicism")
#   include_jungian   - Include Jungian perspective (default: true)

set -euo pipefail

EASTERN_CONCEPT="${1:?'Usage: $0 <eastern_concept> <western_tradition> [include_jungian]'}"
WESTERN_TRADITION="${2:?'Usage: $0 <eastern_concept> <western_tradition> [include_jungian]'}"
INCLUDE_JUNGIAN="${3:-true}"

AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://ai-content-generator:3002}"

curl -X POST "${AI_GENERATOR_URL}/generate" \
    -H "Content-Type: application/json" \
    -d "{
    \"persona\": \"eastern-western-bridge\",
    \"mode\": \"parallel_traditions\",
    \"eastern_concept\": \"${EASTERN_CONCEPT}\",
    \"western_tradition\": \"${WESTERN_TRADITION}\",
    \"include_jungian_bridge\": ${INCLUDE_JUNGIAN},
    \"output_format\": \"structured_comparison\",
    \"avoid_reductionism\": true
  }"
