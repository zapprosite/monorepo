---
name: SPEC-022 Cursor-Loop CLI Solutions
description: Research findings and implementation plan for full-CLI autonomous cursor-loop without dashboard dependencies
type: specification
---

# SPEC-022: Cursor-Loop CLI Solutions — Barreiras e Soluções Full-CLI

**Status:** DRAFT
**Created:** 2026-04-10
**Updated:** 2026-04-10
**Author:** will
**Related:** SPEC-021, SPEC-README

---

## Objective

Documentar barreiras e soluções CLI-only para o cursor-loop autónomo. O objetivo é eliminar dependências de dashboard e implementar Gates Humanos via CLI com notificação Telegram.

---

## Executive Summary

Dos 19 agentes de pesquisa, as principais conclusões são:

| Categoria | Status | Prioridade |
|-----------|--------|------------|
| Coolify CLI | ✅ SOLUÇÃO CLI EXISTE | Baixa (API curl funciona) |
| Infisical CLI | ✅ SOLUÇÃO CLI EXISTE | Baixa (CLI + SDK Python) |
| Terraform Cloudflare | ✅ SOLUÇÃO CLI EXISTE | Baixa (terraform init/plan/apply) |
| Gitea Actions CLI | ⚠️ PARCIAL (tea CLI + API curl) | Media |
| Claude Code Autonomy | ✅ CLI FLAG EXISTE | Crítica (--dangerouslySkipPermission) |
| SPEC Quality Gates | ❌ GAP - sem validação CLI | Alta |
| Human Gates | ❌ GAP - scripts parciais | Crítica |
| Tavily MCP | ❌ NÃO INSTALADO | Media |
| Context7 MCP | ✅ JÁ CONFIGURADO | Baixa |
| ZFS Snapshots | ✅ SOLUÇÃO CLI EXISTE | Baixa |
| Smoke Tests | ✅ SOLUÇÃO CLI EXISTE | Baixa |
| Rollback CLI | ✅ SOLUÇÃO CLI EXISTE | Baixa |

---

## Tech Stack

| Component | Technology | Usage |
|-----------|------------|-------|
| CI/CD | Gitea Actions + tea CLI | Trigger/watch CI via CLI |
| Secrets | Infisical CLI + Python SDK | Secrets management |
| Deploy | Coolify API (curl) | Application deployment |
| DNS | Terraform + Cloudflare provider | DNS management |
| Snapshots | ZFS CLI (zfs snapshot/rollback) | Pre-deploy backup |
| Notifications | Telegram Bot API (curl) | Human gate alerts |
| Research | Tavily MCP (quando instalado) | Web research |
| Docs | Context7 MCP (já configurado) | Library documentation |

---

## 1. CLI-Only Infrastructure Solutions

### 1.1 Coolify Deploy (CLI/API)

**Situação Atual:** API funciona via curl. Bearer token pode retornar 401 se IP não estiver na AllowList.

**Solução CLI:**
```bash
# Deploy via API
curl -X GET "https://cloud.zappro.site/api/v1/deploy?uuid=${UUID}" \
  -H "Authorization: Bearer ${COOLIFY_ACCESS_TOKEN}"

# Deploy com force rebuild
curl -X GET "https://cloud.zappro.site/api/v1/deploy?uuid=${UUID}&force=true"
```

**CLI alternativo:**
```bash
npm install -g coolify
coolify deploy name my-application --force
```

---

### 1.2 Infisical Secrets (CLI/SDK)

**Solução CLI:**
```bash
export INFISICAL_TOKEN=$(infisical login --method=universal-auth \
  --client-id=$INFISICAL_CLIENT_ID \
  --client-secret=$INFISICAL_CLIENT_SECRET --silent --plain)

infisical secrets get SECRET_NAME --env=dev --plain
infisical run --env=dev --watch -- npm run dev
```

**Python SDK:**
```python
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(host="http://127.0.0.1:8200", token=token)
secrets = client.secrets.list_secrets(project_id='...', environment_slug='dev')
```

---

### 1.3 Terraform Cloudflare DNS

```bash
terraform init -input=false
terraform plan -out=tfplan -input=false
terraform apply -input=false -auto-approve tfplan
```

---

### 1.4 Gitea Actions (tea CLI + API)

```bash
# tea CLI
tea actions workflows list
tea actions runs list --status failure
tea actions runs logs 123 --follow

# API curl
curl -X POST "https://gitea.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches" \
  -H "Authorization: token {TOKEN}" -d '{"ref": "main"}'
```

**Gap:** gh CLI não é compatível com Gitea. Usar tea.

---

### 1.5 ZFS Snapshots

```bash
sudo zfs snapshot -r "tank@pre-$(date +%Y%m%d-%H%M%S)-deploy"
sudo zfs rollback -r "tank@pre-20260410-120000-deploy"
```

---

### 1.6 Smoke Tests

```bash
http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/health" 2>/dev/null || echo "000")
[ "$http_code" != "200" ] && exit 1
bash tasks/smoke-tests/run-smoke-tests.sh
```

---

### 1.7 Rollback

```bash
curl -s "$COOLIFY_URL/api/v1/applications/$APP_UUID/deployments" \
  -H "Authorization: Bearer $COOLIFY_API_KEY"

curl -X POST "$COOLIFY_URL/api/v1/applications/$APP_UUID/deploy" \
  -H "Authorization: Bearer $COOLIFY_API_KEY" \
  -d '{"commit": "'$PREV_COMMIT'"}'
```

---

## 2. Claude Code CLI Autonomy

### Flags

| Flag | Purpose |
|------|---------|
| `--dangerouslySkipPermission` | Skip all prompts |
| `--allowedTools` | Whitelist tools |
| `--max-iterations N` | Safety limit |

```bash
claude -p "task" --dangerouslySkipPermission \
  --allowedTools "Bash,Read,Edit,Write,Search" --max-iterations 20
```

### Ralph Loop

```bash
/ralph-loop "task" --max-iterations 20 --completion-promise "TASK COMPLETE"
```

---

## 3. Human Gates Architecture

### Gaps

| Gap | Impact |
|-----|--------|
| No CLI approval | Cannot approve via CLI |
| No polling loop | Loop exits instead of waiting |
| unblock.sh manual | Not integrated |

### Solution

**approve.sh:**
```bash
#!/bin/bash
TASK_ID=$1
STATE_FILE="tasks/pipeline-state.json"

while true; do
  APPROVAL=$(jq -r ".approvals.$TASK_ID.status // \"pending\"" "$STATE_FILE")
  [ "$APPROVAL" != "pending" ] && echo "Approval: $APPROVAL" && exit 0
  echo "Waiting for approval on $TASK_ID..."
  sleep 30
done
```

**wait_for_human():**
```bash
while jq -e '.humanGateRequired == true' "$STATE_FILE" > /dev/null; do
  sleep 30
done
```

---

## 4. MCP Integration

| MCP | Status | Action |
|-----|--------|--------|
| Context7 | ✅ Configurado | Usar normalmente |
| Tavily | ❌ Não instalado | `claude mcp add --transport http tavily ...` |
| Coolify | ⚠️ Não usado | API curl funciona |
| Gitea | ⚠️ Não usado | tea CLI + API |

**Tavily install:**
```bash
claude mcp add --transport http tavily \
  "https://mcp.tavily.com/mcp/?tavilyApiKey=$TAVILY_API_KEY"
```

---

## 5. Telegram Alert

```bash
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": 123456789, "text": "Human gate required", "parse_mode": "HTML"}'
```

With buttons:
```bash
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -d '{"chat_id": 123, "text": "Approve?", "reply_markup": {"inline_keyboard": [[{"text": "Approve", "callback_data": "approve_P001"}]]}}'
```

---

## 6. Known Barriers (Dashboard-Only)

| Service | Dashboard-Only | CLI Solution |
|---------|----------------|--------------|
| Coolify secrets | Yes | API partial |
| Gitea runners | Yes | tea + API partial |
| Infisical projects | Yes | CLI full |

---

## 7. Implementation Roadmap

### Phase 1 — Critical

| # | Action | Priority |
|---|--------|----------|
| 1 | Create `scripts/approve.sh` | CRITICAL |
| 2 | Create `scripts/query-gate.sh` | CRITICAL |
| 3 | Add polling loop to pipeline-runner | CRITICAL |
| 4 | Integrate Telegram alerts | CRITICAL |

### Phase 2 — Should-Have

| # | Action | Priority |
|---|--------|----------|
| 5 | Create `spec-validate.sh` | HIGH |
| 6 | Install Tavily MCP | MEDIUM |
| 7 | Document tea CLI in SPEC-021 | MEDIUM |

---

## 8. Research Results Summary

| # | Topic | Finding | Gap | Solution |
|---|-------|---------|-----|----------|
| 1 | Human gates | unblock.sh exists | No polling | approve.sh |
| 2 | Coolify CLI | API works | 401 IP | Allowlist |
| 3 | Infisical CLI | Full CLI+SDK | None | Done |
| 4 | Terraform CF | Full CLI | None | Done |
| 5 | Gitea | tea+API | gh incompatible | Use tea |
| 6 | Claude Code | --dangerouslySkipPermission | Hooks needed | PreToolUse |
| 7 | SPEC quality | No validation | spec-validate missing | Create it |
| 8 | ZFS | Full CLI | None | Done |
| 9 | Smoke tests | curl scripts exist | None | Done |
| 10 | Rollback | API+ZFS | None | Done |
| 11 | Escalation | Patterns known | Implementation | Telegram |
| 12 | Tavily | Not installed | Install needed | claude mcp add |
| 13 | Context7 | Configured | None | Done |
| 14 | Monorepo | pnpm turbo | None | Done |
| 15 | Log agg | logcli+Vector | None | Done |
| 16 | GitOps | --force-with-lease | None | Done |
| 17 | Telegram | Bot API full | None | Script it |
| 18 | Qdrant | REST+SDK | No CLI | curl |
| 19 | Ollama | Full CLI+REST | None | Done |

---

## Checklist

- [x] Research 19 topics complete
- [ ] Implement approve.sh
- [ ] Implement query-gate.sh
- [ ] Add polling loop
- [ ] Telegram alerts
- [ ] spec-validate.sh
- [ ] Install Tavily MCP
- [ ] Update SPEC-021
