# AGENTS.md — Monorepo Command Center

> **Data:** 2026-04-09
> **Authority:** Claude Code CLI + Gitea Actions + Antigravity Kit (.agent/)
> **Stack:** pnpm workspaces + Turbo pipeline + Biome lint + Playwright E2E

---

## Arquitectura Unified (09/04/2026)

```
┌─────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE CLI                          │
│  (Orchestrator principal — tokens infinitos, 20 agents)     │
├─────────────────────────────────────────────────────────────┤
│  .claude/commands/    .claude/skills/    .claude/workflows/│
│  → 33 slash commands  → 33 skills         → 7 workflows     │
├─────────────────────────────────────────────────────────────┤
│                    TURBO PIPELINE                           │
│  turbo.json defines build/lint/test pipeline                │
│  yarn workspaces (apps/, packages/)                         │
├─────────────────────────────────────────────────────────────┤
│  .gitea/workflows/        .agent/                          │
│  → 4 Gitea Actions       → 18 specialist agents             │
│  → ci-feature            → 20 workflows (Antigravity Kit)  │
│  → code-review                                           │
│  → deploy-main                                          │
│  → rollback                                              │
├─────────────────────────────────────────────────────────────┤
│  scripts/          smoke-tests/        docs/specflow/      │
│  → health-check    → E2E (Playwright) → 15+ SPECs        │
│  → deploy          → smoke-chat        → tasks.md          │
│  → backup           → smoke-openclaw    → reviews/          │
│  → restore          → +more                                   │
│  → mirror-push                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Tool Stack (Raiz)

| Ficheiro | Tool | Uso |
|----------|------|-----|
| `turbo.json` | Turbo | Pipeline de build/test/lint |
| `biome.json` | Biome | Lint + Format (substitui ESLint+Prettier) |
| `yarn.lock` | Yarn Berry | Package manager c/ workspaces | ⚠️ DEPRECATED — use pnpm |
| `pnpm-workspace.yaml` | pnpm | Workspace definition |
| `package.json` | Node.js | Scripts e dependências |
| `docker-compose.yml` | Docker | Containers de desenvolvimento |

---

## Apps & Packages

| App/Package | Tipo | Stack | Notas |
|-------------|------|-------|-------|
| `apps/api` | API | Fastify + OrchidORM + tRPC | PostgreSQL |
| `apps/web` | Web | React 19 + MUI + tRPC | — |
| `apps/orchestrator` | Agent | Node.js + tRPC + YAML | Human gates |
| `apps/perplexity-agent` | Agent | Python + Streamlit + LangChain | Browser automation |
| `packages/ui-mui` | UI Lib | React + Material UI | → frontend |
| `packages/zod-schemas` | Schemas | TypeScript + Zod | → backend, frontend, orchestrator |
| `packages/typescript-config` | Config | TypeScript | Dev tooling |

---

## Slash Commands (`.claude/commands/`)

| Comando | Ficheiro |链 | Uso |
|---------|----------|-------|-----|
| `/pg` | `pg.md` | SPEC → pipeline.json | Gerar tasks de SPECs |
| `/plan` | `plan.md` | SPEC → tasks | Planear implementação |
| `/rr` | `rr.md` | Commits → REVIEW | Code review report |
| `/se` | `se.md` | Scan secrets | Secrets audit |
| `/sec` | `sec.md` | Security scan | Auditoria OWASP |
| `/feature` | `feature.md` | git-feature workflow | Nova branch feature |
| `/ship` | `ship.md` | Pre-launch checklist | Deploy checklist |
| `/turbo` | `turbo.md` | Commit+merge+tag+branch | Git turbo workflow |
| `/code-review` | `code-review.md` | Commits → 5-axis review | Full review |
| `/scaffold` | `scaffold.md` | Template → novo modulo | Scaffold projeto |
| `/img` | `vision-local.md` | Ollama Qwen2.5-VL | Análise de imagem |

---

## Skills (`.claude/skills/`)

**33 skills locais** — ativados automaticamente via `AGENTS.md`:

| Skill | Propósito | Trigger |
|-------|-----------|---------|
| `bug-investigation` | Debug sistemático | `/bug` |
| `test-generation` | Gerar testes | `/test` |
| `code-review` | Review 5-axis | `/review` |
| `refactoring` | Cleanup code smells | `/refactor` |
| `documentation` | Gerar docs | `/docs` |
| `security-audit` | OWASP top 10 | `/sec` |
| `pipeline-gen` | SPEC → pipeline.json | `/pg` |
| `smoke-test-gen` | SPEC → smoke tests | `/st` |
| `secrets-audit` | Scan hardcoded secrets | `/se` |
| `human-gates` | Identificar blockers | `/hg` |
| `spec-driven-development` | Spec → plan → implement | `/spec` |
| `context-prune` | Limpar contexto | — |
| `deploy-validate` | Pre-deploy check | — |
| `mcp-health` | Health MCP servers | — |
| `repo-scan` | Scan tasks pendentes | `/rs` |
| `self-healing` | Auto-heal loop | — |
| `snapshot-safe` | ZFS safe operations | — |
| `cost-reducer` | Optimizar custos | — |
| `browser-dev` | Browser automation | — |
| `researcher` | Web research (Tavily) | — |

---

## Scripts (`scripts/`)

| Script | Função | CI/CD |
|--------|--------|-------|
| `health-check.sh` | Docker, ZFS, disk, git | Pre-deploy |
| `deploy.sh` | Validation + ZFS snapshot + push | Deploy main |
| `backup.sh` | Git bundle + 7-backup rotation | Cron |
| `restore.sh <name>` | Restore from named backup | DR |
| `mirror-push.sh` | Push Gitea + GitHub | Feature branches |
| `sync-env.js` | .env → workspaces | Pre-build |

---

## Smoke Tests (`smoke-tests/`)

| Teste | Service | Método |
|-------|---------|--------|
| `smoke-chat-zappro-site.sh` | chat.zappro.site | curl + redirect |
| `smoke-chat-zappro-site-e2e.sh` | chat.zappro.site | Playwright E2E OAuth |
| `playwright-chat-e2e.mjs` | chat.zappro.site | Playwright full chain |
| `pipeline-openclaw-voice.sh` | OpenClaw voice | curl health |

---

## Gitea Actions (`.gitea/workflows/`)

| Workflow | Trigger | Chain |
|---------|---------|-------|
| `ci-feature.yml` | Push branch | lint → build → test |
| `code-review.yml` | PR | 5 gates: lint + test + security + AI review + human |
| `deploy-main.yml` | Merge main | build → human gate → Coolify deploy |
| `rollback.yml` | Manual dispatch | Coolify rollback + audit |
| `deploy-perplexity-agent.yml` | Push | Coolify API deploy |

---

## Antigravity Kit (`.agent/`)

18 agents especializados + 20 workflows, 10 skills:

### Agentes
`architect-specialist`, `backend-specialist`, `bug-fixer`, `code-reviewer`, `database-specialist`, `debugger`, `devops-specialist`, `documentation-writer`, `feature-developer`, `frontend-specialist`, `mobile-specialist`, `module-architect`, `orchestrator`, `performance-optimizer`, `refactoring-specialist`, `security-auditor`, `executive-ceo`, `context-optimizer`

### Workflows
`api-design`, `bug-investigation`, `code-review`, `commit-message`, `debug`, `documentation`, `feature-breakdown`, `git-feature`, `git-mirror-gitea-github`, `git-ship`, `git-turbo`, `pr-review`, `refactoring`, `security-audit`, `sincronizar-tudo`, `test-generation`, `ui-ux-pro-max`, +more

### Integration
`.claude/` → `.agent/` (automatic search via `search.md` rules)
`.agent/rules/` → Included in context

---

## Spec-Driven Development (`docs/specflow/`)

```
SPEC-TEMPLATE.md → SPEC-*.md → tasks.md → pipeline.json
                                        → smoke-tests/
                                        → REVIEW-*.md
```

| SPEC | Tópico |
|------|--------|
| SPEC-007 | OpenClaw OAuth profiles |
| SPEC-009 | OpenClaw persona audio stack |
| SPEC-013 | Unified Claude Agent Monorepo |
| SPEC-014 | Cursor AI CI/CD Pattern |
| SPEC-015 | Gitea Actions Enterprise |

---

## CI/CD Loop (Cursor AI Pattern — 09/04/2026)

```
PUSH → Gitea Actions (ci-feature)
       ↓
    lint + build + test
       ↓
    PR → code-review workflow
          ↓
       5 gates: lint | test | security | AI review | human
          ↓
       Merge → deploy-main workflow
                ↓
             Human gate (approve)
                ↓
             Coolify deploy
                ↓
             Smoke tests E2E
                ↓
             PASS → done
             FAIL → rollback workflow
```

**AI Self-Fix Loop (a implementar):**
```
AI review finds issue → AI fixes → re-commit → re-review
```

---

## Turbo Pipeline (`turbo.json`)

```json
{
  "pipeline": {
    "build":    { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test":     { "dependsOn": ["build"],  "outputs": ["coverage/**"] },
    "lint":     { "outputs": [] },
    "typecheck": { "outputs": [] }
  }
}
```

**Comandos:**
```bash
turbo run build          # Build all packages
turbo run build --filter=backend   # Build specific
turbo run test          # Test all
turbo run lint          # Biome lint
```

---

## Biome (`biome.json`)

```bash
biome ci .              # Check (CI mode)
biome format --write .  # Format
biome lint --write .    # Fix linting
```

---

## Build Commands

```bash
# Install
yarn install

# Build (turbo)
yarn build              # turbo run build
yarn build --filter=apps/backend

# Test
yarn test              # turbo run test
yarn test --filter=apps/frontend -- --coverage

# Lint (biome)
yarn lint              # biome ci .

# Dev
yarn dev               # turbo run dev
yarn dev --filter=apps/frontend

# Type check
yarn typecheck         # turbo run typecheck
```

---

## Secrets (Infisical)

**Host:** `vault.zappro.site:8200` (localhost:8200)
**Project ID:** `e42657ef-98b2-4b9c-9a04-46c093bd6d37`
**Service Token:** `/srv/ops/secrets/infisical.service-token`

```bash
# Fetch secret
python3 - << 'EOF'
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(
    token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    host='http://127.0.0.1:8200'
)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == 'MY_SECRET':
        print(s.secret_value)
EOF
```

---

## Gitea + GitHub Remotes

| Remote | URL | Uso |
|--------|-----|-----|
| `origin` | `git@github.com:zapprosite/monorepo.git` | GitHub mirror |
| `gitea` | `ssh://git@127.0.0.1:2222/will-zappro/monorepo.git` | Gitea primary |

```bash
# Push to both
git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD
```

---

## Cron Jobs (Auto-Orchestration)

| Job | Cron | Função |
|-----|------|--------|
| `614f0574` | `*/30 * * * *` | Sync docs → memory |
| `modo-dormir-daily` | `0 3 * * *` | SPEC → pipeline |
| `code-review-daily` | `0 4 * * *` | Code review commits |
| `test-coverage-daily` | `0 5 * * *` | Test coverage |
| `secrets-audit-daily` | `0 6 * * *` | Secrets scan |
| `mcp-health-daily` | `0 8 * * *` | MCP server health |
| `d201999d` | `*/5 * * * *` | Auto-healer (Coolify) |
| `95c72b71` | `3 */15 * * *` | Resource monitor |

---

## Quick Reference

```bash
# Health check
bash scripts/health-check.sh

# Deploy com snapshot
bash scripts/deploy.sh --snapshot

# Mirror push
bash scripts/mirror-push.sh

# Smoke test
bash smoke-tests/smoke-chat-zappro-site.sh

# E2E test
node smoke-tests/playwright-chat-e2e.mjs chat.zappro.site

# Turb build
yarn build

# Biome lint
yarn lint

# Sync env
node scripts/sync-env.js
```

---

## Encoding and Localization Guidance

**Regra:** Docs e UI em PT-BR. Código (variáveis, funções, classes, commits) em EN.

### Antes de qualquer alteração de texto user-facing

1. Verificar que o arquivo alvo usa UTF-8
2. Confirmar que acentos portugueses renderizam corretamente
3. Se o arquivo já exibe mojibake ou acentos quebrados — corrigir o encoding ANTES de introduzir novo texto

### Escopo de verificação obrigatória

Aplicar este check antes de editar:
- Labels, títulos, descrições, tooltips
- Tabs e linhas de tabela
- Mensagens de validação
- Empty states
- Conteúdo exportado user-facing
- Documentação gerada automaticamente

### Verificação final para mudanças em PT-BR

Após qualquer alteração de texto em português, confirmar que os seguintes termos
(e similares) estão renderizando corretamente:

- Projeção
- Receita Líquida
- Lucro Bruto
- Configuração, Ação, Descrição, Número

Estender essa verificação a exports e docs gerados quando a mudança
introduz ou atualiza texto em português.

### Padrão do repositório

| Camada | Idioma |
|--------|--------|
| Código-fonte (vars, funções, classes, types) | 🇺🇸 English |
| Commits e branch names | 🇺🇸 English |
| Comentários técnicos inline | 🇺🇸 English |
| Docs (CLAUDE.md, AGENTS.md, ADRs, runbooks) | 🇧🇷 PT-BR |
| UI / texto user-facing | 🇧🇷 PT-BR (UTF-8) |
| Mensagens de erro user-facing | 🇧🇷 PT-BR (UTF-8) |
| Logs internos de sistema | 🇺🇸 English |
