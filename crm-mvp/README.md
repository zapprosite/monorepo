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

# 4. Rodar migrations
pnpm db:migrate

# 5. Seed dados de exemplo
pnpm db:seed

# 6. Dev mode
pnpm dev
```

## Estrutura

```
apps/
  api/    — NestJS + tRPC + TypeORM
  web/    — React 19 + Vite + Tailwind
packages/
  ui/     — Componentes compartilhados
  trpc/   — Tipos e router compartilhados
```

## Fases

- [x] Fase 1: Infraestrutura
- [x] Fase 2: Banco de dados (8 entidades, migration inicial, seed)
- [x] Fase 3: UI Components (11 componentes, dark mode + verde ácido)
- [x] Fase 4: Módulos Core (Dashboard, Leads, Clientes, Agenda, Contratos, Lembretes)
- [x] Fase 5: Testes E2E + Deploy

## Database

```bash
# Subir PostgreSQL + Redis
docker compose up -d postgres redis

# Rodar migrations
pnpm db:migrate

# Seed dados de exemplo
pnpm db:seed
```

## UI Components

```
packages/ui/src/components/
  Button.tsx      — primary, outline, ghost, danger + loading
  Card.tsx        — Card, CardHeader, CardTitle, CardContent
  Form.tsx        — Input, Textarea, Select (com label, error, helper)
  Badge.tsx       — 8 variantes + StatusBadge mapeado por entidade
  DataTable.tsx   — sortable, paginated, empty state
  Modal.tsx       — overlay, sizes, footer, ESC to close
  Toast.tsx       — ToastProvider + useToast hook
  Sidebar.tsx     — responsive, nav items, user section, mobile drawer
  Header.tsx      — title, subtitle, breadcrumb, actions
  KPICard.tsx     — value, icon, trend (up/down/neutral)
```

## Módulos Core

| Módulo | Rotas tRPC | Página |
|--------|-----------|--------|
| Dashboard | `dashboard.getStats`, `dashboard.getRecentItems` | `/dashboard` |
| Leads | `leads.list`, `leads.getById`, `leads.create`, `leads.update`, `leads.delete`, `leads.convertToClient` | `/leads` |
| Clientes | `clients.list`, `clients.getById`, `clients.create`, `clients.update`, `clients.delete` | `/clients` |
| Agenda | `schedules.list`, `schedules.getById`, `schedules.create`, `schedules.update`, `schedules.delete` | `/schedule` |
| Contratos | `contracts.list`, `contracts.getById`, `contracts.create`, `contracts.update`, `contracts.delete` | `/contracts` |
| Lembretes | `reminders.list`, `reminders.getById`, `reminders.create`, `reminders.update`, `reminders.delete`, `reminders.complete` | `/reminders` |

## Deploy

```bash
# Build e subir tudo
docker compose up -d --build

# Teste E2E
pnpm test
```

## Auth

- **Dev Login**: `dev@crm.local` via `sessionStorage` + header `X-Dev-User`
- **OAuth2 Google**: placeholder para implementação futura

## Variáveis de Ambiente

Veja `.env.example` para a lista completa.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS + TanStack Query |
| Backend | NestJS + tRPC + TypeORM |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Deploy | Docker Compose |

## Testes

```bash
# E2E Smoke (login → dashboard → navegação)
pnpm test
```

## Changelog

### v1.0.0 (2026-04-30)
- MVP completo com 6 módulos
- Dark mode + verde ácido (#39FF14)
- 8 entidades, migration inicial, seed
- 11 componentes UI reutilizáveis
- Teste E2E smoke
- Docker Compose pronto para deploy
