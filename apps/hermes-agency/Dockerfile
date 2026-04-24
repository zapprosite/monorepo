FROM node:20-slim

RUN npm install -g pnpm@9

WORKDIR /app

# tsconfig.base.json goes at /tsconfig.base.json so that
# apps/hermes-agency/tsconfig.json "extends": "../../tsconfig.base.json" resolves correctly
COPY tsconfig.base.json /tsconfig.base.json

COPY apps/hermes-agency/package.json apps/hermes-agency/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY apps/hermes-agency/tsconfig.json ./
COPY apps/hermes-agency/src/ ./src/

ENV NODE_ENV=production

CMD ["node_modules/.bin/tsx", "src/index.ts"]
