#!/bin/bash
# scripts/permission-guard.sh - Proactive permission fixer
# Run this before docker-compose up to prevent permission errors
#
# Usage:
#   bash scripts/permission-guard.sh              # Check and fix permissions
#   bash scripts/permission-guard.sh --check-only # Check only, don't fix
#   bash scripts/permission-guard.sh --fix        # Fix permissions (with sudo prompts)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TARGET_UID=1001
TARGET_GID=1001
CHECK_ONLY=false
FIX_MODE=false

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
for arg in "$@"; do
  case $arg in
    --check-only) CHECK_ONLY=true ;;
    --fix) FIX_MODE=true ;;
  esac
done

# Function to fix permissions for agent workspace directories
fix_permissions() {
    local path=$1
    local description=$2

    if [[ -e "$path" ]]; then
        current_uid=$(stat -c %u "$path" 2>/dev/null || echo "0")
        current_gid=$(stat -c %g "$path" 2>/dev/null || echo "0")

        if [[ "$current_uid" != "$TARGET_UID" ]] || [[ "$current_gid" != "$TARGET_GID" ]]; then
            if [[ "$CHECK_ONLY" == true ]]; then
                echo -e "${YELLOW}⚠️  $description has wrong ownership ($current_uid:$current_gid, expected $TARGET_UID:$TARGET_GID)${NC}"
                return 1
            else
                echo -e "${YELLOW}⚠️  Fixing $description ownership ($current_uid:$current_gid → $TARGET_UID:$TARGET_GID)${NC}"
                sudo chown -R "$TARGET_UID:$TARGET_GID" "$path"
                echo -e "${GREEN}✅ Fixed $description${NC}"
            fi
        else
            echo -e "${GREEN}✅ $description ownership correct${NC}"
            return 0
        fi

        # Set appropriate permissions (only if not check-only)
        if [[ "$CHECK_ONLY" == false ]] && [[ -d "$path" ]]; then
            find "$path" -type d -exec chmod 755 {} \;
            find "$path" -type f -exec chmod 644 {} \;
        fi
    else
        if [[ "$CHECK_ONLY" == true ]]; then
            echo -e "${BLUE}ℹ️  $description does not exist (will be created by services)${NC}"
            return 0
        else
            echo -e "${YELLOW}📁 Creating $description...${NC}"
            mkdir -p "$path"
            sudo chown -R "$TARGET_UID:$TARGET_GID" "$path"
            echo -e "${GREEN}✅ Created $description${NC}"
        fi
    fi
}

# Function to fix PostgreSQL database permissions (special handling - runs as root)
fix_postgres_permissions() {
    local path=$1
    local description=$2

    if [[ -e "$path" ]]; then
        current_uid=$(stat -c %u "$path" 2>/dev/null || echo "0")
        current_gid=$(stat -c %g "$path" 2>/dev/null || echo "0")

        # PostgreSQL container runs as root (0) or postgres (999)
        # Accept either ownership, but prefer root:root with 700/600 permissions
        if [[ "$current_uid" == "0" ]] || [[ "$current_uid" == "999" ]]; then
            # Check if permissions are correct (700 for dirs, 600 for files)
            dir_perms=$(stat -c %a "$path" 2>/dev/null)
            if [[ "$dir_perms" == "700" ]]; then
                echo -e "${GREEN}✅ $description ownership and permissions correct (root/postgres with 700/600)${NC}"
                return 0
            elif [[ "$CHECK_ONLY" == true ]]; then
                echo -e "${YELLOW}⚠️  $description has suboptimal permissions ($dir_perms, expected 700/600)${NC}"
                return 1
            else
                echo -e "${YELLOW}⚠️  Fixing $description permissions to 700/600${NC}"
                sudo find "$path" -type d -exec chmod 700 {} \;
                sudo find "$path" -type f -exec chmod 600 {} \;
                echo -e "${GREEN}✅ Fixed $description permissions${NC}"
            fi
        else
            if [[ "$CHECK_ONLY" == true ]]; then
                echo -e "${YELLOW}⚠️  $description has wrong ownership ($current_uid:$current_gid, expected root(0) or postgres(999))${NC}"
                return 1
            else
                echo -e "${YELLOW}⚠️  Fixing $description ownership to root:root${NC}"
                sudo chown -R root:root "$path"
                sudo find "$path" -type d -exec chmod 700 {} \;
                sudo find "$path" -type f -exec chmod 600 {} \;
                echo -e "${GREEN}✅ Fixed $description${NC}"
            fi
        fi
    else
        if [[ "$CHECK_ONLY" == true ]]; then
            echo -e "${BLUE}ℹ️  $description does not exist (will be created by PostgreSQL container)${NC}"
            return 0
        else
            echo -e "${YELLOW}📁 Creating $description for PostgreSQL...${NC}"
            mkdir -p "$path"
            sudo chown -R root:root "$path"
            sudo chmod 700 "$path"
            echo -e "${GREEN}✅ Created $description${NC}"
        fi
    fi
}

echo -e "${BLUE}🔒 Moltbot Permission Guard v2.7${NC}"
echo "================================"
echo ""

# Check and fix all workspace directories
echo "📂 Checking workspace directories..."
PERMISSION_ERRORS=0

for agent in classical existentialist transcendentalist joyce enlightenment beat; do
    fix_permissions "$PROJECT_ROOT/workspace/$agent" "workspace/$agent" || ((PERMISSION_ERRORS++))
done

echo ""
echo "📂 Checking data directories..."
fix_postgres_permissions "$PROJECT_ROOT/data/postgres" "data/postgres" || ((PERMISSION_ERRORS++))
fix_permissions "$PROJECT_ROOT/data/action-queue" "data/action-queue" || ((PERMISSION_ERRORS++))

echo ""
echo "📂 Checking logs directory..."
fix_permissions "$PROJECT_ROOT/logs" "logs directory" || ((PERMISSION_ERRORS++))

# Check docker-compose.yml for common mistakes
echo ""
echo "🔍 Checking docker-compose.yml for permission anti-patterns..."

# Check for actual user: directives (not in comments)
USER_DIRECTIVES=$(grep -n "^[[:space:]]*user:" "$PROJECT_ROOT/docker-compose.yml" 2>/dev/null || true)

if [[ -n "$USER_DIRECTIVES" ]]; then
    echo -e "${RED}❌ ERROR: docker-compose.yml contains 'user:' directive${NC}"
    echo "   This overrides Dockerfile USER and causes permission mismatches."
    echo "   Remove all 'user:' lines from docker-compose.yml"
    echo ""
    echo "   Found in these services:"
    echo "$USER_DIRECTIVES" | sed 's/^/     /'
    ((PERMISSION_ERRORS++))
else
    echo -e "${GREEN}✅ No 'user:' directive found in docker-compose.yml${NC}"
fi

# Check if current user can write to workspace (for development)
echo ""
echo "👤 Checking current user permissions..."
if [[ -w "$PROJECT_ROOT/workspace" ]]; then
    echo -e "${GREEN}✅ Current user can write to workspace${NC}"
else
    echo -e "${YELLOW}⚠️  Current user cannot write to workspace${NC}"
    echo "   This is expected if workspace is owned by UID 1001"
    echo "   Run scripts from docker containers for workspace modifications"
fi

echo ""
if [[ "$PERMISSION_ERRORS" -eq 0 ]]; then
    echo -e "${GREEN}🎉 Permission check complete - all systems go!${NC}"
    exit 0
else
    if [[ "$CHECK_ONLY" == true ]]; then
        echo -e "${YELLOW}⚠️  Found $PERMISSION_ERRORS permission issue(s) - run without --check-only to fix${NC}"
    else
        echo -e "${YELLOW}⚠️  Found $PERMISSION_ERRORS permission issue(s) - some fixes may require manual intervention${NC}"
    fi
    exit 1
fi
