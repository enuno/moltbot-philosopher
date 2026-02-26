#!/bin/bash
# cov-monitor.sh - Coefficient of Variation monitor for post timing
#
# Moltbook detects autonomous agents when inter-post interval CoV < 0.5.
# We alert at CoV < 0.4 to give headroom before the platform threshold.
#
# ⚡ PHASE 2 RATE LIMITING
# This script complements P2.4 rate limiting by detecting temporal patterns.
# CoV monitoring ensures posts appear natural (not metronomic). For engagement metrics:
#   curl http://localhost:3010/stats | jq '.summary.rate_limiting'
#   ./engagement-stats.sh --follow (live monitoring of posting patterns)
#
# Usage: cov-monitor.sh <state-file>
# Exit codes: 0 = OK, 1 = CoV warning (too regular), 2 = error
# Output: "COV_OK:<value>", "COV_WARNING:<value>", or "INSUFFICIENT_DATA"
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <state-file>" >&2
  exit 2
fi

STATE_FILE="$1"
COV_THRESHOLD="${COV_THRESHOLD:-0.4}"

if [ ! -f "$STATE_FILE" ]; then
  echo "INSUFFICIENT_DATA"
  exit 0
fi

# Extract post_timestamps JSON array using grep+awk (no jq required).
# Handles both compact and pretty-printed JSON.
TIMESTAMPS=$(grep -o '"post_timestamps":[[:space:]]*\[[^]]*\]' "$STATE_FILE" 2>/dev/null | \
  grep -o '\[[^]]*\]' | \
  grep -oE '"[0-9T:Z.+-]+"' | \
  tr -d '"' || true)

if [ -z "$TIMESTAMPS" ]; then
  echo "INSUFFICIENT_DATA"
  exit 0
fi

TIMESTAMP_COUNT=$(echo "$TIMESTAMPS" | wc -l)
if [ "$TIMESTAMP_COUNT" -lt 3 ]; then
  echo "INSUFFICIENT_DATA"
  exit 0
fi

# Convert ISO timestamps to epoch seconds (using date -d on Linux)
EPOCHS=""
while IFS= read -r ts; do
  epoch=$(date -d "$ts" +%s 2>/dev/null || echo "")
  if [ -n "$epoch" ]; then
    EPOCHS="$EPOCHS $epoch"
  fi
done <<< "$TIMESTAMPS"

EPOCH_COUNT=$(echo "$EPOCHS" | wc -w)
if [ "$EPOCH_COUNT" -lt 3 ]; then
  echo "INSUFFICIENT_DATA"
  exit 0
fi

# Compute intervals and CoV using awk
COV_RESULT=$(echo "$EPOCHS" | awk '{
  # Parse epoch values into array
  n = split($0, epochs)
  if (n < 3) {
    print "INSUFFICIENT"
    exit 0
  }

  # Sort epochs (simple bubble sort for small n)
  for (i = 1; i <= n; i++)
    for (j = i+1; j <= n; j++)
      if (epochs[i] > epochs[j]) {
        tmp = epochs[i]; epochs[i] = epochs[j]; epochs[j] = tmp
      }

  # Compute intervals
  m = n - 1
  sum = 0
  for (i = 1; i <= m; i++) {
    intervals[i] = epochs[i+1] - epochs[i]
    sum += intervals[i]
  }

  mean = sum / m
  if (mean == 0) {
    print "COV_WARNING:0.00"
    exit 0
  }

  # Compute standard deviation
  sq_sum = 0
  for (i = 1; i <= m; i++) {
    sq_sum += (intervals[i] - mean)^2
  }
  stddev = sqrt(sq_sum / m)
  cov = stddev / mean

  printf "%.4f\n", cov
}')

if [ "$COV_RESULT" = "INSUFFICIENT" ]; then
  echo "INSUFFICIENT_DATA"
  exit 0
fi

# Compare CoV to threshold using awk (bash can't do float comparisons)
IS_WARNING=$(awk -v cov="$COV_RESULT" -v thresh="$COV_THRESHOLD" 'BEGIN { print (cov < thresh) ? "1" : "0" }')

if [ "$IS_WARNING" = "1" ]; then
  echo "COV_WARNING:$COV_RESULT"
  exit 1
else
  echo "COV_OK:$COV_RESULT"
  exit 0
fi
