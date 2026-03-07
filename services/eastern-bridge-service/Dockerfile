# Eastern Bridge Service - Containerized Knowledge Domain Synthesis
FROM node:18-alpine

WORKDIR /app

# Install security headers and utilities
RUN apk add --no-cache curl bash

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src ./src

# Health check endpoint
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3012/health || exit 1

# Run service as non-root (UID 1001)
USER 1001

# Expose port (3012 assigned in docker-compose)
EXPOSE 3012

# Start service
CMD ["node", "src/index.js"]
