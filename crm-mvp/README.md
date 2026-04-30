# CRM MVP — Serviços Técnicos

Dark mode + verde ácido. Stack: React 19 + NestJS + tRPC + PostgreSQL + Redis.

## Quick Start

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir banco de dados
docker compose up -d postgres redis

# 3. Copiar env
cp .env.example .env

# 4. Rodar migrations (quando existirem)
pnpm db:migrate

# 5. Dev mode
pnpm dev
```

## Estrutura

```
apps/
  api/    — NestJS + tRPC + TypeORM
  web/    — React 19 + Vite + Tailwind
packages/
  trpc/   — Tipos e router compartilhados
```

## Fases

- [x] Fase 1: Infraestrutura
- [x] Fase 2: Banco de dados (8 entidades, migration inicial, seed)
- [ ] Fase 3: UI Components
- [ ] Fase 4: Módulos Core
- [ ] Fase 5: Testes + Deploy

## Database

```bash
# Subir PostgreSQL + Redis
docker compose up -d postgres redis

# Rodar migrations
pnpm db:migrate

# Seed dados de exemplo
pnpm db:seed
```
