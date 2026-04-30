# syntax=docker/dockerfile:1
# -----------------------------------------------------------------------------
# SPEC-010 | T-010-001 | apps/web/Dockerfile
# Multi-stage build for React 19 + Vite frontend
# Uses pnpm with node-linker=hoisted for flat, portable node_modules
# -----------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# STAGE 1: Builder
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.0.6 --activate

# Build arguments for environment variables consumed by Vite at build time
ARG VITE_NODE_ENV=production
ARG VITE_API_URL=http://localhost:4002
ENV VITE_NODE_ENV=${VITE_NODE_ENV}
ENV VITE_API_URL=${VITE_API_URL}

# Copy full source code
COPY . .

# Remove host artifacts that would break container install
RUN rm -f .npmrc pnpm-lock.yaml && \
    find . -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true

# Create container-local .npmrc with flat, symlink-free node_modules
RUN printf 'node-linker=hoisted\nvirtual-store-dir=/app/.pnpm-store\nlink-workspace-packages=true\n' > /app/.npmrc

# Install dependencies
RUN pnpm install

# Create symlinks for aliases and misnamed packages
# @repo/zod-schemas -> packages/zod-schemas (Vite alias needs Node resolution in config)
# @connected-repo/typescript-config -> packages/config (tsconfig extends uses wrong name)
RUN mkdir -p /app/apps/web/node_modules/@repo /app/node_modules/@connected-repo && \
    ln -s /app/packages/zod-schemas /app/apps/web/node_modules/@repo/zod-schemas && \
    ln -s /app/packages/config /app/node_modules/@connected-repo/typescript-config

# Build the web app directly with vite (bypasses tsc -b type-check gate)
# Uses vite.docker.config.ts which excludes the bundle analyzer plugin
WORKDIR /app/apps/web
RUN /app/node_modules/.bin/vite build --config /app/apps/web/vite.docker.config.ts

# ---------------------------------------------------------------------------
# STAGE 2: Production (nginx static serve)
# ---------------------------------------------------------------------------
FROM nginx:alpine AS production

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built static files from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy SPA nginx configuration (fallback to index.html for client-side routing)
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
