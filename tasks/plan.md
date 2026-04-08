# Plan: Maximizar ROI do Claude Code — Use Cases Otimizados

**Host:** will-zappro  
**Date:** 2026-04-07  
**Context:** After Coolify audit, Infisical integration, and code review — focusing on highest-value AI assistant use cases for senior dev workflow.

---

## Executive Summary

O objetivo é maximizar o retorno do Claude Code como "senior dev proxy" em tasks que:
- Economizam tempo repetitivo
- Reduzem erros humanos
- Documentam decisões automaticamente
- Mantêm consistência entre sessões

**Não é sobre** usar IA para tudo — é sobre identificar onde ela agrega mais valor real.

---

## Current State Assessment

### Projetos no Monorepo

| Project | Focus | Claude Code ROI |
|---------|-------|----------------|
| `homelab-monorepo` | Self-hosting, monitoring, AI/ML stack | ALTO — infra as code, scripts, configs |
| `multi-claude` | CLI tool para API providers | MÉDIO — código straightforward |
| `openclaw` | Voice AI pipeline | MÉDIO — foco em debugging |

### Infraestrutura Homelab

| Service | Status | AI Opportunity |
|---------|--------|----------------|
| Coolify | 38 containers | Deploy configs, troubleshooting |
| Grafana + Prometheus | Monitoring stack | Alert debugging, dashboard creation |
| Infisical | Secrets vault (127 secrets) | Secrets rotation, audit |
| OpenClaw | Voice pipeline | Script generation, pipeline docs |
| ZFS + snapshots | 3.64TB storage | Backup automation, snapshot policies |

---

## Top 5 Use Cases por ROI (Prioridade)

### Use Case 1:Infraestrutura como Código ✅ (JÁ BEM CONFIGURADO)

**Descrição:** Claude Code gera e mantém Docker Compose, Prometheus alerts, Grafana dashboards, ZFS scripts.

**Examples:**
- `docker-compose.yml` generation from requirements
- Alert rule creation from incident post-mortems
- ZFS snapshot retention policies

**ROI:** ALTO — infra muda pouco mas precisa de precisão máxima

**Current state:** Partial. Alerts e dashboards já em git, mas sem spec-driven development para mudanças.

---

### Use Case 2:Code Review Automatizado ✅ (JÁ CONFIGURADO)

**Descrição:** Cron job `/code-review-daily` revisa commits, gera `REVIEW-*.md`, flagga issues.

**Examples:**
- Review de PRs antes de merge
- Scan de security issues em novos scripts
- Verificação de compliance com project conventions

**ROI:** ALTO — reduz debt técnico acumulado silenciosamente

**Current state:** Configurado mas cron `/code-review-daily` ainda usa agent inexistente.

---

### Use Case 3:Documentação Automática 📝 (PARCIAL)

**Descrição:** Após cada mudança significativa, Claude Code atualiza ADRs, README, architecture docs.

**Examples:**
- ADR para decisões de arquitectura
- Actualização de NETWORK_MAP.md após mudanças de rede
- Sync automático de docs → memory

**ROI:** MÉDIO-ALTO — documentação rara mas valiosa quando precisa existir

**Current state:** AI-CONTEXT MCP sync funciona. Mas ADRs estão desatualizados (alguns "pending").

---

### Use Case 4:Secrets & Compliance Audit 🔐 (PARCIAL)

**Descrição:** Scan automático de secrets em código, rotação de credenciais, compliance checks.

**Examples:**
- `grep -rE "ghp_|sk-|AKIA"` antes de push
- Verificação de compliance com GUARDRAILS.md
- Migration de .env para Infisical

**ROI:** ALTO — previne vazamentos críticos

**Current state:** Pre-commit hook existe mas não está ativo (não configurado via git hooks).

---

### Use Case 5:Voice Pipeline Debugging & Automation 🎤 (OPORTUNIDADE)

**Descrição:** Claude Code como "junior dev" para o OpenClaw — gera scripts de teste, debug output, documenta issues.

**Examples:**
- Analisar logs do Whisper STT quando falha
- Gerar testes de integração para Kokoro TTS
- Documentar pipeline de voz com diagrama

**ROI:** MÉDIO — pipeline complexo com muitos pontos de falha

**Current state:** STT ainda instável — prioridade conforme RESUMO COMPLETO.

---

## Vertical Slices (Implementação por Prioridade)

### Slice 1: Corrigir Cron Jobs com Agents Errados

**Problema:** `/code-review-daily`, `/modo-dormir-daily` usam agents que não existem no monorepo.

**Solução:** Atualizar prompts para usar slash commands nativos.

**Files to modify:**
- `.claude/scheduled_tasks.json` — 4 cron jobs com agent names errados

**Verification:**
```bash
jq '.tasks[].prompt' .claude/scheduled_tasks.json | grep -E "agent-|subagent" || echo "OK: no agent references"
```

---

### Slice 2: Ativar Pre-commit Hook

**Problema:** Secrets audit hook existe em `.claude/hooks/pre-commit` mas não está instalado.

**Solução:** Configurar git hooks path e instalar.

**Files to modify:**
- `.git/hooks/pre-commit` → copiar de `.claude/hooks/pre-commit`

**Verification:**
```bash
git log --oneline -1 --format="%H" | xargs -I{} git hooks list {} pre-commit 2>/dev/null || echo "Hook not installed"
```

---

### Slice 3: Completar ADR Records

**Problema:** Alguns ADRs estão "pending" — decisões tomadas mas não documentadas.

**Solução:** Preencher ADRs pendentes com contexto e justificativa.

**Files to identify:**
```bash
grep -r "pending\|TODO" /srv/monorepo/docs/adr/ --include="*.md" | head -10
```

---

### Slice 4: Voice Pipeline Test Suite

**Problema:** Whisper STT "não funciona via Telegram" — sem testes para identificar onde quebra.

**Solução:** Criar smoke tests para voice pipeline.

**Files to create:**
- `tasks/smoke-tests/pipeline-voice.yaml` — testes de integração
- `tasks/smoke-tests/results/pipeline-voice.json` — output

**Verification:**
```bash
bash tasks/smoke-tests/run-smoke-tests.sh voice 2>&1 | tail -10
```

---

### Slice 5: Infisical → Coolify Secret Migration

**Problema:** Secrets do Coolify ainda em `.env` plain text em `/srv/data/coolify/services/*/.env`.

**Solução:** Usar Infisical SDK + wrapper script (já criado) para fazer bootstrap dos services.

**Files to use:**
- `/srv/ops/scripts/infisical-monitoring.sh` (já criado — adaptar para Coolify)

**Verification:**
```bash
python3 -c "
from infisical_sdk import InfisicalSDKClient
c = InfisicalSDKClient(host='http://127.0.0.1:8200', token='$(cat /srv/ops/secrets/infisical.service-token)')
secrets = c.secrets.list_secrets(project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37', environment_slug='dev', secret_path='/')
print(f'Coolify secrets in vault: {len([s for s in secrets.secrets if \"coolify\" in s.secret_key.lower()])}')
"
```

---

## Dependency Graph

```
Slice 1 (Cron Fixes)
    └── Slice 2 (Pre-commit Hook)     [independent, can parallel]
            └── Slice 3 (ADRs)       [depends on Slice 1+2]

Slice 4 (Voice Tests)
    └── Slice 5 (Coolify Secrets)    [depends on understanding what's broken in voice]
```

---

## O Que NÃO Fazer

- Não migrar tudo para Infisical de uma vez — risco de quebrar serviços
- Não criar mais cron jobs sem testar os existentes primeiro
- Não adicionar AI para decisões de arquitectura — documentar, não deciding
- Não usar AI para coisas que um script bash resolve em 5 minutos

---

## Checkpoints

1. **After Slice 1:** `jq '.tasks[].id' .claude/scheduled_tasks.json | wc -l` mostra 9 jobs sem errors
2. **After Slice 2:** `git commit` trigger hook scanea staged files sem false positives
3. **After Slice 3:** `ls docs/adr/*.md | wc -l` sem files com "pending" no content
4. **After Slice 4:** Voice pipeline smoke tests passam 80%+
5. **After Slice 5:** Coolify secrets migrados, .env plain text apagados

---

## Last Updated

2026-04-07 — after Coolify audit + Infisical integration + code review
