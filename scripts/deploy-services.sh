#!/bin/bash
#
# Deploy Moltbot Services
# Builds and starts all services in production mode
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Moltbot Service Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"

# Check environment
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create .env with MOLTBOOK_API_KEY"
    exit 1
fi

# Check workspace permissions
echo -e "${BLUE}Checking workspace permissions...${NC}"
if [ -d workspace/classical ]; then
    current_owner=$(stat -c '%u:%g' workspace/classical 2>/dev/null || stat -f '%u:%g' workspace/classical)
    if [ "$current_owner" != "1001:1001" ]; then
        echo -e "${YELLOW}Warning: Workspace not owned by UID 1001:1001${NC}"
        echo -e "${YELLOW}Run: sudo chown -R 1001:1001 workspace/${NC}"
    fi
fi

# Stop existing containers
echo -e "\n${BLUE}Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down

# Build images
echo -e "\n${BLUE}Building service images...${NC}"
echo "This may take several minutes..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
echo -e "\n${BLUE}Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for health checks
echo -e "\n${BLUE}Waiting for services to become healthy...${NC}"
sleep 10

# Check service health
services=(
    "agent-orchestrator:3006"
    "event-listener:3007"
    "verification-service:3008"
    "engagement-service:3009"
    "council-service:3010"
    "noosphere-service:3011"
    "moltstack-service:3012"
)

all_healthy=true

for service in "${services[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"

    if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name (port $port) is healthy"
    else
        echo -e "${RED}✗${NC} $name (port $port) is unhealthy"
        all_healthy=false
    fi
done

echo ""

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  All services deployed successfully! 🚀${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}\n"

    echo -e "${BLUE}Service URLs:${NC}"
    echo "  Agent Orchestrator:    http://localhost:3006/health"
    echo "  Event Listener:        http://localhost:3007/health"
    echo "  Verification Service:  http://localhost:3008/health"
    echo "  Engagement Service:    http://localhost:3009/health"
    echo "  Council Service:       http://localhost:3010/health"
    echo "  Noosphere Service:     http://localhost:3011/health"
    echo "  MoltStack Service:     http://localhost:3012/health"

    echo -e "\n${BLUE}Logs:${NC}"
    echo "  docker-compose -f docker-compose.prod.yml logs -f"

    echo -e "\n${BLUE}Stop services:${NC}"
    echo "  docker-compose -f docker-compose.prod.yml down"
else
    echo -e "${RED}═══════════════════════════════════════════════${NC}"
    echo -e "${RED}  Some services failed to start${NC}"
    echo -e "${RED}═══════════════════════════════════════════════${NC}\n"

    echo -e "${YELLOW}Check logs with:${NC}"
    echo "  docker-compose -f docker-compose.prod.yml logs"

    exit 1
fi
