#!/bin/bash
# scripts/setup-permissions.sh - One-time development environment setup
# Run this once to initialize permissions and git hooks for the project
#
# Usage:
#   bash scripts/setup-permissions.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TARGET_UID=1001
TARGET_GID=1001

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Moltbot Permission Setup${NC}"
echo "============================"
echo ""

# Create agent user on host if doesn't exist (optional, for development)
echo "👤 Checking for agent user (UID 1001)..."
if ! id -u 1001 &>/dev/null; then
    echo "   Creating agent user (UID 1001)..."
    sudo useradd -u 1001 -m agent 2>/dev/null || echo "   User 1001 already exists or cannot be created (this is OK)"
    echo -e "${GREEN}✅ Agent user ready${NC}"
else
    echo -e "${GREEN}✅ Agent user (UID 1001) already exists${NC}"
fi

echo ""
echo "📁 Creating workspace directory structure..."

# Create all workspace directories with correct ownership
for agent in classical existentialist transcendentalist joyce enlightenment beat; do
    dir="$PROJECT_ROOT/workspace/$agent"
    mkdir -p "$dir"/{noosphere,state,logs,cache}
    sudo chown -R $TARGET_UID:$TARGET_GID "$dir"
    echo -e "${GREEN}✅ workspace/$agent${NC}"
done

# Create shared directories
echo ""
echo "📁 Creating shared data directories..."

mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$PROJECT_ROOT/data/postgres"
mkdir -p "$PROJECT_ROOT/data/action-queue"

sudo chown -R $TARGET_UID:$TARGET_GID "$PROJECT_ROOT/logs"
sudo chown -R $TARGET_UID:$TARGET_GID "$PROJECT_ROOT/data"

echo -e "${GREEN}✅ Shared directories ready${NC}"

# Set up git hooks to prevent permission issues
echo ""
echo "🔗 Setting up git hooks..."

mkdir -p "$PROJECT_ROOT/.git/hooks"

# Post-checkout hook to validate permissions after git operations
cat > "$PROJECT_ROOT/.git/hooks/post-checkout" << 'EOF'
#!/bin/bash
# Fix permissions after git checkout
if [[ -f scripts/permission-guard.sh ]]; then
    bash scripts/permission-guard.sh --check-only 2>/dev/null || {
        echo "⚠️  Permission issues detected after checkout"
        echo "Run: bash scripts/permission-guard.sh"
    }
fi
EOF

chmod +x "$PROJECT_ROOT/.git/hooks/post-checkout"
echo -e "${GREEN}✅ post-checkout hook installed${NC}"

# Pre-commit hook to validate workspace state
cat > "$PROJECT_ROOT/.git/hooks/pre-commit" << 'EOF'
#!/bin/bash
# Warn if workspace/ has permission issues
if [[ -f scripts/permission-guard.sh ]]; then
    bash scripts/permission-guard.sh --check-only 2>/dev/null || {
        echo "⚠️  Warning: Workspace has permission issues"
        echo "Consider running: bash scripts/permission-guard.sh"
    }
fi
EOF

chmod +x "$PROJECT_ROOT/.git/hooks/pre-commit"
echo -e "${GREEN}✅ pre-commit hook installed${NC}"

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run: bash scripts/permission-guard.sh (verify permissions)"
echo "2. Start services: docker compose up -d"
echo "3. If permission errors occur:"
echo "   - Run: bash scripts/permission-guard.sh"
echo "   - Then: docker compose restart <service>"
echo ""
echo "Optional: Add to your shell profile for convenience:"
echo "  alias moltbot-check='bash scripts/permission-guard.sh'"
echo "  alias moltbot-setup='bash scripts/setup-permissions.sh'"
