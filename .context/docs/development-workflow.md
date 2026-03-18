---
type: doc
name: development-workflow
description: Day-to-day engineering processes, branching, and contribution guidelines
category: workflow
generated: 2026-03-16
updated: 2026-03-17
status: active
scaffoldVersion: "2.0.0"
---
## Development Workflow

## ⚠️ Governância de Portas

Antes de iniciar serviços, consulte: [`/srv/ops/ai-governance/PORTS.md`](/srv/ops/ai-governance/PORTS.md)

**Portas deste projeto:**
- Backend: `http://localhost:4000` (`PORT=4000` no `.env`)
- Frontend: `http://localhost:5173`
- PostgreSQL: `localhost:5432`
- ❌ **Porta 3000 = CapRover** — nunca usar neste host

## Setup Inicial

```bash
yarn install
docker compose up -d   # PostgreSQL 15
yarn db -- up          # aplicar migrations
yarn dev               # backend :4000 + frontend :5173
```

## Branches

| Prefixo | Uso |
|---------|-----|
| `main` | produção, sempre deployável |
| `feature/*` | novas features |
| `fix/*` | bug fixes |
| `chore/*` | manutenção, tooling |

Criar branch: `/feature` (gera nome criativo automaticamente)

## Fluxo Diário

```
/feature          → cria feature/[nome] + upstream
  ↓ implementar
/ship             → commit semântico + push + PR
  ↓ CI passa
merge via PR      → main atualizada
```

**Modo pressa**: `/turbo` — commit + merge + tag + nova branch em sequência.

## Conventional Commits

Formato: `tipo(escopo): descrição`

| Tipo | Quando usar |
|------|-------------|
| `feat` | nova funcionalidade |
| `fix` | correção de bug |
| `chore` | manutenção sem impacto funcional |
| `refactor` | refatoração sem mudança de comportamento |
| `docs` | apenas documentação |
| `test` | adição/correção de testes |

Escopos derivados do path: `api`, `web`, `ui`, `core`, `claude`.

## Novo Módulo Full-Stack

Usar `/scaffold` — gera automaticamente:
1. Schema Zod em `packages/zod-schemas/`
2. Orchid ORM table + migration
3. tRPC router no backend
4. Page + router no frontend

Ver [tooling.md](./tooling.md) para lista completa de slash commands.

## CI/CD

Todo PR para `main` passa por:
1. `yarn check-types` — TypeScript
2. `biome ci` — lint + format
3. `yarn build` — build de produção
4. `yarn test` — Vitest

PRs bloqueados se qualquer check falhar.

## Antes de Abrir PR

```bash
yarn check-types && yarn format && yarn test && yarn build
```

Ou usar `/ship` que faz tudo automaticamente.

## Related Resources

- [testing-strategy.md](./testing-strategy.md)
- [tooling.md](./tooling.md)
- [AGENTS.md](../../AGENTS.md)
