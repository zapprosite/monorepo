# SPEC-POLYMER-007 — HOMELAB COMPLETE LEGACY AUDIT
**Status:** IN PROGRESS
**Date:** 2026-05-01
**Auditor:** Hermes Agent

---

## OBJECTIVE
Ruthless audit of entire homelab: /srv/monorepo, /srv/ops, /srv/data, /srv/backups, ~/home

**Classificar cada item em:**
- ✅ **ACTIVE** — em uso, funciona, manter
- 🔄 **MIGRATE** — funciona mas deve mover de lugar
- 🗑️ **LEGACY** — não funciona ou duplicado, prune total
- ❓ **VERIFY** — precisa decisão do usuário

---

## PHASE 1: AUDIT RESULTS

### /srv/monorepo/apps/

| App | Status | Reason |
|-----|--------|--------|
| `ai-gateway/` | 🗑️ LEGACY | Duplicado — LiteLLM em zappro-litellm Docker. Sem uso. |
| `api/` | 🗑️ LEGACY | Duplicado — API do CRM é crm-api em Docker :4088 |
| `CRM-REFRIMIX/` | 🔄 ACTIVE | CRM principal, mas código legado — crm-mvp é o novo |
| `hvac-manual-downloader/` | ❓ VERIFY | Parece abandonado |
| `list-web/` | ❓ VERIFY | Propósito desconhecido |
| `monitoring/` | 🗑️ LEGACY | Duplicado — Prometheus+Grafana em Docker |
| `obsidian-web/` | ❓ VERIFY | UI para Obsidian? |
| `orchestrator/` | 🗑️ LEGACY | Hermes Agency — não existe como app |
| `painel-organism/` | 🔄 ACTIVE | Dashboard homelab — precisa rebuild (gemma4 no dist) |
| `perplexity-agent/` | ✅ ACTIVE | Container rodando :4004 |
| `web/` | ❓ VERIFY | Provavelmente frontend CRM legacy |
| `.pytest_cache/` | 🗑️ PRUNE | Cache de testes — não versionar |
| `alertmanager/` | 🗑️ LEGACY | Prometheus Alertmanager — não deployed |

### /srv/monorepo/archive/

| Archive | Status | Reason |
|---------|--------|--------|
| `SPECS-dead/` | 🗑️ PRUNE | SPECs mortas — podem ser apagadas |
| `flow-legacy-20260425/` | 🗑️ PRUNE | Legado de 04/25 |
| `hvac-rag-legacy/` | 🗑️ PRUNE | RAG superseded por trieve |
| `infrastructure/` | ❓ VERIFY | Terraform antigo? |
| `legacy/` | 🗑️ PRUNE | Legado geral |
| `logs-20260425/` | 🗑️ PRUNE | Logs velhos |
| `research-20260425/` | ❓ VERIFY | Pesquisas — talvez manter? |
| `smoke-tests/` | ❓ VERIFY | Testes — podem ser úteis |
| `tasks-20260425/` | 🗑️ PRUNE | Tarefas antigas |
| `.claude-brain-refactor/` | 🗑️ PRUNE | Refactor abortado |

### /srv/monorepo/.claude/

| Item | Status | Reason |
|------|--------|--------|
| `agents/` | ❓ VERIFY | Agentes CodeX/Claude — ativos? |
| `commands/` | 🔄 ACTIVE | Comandos CLI úteis — manter |
| `decisions/` | 🔄 ACTIVE | Decisões arquiteturais — manter |
| `docs-ptbr/` | 🔄 ACTIVE | Docs PT-BR — manter |
| `flow-next/` | 🗑️ LEGACY | Flow projetado mas nunca usado |
| `hooks/` | 🔄 ACTIVE | Git hooks — manter |
| `orchestrator/` | 🗑️ LEGACY | Orchestrator de 14 agentes — nunca implementado |
| `rules/` | 🔄 ACTIVE | Regras de segurança — manter |
| `scripts/` | 🗑️ LEGACY | Scripts velhos — ops/scripts é o correto |
| `skills/` | 🔄 ACTIVE | Skills reais — manter |
| `tasks/` | ❓ VERIFY | Tasks — verificar se ativas |
| `tools/` | 🗑️ LEGACY | Tools não usadas |
| `vibe-kit/` | 🗑️ LEGACY | Nunca existiu |
| `workflows/` | ❓ VERIFY | Workflows — verificar se usados |

### /srv/monorepo/.cline/

| Item | Status | Reason |
|------|--------|--------|
| `agents/` | 🗑️ LEGACY | Cloned from elsewhere, não é source |
| `rules/` | 🗑️ LEGACY | Duplicado de .claude/rules |

### /srv/monorepo/cmd/

| Item | Status | Reason |
|------|--------|--------|
| `index-hvac/` | ❓ VERIFY | Script de indexação — ativo? |
| `manual-scraper/` | ❓ VERIFY | Scraper de manuais — ativo? |
| `swarm/` | 🗑️ LEGACY | Experimentação abortada |
| `whatsapp-simulator/` | 🗑️ LEGACY | Mock — nunca production |

### /srv/monorepo/config/

| Item | Status | Reason |
|------|--------|--------|
| `hvac-copilot/` | ❓ VERIFY | Config COPILOT — ativo? |
| `hvac-rag/` | 🔄 ACTIVE | RAG config para HVAC — ativo em trieve |
| `litellm/` | 🔄 ACTIVE | Config LiteLLM — ativo em Docker |

### /srv/ops/

| Item | Status | Reason |
|------|--------|--------|
| `ai-governance/` | ✅ ACTIVE | Governança — MANTEM |
| `ansible/` | 🗑️ LEGACY | Ansible — superseded por Docker/Coolify |
| `backup-logs/` | 🔄 ACTIVE | Logs de backup — manter |
| `backups/legacy/` | 🗑️ PRUNE | Backups velhos |
| `claude-code-minimax.git/` | 🗑️ LEGACY | Repo clonado, não é source |
| `docker/` | ❓ VERIFY | Docker configs — ativos? |
| `gitea/` | 🔄 ACTIVE | Gitea setup — manter |
| `grafana/` | 🔄 ACTIVE | Grafana dashboards — manter |
| `hardware/` | 🔄 ACTIVE | Docs hardware — manter |
| `homelab-monitor/` | 🗑️ LEGACY | Script Python custom — superseded por Grafana |
| `locked-config/` | 🔄 ACTIVE | Configs sensíveis — manter |
| `scripts/` | ✅ ACTIVE | Scripts Hermes ops — MANTEM |
| `terraform/cloudflare/` | 🔄 ACTIVE | IaC Cloudflare — manter |

### /srv/data/

| Item | Status | Reason |
|------|--------|--------|
| `coolify/` | ✅ ACTIVE | Coolify data |
| `gitea/` | ✅ ACTIVE | Gitea data |
| `grafana/` | ✅ ACTIVE | Grafana data |
| `hvac-manuals/` | 🔄 ACTIVE | Manuais baixados |
| `hvac-rag/` | 🔄 ACTIVE | RAG data — activo em trieve |
| `infisical-db/` | ❓ VERIFY | Infisical — ainda usa? |
| `infisical-redis/` | ❓ VERIFY | Infisical — ainda usa? |
| `librarian/` | ❓ VERIFY | Desconhecido |
| `monitoring/` | 🔄 ACTIVE | Dados monitoring |
| `openclaw/` | 🗑️ LEGACY | OCR stack — não usado |
| `perplexity-agent/` | ✅ ACTIVE | Perplexity data |
| `postgres/` | 🔄 ACTIVE | Postgres data |
| `prometheus/` | ✅ ACTIVE | Prometheus data |
| `qdrant/` | ✅ ACTIVE | Qdrant data |
| `redis/` | ✅ ACTIVE | Redis data |
| `tts/` | 🔄 ACTIVE | TTS audio cache |

### /srv/backups/

| Item | Status | Reason |
|------|--------|--------|
| `brain/` | ✅ ACTIVE | Brain backups |
| `cloudflared/` | ✅ ACTIVE | Cloudflare backups |
| `env-secrets/` | ✅ ACTIVE | Secrets backups |
| `hermes-brain/` | ✅ ACTIVE | Hermes brain backups |
| `models/` | 🗑️ PRUNE | Models backup — Ollama não precisa |
| `ollama/` | ✅ ACTIVE | Ollama registry backup |
| `postgres/` | ✅ ACTIVE | Postgres backups |
| `qdrant/` | ✅ ACTIVE | Qdrant backups |
| `redis/` | ✅ ACTIVE | Redis backups |
| `security-*/` | ✅ ACTIVE | Security backups |
| `systemd/` | ✅ ACTIVE | Systemd backups |
| `deprecated-crons-*/` | 🗑️ PRUNE | Crons velhos — já migrados |
| `gitea-dump-*.tar.gz` | 🔄 PRUNE-OLD | Gitea dumps velhos (>7 dias) |
| `README.md` | 🗑️ PRUNE | Readme de backup antigo |
| `redis-backup-*.tar` | 🗑️ PRUNE | Backups redis velhos |

### ~/home/will/

| Item | Status | Reason |
|------|--------|--------|
| `.agent/` | ❓ VERIFY | Config agente |
| `.agents/` | ❓ VERIFY | Multi-agent configs |
| `.antigravity/` | ❓ VERIFY | Experimental |
| `.antigravity_cockpit/` | ❓ VERIFY | UI experimental |
| `.autotier/` | ❓ VERIFY | Tiering de storage? |
| `.bashrc/.bash_profile` | 🔄 ACTIVE | Shell config |
| `.biome/` | 🔄 ACTIVE | Biome formatter config |
| `.bun/` | 🔄 ACTIVE | Bun runtime |
| `.cache/` | 🗑️ PRUNE | Cache — não versionar |
| `.claude/` | ✅ ACTIVE | Claude Code config |
| `.codex/` | ❓ VERIFY | Codex config — ainda usa? |
| `.config/` | 🔄 ACTIVE | Apps config |
| `.context/` | 🔄 ACTIVE | Contexto projeto |
| `.cursor-loop/` | 🗑️ LEGACY | Cursor loop — não existe |
| `.cursorrules/` | ❓ VERIFY | Cursor rules — ativo? |
| `bin/` | 🔄 ACTIVE | Scripts pessoais |
| `Desktop/` | 🔄 ACTIVE | Desktop files |
| `dev/` | ❓ VERIFY | Dev work |
| `.docker/` | 🔄 ACTIVE | Docker configs |
| `.gemini/` | ❓ VERIFY | Gemini config |
| `.hermes/` | ✅ ACTIVE | Hermes agent |
| `.local/` | 🔄 ACTIVE | Local apps |
| `.npm/` | 🗑️ PRUNE | NPM cache |
| `.ssh/` | ✅ ACTIVE | SSH keys |

---

## EXECUTE PRUNE

### Commands to run:

```bash
# /srv/monorepo/apps/ LEGACY
rm -rf /srv/monorepo/apps/ai-gateway/
rm -rf /srv/monorepo/apps/api/
rm -rf /srv/monorepo/apps/monitoring/
rm -rf /srv/monorepo/apps/orchestrator/
rm -rf /srv/monorepo/apps/alertmanager/

# /srv/monorepo/archive/ PRUNE
rm -rf /srv/monorepo/archive/SPECS-dead/
rm -rf /srv/monorepo/archive/flow-legacy-20260425/
rm -rf /srv/monorepo/archive/hvac-rag-legacy/
rm -rf /srv/monorepo/archive/legacy/
rm -rf /srv/monorepo/archive/logs-20260425/
rm -rf /srv/monorepo/archive/tasks-20260425/
rm -rf /srv/monorepo/archive/.claude-brain-refactor/

# /srv/monorepo/.cline/ PRUNE
rm -rf /srv/monorepo/.cline/

# /srv/monorepo/.claude/ LEGACY
rm -rf /srv/monorepo/.claude/flow-next/
rm -rf /srv/monorepo/.claude/orchestrator/
rm -rf /srv/monorepo/.claude/scripts/
rm -rf /srv/monorepo/.claude/tools/
rm -rf /srv/monorepo/.claude/vibe-kit/

# /srv/monorepo/cmd/ LEGACY
rm -rf /srv/monorepo/cmd/swarm/
rm -rf /srv/monorepo/cmd/whatsapp-simulator/

# /srv/ops/ LEGACY
rm -rf /srv/ops/ansible/
rm -rf /srv/ops/backup-logs/ # move content to ops/logs
rm -rf /srv/ops/backups/legacy/
rm -rf /srv/ops/claude-code-minimax.git/
rm -rf /srv/ops/homelab-monitor/

# /srv/data/ LEGACY
rm -rf /srv/data/openclaw/

# /srv/backups/ PRUNE
rm -rf /srv/backups/models/
find /srv/backups -name "gitea-dump-*.tar.gz" -mtime +7 -delete
rm -f /srv/backups/README.md
find /srv/backups -name "redis-backup-*.tar" -mtime +7 -delete
rm -rf /srv/backups/deprecated-crons-*/

# ~/.home/ LEGACY
rm -rf ~/.home/.cursor-loop/
rm -rf ~/.cache/
rm -rf ~/.npm/

# Clear pytest cache
find /srv/monorepo -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
rm -rf /srv/monorepo/.pytest_cache/
```

---

## PENDING VERIFY (user decision needed)

1. `.codex/` — Codex ainda usado ou foi substituído por Claude Code?
2. `.cursorrules/` — Cursor rules — ativo?
3. `infisical-db/infisical-redis/` — Infisical ainda em uso?
4. `.antigravity/` e `.antigravity_cockpit/` — experimental, mantém?
5. `.librarian/` em /srv/data — o que é?
6. `apps/hvac-manual-downloader/` — ainda baixa manuais?
7. `apps/obsidian-web/` — o que é?
8. `apps/list-web/` — o que é?
9. `apps/web/` — frontend CRM legacy?
10. `cmd/index-hvac/` — ainda roda?
11. `cmd/manual-scraper/` — ainda usa?
12. `config/hvac-copilot/` — ativo?
13. `research-20260425/` — mantém ou prune?
14. `smoke-tests/` — úteis?
