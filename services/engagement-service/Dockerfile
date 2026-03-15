FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies (including dev deps for build)
COPY package.json package-lock.json* ./
RUN npm install --no-optional --legacy-peer-deps

# Copy source files
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Remove source files, keep compiled JS
RUN rm -rf src tsconfig.json

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3010/health || exit 1

CMD ["node", "dist/engagement-service.js"]
