FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace config and shared module
COPY pnpm-workspace.yaml ./
COPY services/shared /shared
COPY services/event-listener/package*.json ./

# Install pnpm and dependencies
RUN npm install -g pnpm@10.28.1
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY services/event-listener/src ./src
COPY services/event-listener/tsconfig.json ./
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.28.1

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Set user for security
RUN addgroup -g 1001 moltbot && \
    adduser -D -u 1001 -G moltbot moltbot && \
    chown -R moltbot:moltbot /app

USER moltbot

EXPOSE 3007

CMD ["node", "dist/index.js"]
