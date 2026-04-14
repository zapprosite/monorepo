# SPEC-001: Workflow Performatico de AI Tools

**Date:** 2026-04-08
**Status:** DRAFT — awaiting human approval
**Branch:** `feature/claude-workflow-performatico`

---

## Objective

Criar o **workflow performatico de AI tools** para o host `will-zappro`: um sistema de orchestração que conecta Claude Code CLI, OpenCode CLI e OpenClaw Bot com hardening de segurança, audit trail, auto-detection de secrets expostos, e alertas Telegram.

**User:** Principal Engineer (will) — opera num homelab com 26+ serviços

**Success criteria:**
- FASE 1 completa: secrets fora de env vars, audit trail ativo, healthchecks nos cron jobs
- FASE 2 completa: SPEC + skill + workflow como código (`pipeline.json`)
- FASE 3 completa: auto-detectar secrets plaintext, alertas quando tool não reporta
- Zero secrets em plaintext após FASE 1
- Audit log contém todas as execuções entre tools

---

## Tech Stack

| Componente | Tecnologia |
|------------|------------|
| SDK | Python `infisicalsdk>=0.1.3,<1.0.17` |
| Audit | JSONL append-only em `~/.claude/audit/` |
| Logs centralizados | Loki/Promtail (já existe no host) |
| Skills | Ficheiros `.md` em `.claude/skills/` |
| Cron jobs | `.claude/scheduled_tasks.json` |
| Alertas | Telegram (OpenClaw bot) |
| Workflow | `pipeline.json` em `.claude/` |

---

## Commands

```bash
# Health check do workflow
~/.claude/skills/workflow-performatico/health-check.sh

# Audit trail — listar últimas 50 execuções
~/.claude/skills/workflow-performatico/audit.sh | tail -50

# Audit do workflow (skill)
/audit-workflow

# Secret scan (cron job ou manual)
/srv/ops/ai-governance/skills/secrets-audit/SKILL.md

# Pipeline workflow
cat .claude/pipeline.json | jq '.workflow'
```

---

## Project Structure

```
.claude/
├── skills/
│   ├── workflow-performatico/
│   │   ├── SKILL.md              # Skill principal: /audit-workflow
│   │   ├── health-check.sh       # Health check de todas as 3 tools
│   │   ├── audit.sh             # Lister audit log
│   │   └── pipeline.json       # Definição do workflow como código
│   ├── secrets-audit/           # Já existe — usar como base
│   └── monitoring-health-check/ # Já existe — usar como base
├── audit/
│   └── workflow-YYYYMMDD.jsonl  # Audit log append-only
├── scheduled_tasks.json         # Cron jobs (atualizar com healthchecks)
└── pipeline.json               # Workflow como código (agent-readable)
```

---

## Code Style

### Audit Log Entry
```jsonl
{"timestamp":"2026-04-08T10:30:00Z","tool":"claude-code-cli","action":"feature-commit","result":"success","commit":"abc123","branch":"feature/foo"}
{"timestamp":"2026-04-08T10:35:00Z","tool":"openclaw-bot","action":"alert-sent","result":"success","alert_type":"deploy-success","chat_id":"@CEO_REFRIMIX"}
```

### Health Check Script
```bash
#!/bin/bash
set -euo pipefail

# Verificar Claude Code CLI
if command -v claude &>/dev/null; then
  echo "[OK] Claude Code CLI"
else
  echo "[DOWN] Claude Code CLI"
fi

# Verificar OpenCode CLI
if command -v opencode &>/dev/null; then
  echo "[OK] OpenCode CLI"
else
  echo "[DOWN] OpenCode CLI"
fi

# Verificar OpenClaw bot (Telegram API health)
curl -sf http://localhost:8080/health &>/dev/null \
  && echo "[OK] OpenClaw" \
  || echo "[DOWN] OpenClaw"
```

### Pipeline JSON
```json
{
  "workflow": {
    "name": "ai-tools-performatico",
    "version": "1.0.0",
    "tools": ["claude-code-cli", "opencode-cli", "openclaw-bot"],
    "escalation": {
      "claude-code-cli": "terminal",
      "opencode-cli": "desktop",
      "openclaw-bot": "telegram"
    },
    "audit": {
      "format": "jsonl",
      "path": "~/.claude/audit/",
      "centralized": "loki:3100"
    },
    "alerts": {
      "channel": "telegram",
      "recipient": "@CEO_REFRIMIX_bot"
    }
  }
}
```

---

## Testing Strategy

| Nível | O quê | Onde |
|-------|-------|------|
| Unit | Script health-check.sh | `bash -n` syntax check |
| Unit | Script audit.sh | `bash -n` syntax check |
| Unit | pipeline.json schema | `jq` validation |
| Integration | Health check full | `~/.claude/skills/workflow-performatico/health-check.sh` |
| Integration | Audit log write | Append test entry, verify format |
| Integration | Secret scan | `grep` pattern match on test file |
| Smoke | Cron job fired | Verificar `lastFiredAt` atualizado |

**Coverage target:** Todas as skills cobrem healthcheck + error reporting.

---

## Boundaries

### Always
- Criar ZFS snapshot antes de qualquer mudança em `.claude/skills/` ou `pipeline.json`
- Usar Infisical vault para todos os secrets — NUNCA env vars plain text
- Adicionar entries ao audit log após cada ação cross-tool
- Seguir naming convention: `tank@pre-YYYYMMDD-HHMMSS-workflow-performatico`
- Atualizar `scheduled_tasks.json` lastFiredAt após cada cron execution

### Ask First
- Adicionar nova tool ao workflow (pode afectar o pipeline.json)
- Modificar formato do audit log (breaking change para agents)
- Mudar canal de alertas do Telegram (afecta todo o sistema)
- Adicionar secrets ao vault (pode haver rotação automática)

### Never
- Commitar `.env` ou secrets em plaintext
- Usar `env_file:` em Docker compose para secrets (usar Infisical init container)
- Remover ou desabilitar healthchecks dos cron jobs
- Fazer merge sem review do SPEC-001
- Expor portas fora de `PORTS.md` + `SUBDOMAINS.md`

---

## Fases de Implementação

### FASE 1 — Hardening

| Task | Acceptance | Verify | Files |
|------|------------|--------|-------|
| 1.2 | Criar skill `audit-workflow` em `.claude/skills/` | Skill responde a `/audit-workflow` e lista log | `.claude/skills/workflow-performatico/SKILL.md` |
| 1.3 | Adicionar healthchecks ao `scheduled_tasks.json` | Cron job verifica health antes de executar task | `.claude/scheduled_tasks.json` |
| 1.4 | Verificar `BROWSER_EVALUATE_ENABLED=false` no OpenClaw | `docker inspect` mostra `false` | docker-compose.yml |

### FASE 2 — Consolidação

| Task | Acceptance | Verify | Files |
|------|------------|--------|-------|
| 2.1 | Criar SPEC-001-workflow-performatico.md | Commit no main | `docs/SPECS/SPEC-001-workflow-performatico.md` |
| 2.2 | Criar `pipeline.json` com workflow como código | Agent consegue ler e executar | `.claude/pipeline.json` |
| 2.3 | Skill `/audit-workflow` funcional e documentada | `/audit-workflow` lista últimas 50 execuções | `.claude/skills/workflow-performatico/` |
| 2.4 | Health check script cobre todas as 3 tools | Script retorna OK/DOWN para cada tool | `.claude/skills/workflow-performatico/health-check.sh` |

### FASE 3 — Automation

| Task | Acceptance | Verify | Files |
|------|------------|--------|-------|
| 3.1 | Cron job auto-detectar secrets plaintext | Cron detecta e envia alerta Telegram | `.claude/scheduled_tasks.json` |
| 3.2 | Cron job auto-rotar tokens expirados | Aspiracional — requer workflow de renewal via API (não existe ainda) | Infisical SDK script |
| 3.3 | Alerta Telegram quando tool não reporta (>1h) | `health-check.sh` detecta DOWN → Telegram | `monitoring-health-check.md` skill |

### FASE 4 — Multi-Host (futuro)

| Task | Acceptance | Verify | Files |
|------|------------|--------|-------|
| 4.1 | Spec separado para multi-host | Spec-002 | `docs/SPECS/SPEC-002-multi-host.md` |
| 4.2 | Shared memory entre instâncias | Qdrant collection `shared-memory` | Infra |
| 4.3 | OpenClaw como orchestration layer | OpenClaw sabe estado de todos os hosts | OpenClaw skills |

---

## Open Questions

1. **Auto-rotação GitHub PAT:** Renewal via GitHub API não existe ainda — FASE 3 task 3.2 fica como aspiracional, implementar após existir workflow de renewal.
2. **Loki centralizado:** Loki/Promtail é para logs da stack monitoring (Grafana/Prometheus), não para audit trail. Audit logs ficam locais em `~/.claude/audit/`.

**Decisões tomadas (não precisa responder):**
- Audit trail = `~/.claude/audit/workflow-YYYYMMDD.jsonl` (append-only, local)
- Loki NÃO é usado para audit (é monitoring stack only)
- Auto-rotação secrets = aspiracional FASE 3 (precisa de workflow de renewal via API, não existe ainda)

---

## Verification Checklist

- [ ] SPEC-001 criado em `docs/SPECS/`
- [ ] Pipeline.json válido (`jq .workflow .claude/pipeline.json`)
- [ ] Audit log funciona (`~/.claude/audit/workflow-*.jsonl`)
- [ ] Health check cobre Claude Code CLI, OpenCode CLI, OpenClaw
- [ ] Secrets migrados para Infisical (verificar `.env` vazio)
- [ ] Cron job de secrets audit activo
- [ ] Alertas Telegram funcionando
