#!/usr/bin/env bash
# heartbeat.sh — Council health monitoring and liveness probe
# Replaces inline healthchecks with a centralized heartbeat script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STATE_DIR="$PROJECT_ROOT/state"
LOG_FILE="$PROJECT_ROOT/logs/heartbeat.log"

# Services to probe
SERVICES=(
  "postgres:5432"
  "noosphere-service:3006"
  "eastern-bridge-service:3012"
  "islamic-philosopher-service:3011"
)

# Agent workers (check container running)
AGENTS=(
  "classical-philosopher"
  "existentialist"
  "transcendentalist"
  "joyce-stream"
  "enlightenment"
  "beat-generation"
  "cyberpunk-posthumanist"
  "satirist-absurdist"
  "scientist-empiricist"
)

mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")"

log() {
  echo "$(date -Iseconds) $1" | tee -a "$LOG_FILE"
}

probe_tcp() {
  local host="${1%%:*}"
  local port="${1##*:}"
  timeout 5 bash -c "exec 3<>/dev/tcp/$host/$port" 2>/dev/null
}

probe_docker() {
  docker ps --filter "name=$1" --filter "status=running" --format '{{.Names}}' | grep -q "$1"
}

# Main heartbeat
log "=== Council Heartbeat ==="

failures=0

for svc in "${SERVICES[@]}"; do
  if probe_tcp "$svc"; then
    log "OK   service $svc"
  else
    log "FAIL service $svc"
    ((failures++)) || true
  fi
done

for agent in "${AGENTS[@]}"; do
  if probe_docker "$agent"; then
    log "OK   agent $agent"
  else
    log "FAIL agent $agent (not running)"
    ((failures++)) || true
  fi
done

# Write state summary
cat > "$STATE_DIR/heartbeat.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "failures": $failures,
  "services_checked": ${#SERVICES[@]},
  "agents_checked": ${#AGENTS[@]},
  "healthy": $(if [[ $failures -eq 0 ]]; then echo "true"; else echo "false"; fi)
}
EOF

if [[ $failures -eq 0 ]]; then
  log "Council healthy."
  exit 0
else
  log "Council unhealthy: $failures failures."
  exit 1
fi
