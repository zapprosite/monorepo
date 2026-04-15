# SPEC-051: OpenClaw Prune & Specs Polish

**Date:** 2026-04-15
**Author:** Principal Engineer
**Status:** ACTIVE
**Type:** Infrastructure Cleanup

---

## Objective

Prune total do legado OpenClaw de todos os SPECs, docs, skills, scripts e containers. HERMES é o único assistente. Criar pipeline de tasks e executar com 14 agentes em paralelo.

---

## Background

Auditoria de 15/04/2026 revelou salada de referências OpenClaw legadas por todo o monorepo:

- SPECs arquivadas mas ainda referenciadas no SPEC-INDEX
- Skills com OpenClaw em tabelas de configuração
- Containers Docker a correr mas sem propósito (OpenClaw deprecated)
- Variáveis .env com chaves OpenClaw ainda activas
- Docs de infraestrutura com drifts entre PORTS/SUBDOMAINS/NETWORK_MAP
- Smoke tests legados ainda a apontar para portas 8202/8203

**Decisão:** HERMES é o único assistente. OpenClaw prune total.

---

## Scope

### Canonical Source of Truth

- **Assistente:** HERMES (único)
- **STT:** `Systran/faster-whisper-medium` em :8204 → ai-gateway
- **TTS:** Kokoro via TTS Bridge :8013
- **Voice:** Hermes Gateway :8642 → Telegram

### Canonical Ports (post-migration)

| Porta | Serviço                    | Status |
| ----- | -------------------------- | ------ |
| 4002  | ai-gateway (OpenAI compat) | ACTIVO |
| 8204  | faster-whisper-medium STT  | ACTIVO |
| 8642  | Hermes Gateway             | ACTIVO |
| 8092  | Hermes MCP                 | ACTIVO |
| 8013  | TTS Bridge (Kokoro)        | ACTIVO |

### Ports to Prune (OpenClaw legacy)

| Porta | Serviço                     | Acção             |
| ----- | --------------------------- | ----------------- |
| 4001  | OpenClaw Bot                | REMOVER container |
| 8202  | wav2vec2 STT                | REMOVER container |
| 8203  | wav2vec2-proxy (deepgram)   | REMOVER container |
| 8012  | Kokoro GPU (old)            | REMOVER container |
| 3456  | openwebui-bridge-agent      | REMOVER container |
| 4006  | mcp-monorepo (OpenClaw MCP) | REMOVER container |

---

## Files to Modify / Archive

### SPEC-INDEX.md — Arquivar 8 SPECs

- SPEC-007 (OpenClaw OAuth Profiles)
- SPEC-010 (OpenClaw Agents Kit)
- SPEC-011 (OpenClaw Agency Suite)
- SPEC-012 (openclaw-update-discoverer)
- SPEC-019 (OpenWebUI Repair)
- SPEC-020 (OpenWebUI OpenClaw Bridge)
- SPEC-025 (OpenClaw CEO Mix Voice Stack)
- SPEC-026 (OpenClaw TTS Route Fix)
- SPEC-009 (audio stack) → renomear para archived

### .env — Prune 12 variáveis

```
PRUNE: OPENCLAW_USER, OPENCLAW_PASSWORD, OPENCLAW_DEEPGRAM_API_KEY,
       OPENCLAW_GATEWAY_TOKEN, OPENCLAW_GEMINI_API_KEY,
       OPENCLAW_CONTAINER_NAME, OPENCLAW_FQDN,
       OPENCLAW_INTERNAL_URL, OPENCLAW_INTERNAL_PORT,
       STT_PROXY_URL, PORT=4001, WAV2VEC2_URL (já comentado)
```

### Skills — Update/Archive

| Skill                                   | Acção                                                |
| --------------------------------------- | ---------------------------------------------------- |
| `coolify-access/SKILL.md`               | ARCHIVE (docker-compose OpenClaw legacy)             |
| `coolify-sre/SKILL.md`                  | UPDATE (remover openclaw/openwebui, manter wav2vec2) |
| `cloudflare-terraform/SKILL.md`         | UPDATE (remover bot.zappro.site)                     |
| `cloudflare-tunnel-enterprise/SKILL.md` | UPDATE (remover bot.zappro.site)                     |

### Docs/OPERATIONS/SKILLS/ — Archive 13+ ficheiros

```
wav2vec2-health-check.md           (ARCHIVE)
wav2vec2-proxy.md                  (ARCHIVE)
wav2vec2-deepgram-proxy.py         (ARCHIVE)
wav2vec2-proxy.compose.yml         (ARCHIVE)
wav2vec2-deepgram-proxy.dockerfile (ARCHIVE)
voice-pipeline-watchdog.md          (ARCHIVE)
openwebui-health-check.sh          (ARCHIVE)
openwebui-runbook.md               (ARCHIVE)
openwebui_admin.py                 (ARCHIVE)
openwebui_secrets.py               (ARCHIVE)
openwebui-mcp-docker-compose.yml   (ARCHIVE)
openwebui-mcp.yml                  (ARCHIVE)
openclaw-agents-kit/               (ARCHIVE dir inteiro)
```

### Smoke-tests — Delete 4 ficheiros

```
tasks/smoke-tests/pipeline-openclaw-voice.sh    (DELETE)
tasks/smoke-tests/voice-proxy-smoke-test.sh     (DELETE)
tasks/smoke-tests/voice-pipeline-loop.sh         (DELETE)
tasks/smoke-tests/openwebui-api.sh               (DELETE)
smoke-tests/smoke-env-secrets-validate.sh        (DELETE — valida secrets OpenClaw legadas)
```

### Tasks files — Archive 7 ficheiros

```
tasks/todo-openwebui-claude-code-cli.md
tasks/plan-openwebui-claude-code-cli.md
tasks/plan-openclaw-oauth-profiles.md
tasks/plan-agency-reimagined.md
tasks/TODO-audio-stack.md
tasks/todo-agency-reimagined.md
tasks/PLAN-audio-stack-integration.md
```

### Docs infra — Fix drifts

| Ficheiro         | Fix                                                       |
| ---------------- | --------------------------------------------------------- |
| `NETWORK_MAP.md` | `llm.zappro.site` → :4002 (T400 done, drift)              |
| `PORTS.md`       | wava2vec2 8202/8203 como DEPRECATED (containers ainda UP) |
| `AGENTS.md`      | openwebui-bridge-agent (:3456) reference                  |

### Scripts — Archive

```
/srv/ops/scripts/openclaw-to-hermes-migration.sh
/srv/ops/scripts/hermes-openwebui-setup.sh
/srv/ops/scripts/openclaw-disable.sh
/srv/ops/scripts/hermes-migrate-now.sh (refere openclaw container)
/srv/monorepo/scripts/setup-whisper-medium-ptbr.sh
```

---

## Docker Containers to Remove

| Container                | Port | Reason                            |
| ------------------------ | ---- | --------------------------------- |
| `zappro-wav2vec2`        | 8202 | Legacy STT, substituído por :8204 |
| `zappro-wav2vec2-proxy`  | 8203 | Deepgram proxy, OpenClaw legacy   |
| `zappro-tts-bridge`      | 8013 | Kokoro bridge antigo              |
| `zappro-kokoro`          | 8012 | Kokoro GPU antigo (v0.2.2)        |
| `openwebui-bridge-agent` | 3456 | OpenWebUI bridge legacy           |
| `mcp-monorepo`           | 4006 | OpenClaw MCP                      |

**NOTA:** Remover via Coolify dashboard. Containers geridos por `/home/will/zappro-lite/docker-compose.yml` e Coolify.

---

## Terraform to Update

| Ficheiro                                     | Acção                                         |
| -------------------------------------------- | --------------------------------------------- |
| `/srv/ops/terraform/cloudflare/variables.tf` | Remover serviço "chat" (OpenWebUI deprecated) |
| `/srv/ops/terraform/cloudflare/README.md`    | Remover supabase.zappro.site                  |

---

## Success Criteria

- [ ] SPEC-INDEX.md sem referências OpenClaw (exceto arquivo)
- [ ] .env sem variáveis OPENCLAW\_
- [ ] docs/OPERATIONS/SKILLS/ sem ficheiros wav2vec2/openwebui/openclaw
- [ ] tasks/smoke-tests/ sem scripts legacy
- [ ] Docker sem containers OpenClaw legacy
- [ ] Skills actualizados sem openclaw/openwebui
- [ ] NETWORK_MAP.md corrigido (llm.zappro.site → :4002)
- [ ] smoke-tests pass com resultado consistente

---

## Dependencies

- Coolify acessível para remover containers
- Terraform apply para actualizar DNS
- Smoke tests validados após prune

---

## Risks

| Risco                               | Mitigação                                             |
| ----------------------------------- | ----------------------------------------------------- |
| Remover container que ainda é usado | Confirmar que ai-gateway usa :8204, não :8202         |
| Drift entre docs e realidade        | Verificarai-gateway routes antes de remover           |
| Coolify inacessível                 | Avaliar se containers podem ser removidos manualmente |

---

## Execution Plan

1. Criar SPEC-051
2. Executar /pg para gerar pipeline.json
3. Executar 14 agentes em paralelo para modificar ficheiros
4. Executar computer-loop para validação final
5. Commit e PR
