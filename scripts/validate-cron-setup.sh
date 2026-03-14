#!/bin/bash
#
# Moltbot Cron Setup Validation Script
# Verifies all requirements are met before cron jobs start running
#
# Usage: bash scripts/validate-cron-setup.sh
#

set -euo pipefail

# Configuration
REPO_ROOT="${HOME}/.moltbot"
ENV_FILE="$REPO_ROOT/.env"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Track failures
FAILURES=0

# Start validation
log_section "Moltbot Cron Setup Validation"

# 1. Check repository exists
log_info "Checking repository..."
if [ -d "$REPO_ROOT" ]; then
    log_success "Repository found at $REPO_ROOT"
else
    log_error "Repository not found at $REPO_ROOT"
    ((FAILURES++))
fi

# 2. Check scripts exist
log_section "Checking Scripts"

required_scripts=(
    "scripts/db-backup.sh"
    "scripts/commit-persona-changes.sh"
    "scripts/setup-cron-jobs.sh"
)

for script in "${required_scripts[@]}"; do
    if [ -f "$REPO_ROOT/$script" ]; then
        if [ -x "$REPO_ROOT/$script" ]; then
            log_success "$script exists and is executable"
        else
            log_error "$script exists but is not executable"
            log_info "Fix: chmod +x $REPO_ROOT/$script"
            ((FAILURES++))
        fi
    else
        log_error "$script not found"
        ((FAILURES++))
    fi
done

# 3. Check environment variables
log_section "Checking Environment Variables"

if [ -f "$ENV_FILE" ]; then
    log_success ".env file found"

    if grep -q "VENICE_API_KEY" "$ENV_FILE"; then
        if grep -q "VENICE_API_KEY=[^=]" "$ENV_FILE"; then
            log_success "VENICE_API_KEY is configured"
            venice_key=$(grep "VENICE_API_KEY=" "$ENV_FILE" | cut -d'=' -f2 | head -c 10)
            log_info "API key starts with: ${venice_key}..."
        else
            log_error "VENICE_API_KEY is empty"
            ((FAILURES++))
        fi
    else
        log_warning "VENICE_API_KEY not found in .env"
        log_info "Add: echo 'VENICE_API_KEY=your_key_here' >> $ENV_FILE"
        ((FAILURES++))
    fi
else
    log_error ".env file not found at $ENV_FILE"
    ((FAILURES++))
fi

# 4. Check Git configuration
log_section "Checking Git Configuration"

git_user=$(git config --global user.name 2>/dev/null || echo "")
git_email=$(git config --global user.email 2>/dev/null || echo "")

if [ -n "$git_user" ]; then
    log_success "Git user configured: $git_user"
else
    log_warning "Git user not configured"
    log_info "Configure: git config --global user.name 'Moltbot'"
fi

if [ -n "$git_email" ]; then
    log_success "Git email configured: $git_email"
else
    log_warning "Git email not configured"
    log_info "Configure: git config --global user.email 'moltbot@philosophers.local'"
fi

# 5. Check Git credentials
log_section "Checking Git Credentials"

cd "$REPO_ROOT"

# Try to check if git push would work (without actually pushing)
if git ls-remote origin main > /dev/null 2>&1; then
    log_success "Can connect to git remote (origin)"
else
    log_warning "Cannot verify git remote access"
    log_info "This will be tested at first cron job execution"
fi

# 6. Check Venice.AI connectivity
log_section "Checking Venice.AI Connectivity"

if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE" 2>/dev/null || true

    if [ -n "${VENICE_API_KEY:-}" ]; then
        log_info "Testing Venice.AI API..."

        response=$(curl -s -X POST https://api.venice.ai/v1/chat/completions \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $VENICE_API_KEY" \
          -d '{"model":"gpt-4o","messages":[{"role":"user","content":"test"}],"max_tokens":10}' 2>&1 || echo "")

        if echo "$response" | grep -q "choices"; then
            log_success "Venice.AI API is responding correctly"
        elif echo "$response" | grep -q "invalid_api_key\|unauthorized"; then
            log_error "Venice.AI API key is invalid"
            ((FAILURES++))
        else
            log_warning "Could not verify Venice.AI (may be network issue)"
            log_info "Response: ${response:0:100}..."
        fi
    else
        log_warning "VENICE_API_KEY not set - skipping Venice.AI test"
    fi
else
    log_warning "Cannot test Venice.AI - .env file not found"
fi

# 7. Check cron jobs
log_section "Checking Cron Jobs"

if crontab -l 2>/dev/null | grep -q "moltbot-backup"; then
    log_success "Database backup cron job installed"
else
    log_warning "Database backup cron job not found"
    log_info "Run: bash scripts/setup-cron-jobs.sh"
fi

if crontab -l 2>/dev/null | grep -q "commit-persona"; then
    log_success "Persona commit cron job installed"
else
    log_warning "Persona commit cron job not found"
    log_info "Run: bash scripts/setup-cron-jobs.sh"
fi

# 8. Check log files
log_section "Checking Log Files"

log_files=(
    "/var/log/moltbot-backup.log"
    "/var/log/moltbot-persona-commit.log"
)

for log in "${log_files[@]}"; do
    if [ -f "$log" ]; then
        if [ -w "$log" ]; then
            log_success "Log file writable: $log"
        else
            log_warning "Log file exists but not writable: $log"
            log_info "Fix: sudo chmod 666 $log"
        fi
    else
        log_warning "Log file not created yet: $log (will be created on first run)"
    fi
done

# 9. Summary
log_section "Validation Summary"

if [ $FAILURES -eq 0 ]; then
    log_success "All checks passed!"
    echo ""
    log_info "Your setup is ready for cron jobs."
    log_info "Next steps:"
    log_info "  1. Verify your .env has VENICE_API_KEY"
    log_info "  2. Run: bash scripts/setup-cron-jobs.sh"
    log_info "  3. Monitor: tail -f /var/log/moltbot-persona-commit.log"
    exit 0
else
    log_error "Validation found $FAILURES issue(s)"
    echo ""
    log_info "Before running cron jobs, fix the issues above."
    log_info "Then run validation again:"
    log_info "  bash scripts/validate-cron-setup.sh"
    exit 1
fi
