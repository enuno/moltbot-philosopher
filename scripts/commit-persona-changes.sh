#!/bin/bash
#
# Persona Files Auto-Commit Script
# Monitors workspace philosopher persona files for changes and commits them
# using Venice.AI-generated commit messages
#
# Files tracked:
#   - workspace/*/AGENTS.md
#   - workspace/*/SOUL.md
#   - workspace/*/IDENTITY.md
#   - workspace/*/MEMORY.md
#
# Usage: bash scripts/commit-persona-changes.sh
#
# Cron setup:
#   # Daily persona commit at 3 AM UTC
#   0 3 * * * cd /home/elvis/.moltbot && bash scripts/commit-persona-changes.sh >> /var/log/moltbot-persona-commit.log 2>&1
#

set -euo pipefail

# Configuration
REPO_ROOT="${HOME}/.moltbot"
VENICE_API_KEY="${VENICE_API_KEY:-}"
VENICE_MODEL="gpt-4o"
LOG_FILE="/var/log/moltbot-persona-commit.log"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}✗${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Change to repo directory
cd "$REPO_ROOT" || { log_error "Failed to change to $REPO_ROOT"; exit 1; }

# Verify Venice API key
if [ -z "$VENICE_API_KEY" ]; then
    log_error "VENICE_API_KEY not set in environment"
    exit 1
fi

log_info "Starting persona file commit check"

# Check for changes in workspace files
git fetch origin main 2>/dev/null || true

# Get list of changed persona files
changed_files=$(git diff --name-only origin/main..HEAD -- \
    workspace/*/AGENTS.md \
    workspace/*/SOUL.md \
    workspace/*/IDENTITY.md \
    workspace/*/MEMORY.md \
    2>/dev/null || echo "")

# Also check unstaged changes
unstaged=$(git status --porcelain -- \
    workspace/*/AGENTS.md \
    workspace/*/SOUL.md \
    workspace/*/IDENTITY.md \
    workspace/*/MEMORY.md \
    2>/dev/null || echo "")

if [ -z "$changed_files" ] && [ -z "$unstaged" ]; then
    log_info "No changes to persona files"
    exit 0
fi

log_info "Found changes in persona files"

# Stage the persona files
git add workspace/*/AGENTS.md workspace/*/SOUL.md workspace/*/IDENTITY.md workspace/*/MEMORY.md 2>/dev/null || true

# Get the diff for commit message generation
diff_output=$(git diff --cached -- \
    workspace/*/AGENTS.md \
    workspace/*/SOUL.md \
    workspace/*/IDENTITY.md \
    workspace/*/MEMORY.md 2>/dev/null | head -2000)

if [ -z "$diff_output" ]; then
    log_warning "No staged changes found"
    git reset
    exit 0
fi

log_info "Generating commit message with Venice.AI"

# Generate commit message using Venice.AI
commit_message=$(curl -s -X POST https://api.venice.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VENICE_API_KEY" \
  -d @- <<EOF
{
  "model": "$VENICE_MODEL",
  "messages": [
    {
      "role": "system",
      "content": "You are a git commit message generator. Generate a concise, conventional commit message (feat/fix/docs/refactor) based on the provided git diff. Keep it under 72 characters for the subject line. Format: type(scope): subject\\n\\nbody (if needed)"
    },
    {
      "role": "user",
      "content": "Generate a git commit message for these changes to philosopher persona files:\\n\\n$diff_output"
    }
  ],
  "max_tokens": 256,
  "temperature": 0.7
}
EOF
)

# Extract the message content
message=$(echo "$commit_message" | jq -r '.choices[0].message.content' 2>/dev/null | head -1)

if [ -z "$message" ] || [ "$message" = "null" ]; then
    log_error "Failed to generate commit message with Venice.AI"
    log_warning "API Response: $commit_message"
    git reset
    exit 1
fi

# Clean up the message (remove quotes if present)
message=$(echo "$message" | sed 's/^["\x27]//;s/["\x27]$//')

log_info "Generated message: $message"

# Commit the changes
if git commit -m "$message" 2>&1; then
    log_success "Committed persona changes"
else
    log_warning "Commit failed (might be empty or no changes)"
    git reset
    exit 0
fi

# Push to origin
if git push origin HEAD:main 2>&1; then
    log_success "Pushed persona changes to origin/main"
else
    log_error "Failed to push changes to origin"
    # Reset the commit since push failed
    git reset --soft HEAD~1
    exit 1
fi

log_success "Persona file commit and push completed"
