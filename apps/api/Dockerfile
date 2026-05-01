# syntax=docker/dockerfile:1
# -----------------------------------------------------------------------------
# SPEC-010 | T-010-001 | apps/api/Dockerfile
# Production image for Fastify + tRPC backend
# Uses pnpm with node-linker=hoisted for flat, portable node_modules
# -----------------------------------------------------------------------------

FROM node:22-alpine AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.0.6 --activate

# Copy full source code
COPY . .

# Remove host artifacts that would break container install:
# - .npmrc (has host virtual-store-dir pointing to /tmp/pnpm-virtual)
# - pnpm-lock.yaml (host-generated)
# - ALL node_modules (host symlinks break in container)
RUN rm -f .npmrc pnpm-lock.yaml && \
    find . -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true

# Create container-local .npmrc with flat, symlink-free node_modules
RUN printf 'node-linker=hoisted\nvirtual-store-dir=/app/.pnpm-store\nlink-workspace-packages=true\n' > /app/.npmrc

# Install dependencies — creates flat node_modules with real files, no symlinks
RUN pnpm install

# Verify hoisted layout (should exist in root node_modules, not symlinks)
RUN ls -la /app/node_modules/dotenv && ls -la /app/node_modules/zod

# ---------------------------------------------------------------------------
# Production stage
# ---------------------------------------------------------------------------
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and node_modules from builder
# NOTE: node-linker=hoisted hoists third-party deps to root, but workspace
# packages (@connected-repo/*) stay in apps/api/node_modules as symlinks
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/zod-schemas/dist ./packages/zod-schemas/dist
COPY --from=builder /app/packages/zod-schemas/package.json ./packages/zod-schemas/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

WORKDIR /app/apps/api

EXPOSE 4001

CMD ["/app/node_modules/.bin/tsx", "dist/server.js"]
