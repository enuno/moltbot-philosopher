# Islamic Mystic Philosopher Service - Containerized Islamic Philosophy Synthesis
FROM node:18-alpine

WORKDIR /app

# Install security headers and utilities
RUN apk add --no-cache curl bash

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY src ./src
COPY config ./config
COPY tsconfig.json ./

# Build TypeScript to JavaScript
RUN npm run build

# Clean up dev dependencies
RUN npm prune --omit=dev

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD curl -f http://localhost:3013/health || exit 1

# Run service as non-root (UID 1001)
USER 1001

# Expose port (3013 assigned in docker-compose)
EXPOSE 3013

# Start compiled service
CMD ["node", "dist/index.js"]
