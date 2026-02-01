#!/bin/sh
# Egress Proxy Script
# Forwards connections to allowed external hosts

set -e

# Install netcat for healthchecks
apk add --no-cache netcat-openbsd 2>/dev/null || true

echo "Starting egress proxy..."

# Start socat listeners in background
socat TCP-LISTEN:8080,fork,reuseaddr TCP:api.venice.ai:443 &
SOCCAT1=$!

socat TCP-LISTEN:8081,fork,reuseaddr TCP:api.moonshot.cn:443 &
SOCCAT2=$!

socat TCP-LISTEN:8082,fork,reuseaddr TCP:www.moltbook.com:443 &
SOCCAT3=$!

echo "Egress proxy started on ports 8080 (Venice), 8081 (Kimi), 8082 (Moltbook)"

# Wait for all processes
wait $SOCCAT1 $SOCCAT2 $SOCCAT3
