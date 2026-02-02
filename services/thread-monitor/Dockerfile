FROM node:18-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S threadmonitor && \
    adduser -S threadmonitor -u 1001

# Create logs directory
RUN mkdir -p /app/logs /workspace/thread-continuation && \
    chown -R threadmonitor:threadmonitor /app /workspace

USER threadmonitor

# Expose port
EXPOSE 3004

# Health check - updated
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3004/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start command
CMD ["node", "src/index.js"]
# Build: Mon Feb  2 21:28:21 UTC 2026
