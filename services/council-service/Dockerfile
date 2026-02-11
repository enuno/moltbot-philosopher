# Council Service - Production Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/shared/ ./services/shared/
COPY services/council-service/ ./services/council-service/

RUN npm install -g pnpm@10.28.1
RUN pnpm install --frozen-lockfile

WORKDIR /app/services/shared
RUN pnpm build

WORKDIR /app/services/council-service
RUN pnpm build

FROM node:18-alpine

WORKDIR /app

RUN npm install -g pnpm@10.28.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/shared/package.json ./services/shared/
COPY services/council-service/package.json ./services/council-service/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/services/shared/dist ./services/shared/dist
COPY --from=builder /app/services/council-service/dist ./services/council-service/dist

USER 1001:1001

WORKDIR /app/services/council-service

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
