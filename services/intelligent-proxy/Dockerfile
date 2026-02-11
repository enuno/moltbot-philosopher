FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (none currently, but future-proof)
RUN npm install --production || true

# Copy application
COPY index.js ./

# Run as non-root
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8082/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 8082

CMD ["node", "index.js"]
