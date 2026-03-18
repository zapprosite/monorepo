---
type: doc
name: tooling
description: Scripts, IDE settings, automation, and developer productivity tips
category: tooling
generated: 2026-03-16
updated: 2026-03-17
status: active
scaffoldVersion: "2.0.0"
---
## Tooling & Productivity Guide

## ⚠️ Governância de Portas

**LEIA ANTES DE INICIAR QUALQUER SERVIÇO:**
[`/srv/ops/ai-governance/PORTS.md`](/srv/ops/ai-governance/PORTS.md)

| Serviço | Porta | Observação |
|---------|-------|-----------|
| Backend (Fastify) | **4000** | `PORT=4000` no `.env` |
| Frontend (Vite) | **5173** | padrão Vite |
| PostgreSQL | **5432** | `connected_repo_db` |
| ~~3000~~ | **OCUPADA** | CapRover Dashboard — nunca usar |

Skill de governância: `.agent/skills/port-governance/SKILL.md`

---

## Requisitos

- **Node.js 22+** — obrigatório (`engines.node` no `package.json`)
- **Yarn 1.22** — package manager (`packageManager` no `package.json`)
- **Docker** — para PostgreSQL local

```bash
yarn install       # instalar dependências
docker compose up -d  # subir banco
yarn dev           # iniciar todos os apps
```

## Scripts Raiz

```bash
yarn dev             # backend + frontend em paralelo (via Turbo)
yarn build           # build de produção
yarn check-types     # type check em todos os pacotes
yarn test            # Vitest em todos os apps
yarn format          # Biome format (substitui Prettier)
yarn db -- g <name>  # gerar migration Orchid ORM
yarn db -- up        # aplicar migrations
yarn env:sync        # sincronizar .env entre apps
yarn clean           # limpar node_modules + dist + cache
```

## Qualidade de Código

**Biome** (substitui ESLint + Prettier):
```bash
yarn format                   # formatar tudo
npx @biomejs/biome ci .       # checar sem modificar (usado no CI)
```
Config: `biome.json` na raiz.

**TypeScript**:
```bash
yarn check-types              # todos os pacotes
```
Configs em `packages/typescript-config/` (base, library, react-library, vite).

## Claude Code — Slash Commands

Ativados com `/` no Claude Code (arquivos em `.claude/commands/`):

| Comando | Descrição |
|---------|-----------|
| `/scaffold` | Gera módulo full-stack completo (Zod + ORM + tRPC + frontend) |
| `/feature` | Cria branch `feature/[nome-criativo]` + upstream |
| `/ship` | Commit semântico + push + PR no GitHub |
| `/turbo` | Commit + merge + tag + nova branch (modo pressa) |
| `/commit` | Gera mensagem Conventional Commits pelo diff |
| `/code-review` | Review dos últimos N commits |

Workflows completos em `.agent/workflows/`. Agentes em `.agent/agents/`.

## CI/CD

GitHub Actions em `.github/workflows/ci.yml`:
- Trigger: push/PR para `main`
- Steps: type check → Biome lint → build → test
- PostgreSQL 15 disponível para integration tests

## Database

```bash
yarn db -- g <migration_name>   # gerar migration
yarn db -- up                   # aplicar
yarn db -- down                 # reverter última
```

Scripts via `apps/backend/src/db/db_script.ts` (Orchid ORM CLI).

## IDE

VS Code — settings em `.vscode/settings.json`.
Biome extension recomendada (substitui ESLint + Prettier no editor).

## Related Resources

- [development-workflow.md](./development-workflow.md)
- [testing-strategy.md](./testing-strategy.md)
