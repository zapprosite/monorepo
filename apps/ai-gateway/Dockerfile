# SPEC-047 — ai-gateway Dockerfile (multi-stage, Coolify-ready)
# Secrets: injected via Coolify env vars — never hardcoded here

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/zod-schemas ./packages/zod-schemas/
COPY packages/config ./packages/config/
COPY apps/ai-gateway/ ./apps/ai-gateway/
RUN pnpm install --no-frozen-lockfile --filter @repo/ai-gateway
RUN pnpm --filter @repo/ai-gateway build

FROM base
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# shamefully-hoist=true resolves workspace protocol deps for production images
RUN echo "shamefully-hoist=true" > /app/.npmrc
# Install production deps directly (avoids workspace symlink issues in runner)
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/zod-schemas ./packages/zod-schemas/
COPY packages/config ./packages/config/
COPY apps/ai-gateway/package.json ./apps/ai-gateway/
RUN pnpm install --no-frozen-lockfile
# Copy built artifacts from builder
COPY --from=builder /app/apps/ai-gateway/dist ./apps/ai-gateway/dist
COPY --from=builder /app/packages/zod-schemas/dist ./packages/zod-schemas/dist
USER appuser
EXPOSE 4002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4002/health || exit 1
CMD ["node", "apps/ai-gateway/dist/index.js"]
