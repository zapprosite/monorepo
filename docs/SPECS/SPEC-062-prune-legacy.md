---
name: SPEC-062-prune-legacy
description: Prune total de legacy — monorepo + home. CORE: Hermes/AI-Gateway/ListWeb/Monitoring + SPECs ativas + Governance. LEGACY: tudo o resto some.
spec_id: SPEC-062
status: IN_PROGRESS
priority: critical
author: Principal Engineer
date: 2026-04-17
---

# SPEC-062: Prune Total de Legacy

## Regra Única

**CORE é tudo que está deployed e funcionando. LEGACY é tudo o resto — não existe, não é comentado, não é archivado. APAGADO.**

---

## CORE — O que Fica

### Monorepo

```
apps/hermes-agency/     ← Hermes Agency Suite (SPEC-058/059/060)
apps/ai-gateway/       ← AI Gateway :4002 (SPEC-047/048)
apps/list-web/         ← List web
apps/monitoring/       ← Prometheus/Grafana

smoke-tests/
  smoke-agency-hardening.sh
  smoke-agency-suite.sh
  smoke-hermes-local-voice.sh
  smoke-hermes-ready.sh
  smoke-hermes-telegram.sh
  smoke-multimodal-stack.sh
  smoke-env-secrets-validate.sh

docs/
  SPECS/058,059,060,048,053,054 + 034,035,036,038 + TEMPLATE
  ADRs/
  GUIDEs/
  REFERENCE/
  GOVERNANCE/
  INFRASTRUCTURE/

.env + .env.example
docker-compose.yml
.claude/skills/   ← só activos (não stubs)
```

### Coolify (DEPLOYED — NÃO MEXER)

```
Hermes :8642 | Ollama :11434 | Litellm :4000 | Qdrant | OpenWebUI | Grafana
```

### Home (`/home/will/`)

```
~/.claude/  ← skills, commands, hooks, agents, audit, tasks, plans, mcps
```

---

## LEGACY — Apagar TUDO

### SPECs (apagar se existir)

```
SPEC-024-UNIFIED-CLAUDE-AGENT-MONOREPO
SPEC-027-voice-pipeline-humanized-ptbr
SPEC-032-tunnel-health-automation
SPEC-033-supabase-tunnel-exposure
SPEC-035-one-shot-prd-to-deploy
SPEC-036-infinite-memory-architecture
SPEC-039-hermes-gateway-tunnel
SPEC-040-homelab-alerting-rate-limit
SPEC-041-monorepo-estado-arte-polish
SPEC-043-subdomain-prune-hermes-migration
SPEC-046-hermes-agent-improvements
SPEC-051-legacy-services-prune-specs-polish
SPEC-052-hermes-mcp-context7-integration
SPEC-056-cursor-loop-enterprise-polish-2026
SPEC-057-hermes-multimodal-ptbr-minimax-polish
SPEC-AUDIT-*
SPEC-CLOUDFLARED-RESTART
SPEC-CURSOR-LOOP*
SPEC-HERMES-INTEGRATION
SPEC-HOMELAB-GOVERNANCE-DEFINITIVO
SPEC-HOMELAB-SEGURO-ESTAVEL
SPEC-INDEX
SPEC-README
SPEC-SPEC-AUTOMATOR
SPEC-TEMPLATE
SPEC-TEST-001-auto
SPEC-TROCAR-ROUPA
SPEC-TRANSFORM-MONOREPO
SPEC-PLANNING-PIPELINE
SPEC-100-PIPELINE-BOOTSTRAP
SPECFLOW README
tasks.md
SPEC-034-REVIEW-FINAL
SPEC-044-TERRAFORM-ENTERPRISE
SPEC-045-governance-reform-communication
SPEC-047-enterprise-polish-ai-gateway-ptbr
SPEC-049-ai-gateway-polish
SPEC-050-governance-alignment
SPEC-055-v2-gpu-max-latra-inteligent-cloud-fallback
```

### Arquivos/Dirs (apagar se existirem)

```
docs/archive/               ← apagar tudo dentro
.github/workflows/ci.yml
.github/workflows/code-review.yml
.github/workflows/daily-report.yml
.github/workflows/deploy-main.yml
.github/workflows/deploy-on-green.yml
.github/workflows/deploy-perplexity-agent.yml
.github/workflows/rollback.yml
smoke-tests/smoke-openclaw*.sh
smoke-tests/smoke-voice*.sh
smoke-tests/smoke-infisical*.sh
smoke-tests/smoke-deepgram*.sh
smoke-tests/smoke-loki*.sh
smoke-tests/smoke-langchain*.sh
smoke-tests/smoke-prometheus*.sh
smoke-tests/smoke-ai-gateway*.sh
smoke-tests/smoke-list-web*.sh
apps/openclaw*/
apps/voice-pipeline*/
apps/infisical*/
apps/supabase*/
scripts/openclaw*.sh
scripts/voice-pipeline*.sh
packages/  ← se não for usado
```

### Home Legacy (apagar se existirem)

```
~/openclaw*/
~/voice-pipeline*/
~/.claude/projects/-srv-monorepo/memory/openclaw-agents-kit.md
~/.claude/projects/-srv-monorepo/memory/voice-pipeline-08-04-2026.md
```

---

## PROIBIDO — NUNCA TOCAR

```
/srv/ops/         ← governance
/srv/backups/     ← backups
/srv/data/        ← data
/srv/docker-data/ ← docker
~/.ssh/           ← SSH keys
~/.npm/           ← npm cache
~/.gnupg/         ← GPG
~/.claude/settings.json
~/.claude/mcps/   ← MCP servers
obsidian/         ← espelho read-only
node_modules/     ← não regenerar
```

---

## Execução

14 agents em paralelo. Cada um apaga uma área. Sem archive, sem move, sem comentário. Só delete.

## Non-Goals

- NÃO mexer em Coolify
- NÃO alterar .env ou secrets
- NÃO apagar SPECs CORE (058,059,060,048,053,054,034,035,036,038,TEMPLATE)
- NÃO apagar ADRs/GUIDEs/REFERENCE/GOVERNANCE/INFRASTRUCTURE ativos
