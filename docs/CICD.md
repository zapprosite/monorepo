# CI/CD Pipeline — Monorepo

Pipeline de 3 fases (SPEC → PG → SHIPPER) com gates de seguranca e rollback automatico.

---

## Estrutura Geral

```
push/PR                    Pipeline                     Deploy
─────────                  ────────                     ──────
pr-check.yml  ──────►  orchestrator.yml  ──────►  deploy-main.yml
                       (14 agentes)                      │
                       (SPEC-090)                    Coolify
                                                        │
                                                    rollback.yml
```

---

## Fase 1: SPEC (Pull Request Check)

**Trigger:** `pull_request` (opened, synchronize)

**Arquivo:** `.github/workflows/pr-check.yml`

### O que faz

| Step | Comando | Purpose |
|------|---------|---------|
| Install | `pnpm install --frozen-lockfile` | Dependencias |
| Type check | `pnpm tsc --noEmit` | Validacao TypeScript |
| Lint | `pnpm lint` | Biome lint |
| Test | `pnpm test` | Testes unitarios |
| Version drift | `bash scripts/versions-check.sh` | Verifica consistencia de versoes |

### Debugar falhas

```bash
# Executar localmente
pnpm tsc --noEmit
pnpm lint
pnpm test

# Verificar versoes
bash scripts/versions-check.sh
```

**Tempo estimado:** ~5 minutos

---

## Fase 2: PG (Pipeline Generativo — 14 Agentes)

**Trigger:** `workflow_dispatch` via GitHub Actions (ou `orchestrator.yml` no Gitea)

**Arquivo:** `.github/workflows/orchestrator.yml`

### Como.triggerar

```bash
# Via GitHub Actions UI
# Acesse: https://git.zappro.site/<owner>/<repo>/actions
# Clique em "Orchestrator" → "Run workflow"
# Preencha: spec_file (ex: 042) e spec_description
```

Ou via CLI (dentro do monorepo):

```bash
bash .claude/skills/orchestrator/scripts/run-pipeline.sh <SPEC-NNN>
```

### Fases do Pipeline

| Fase | Agentes | Purpose |
|------|---------|---------|
| **Fase 1** | SPEC-ANALYZER + ARCHITECT | Analise do SPEC e arquitetura |
| **Fase 2** | CODER-1 + CODER-2 | Implementacao do codigo |
| **Fase 3** | TESTER + DOCS + SMOKE + REVIEWER | Testes, docs, smoke test e review |
| **SHIP** | SHIPPER | Cria PR no Gitea |

### Os 14 Agentes

```
SPEC-ANALYZER  ARCHITECT     CODER-1        CODER-2
TESTER         SMOKE         SECURITY      DOCS
TYPES          LINT          SECRETS       GIT
REVIEWER       SHIPPER
```

### Como debugar falhas de agentes

```bash
# Ver logs dos agentes
ls -la .claude/skills/orchestrator/logs/

# Ver estado dos agentes
cat tasks/agent-states/<AGENT>.json

# Exemplo: ver se CODER-1 falhou
cat tasks/agent-states/CODER-1.json | jq .

# Ver snapshots disponiveis
bash .claude/skills/orchestrator/scripts/rollback.sh --list <PIPELINE_ID>

# Rollback de um agente especifico
bash .claude/skills/orchestrator/scripts/rollback.sh \
  --agent=CODER-1 --to=<SPEC-NNN>
```

### Estrutura de diretorios durante execucao

```
monorepo/
├── tasks/
│   ├── agent-states/       # Estado de cada agente (JSON)
│   │   ├── SPEC-ANALYZER.json
│   │   ├── ARCHITECT.json
│   │   └── ...
│   ├── pipeline.json       # Estado global do pipeline
│   └── snapshots/         # Snapshots para rollback
│       └── <PIPELINE_ID>/
│           └── <AGENT_ID>/
│               ├── src.before/     # Copy do src/ antes do agente
│               ├── git.commit      # Commit hash
│               └── manifest.json
└── .claude/skills/orchestrator/logs/
    └── <AGENT_ID>.log
```

**Tempo estimado:** 15-30 minutos (dependendo da complexidade do SPEC)

---

## Fase 3: Deploy

**Trigger:** `push` para branch `main` (merge de PR)

**Arquivo:** `.gitea/workflows/deploy-main.yml`

### Stages

| Stage | Gate | Descricao |
|-------|------|-----------|
| **build-and-test** | Automatico | Build + Test com Postgres |
| **human-gate** | **APROVACAO MANUAL** | Requer aprovacao via Gitea Environments |
| **deploy** | Apos human gate | Trigger Coolify + health check |

### Como.triggerar deploy manual

```bash
# Via GitHub Actions UI
# Acesse: https://git.zappro.site/<owner>/<repo>/actions
# Clique em "Deploy Main" → "Run workflow"
# Selecione environment: production | staging | preview
```

### Debugar falhas de deploy

```bash
# 1. Ver logs do Coolify
curl -s "$COOLIFY_URL/api/v1/applications/<APP_UUID>/deployments" \
  -H "Authorization: Bearer $COOLIFY_API_KEY"

# 2. Ver status da aplicacao
curl -s "$COOLIFY_URL/api/v1/applications/<APP_UUID>" \
  -H "Authorization: Bearer $COOLIFY_API_KEY"

# 3. Health check manual
curl -s -o /dev/null -w "%{http_code}" https://web.zappro.site/_stcore/health
```

---

## Rollback

**Arquivo:** `.gitea/workflows/rollback.yml`

### Quando usar

- Deploy quebrou em producao
- Aplicacao nao responde apos deploy
- Smoke test falhou

### Como executar

```bash
# Via GitHub Actions UI
# Acesse: https://git.zappro.site/<owner>/<repo>/actions
# Clique em "Rollback" → "Run workflow"
# Preencha:
#   - app_name: monorepo-web | perplexity-agent | backend | frontend
#   - reason: (obrigatorio — documento para audit trail)
#   - environment: production | staging | preview
```

### Rollback automatico

O deploy-main.yml inclui rollback automatico se o smoke test falhar:

```
deploy-main.yml
  ├── build-and-test
  ├── human-gate
  ├── deploy
  │     └── rollback-on-failure (automatico se deploy falhar)
  └── smoke-test
```

### Rollback manual por commit

```bash
# Forcar rollback para commit especifico
curl -X POST "$COOLIFY_URL/api/v1/applications/<APP_UUID>/deploy" \
  -H "Authorization: Bearer $COOLIFY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"commit": "<COMMIT_SHA>", "environment_name": "production"}'
```

---

## CI Feature (Feature Branches)

**Arquivo:** `.gitea/workflows/ci-feature.yml`

**Trigger:** `push` para qualquer branch que nao seja `main`

### O que faz

| Step | Purpose |
|------|---------|
| Security audit | `pnpm audit --level high` |
| Type check | `pnpm check-types` |
| Lint | `pnpm biome check .` |
| Build | `pnpm build` |
| Test | `pnpm test` |

### Caracteristicas

- **Sem human gate** — CI leve para feature branches
- **PostgresIncluso** — usa servico postgres:15-alpine
- **Concurrent:** mesmo branch com nova execucao cancela a anterior

---

## Code Review Pipeline

**Arquivo:** `.gitea/workflows/code-review.yml`

**Trigger:** `pull_request` (opened, synchronize, reopened)

### Gates

| Gate | Tipo | Descricao |
|------|------|-----------|
| **automated-checks** | Automatico | Type check + Lint + Build + Test |
| **security-scan** | Automatico | Trivy vulnerability scan |
| **ai-review** | Automatico | Claude Code CLI review como PR comment |
| **human-approval** | **MANUAL** | Aprovacao via Gitea Environment |
| **merge** | Final | Signal de readiness para merge |

### Debugar AI review

```bash
# Ver output do AI review
# O output e postado como comentario no PR

# Rebuild local
claude -p --print "Review this PR changes..."
```

---

## Run-Pipeline Script

**Arquivo:** `.claude/skills/orchestrator/scripts/run-pipeline.sh`

### Uso

```bash
bash .claude/skills/orchestrator/scripts/run-pipeline.sh <SPEC-NNN>
```

### Fluxo

```
1. Cria tasks/pipeline.json
2. Fase 1: SPEC-ANALYZER + ARCHITECT (paralelo)
   ├── snapshot.sh pre-phase-1
   └── wait-for-phase.sh 1
3. Fase 2: CODER-1 + CODER-2 (paralelo)
   ├── snapshot.sh pre-phase-2
   └── wait-for-phase.sh 2
4. Fase 3: TESTER + DOCS + SMOKE + REVIEWER
   └── snapshot.sh pre-phase-3
5. SHIP: ship.sh --pr
```

---

## Variaveis de Ambiente (Secrets)

| Secret | Uso |
|--------|-----|
| `COOLIFY_URL` | URL base do Coolify |
| `COOLIFY_API_KEY` | API key do Coolify |
| `GITEA_TOKEN` | Token Gitea para criar PRs/issues |
| `CLAUDE_API_KEY` | API key Claude para AI review |

---

## Quick Reference — Debug Commands

```bash
# Ver status do pipeline
cat tasks/pipeline.json

# Ver estado de todos os agentes
for f in tasks/agent-states/*.json; do
  echo "$f: $(jq -r '.status' $f)"
done

# Ver logs recentes
tail -f .claude/skills/orchestrator/logs/*.log

# Verificar health da aplicacao
curl -s https://web.zappro.site/_stcore/health

# Ver deploys recentes no Coolify
curl -s "$COOLIFY_URL/api/v1/applications/<UUID>/deployments" \
  -H "Authorization: Bearer $COOLIFY_API_KEY"

# Listar snapshots
bash .claude/skills/orchestrator/scripts/rollback.sh --list <PIPELINE_ID>
```

---

## Links

- **Gitea Actions:** https://git.zappro.site/will-zappro/monorepo/actions
- **Coolify:** https://coolify.zappro.site
- **Web (Production):** https://web.zappro.site
- **Second Brain:** https://git.zappro.site/will-zappro/hermes-second-brain
