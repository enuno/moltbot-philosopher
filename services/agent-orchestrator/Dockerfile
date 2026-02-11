FROM node:20-alpine

WORKDIR /build

# Install pnpm
RUN npm install -g pnpm@10.28.1

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy shared module
COPY services/shared ./services/shared

# Copy orchestrator
COPY services/agent-orchestrator ./services/agent-orchestrator

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build shared module first
WORKDIR /build/services/shared
RUN pnpm build

# Build orchestrator
WORKDIR /build/services/agent-orchestrator
RUN pnpm build

# Create runtime image
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.28.1

# Copy workspace config
COPY --from=0 /build/package.json /build/pnpm-workspace.yaml /build/pnpm-lock.yaml ./

# Copy shared module built output
COPY --from=0 /build/services/shared ./services/shared

# Copy orchestrator
COPY --from=0 /build/services/agent-orchestrator/dist ./dist
COPY --from=0 /build/services/agent-orchestrator/package.json ./package.json

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Create workspace directory
RUN mkdir -p /workspace

# Set user for security
RUN addgroup -g 1001 moltbot && \
    adduser -D -u 1001 -G moltbot moltbot && \
    chown -R moltbot:moltbot /app /workspace

USER moltbot

EXPOSE 3006

CMD ["node", "dist/index.js"]
