# INCIDENT-2026-04-08: Perplexity Agent GitOps Gap

**Data:** 2026-04-08
**Severidade:** 🔴 HIGH (site down por ~4 horas)
**Tipo:** GitOps Gap / Deployment Automation Failure
**Status:** ✅ RESOLVIDO

---

## Sumário

`web.zappro.site` ficou indisponível porque o container Docker do `perplexity-agent` nunca foi deployado no Coolify, apesar do DNS (Terraform) e do subdomain (Cloudflare Tunnel) já estarem configurados.

---

## Timeline

| Hora | Evento |
|------|--------|
| ~04/2026 | Terraform configurou subdomain `web.zappro.site` |
| ~04/2026 | Coolify App criada com UUID |
| ~04/2026 | Gitea Action criada para deploy automático |
| 08:00 | Container não existia — site down |
| 08:XX | Deploy manual feito via `docker run` |
| 08:XX | Container "Up (healthy)" confirmado |
| 08:XX | web.zappro.site retorna HTTP 200 |

---

## Root Cause

**Gap entre Terraform (DNS) e Coolify (Deploy):**

```
Terraform Apply → DNS criado → Cloudflare Tunnel UP
                                     ↓
                              (Ninguém disparou deploy)
                                     ↓
                              Container não existe
```

O processo de deploy tinha duas partes desconectadas:
1. **Infraestrutura como Código:** Terraform gerencia DNS/tunnel
2. **Deploy Manual:** Alguém precisava fazer `docker run` ou usar a UI do Coolify

A assunção errada era que o Gitea Action resolveria isso automaticamente — mas ele só disparava se houvesse um push em `apps/perplexity-agent/`.

---

## O que Nos Impedia de Ver o Problema

| Sintoma | Por que era enganoso |
|---------|---------------------|
| DNS "OK" | Cloudflare Tunnel estava UP, mas container não |
| "Coolify App existe" | App existia na UI, mas sem container |
| "Health check OK" | `/health` não estava configurado no Streamlit |
| Workflow "pronto" | Gitea Action nunca tinha sido testado com push real |

---

## Lessons Learned

### 1. DNS ≠ Container
Cloudflare Tunnel estar UP não significa que o container está rodando. O tunnel apenas escuta na porta — se não há container, retorna connection refused.

### 2. GitOps é "push-triggered"
Gitea Action só dispara com push. Se ninguém fez push, o deploy nunca aconteceu.

### 3. Health check é mandatório
Action que termina sem verificar health deixou-nos cegos. "Deploy triggered" ≠ "Deploy successful".

### 4. Auto-healer sem cron é inútil
Scripts de auto-healer existiam como skill mas não estavam agendados. Não executavam automaticamente.

---

## Fixes Implementados

### A. Gitea Workflow com Health Check
```
Deploy → Polling (60s) → Status Check → Smoke Test → (Rollback on fail)
```

### B. Smoke Test Automático
```bash
# /home/will/.claude/skills/gitea-coolify-deploy/scripts/smoke-test.sh
curl -s -o /dev/null -w "%{http_code}" https://web.zappro.site/_stcore/health
# Retry a cada 5s, timeout 60s
```

### C. Cron Jobs Agendados
| Job | Frequência | Função |
|-----|-------------|--------|
| `d201999d` | `*/5 * * * *` | Auto-healer (restart se degraded/down) |
| `95c72b71` | `3 */15 * * *` | Resource monitor (CPU >70%, Memory >80%) |

### D. Rollback Automático
Se smoke test falha após timeout, o workflow busca o commit anterior e faz rollback automaticamente.

### E. SPEC-PERPLEXITY-GITOPS.md
Documentação completa do padrão para evitar gap futuro.

---

## Prevenção Futura

### Checklist para Novos Services

Antes de marcar "deploy pronto", verificar:

- [ ] Container foi deployado manualmente pelo menos uma vez
- [ ] Health endpoint retorna HTTP 200
- [ ] Smoke test existe e passa
- [ ] Gitea Action testado com push real (não só commitado)
- [ ] Cron jobs de auto-healer configurados (se aplicável)
- [ ] DNS resolve para IP correto
- [ ] Cloudflare Tunnel está processando requests

### Padrão GitOps (NON-NEGOTIABLE)

```
┌────────────────────────────────────────────────────────┐
│  ANTES DE MARCAR "DEPLOY PRONTO"                        │
│                                                         │
│  1. git push → Gitea Action executa ✓                   │
│  2. Container fica "Up (healthy)" no Coolify ✓         │
│  3. Site retorna HTTP 200 ✓                             │
│  4. Smoke test passa ✓                                  │
│  5. Cron jobs ativos (se auto-healer) ✓               │
└────────────────────────────────────────────────────────┘
```

### Scripts de Verificação

```bash
# Verificar se container existe E está rodando
docker ps | grep perplexity
curl -s -o /dev/null -w "%{http_code}" https://web.zappro.site/_stcore/health

# Verificar se cron jobs estão activos
crontab -l | grep auto-healer
crontab -l | grep resource-monitor

# Verificar logs de heal
tail -20 /srv/ops/logs/healing.log
```

---

## Referências

- **SPEC:** `/srv/monorepo/docs/specflow/SPEC-PERPLEXITY-GITOPS.md`
- **Workflow:** `/.gitea/workflows/deploy-perplexity-agent.yml`
- **Scripts:** `/home/will/.claude/skills/gitea-coolify-deploy/scripts/`
- **Guia Operacional:** `/srv/monorepo/docs/OPERATIONS/guide.md`

---

**Registrado:** 2026-04-08
**Autor:** will
**Proxima revisão:** 2026-05-08
