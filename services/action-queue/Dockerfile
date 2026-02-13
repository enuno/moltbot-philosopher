FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci --only=production

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
RUN mkdir -p /data && chown -R node:node /data

# Switch to non-root user
USER node

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3006/queue/health || exit 1

# Start service
CMD ["node", "dist/index.js"]
