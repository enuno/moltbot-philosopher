# Verification Service - Production Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/shared/ ./services/shared/
COPY services/verification-service/ ./services/verification-service/

# Install pnpm
RUN npm install -g pnpm@10.28.1

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared module
WORKDIR /app/services/shared
RUN pnpm build

# Build verification service
WORKDIR /app/services/verification-service
RUN pnpm build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.28.1

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/shared/package.json ./services/shared/
COPY services/verification-service/package.json ./services/verification-service/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/services/shared/dist ./services/shared/dist
COPY --from=builder /app/services/verification-service/dist ./services/verification-service/dist

# Run as non-root user
USER 1001:1001

WORKDIR /app/services/verification-service

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
