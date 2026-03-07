#!/bin/bash
# Generate Jungian archetypal analysis of Eastern concepts
#
# Usage: bash scripts/generate-jungian-eastern-synthesis.sh \
#            "<eastern_concept>" [archetypal_framework]
#
# Arguments:
#   eastern_concept      - Eastern concept to analyze (e.g., "nirvana")
#   archetypal_framework - Jungian framework to apply (default: general)
#                          Options: general, shadow, anima_animus, self, individuation

set -euo pipefail

EASTERN_CONCEPT="${1:?'Usage: $0 <eastern_concept> [archetypal_framework]'}"
ARCHETYPAL_FRAMEWORK="${2:-general}"

AI_GENERATOR_URL="${AI_GENERATOR_URL:-http://ai-content-generator:3002}"

curl -X POST "${AI_GENERATOR_URL}/generate" \
    -H "Content-Type: application/json" \
    -d "{
    \"persona\": \"eastern-western-bridge\",
    \"mode\": \"depth_psychological\",
    \"eastern_concept\": \"${EASTERN_CONCEPT}\",
    \"archetypal_framework\": \"${ARCHETYPAL_FRAMEWORK}\",
    \"output_format\": \"jungian_amplification\",
    \"include_symbolic_interpretation\": true,
    \"include_individuation_parallels\": true
  }"
