#!/bin/bash
set -euo pipefail

# Setup Moltstack Automation - Install cron jobs and configure services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() {
  echo -e "[${BLUE}INFO${NC}] $*"
}

success() {
  echo -e "[${GREEN}SUCCESS${NC}] $*"
}

warn() {
  echo -e "[${YELLOW}WARN${NC}] $*"
}

# Check if running in correct directory
if [ ! -f "$REPO_ROOT/package.json" ]; then
  echo "Error: Must run from moltbot-philosopher repository"
  exit 1
fi

info "Setting up Moltstack automation..."
info "Repository: $REPO_ROOT"

# 1. Setup weekly essay generation cron job
info ""
info "=== Weekly Essay Generation ==="
info "Adding cron job for Sundays at 10:00 AM..."

CRON_CMD="0 10 * * 0 cd $REPO_ROOT && bash scripts/moltstack-heartbeat.sh >> logs/moltstack-heartbeat.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "moltstack-heartbeat.sh"; then
  warn "Cron job already exists for moltstack-heartbeat.sh"
else
  # Add to crontab
  (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
  success "✅ Added weekly essay generation cron job (Sundays 10 AM)"
fi

# 2. Setup NTFY service check
info ""
info "=== NTFY Service Configuration ==="

if [ -z "${NTFY_URL:-}" ]; then
  warn "NTFY_URL not set in environment"
  info "To enable notifications, add to .env:"
  info "  NTFY_URL=https://ntfy.sh/your-topic"
  info "  NTFY_API_KEY=your_api_key (optional)"
else
  info "NTFY_URL configured: $NTFY_URL"

  # Test NTFY
  if bash "$SCRIPT_DIR/notify-ntfy.sh" "Moltstack automation setup complete" "info" "moltstack,setup" 2>/dev/null; then
    success "✅ NTFY service working"
  else
    warn "NTFY service may not be working properly"
  fi
fi

# 3. Create monitoring dashboard
info ""
info "=== Monitoring Setup ==="

# Ensure logs directory exists
mkdir -p "$REPO_ROOT/logs"

# Create monitoring script
cat > "$SCRIPT_DIR/monitor-moltstack-status.sh" << 'EOF'
#!/bin/bash
# Moltstack Status Monitor - Quick health check

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-$REPO_ROOT/workspace/classical}"

echo "📊 Moltstack Status Monitor"
echo "=========================="
echo ""

# Heartbeat status
if [ -f "$WORKSPACE_DIR/moltstack/heartbeat-state.json" ]; then
  echo "🔄 Heartbeat Status:"
  jq -r '"  Last Run: " + (.last_run | tostring | if . == "null" then "never" else . end) +
         "\n  Total Runs: " + (.total_runs | tostring) +
         "\n  Total Generated: " + (.total_generated | tostring) +
         "\n  Consecutive Failures: " + (.consecutive_failures | tostring)' \
    "$WORKSPACE_DIR/moltstack/heartbeat-state.json"
  echo ""
fi

# Generation state
if [ -f "$WORKSPACE_DIR/moltstack/generation-state.json" ]; then
  echo "📝 Generation State:"
  jq -r '"  Total Generated: " + (.total_generated | tostring) +
         "\n  Last Philosopher: " + (.last_philosopher_index | tostring)' \
    "$WORKSPACE_DIR/moltstack/generation-state.json"
  echo ""
fi

# Publication state
if [ -f "$WORKSPACE_DIR/moltstack/state.json" ]; then
  echo "📚 Publication State:"
  jq -r '"  Article Count: " + (.article_count | tostring) +
         "\n  Last Published: " + (.last_published // "never")' \
    "$WORKSPACE_DIR/moltstack/state.json"
  echo ""
fi

# Recent archives
echo "📦 Recent Archives:"
if [ -d "$REPO_ROOT/memory/moltstack-archive" ]; then
  find "$REPO_ROOT/memory/moltstack-archive" -name "*-metadata.json" -type f -mtime -30 | \
    while read -r file; do
      echo "  - $(jq -r '.title' "$file") ($(jq -r '.date' "$file"))"
    done | head -5
else
  echo "  No archives found"
fi

echo ""
echo "✅ Status check complete"
EOF

chmod +x "$SCRIPT_DIR/monitor-moltstack-status.sh"
success "✅ Created monitoring script: scripts/monitor-moltstack-status.sh"

# 4. Setup log rotation
info ""
info "=== Log Rotation ==="

if [ -f /etc/logrotate.d/moltbot-philosopher ]; then
  warn "Logrotate config already exists"
else
  info "Creating logrotate configuration..."

  cat > /tmp/moltbot-logrotate << EOF
$REPO_ROOT/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $(whoami) $(whoami)
}
EOF

  info "To enable log rotation, run:"
  info "  sudo mv /tmp/moltbot-logrotate /etc/logrotate.d/moltbot-philosopher"
  info "  sudo chown root:root /etc/logrotate.d/moltbot-philosopher"
  info "  sudo chmod 644 /etc/logrotate.d/moltbot-philosopher"
fi

# 5. Test heartbeat
info ""
info "=== Testing Heartbeat ==="
info "Running heartbeat status check..."

if bash "$SCRIPT_DIR/moltstack-heartbeat.sh" --status; then
  success "✅ Heartbeat working"
else
  warn "Heartbeat may have issues"
fi

# Summary
echo ""
echo "================================================"
echo "✅ Moltstack Automation Setup Complete!"
echo "================================================"
echo ""
echo "📋 Installed Components:"
echo "  ✓ Weekly essay generation (Sundays 10 AM)"
echo "  ✓ Status monitoring script"
echo "  ✓ Log rotation configuration (pending sudo)"
echo ""
echo "🔍 Quick Commands:"
echo "  Monitor status:     ./scripts/monitor-moltstack-status.sh"
echo "  Heartbeat status:   ./scripts/moltstack-heartbeat.sh --status"
echo "  Force generation:   ./scripts/moltstack-heartbeat.sh --force"
echo "  View cron jobs:     crontab -l | grep moltstack"
echo ""
echo "📊 Logs Directory:"
echo "  $REPO_ROOT/logs/"
echo ""
echo "🔔 NTFY Notifications:"
if [ -z "${NTFY_URL:-}" ]; then
  echo "  ⚠️  Not configured (set NTFY_URL in .env)"
else
  echo "  ✓ Configured: $NTFY_URL"
fi
echo ""
