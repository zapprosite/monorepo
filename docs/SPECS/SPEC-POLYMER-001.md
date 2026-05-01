# SPEC-POLYMER-001 — Reorganização Completa do Homelab

**Data:** 2026-04-30
**Status:** IN PROGRESS
**Owner:** William Rodrigues / Hermes
**Priority:** P0

---

## Objectivo

Organizar, estabilizar e documentar todo o homelab (/srv e Ubuntu Desktop) antes de qualquer produto de design ou dev automation. Polymer = integrar todos os componentes num sistema coeso com telemetria.

---

## Estado Actual — Diagnóstico

### Hardware
| Recurso | Estado | Risco |
|---|---|---|
| RTX 4090 24GB | 22GB VRAM livre | subaproveitado |
| 30GB RAM | 18GB used, 7.7GB SWAP | CRÍTICO — NVMe Gen5 em risco |
| ZFS tank 3.62TB | 177GB usado (4%) | subaproveitado |

### /srv — Repos Principais
| Repo | Tamanho | Estado |
|---|---|---|
| monorepo | 10.2GB | **FONTE DA VERDADE** |
| hermes-second-brain | ~50MB | Repositório de conhecimento/memória |
| ops | ~5MB | Scripts IaC e governança |
| fit-tracker | 8.3MB | **DUPLICADO** — apps espelhados no monorepo |
| hvacr-swarm | 134MB | **DUPLICADO** — apps espelhados + agente legado |
| archive | ~500KB | Stuff legado |

### Docker — Serviços Ativos
```
CRM-REFRIMIX (4088)       → Produção
Keycloak (8080/8443)      → Auth
Trieve (8090) + Qdrant    → Search/RAG
Coolify (8000)            → Deploy
Gitea (3300/2222)         → Git
Grafana/Prometheus        → Monitoring
OpenWebUI x2              → AI Chat UI
Searxng                   → Search
Edge TTS (8012)           → TTS
Qdrant (6333)             → DUPLICADO (tank + trieve + standalone)
Litellm (4000)            → LLM Gateway
node-exporter             → Metrics
```

### Containers Órfãos Identificados
```
openwebui-hvac     → UI para HVAC? Verificar uso
kind_easley        → Não identificado
competent_heyrovsky → Não identificado
```

### Swap — CRÍTICO
```
/swap.img 8GB — 7.7GB used
FSTAB: /swap.img none swap sw 0 0
```

---

## Plano de Execução

### FASE 1: Stabilização Urgente (Hardware Protection)

- [ ] **1.1** Desligar swap (`swapoff -a`, comentar fstab)
- [ ] **1.2** Audit containers órfãos (openwebui-hvac, kind_easley, competent_heyrovsky)
- [ ] **1.3** Desduplicar Qdrant (manter só tank/qdrant + trieve-qdrant)

### FASE 2: Reorganização /srv

- [ ] **2.1** Archive `/srv/fit-tracker` → `/srv/archive/fit-tracker-archived-YYYYMMDD`
- [ ] **2.2** Archive `/srv/hvacr-swarm` → `/srv/archive/hvacr-swarm-archived-YYYYMMDD`
- [ ] **2.3** Consolidar archive do monorepo em `/srv/monorepo/archive/`

### FASE 3: Docker Stack Cleanup

- [ ] **3.1** Remover containers órfãos identificados
- [ ] **3.2** Limpar volumes Docker órfãos
- [ ] **3.3** Verificar compose files em /srv/apps/

### FASE 4: Telemetria

- [ ] **4.1** Verificar Grafana dashboards activos
- [ ] **4.2** Configurar alerts: swap, VRAM, disk, containers down
- [ ] **4.3** Integrar Prometheus node-exporter + cadvisor
- [ ] **4.4** Criar dashboard "Homelab Overview"

### FASE 5: Desktop Ubuntu

- [ ] **5.1** Limpar ~/.local/share/applications/ (desktops órfãos)
- [ ] **5.2** Atualizar ~/Desktop/hermes-second-brain (sync com /srv version)
- [ ] **5.3** Criar ~/Desktop/SYSTEM_ARCHITECTURE.md
- [ ] **5.4** Limpar configs redundantes de editors (.cline, .continue, .cursor, .trae, .windsurf)

### FASE 6: Second Brain Update

- [ ] **6.1** Atualizar TREE.md com estado real pós-polymer
- [ ] **6.2** Atualizar SOUL.md com telemetria e stack atual
- [ ] **6.3** Commit e push para Gitea

---

## Ações Já Executadas

| Data | Acção | Estado |
|---|---|---|
| 2026-04-30 | Snapshot ZFS pre-polymer | ✅ tank@pre-polymer-20260430-172434 |
| 2026-04-30 | Delete brain-refactor/ | ✅ |
| 2026-04-30 | Delete whisper-server-v2.py | ✅ |
| 2026-04-30 | Archive fit-tracker → /srv/archive/fit-tracker-20260430 | ✅ |
| 2026-04-30 | Archive hvacr-swarm → /srv/archive/hvacr-swarm-20260430 | ✅ |
| 2026-04-30 | Docker reorg: orphans removidos, redes consolidadas | ✅ |
| 2026-04-30 | COMPOSE_PROJECT_NAME aplicado em todos 8 compose files | ✅ |
| 2026-04-30 | Qdrant consolidado: hermes-qdrant como fonte única | ✅ |
| 2026-04-30 | Prometheus Docker target corrigido (metrics-addr 0.0.0.0:9323) | ✅ |
| 2026-04-30 | SPEC-POLYMER-003 criado: Enterprise Orchestration | ✅ |
| 2026-04-30 | Orchestrator PoC: 5 tools via JSON-RPC :8095 | ✅ |
| 2026-04-30 | nexus-deploy.sh migrado para nexus_orchestrated.py | ✅ |
| 2026-04-30 | Skills audit: 5 skills corrigidas (vl-toggle, infra-audit) | ✅ |

---

## Rollback

```bash
sudo zfs rollback -r tank@pre-polymer-20260430-172434
```

---

## Notas

- fit-tracker e hvacr-swarm são duplicados do monorepo — apps são os mesmos
- AGENTS.md do hvacr-swarm marcado como DEPRECATED desde 2026-04-09
- Qdrant a correr em 3 lugares: tank/qdrant (ZFS), trieve-qdrant (docker), hermes-second-brain-qdrant (docker)
