# AGENTS.md — Monorepo Command Center

> **Data:** 2026-05-03
> **Canonical reference:** `docs/HOMELAB.md`

---

## 📜 COMUNICADO GLOBAL RULES — Lei Suprema do Repositório

> **Status:** ✅ Em vigor | **Última atualização:** 2026-05-05
> **Aplicação:** Todos os agentes, humanos e automações que interagem com este repositório.

### 🚫 Regras Absolutas (Quebra = Bloqueio de Deploy)

| # | Regra | Penalidade |
|---|-------|-----------|
| R1 | **NUNCA hardcodar secrets, tokens ou keys.** Sempre usar `os.environ.get()`, `process.env.VAR` ou vault. | CI falha, PR bloqueado |
| R2 | **NUNCA comitar arquivos `.env`, `credentials.json`, `*.pem`, `*.key`.** | Git hook rejeita, alerta CSO |
| R3 | **Commits atômicos** — uma feature/fix por commit. Squash proibido sem justificativa documentada. | Revert obrigatório |
| R4 | **Testes antes ou junto com código.** Zero testes = zero merge. | PR rejeitado |
| R5 | **Docs em PT-BR, código em EN.** Variáveis, funções, classes e commits em inglês. UI/texto em português UTF-8. | Biome/CI falha |
| R6 | **Zero deploy em produção sem smoke test.** | Rollback automático |
| R7 | **Toda alteração em AGENTS.md, CLAUDE.md ou SPECs exige commit separado** com prefixo `docs:`. | Revert |
| R8 | **Hermes é tree-only.** Proibido manter `state.db`, `state.json`, ou qualquer arquivo de estado > 1MB fora do monorepo. Ver ADR-001. | PR bloqueado, alerta CSO |

### 📋 Convenções Obrigatórias

| # | Convenção | Exemplo |
|---|-----------|---------|
| C1 | **Prefixos de commit:** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:` | `feat(api): add rate limit middleware` |
| C2 | **Branch names:** `feature/descricao-curta` ou `fix/nome-do-bug` | `feature/hce-v2.1-rate-limit` |
| C3 | **Env vars em SCREAMING_SNAKE_CASE** | `RATE_LIMIT_REQUESTS=10` |
| C4 | **Números mágicos proibidos** — sempre extrair para constante com nome | `MAX_RETRIES = 3` |
| C5 | **Funções puras quando possível** — evitar side effects ocultos | — |
| C6 | **TODO no código exige ticket/PR vinculado** | `TODO(#123): migrar para async` |

### 🔄 Sync Automático — Aider Tree

**Em TODO commit, o script `scripts/aider-tree.sh` DEVE ser executado** para gerar a árvore de arquivos modificados no estilo Aider (tree-like). O output é anexado ao corpo do commit.

```bash
# Uso obrigatório antes de TODO commit
bash scripts/aider-tree.sh >> COMMIT_MSG.txt
git commit -m "feat: ..." -m "$(cat COMMIT_MSG.txt)"
```

**Requisitos da árvore:**
- Mostrar apenas arquivos modificados/criados/deletados no staging
- Formato: tree-like com indentação hierárquica
- Destacar `N` (novo), `M` (modificado), `D` (deletado)
- Incluir contagem de linhas alteradas por arquivo

### 🏛️ Hierarquia de Decisão

```
SPEC.md > AGENTS.md > CLAUDE.md > Código-fonte
```

- Se um SPEC contradiz AGENTS.md, o SPEC vence para aquela feature.
- Se não há SPEC, AGENTS.md é a fonte suprema.
- Todo agente DEVE citar a regra que está seguindo ao explicar uma decisão.

### ⚖️ Processo de Infração

1. **Detectada:** CI, code-review ou agente identifica quebra de regra
2. **Documentada:** Issue com label `infraction` e referência à regra quebrada
3. **Corrigida:** Fix obrigatório antes de qualquer merge
4. **Arquivada:** Registro em `docs/ADRs/INFRACTION-NNN.md` se recorrente

> **LEI FUNDAMENTAL:** *Se uma regra não está escrita aqui, ela não existe. Se uma regra está escrita aqui, ela é absoluta.*

---

### 🌳 Hermes Tree-Only (ADR-001)

**Hermes-second-brain é tree-only.** Não é cérebro persistente. Não é daemon. Não é banco de dados.

| Camada | Ferramenta | Estado |
|--------|-----------|--------|
| **Contexto imediato** | `scripts/hermes-tree.py` | Zero state, 50ms, morre |
| **Contexto sessão** | `libs/memory/manager.py` | SQLite no monorepo, recriável |
| **Contexto longo** | HCE API :8642 | SQLite + Qdrant, versionado |
| **Memória vetorial** | Qdrant :6333 | Fonte canônica de embeddings |

**Proibido:**
- `state.db`, `state.json`, `.skills_prompt_snapshot.json` > 1MB
- Daemons Python > 512MB RAM para "ler contexto"
- Duplicar `libs/` fora do monorepo
- Porta 8642 ocupada por não-HCE

**Ver:** [docs/ADRs/ADR-001-hermes-tree-only.md](docs/ADRs/ADR-001-hermes-tree-only.md)

---

## Leia Primeiro

1. **[homelab-context/CONTRACT.md](homelab-context/CONTRACT.md)** — 🦍 Contrato de comportamento (obrigatório)
2. **[homelab-context/README.md](homelab-context/README.md)** — Mapa do homelab
3. [docs/HOMELAB.md](docs/HOMELAB.md) — referência canônica de infraestrutura
4. `bash scripts/sre-check.sh ci --json` — contrato local do repo
5. [docs/SPECS/SPEC-208-nexus-prevc-unified-architecture.md](docs/SPECS/SPEC-208-nexus-prevc-unified-architecture.md) — arquitetura de execução

---

## Arquitetura Mínima Viável — 2 Gateways (Poda Agressiva)

**Regra:** LiteLLM :4018/v1 é o ÚNICO gateway LLM. Voice Gateway :4002 é o ÚNICO gateway de voz. Tudo que não for esses dois é lixo.

```
┌─────────────────────────────────────────────────────────────┐
│                    LITELLM :4018/v1                         │
│  Gateway canônico: text · code · instruction · embedding    │
│  Aliases: hermes-auto, hermes-local-code, hermes-vision,    │
│           hermes-embed, hermes-cloud-*, hermes-brain        │
├─────────────────────────────────────────────────────────────┤
│                    VOICE GATEWAY :4002                      │
│  TTS (Edge-tts :8012) + STT (Groq cloud whisper-large-v3)   │
├─────────────────────────────────────────────────────────────┤
│  Backends: Ollama :11434  |  OpenRouter (cloud fallback)   │
│            Qdrant :6333   |  Edge-tts :8012                 │
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

## Apps & Packages — Mínimo Viável (Poda Agressiva 2026-05-04)

| App/Package | Tipo | Stack | Gateway |
|-------------|------|-------|---------|
| `apps/api` | API | Fastify + OrchidORM + tRPC | — |
| `apps/web` | Web | React 19 + MUI + tRPC | — |
| `apps/ai-gateway` | Voice Gateway | Fastify + edge-tts + Groq STT | :4002 (TTS + STT) |
| `packages/ui` | UI Lib | React + Material UI | — |
| `packages/zod-schemas` | Schemas | TypeScript + Zod | — |
| `packages/config` | Config | TypeScript | — |

**Removidos (duplicados/legado):**
- `apps/perplexity-agent` → Hermes-second-brain já cobre
- `apps/hvac-manual-downloader` → Script em `scripts/hvac-rag/hvac_manual_downloader.py`
- `apps/list-web` + `obsidian-web` + `painel-organism` → Integrados no `apps/web`
- `apps/orchestrator` → Duplicado de `services/orchestrator`

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

## Tool System (`.claude/tools/`)

**Painel de tools para agentes descobrirem e usarem automaticamente.**

### Filosofia
- Tools são **descobertas** por agents via contexto (AGENTS.md)
- Output **JSON** para orquestração entre tools
- **Dependency graph** para chaining automático
- **Cron triggers** para auto-execução

### Tool Panel

| Tool | Alias | Descrição | Dependency |
|------|-------|-----------|------------|
| `/sync` | — | ai-context-sync → memory | cron:30min |
| `/heal` | — | Auto-healer Docker containers | cron:5min |
| `/scraper` | — | Pipeline HVAC: scrape→download→extract→embed→qdrant | chains |
| `/extract` | — | docling table extraction from PDFs | used by scraper |
| `/embed` | — | Ollama nomic-embed-text (768D) | used by scraper |
| `/qdrant` | — | Vector upsert/search (hvac_service_manuals) | used by scraper |
| `/github` | — | Sync GitHub repos HVAC (coolfix, hvac-pro) | cron:daily |
| `/build` | — | Go build com caching | pre-deploy |
| `/deploy` | — | Coolify API deploy | post-build |
| `/status` | — | Homelab overview (containers, resources) | cron:daily |

### Dependency Graph (Orquestração)

```
/github ──→ /scraper ──→ /extract
                           │
                      /embed ──→ /qdrant
                           ↑
                           │
/build ──→ /deploy ──→ /heal
                    ↑
                    │
/sync ──→ /status ◄── /heal
```

### Tool Definitions (`.claude/tools/`)

```json
{
  "name": "scraper",
  "alias": "/scraper",
  "description": "Pipeline HVAC manuals",
  "flags": ["--pipeline {lg,samsung,springer}", "--max N", "--verbose"],
  "orchestrates": ["/extract", "/embed", "/qdrant"],
  "output": "json"
}
```

### Fluxo de Execução

1. **Trigger**: cron ou agent invoca tool
2. **Execute**: Script com flags → JSON stdout
3. **Parse**: Agent ou orchestrator lê output
4. **Chain**: Se dependent tool, dispara próximo

### Fragile Containers (para /heal)

| Container | Risco | Fallback |
|-----------|-------|----------|
| gitea-runner | Token expiry | Regenerar token |
| node-exporter/cadvisor | OOM kills | Não restartar em loop |

### Rate Limiting (para /scraper, /github)

- **Default**: 2s entre requests
- **On 429**: Exponential backoff 1→2→4→8→16s com jitter ±500ms
- **On CAPTCHA**: Skip + log + `login_required: true`

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
| `env-vault-sync.sh` | ZFS snapshot + .env → .env.example (anti-hardcode) | Pre-commit |

---

## Smoke Tests (`smoke-tests/`)

| Teste | Service | Método |
|-------|---------|--------|
| `smoke-chat-zappro-site.sh` | chat.zappro.site | curl + redirect |
| `smoke-chat-zappro-site-e2e.sh` | chat.zappro.site | Playwright E2E OAuth |
| `playwright-chat-e2e.mjs` | chat.zappro.site | Playwright full chain |
| `pipeline-

---

## Gitea Actions (`.gitea/workflows/`)

| Workflow | Trigger | Chain |
|---------|---------|-------|
| `ci-feature.yml` | Push branch | lint → build → test |
| `code-review.yml` | PR | 5 gates: lint + test + security + AI review + human |
| `deploy-main.yml` | Merge main | build → human gate → Coolify deploy |
| `rollback.yml` | Manual dispatch | Coolify rollback + audit |
| `failure-report.yml` | CI fail | Alerta de falha |
| `daily-report.yml` | Cron 9h | Relatório diário |

---

## Antigravity Kit (`.claude/agents/`)

9 agentes especializados + 2 skills legacy:

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
| SPEC-007 | 
| SPEC-009 | 
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
             ✅ PASS → done
             ❌ FAIL → rollback workflow
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

## Secrets (

**Host:** `vault.zappro.site:8200` (localhost:8200)
**Project ID:** `e42657ef-98b2-4b9c-9a04-46c093bd6d37`
**Service Token:** `/srv/ops/secrets/

```bash
# Fetch secret
python3 - << 'EOF'
from 
client = 
    token=open('/srv/ops/secrets/
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
| `gitea` | `ssh://git@127.0.0.1:2222/will-zappro/monorepo.git` | Primary CI/CD |
| `origin` | `git@github.com:zapprosite/monorepo.git` | Mirror |

```bash
# Push to both (usado por /turbo e /ship)
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
bash scripts/env-vault-sync.sh
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
