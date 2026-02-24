FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci --production

# Copy TypeScript source
COPY tsconfig.json ./
COPY src/ ./src/

# Install dev dependencies for build
RUN npm install --save-dev typescript @types/node @types/express

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create data directory
RUN mkdir -p /data && chown -R 1001:1001 /data

# Switch to non-root user (UID 1001 matches host agent:agent)
RUN addgroup -g 1001 -S agent && adduser -S agent -u 1001 -G agent || true
USER 1001:1001

# Expose port
EXPOSE 3008

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3008/queue/health || exit 1

# Start service
CMD ["node", "dist/index.js"]
