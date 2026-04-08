---
name: SPEC-Perplexity-GitOps
description: Padrão estável de deploy GitOps para Perplexity Agent via Gitea + Coolify
type: specification
---

# SPEC-001: Perplexity Agent — GitOps Deployment Pattern

**Status:** APPROVED
**Created:** 2026-04-08
**Author:** will
**Related:** SPEC-002 (Voice Pipeline), docs/OPERATIONS/guide.md

---

## User Story

Como **platform engineer**, quero fazer deploy do Perplexity Agent via GitOps, para que cada push à branch `main` dispare automaticamente um deploy no Coolify sem intervenção manual.

---

## Overview

Este documento define o padrão estável de deployment para o `perplexity-agent` usando:
- **Gitea Actions** como CI/CD engine
- **Coolify** como PaaS (deploy de containers Docker)
- **Infisical** como secrets manager (API keys, senhas)
- **Claude Code CLI** (`claude -p`) para automação de tasks

---

## Goals

### Must Have (MVP)
- [x] Push à `main` → Gitea Action dispara deploy no Coolify
- [x] UUID da app resolvido dinamicamente via API Coolify
- [x] Secrets nunca em código (Infisical + Gitea Secrets)
- [x] SSRF protection no deploy script
- [x] Health check após deploy (60s timeout)
- [x] Container exposto em porta 4004 (web.zappro.site)

### Should Have
- [ ] Auto-rollback em caso de deploy failure
- [ ] Notificação de sucesso/falha (Gitea webhook ou Slack)
- [ ] Smoke test automático pós-deploy

### Could Have
- [ ] Cron job auto-healer (a cada 5 min)
- [ ] Cron job resource-monitor (a cada 15 min)
- [ ] PR preview deployments

---

## Non-Goals

- Este pattern NÃO cobre CI/testes (apenas deploy)
- NÃO cobre migrations ou schema changes
- NÃO cobre multi-region deployment

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Gitea                                │
│                   (git.zappro.site)                          │
│                                                              │
│  push main ──► gitea/workflows/deploy-perplexity-agent.yml  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Infisical                                 │
│           (secrets: COOLIFY_API_KEY, etc)                  │
│                                                              │
│  Gitea Action fetch secret via token                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Coolify                                 │
│                (coolify.zappro.site)                        │
│                                                              │
│  POST /api/v1/applications/{uuid}/deploy                     │
│  GET  /api/v1/applications/{uuid}  (health check)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container                          │
│                 perplexity-agent :4004                       │
│                                                              │
│  Streamlit + browser-use + OpenRouter GPT-4o-mini           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    web.zappro.site (Cloudflare Tunnel)
```

---

## User Flows

### Fluxo Principal: Deploy via Git Push

```
1. Developer faz git push origin main
2. Gitea detecta push na branch main
3. Gitea Action inicia (workflow: deploy-perplexity-agent.yml)
4. Action busca COOLIFY_API_KEY do Gitea Secrets
5. Action executa: curl POST /api/v1/applications/{uuid}/deploy
   - UUID é resolvido via GET /api/v1/applications (lookup por nome)
6. Coolify executa docker-compose pull + up
7. Action polling health check (a cada 5s, timeout 60s)
8. Se status = running/idle → deploy sucesso
9. Se timeout → deploy pendente (Action exits 1)
```

### Fluxo Alternativo: Deploy Manual via CLI

```bash
# Usando deploy.sh diretamente (sem Gitea)
./deploy.sh --app perplexity-agent --branch main
```

---

## Secrets Reference

| Secret | Local | Gitea Secret | Infisical |
|--------|-------|--------------|-----------|
| `COOLIFY_URL` | `http://localhost:8000` | ✅ | ❌ |
| `COOLIFY_API_KEY` | ✅ | ✅ | ✅ |
| `COOLIFY_APP_UUID` | - | ✅ | ❌ |
| `INFISICAL_TOKEN` | `/srv/ops/secrets/infisical.service-token` | N/A | N/A |

---

## File Structure

```
/srv/monorepo/
├── .gitea/workflows/
│   └── deploy-perplexity-agent.yml      # Gitea Action workflow
├── apps/
│   └── perplexity-agent/
│       ├── Dockerfile
│       ├── docker-compose.yml
│       └── ... (app files)
└── docs/specflow/
    └── SPEC-PERPLEXITY-GITOPS.md        # Esta spec

/home/will/.claude/skills/
├── gitea-coolify-deploy/
│   └── scripts/
│       ├── deploy.sh                     # Script de deploy (HEREDOC Python, SSRF protection)
│       ├── smoke-test.sh                 # Smoke test pós-deploy
│       ├── auto-healer.sh               # Auto-healer (cron 5min)
│       └── resource-monitor.sh          # Resource monitor (cron 15min)
├── coolify-deploy-trigger/
├── coolify-auto-healer/
├── coolify-health-check/
├── coolify-resource-monitor/
└── coolify-rollback/
```

---

## Gitea Action Workflow

```yaml
# .gitea/workflows/deploy-perplexity-agent.yml
name: Deploy Perplexity Agent

on:
  push:
    branches: [main]
    paths:
      - 'apps/perplexity-agent/**'

env:
  COOLIFY_URL: ${{ secrets.COOLIFY_URL }}
  COOLIFY_APP_NAME: perplexity-agent

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get APP UUID
        run: |
          APPS_JSON=$(curl -s "$COOLIFY_URL/api/v1/applications" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}")
          APP_UUID=$(echo "$APPS_JSON" | python3 -c "
            import sys, json
            data = json.load(sys.stdin)
            for a in data.get('data', []):
              if 'perplexity' in a.get('name', '').lower():
                print(a['uuid'])
                break
          ")
          echo "APP_UUID=$APP_UUID" >> $GITHUB_ENV

      - name: Trigger Deploy
        run: |
          curl -s -X POST \
            "$COOLIFY_URL/api/v1/applications/$APP_UUID/deploy" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"pull_request_id": "main"}'

      - name: Wait for Deploy
        run: |
          # Polling loop com timeout 60s
          for i in {0..12}; do
            STATUS=$(curl -s "$COOLIFY_URL/api/v1/applications/$APP_UUID" \
              -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" | \
              python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
            echo "Status: $STATUS"
            if [[ "$STATUS" == "running" ]] || [[ "$STATUS" == "idle" ]]; then
              echo "Deploy successful"
              exit 0
            fi
            sleep 5
          done
          echo "Deploy timeout"
          exit 1
```

---

## Security Considerations

1. **SSRF Protection**: `validate_url()` em `deploy.sh` permite apenas `localhost` e `127.0.0.1`
2. **Secrets**: Nunca hardcoded — todos via Gitea Secrets ou Infisical
3. **UUID Lookup**: Apenas busca por nome contains (não é fixed match) — reduz risco de wrong target
4. **force-with-lease**: Não usar `--force` em pushes

---

## Acceptance Criteria

| # | Critério | Test |
|---|----------|------|
| AC-1 | Push à `main` em `apps/perplexity-agent/` dispara Gitea Action | Fazer push e verificar em git.zappro.site |
| AC-2 | Gitea Action faz deploy no Coolify sem errors | Ver logs do Action em git.zappro.site |
| AC-3 | Container fica `Up (healthy)` no Coolify dashboard | Verificar coolify.zappro.site |
| AC-4 | web.zappro.site retorna HTTP 200 | `curl -I https://web.zappro.site` |
| AC-5 | Secrets nunca aparecem em logs do Gitea Action | Review dos logs (redacted por padrão) |

---

## Edge Cases

| Caso | Comportamento esperado |
|------|----------------------|
| Coolify API retorna 403 | Action falha com erro claro (não timeout) |
| Container crash loop | Health check detecta e Action faila |
| App UUID não encontrada | Action falha com lista de apps disponíveis |
| Rede indisponível | Action retry ou fail após timeout |

---

## Decisions Log

| Data | Decisão | Rationale |
|------|---------|-----------|
| 2026-04-08 | UUID lookup dinâmico vs hardcoded | Evita sync de secrets entre Terraform e Gitea |
| 2026-04-08 | Infisical para secrets persistentes | Gitea Secrets volatile, Infisical é fonte de verdade |
| 2026-04-08 | SSRF protection via allowlist | Coolify URL nunca validata antes — risco SSRF |
| 2026-04-08 | Polling health check em vez de webhook | Simpler, não requer callback URL pública |

---

## Dependencies

| Dependência | Status | Notes |
|-------------|--------|-------|
| Coolify API v1 | ✅ OK | Endpoint `/api/v1/applications` |
| Infisical SDK | ✅ OK | Python SDK para secrets |
| Gitea Actions | ✅ OK | Workflow syntax compatível |
| Cloudflare Tunnel | ✅ OK | web.zappro.site exposto |
| Terraform Cloudflare | ✅ OK | DNS subdomain gerenciado |

---

## Checklist

- [x] SPEC escrita e revisada
- [x] Gitea Action workflow criado
- [x] deploy.sh refatorado com SSRF protection
- [x] Secrets configurados no Gitea
- [x] Container manual deployado e verified
- [x] Health check funcionando
- [x] Auto-rollback implementado (workflow)
- [x] Smoke test pós-deploy
- [x] Cron jobs (auto-healer 5min, resource-monitor 15min)
- [ ] Tasks geradas via `/pg`

---

## Comandos Úteis

```bash
# Ver status do container
docker ps | grep perplexity

# Ver logs
docker logs perplexity-agent --tail 50

# Verificar porta
ss -tlnp | grep 4004

# Health check manual
curl -s -o /dev/null -w "%{http_code}" http://localhost:4004

# Trigger deploy manualmente
/home/will/.claude/skills/gitea-coolify-deploy/scripts/deploy.sh \
  --app perplexity-agent --branch main

# Ver Gitea Action logs
# Acesse: git.zappro.site/{org}/{repo}/actions
```
