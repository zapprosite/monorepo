# SPEC-047 — ai-gateway Dockerfile (multi-stage, Coolify-ready)
# Secrets: injected via Coolify env vars — never hardcoded here

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
COPY packages/zod-schemas/package.json ./packages/zod-schemas/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
WORKDIR /app
# Root monorepo files needed for pnpm workspace + tsconfig
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
# Only copy needed packages for ai-gateway
COPY packages/zod-schemas ./packages/zod-schemas/
COPY packages/config ./packages/config/
COPY apps/ai-gateway/ ./apps/ai-gateway/
# Install only ai-gateway deps (skip other workspace packages with phantom deps)
RUN pnpm install --no-frozen-lockfile --filter @repo/ai-gateway
RUN pnpm --filter @repo/ai-gateway build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/ai-gateway/dist ./dist
COPY --from=builder /app/packages/zod-schemas/dist ./packages/zod-schemas/dist

USER appuser
EXPOSE 4002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4002/health || exit 1

CMD ["node", "dist/index.js"]
