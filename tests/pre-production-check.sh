#!/bin/bash
# tests/pre-production-check.sh - Pre-Production Validation
# Validates environment readiness before deployment.
# Exits 0 if all checks pass, 1 if any fail.

set -euo pipefail

WORKTREE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

pass() {
    echo "[PASS] $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo "[FAIL] $1: $2"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

skip() {
    echo "[SKIP] $1"
    SKIP_COUNT=$((SKIP_COUNT + 1))
}

# ---------------------------------------------------------------
# CHECK 1: Environment variables present
# ---------------------------------------------------------------
check_env_vars() {
    local desc="Environment variables present"
    local env_file="$WORKTREE_DIR/.env"

    if [ ! -f "$env_file" ]; then
        fail "$desc" ".env file not found (copy .env.example and configure)"
        return
    fi

    if ! grep -q "^MOLTBOOK_API_KEY=" "$env_file" 2>/dev/null; then
        fail "$desc" "MOLTBOOK_API_KEY not set in .env"
        return
    fi

    pass "$desc"
}

# ---------------------------------------------------------------
# CHECK 2: Docker services defined in docker-compose.yml
# ---------------------------------------------------------------
check_docker_services() {
    local desc="Docker services defined in docker-compose.yml"
    local compose_file="$WORKTREE_DIR/docker-compose.yml"

    if ! command -v docker &>/dev/null; then
        skip "$desc"
        return
    fi

    if [ ! -f "$compose_file" ]; then
        fail "$desc" "docker-compose.yml not found"
        return
    fi

    local service_count
    service_count=$(grep -c "^  [a-z].*:$" "$compose_file" 2>/dev/null || echo 0)
    if [ "$service_count" -lt 1 ]; then
        fail "$desc" "No services found in docker-compose.yml"
        return
    fi

    pass "$desc"
}

# ---------------------------------------------------------------
# CHECK 3: API key format valid (not placeholder)
# ---------------------------------------------------------------
check_api_key_format() {
    local desc="API key format valid (not placeholder)"
    local env_file="$WORKTREE_DIR/.env"

    if [ ! -f "$env_file" ]; then
        fail "$desc" ".env file not found"
        return
    fi

    local api_key
    api_key=$(grep "^MOLTBOOK_API_KEY=" "$env_file" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)

    if [ -z "$api_key" ]; then
        fail "$desc" "MOLTBOOK_API_KEY is empty"
        return
    fi

    if [ "$api_key" = "moltbook_sk_your_key_here" ]; then
        fail "$desc" "API key is still the placeholder value"
        return
    fi

    if ! echo "$api_key" | grep -q "^moltbook_sk_"; then
        fail "$desc" "API key does not start with 'moltbook_sk_'"
        return
    fi

    pass "$desc"
}

# ---------------------------------------------------------------
# CHECK 4: Rate limiter config sane (post interval >= 1800s)
# ---------------------------------------------------------------
check_rate_limiter_config() {
    local desc="Rate limiter config sane (post interval >= 1800s)"
    local config_file="$WORKTREE_DIR/services/action-queue/src/config.ts"

    if [ ! -f "$config_file" ]; then
        fail "$desc" "config file not found: services/action-queue/src/config.ts"
        return
    fi

    # Extract the intervalSeconds for the POST action type block.
    # The block starts at [ActionType.POST] and we read the intervalSeconds from it.
    local interval_expr
    interval_expr=$(awk '
        /\[ActionType\.POST\]/ { in_block=1 }
        in_block && /intervalSeconds:/ {
            match($0, /intervalSeconds:[[:space:]]*([^,\/]+)/, arr)
            print arr[1]
            exit
        }
    ' "$config_file" | tr -d ' ')

    if [ -z "$interval_expr" ]; then
        fail "$desc" "Could not find POST intervalSeconds in config"
        return
    fi

    # Evaluate arithmetic expressions like "30 * 60"
    local interval_seconds
    interval_seconds=$(node -e "process.stdout.write(String($interval_expr))" 2>/dev/null \
        || echo "$interval_expr" | bc 2>/dev/null \
        || echo "0")

    if [ "$interval_seconds" -lt 1800 ] 2>/dev/null; then
        fail "$desc" "POST interval is ${interval_seconds}s (minimum required: 1800s)"
        return
    fi

    pass "$desc"
}

# ---------------------------------------------------------------
# CHECK 5: Credential file permissions secure (600)
# ---------------------------------------------------------------
check_credential_permissions() {
    local desc="Credential file permissions secure (600)"
    local env_file="$WORKTREE_DIR/.env"

    if [ ! -f "$env_file" ]; then
        fail "$desc" ".env file not found"
        return
    fi

    local perms
    perms=$(stat -c "%a" "$env_file" 2>/dev/null || stat -f "%Lp" "$env_file" 2>/dev/null || echo "")

    if [ -z "$perms" ]; then
        fail "$desc" "Could not determine file permissions"
        return
    fi

    if [ "$perms" != "600" ]; then
        fail "$desc" ".env permissions are $perms (expected 600) — run: chmod 600 .env"
        return
    fi

    pass "$desc"
}

# ---------------------------------------------------------------
# CHECK 6: Skill manifest hashes present
# ---------------------------------------------------------------
check_skill_manifest_hashes() {
    local desc="Skill manifest hashes present"
    # Search for any hashes.json under workspace/
    local hashes_file
    hashes_file=$(find "$WORKTREE_DIR/workspace" -name "hashes.json" 2>/dev/null | head -1)

    if [ -z "$hashes_file" ]; then
        fail "$desc" "No hashes.json found under workspace/"
        return
    fi

    local skill_hash
    skill_hash=$(grep -o '"skill_md_hash"[[:space:]]*:[[:space:]]*"[^"]*"' "$hashes_file" 2>/dev/null \
        | grep -o '"[^"]*"$' | tr -d '"' || true)

    if [ -z "$skill_hash" ]; then
        fail "$desc" "skill_md_hash not present in $hashes_file"
        return
    fi

    pass "$desc"
}

# ---------------------------------------------------------------
# CHECK 7: Lint passes
# ---------------------------------------------------------------
check_lint() {
    local desc="Lint passes (npm run lint)"

    if ! command -v npm &>/dev/null; then
        skip "$desc"
        return
    fi

    if [ ! -f "$WORKTREE_DIR/package.json" ]; then
        skip "$desc"
        return
    fi

    if (cd "$WORKTREE_DIR" && npm run lint -- --quiet 2>&1) >/dev/null 2>&1; then
        pass "$desc"
    else
        fail "$desc" "npm run lint reported errors (run 'npm run lint' for details)"
    fi
}

# ---------------------------------------------------------------
# CHECK 8: Unit tests pass
# ---------------------------------------------------------------
check_unit_tests() {
    local desc="Unit tests pass"

    if ! command -v npm &>/dev/null; then
        skip "$desc"
        return
    fi

    if [ ! -f "$WORKTREE_DIR/package.json" ]; then
        skip "$desc"
        return
    fi

    if (cd "$WORKTREE_DIR" && npm test -- --passWithNoTests 2>&1) >/dev/null 2>&1; then
        pass "$desc"
    else
        fail "$desc" "Unit tests failed (run 'npm test' for details)"
    fi
}

# ---------------------------------------------------------------
# Run all checks
# ---------------------------------------------------------------
echo "=== Pre-Production Validation ==="
echo ""

check_env_vars
check_docker_services
check_api_key_format
check_rate_limiter_config
check_credential_permissions
check_skill_manifest_hashes
check_lint
check_unit_tests

echo ""
TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))
echo "=== Summary: ${PASS_COUNT}/${TOTAL} checks passed (${SKIP_COUNT} skipped) ==="

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

exit 0
