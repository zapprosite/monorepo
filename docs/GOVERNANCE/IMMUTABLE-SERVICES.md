---
version: 2.0
author: will-zappro
date: 2026-04-12
---

# Immutable Services Governance

**Versão:** 2.0 | **Data:** 2026-04-12
**Modelo:** PINNED + IMMUTABLE dual-layer
**Autoridade:** will-zappro

---

## PINNED vs IMMUTABLE — Dual-Layer Governance

### IMMUTABLE — Never Change, No Matter What

Services marked **IMMUTABLE** cannot be changed under any circumstances — not even with master password. They are foundational infrastructure that, if altered, would compromise the entire homelab integrity.

**Criteria for IMMUTABLE:**
- Single point of failure if changed
- Cannot be rebuilt from scratch
- Core routing/tunneling infrastructure
- Security-critical components

**Behavior:** Even with valid MASTER_PASSWORD, changes are **forbidden**. To modify an IMMUTABLE service, a complete homelab rebuild is required.

---

### PINNED — Can Change with MASTER_PASSWORD

Services marked **PINNED** are stable configurations that require the MASTER_PASSWORD to modify. They protect against accidental changes but can be updated through proper governance procedure.

**Criteria for PINNED:**
- Tested and validated in the current stack
- Changing would break integrations
- Costly to recreate (model cache, secrets, tunnels)
- Has dependent services

**Behavior:** Changes require:
1. ZFS snapshot before any modification
2. MASTER_PASSWORD via `/srv/ops/scripts/unlock-config.sh`
3. Proper change logging in INCIDENTS.md
4. Smoke test verification after change

---

## IMMUTABLE Services

These services are **never changeable** — treat as permanent infrastructure:

| Service | Type | Reason |
|---------|------|--------|
| **coolify-proxy** | Traefik reverse proxy | Port 8080 conflict resolution; cannot be remapped |
| **cloudflared** | Tunnel daemon | bot.zappro.site routing; tunnel cannot be recreated |
| **coolify-db** | PostgreSQL database | Coolify state store; changing breaks all Coolify metadata |
| **prometheus** | Metrics database | Alert history and monitoring data integrity |
| **grafana** | Dashboards | Dashboard configs and data sources |
| **loki** | Log aggregation | Log retention and query history |
| **alertmanager** | Alert routing | Notification pipeline integrity |
| **n8n** | Workflow automation | Production workflows depend on it |

**IMMUTABLE means:** Do not propose updates, restarts, config changes, or replacements — ever. If an IMMUTABLE service fails, escalate to human.

---

## PINNED Services

PINNED services can be changed with MASTER_PASSWORD following proper procedure:

| Service | Container | Why Pinned |
|---------|-----------|------------|
| **TTS Bridge** | `zappro-tts-bridge` | Filters Kokoro voices — only pm_santa/pf_dora allowed |
| **Kokoro TTS** | `zappro-kokoro` | Validated with OpenClaw watchdog; model cache large |
| **wav2vec2 STT** | `zappro-wav2vec2` | HF model cache 5.8GB; watchdog depends on port 8201 |
| **OpenClaw Bot** | `openclaw-qgtzrmi6771lt8l7x8rqx72f` | Complex config + secrets; tunnel routing validated |
| **LiteLLM Proxy** | `zappro-litellm` | GPU proxy for TTS/STT/Vision; config.yaml validated |
| **openwebui** | `openwebui` | Validated bridge target; OAuth integration stable |

---

## docker-autoheal Whitelist — Implicit PINNED

The docker-autoheal sidecar monitors and restarts unhealthy containers. Containers in its implicit whitelist are PINNED because autoheal preserves them:

| Container | Autoheal Behavior |
|-----------|-------------------|
| **prometheus** | Auto-restart on unhealthy |
| **grafana** | Auto-restart on unhealthy |
| **loki** | Auto-restart on unhealthy |
| **alertmanager** | Auto-restart on unhealthy |
| **coolify-proxy** | Auto-restart on unhealthy |
| **cloudflared** | Auto-restart on unhealthy |
| **n8n** | Auto-restart on unhealthy |
| **openwebui** | Auto-restart on unhealthy |
| **openclaw-mcp-wrapper** | Auto-restart on unhealthy |
| **openwebui-bridge-agent** | Auto-restart on unhealthy |

These services benefit from auto-healing but remain PINNED — changes still require MASTER_PASSWORD.

---

## Change Procedure for PINNED Services

```
1. ZFS SNAPSHOT — mandatory before any change
   sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-pinned-services

2. MASTER_PASSWORD unlock
   /srv/ops/scripts/unlock-config.sh

3. Make changes (all actions logged)

4. Re-lock after changes
   /srv/ops/scripts/lock-config.sh

5. Verify with smoke test
   bash /srv/monorepo/tasks/smoke-tests/pipeline-openclaw-voice.sh

6. Document in INCIDENTS.md
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| **PINNED-SERVICES.md** | Detailed registry of all pinned services with verification commands |
| **LOCKED-CONFIG.md** | Mechanism for protecting configs with MASTER_PASSWORD |
| **MASTER-PASSWORD-PROCEDURE.md** | Full lifecycle and emergency procedures for master password |
| **ANTI-FRAGILITY.md** | General resilience principles |
| **GUARDRAILS.md** | Forbidden actions and approval requirements |

---

## Summary

| Classification | Change Method | Can Override? |
|---------------|---------------|--------------|
| **IMMUTABLE** | Never | No — not even with MASTER_PASSWORD |
| **PINNED** | MASTER_PASSWORD + ZFS snapshot | Yes, with proper procedure |

**Golden Rule:** IMMUTABLE services are permanent. PINNED services are stable. Only propose changes to PINNED services through proper governance channels.

---

**Criado:** 2026-04-12
**Modelo:** PINNED + IMMUTABLE dual-layer
**Autoridade:** will-zappro