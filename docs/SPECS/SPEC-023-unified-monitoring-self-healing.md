# SPEC-023 — Unified Monitoring & Self-Healing Datacenter System

**Versão:** 1.0 | **Data:** 2026-04-10
**Status:** SPECIFIED | **Estack:** homelab-monorepo
**Owner:** will-zappro | **Branch:** feature/quantum-dispatch-ax7k2

---

## 1. Objective

Consolidar auto-healer.sh + health_agent.sh + Coolify + Prometheus + Grafana + AlertManager + n8n num sistema coeso de monitoring e self-healing. Corrigir gaps críticos e deixar rígido — "never touch after done".

---

## 2. Tech Stack

### 2.1 Stable Versions (Pinned to Digest)

| Componente | Versão | Digest/Tag | Notas |
|-----------|--------|------------|-------|
| Prometheus | 3.11.1 | `prom/prometheus:3.11.1` | TSDB 30d retention |
| Grafana | 12.4.2 | `grafana/grafana:12.4.2` | UID: `efg9h1u7ja6tcb` |
| AlertManager | 0.31.1 | `prom/alertmanager:0.31.1` | |
| cAdvisor | 0.56.2 | `gcr.io/cadvisor/cadvisor:0.56.2` | Docker metrics |
| node-exporter | 1.11.1 | `prom/node-exporter:1.11.1` | ⚠️ SEM Docker HEALTHCHECK |
| nvidia-gpu-exporter | 1.4.1 | `utkuozdemir/nvidia_gpu_exporter:1.4.1` | DCGM 4.5.2 |
| Loki | 3.7.0 | `grafana/loki:3.7.0` | ⚠️ SEM Docker HEALTHCHECK |
| Grafana Alloy | 1.12.0 | `grafana/alloy:1.12.0` | **Promail EOL → migrar** |

**RTX 4090 Limitação:** DCGM_FI_PROF_* profiling metrics só disponíveis em GPUs datacenter. VRAM, temperature, utilization normais disponíveis.

### 2.2 Rede

```
Monitoring network: monitoring_monitoring (10.0.16.x)
Prometheus scrape: via Docker DNS names (node-exporter:9100, etc.)
```

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  OBSERVABILITY LAYER                                             │
│  Prometheus (:9090) ──→ Grafana (:3100) ──→ Dashboards         │
│       ↑ scrape                                                   │
│  node-exporter (:9100)  cadvisor (:9250)  nvidia-gpu (:9835)    │
└─────────────────────────────────────────────────────────────────┘
                            ↓ alerts
┌─────────────────────────────────────────────────────────────────┐
│  ALERTING LAYER                                                  │
│  Prometheus alerts.yml ──→ AlertManager (:9093)                │
│       → alert-sender:8080 → Telegram @HOMELAB_LOPS_bot          │
│       (Python 3.12-slim, TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID) │
└─────────────────────────────────────────────────────────────────┘
                            ↓ webhook
┌─────────────────────────────────────────────────────────────────┐
│  CONTROL PLANE (LIMITED)                                         │
│  Coolify API → bloqueado por Cloudflare Access                 │
│  workaround: docker exec + docker-autoheal container           │
│  alert-sender → Telegram (único canal ativo)                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓ heal events
┌─────────────────────────────────────────────────────────────────┐
│  HEALING LAYER                                                  │
│  docker-autoheal (willfarrell/autoheal)                        │
│    interval: 60s, AUTOHEAL_CONTAINER_LABEL=all                 │
│  health_agent.sh (cron)                                         │
│  ⚠️ SEM ZFS snapshot before healing (GAP)                       │
│  ⚠️ SEM restart loop protection (GAP)                            │
│  ⚠️ SEM Coolify API integration (GAP)                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓ logs
┌─────────────────────────────────────────────────────────────────┐
│  LOGGING LAYER                                                  │
│  ⚠️ Promail EOL (março 2026) → migrar para Grafana Alloy       │
│  Loki (:3101) ← docker logs (json-file, max-file:3, max-size:10m) │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Critical Gaps

### 4.1 🔴 Alta — Corrigir Antes do Deploy

| Gap | Impacto | Solução |
|-----|---------|---------|
| **node-exporter SEM Docker HEALTHCHECK** | Prometheus não detecta se exporter cai | Adicionar healthcheck ao container |
| **loki SEM Docker HEALTHCHECK** | Loki pode estar DOWN sem detecção | Adicionar healthcheck ao container |
| **SEM restart loop protection** | Container em restart loop causa cascading failures | Implementar: RestartCount ≥ 3 em 1h OR avg interval < 30s → block 10min + ZFS snapshot |
| **SEM ZFS snapshot before healing** | CONTRATO viola: healing scripts não criam snapshot antes de heal | Integrar snapshot no heal pipeline |
| **cadvisor DOWN em Prometheus** | cAdvisor marca `Up` mas Prometheus scrape falha por timeout 10s | Aumentar scrape timeout para 30s em prometheus.yml |

### 4.2 🟡 Média — Implementar no Pipeline

| Gap | Impacto | Solução |
|-----|---------|---------|
| **SEM pinned container whitelist** | Autohealer pode restartar serviços críticos | Criar whitelist: coolify-db, prometheus, grafana, loki, alertmanager |
| **logs SEM rotação** | Docker json-file log cresce indefinidamente | `max-size: 10m, max-file: 3` JÁ configurado em todos containers — verificar |
| **health_agent.sh NÃO usa Coolify API** | Gap de integração | health_agent.sh roda via cron, não precisa de Coolify API se docker-autoheal cobre restart |
| **double-run cron** | health_agent.sh executa 2x ao mesmo tempo | Lockfile com `flock` |

### 4.3 🟢 Baixa — Melhorar

| Gap | Solução |
|-----|---------|
| Promail EOL | Migrar para Grafana Alloy (1.12.0) |
| AlertManager nflog permission denied | Garantir que `/srv/data/monitoring/alertmanager/` tem owner `will:will` |
| Prometheus targets cAdvisor DOWN | Scrap timeout 10s → 30s |
| Prometheus targets loki DNS fail | Verificar network alias em docker-compose |

---

## 5. Pinned Container Whitelist

Containeres que **NUNCA** devem ser restartados automaticamente pelo autohealer:

```yaml
PINNED_CONTAINERS:
  - coolify-db          # Database — restart manual only
  - prometheus          # TSDB — restart pode perder dados
  - grafana             # Dashboards — restart causa downtime visual
  - loki                # Logs — restart pode perder buffer
  - alertmanager        # Alerts — restart pode perder silêncio
  - n8n-jbu1zy377ies2zhc3qmd03gz  # n8n — workflows críticos
  - cloudflared         # Tunnel — restart quebra routing
  - coolify-proxy       # Traefik — restart quebra todos os serviços
```

**Implementação:** `AUTOHEAL_CONTAINER_LABEL=monitoring` em vez de `all` — aplicar label `monitoring` apenas aos containers que devem ser healados.

---

## 6. Restart Loop Protection

### 6.1 Algoritmo

```
para cada container:
  restart_count = count_restarts_last_1h(container)
  intervals = get_restart_intervals_last_1h(container)
  avg_interval = mean(intervals)

  SE restart_count >= 3 AND avg_interval < 30s:
    → BLOQUEAR restart por 10 minutos
    → CRIAR ZFS snapshot tank@heal-blocked-YYYYMMDD-HHMMSS
    → ENVIAR Telegram CRITICAL alert (container em loop)
  SENAO SE restart_count >= 3:
    → CRIAR ZFS snapshot antes do próximo restart
    → ENVIAR Telegram WARNING alert
```

### 6.2 Restarts Contados por

- `docker inspect --format='{{.RestartCount}}' <container>`
- `docker inspect --format='{{.State.StartedAt}}' <container>` para intervalos

---

## 7. Alert Routing

### 7.1 Fluxo Atual

```
Prometheus alerts.yml
  → AlertManager (:9093)
    → alert-sender (:8051) [Python webhook receiver]
      → Telegram @HOMELAB_LOPS_bot
```

### 7.2 Severity Routing

| Severity | Descrição | Ação |
|----------|-----------|------|
| `critical` | Container DOWN, GPU gone, Disk < 10%, ZFS pool > 93% | Telegram: 🔴 CRITICAL + @HOMELAB_LOPS |
| `warning` | Memory > 90%, GPU temp > 80°C, ZFS pool > 85% | Telegram: 🟡 WARNING |
| `info` | Restart automático, restart loop bloqueado, ZFS snapshot criado | Telegram: ℹ️ INFO (silenciar opcional) |

### 7.3 Telegram Message Format

```python
# CRITICAL
🔴 [{alertname}] {summary}
Instance: {instance}
Description: {description}
Time: {startsAt}

# WARNING
🟡 [{alertname}] {summary}
Instance: {instance}
Value: {value}
Time: {startsAt}

# INFO
ℹ️ [{alertname}] {summary}
Container: {container}
Action: {action}
Time: {startsAt}
```

### 7.4 Telegram Secrets

- `TELEGRAM_BOT_TOKEN` — source: Infisical `vault.zappro.site`
- `TELEGRAM_CHAT_ID` — source: Infisical `vault.zappro.site`

---

## 8. Docker HEALTHCHECK (Falta Adicionar)

### 8.1 node-exporter

```yaml
# Adicionar ao docker-compose.yml do node-exporter
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:9100/-/healthy || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s
```

### 8.2 loki

```yaml
# Adicionar ao docker-compose.yml do loki
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:3101/ready || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 30s
```

---

## 9. Prometheus Scrape Config Fix

### 9.1 cAdvisor Timeout

```yaml
# prometheus.yml — aumentar scrape timeout
- job_name: cadvisor
  scrape_timeout: 30s   # era 10s (default)
  static_configs:
    - targets: ['cadvisor:8080']
```

### 9.2 Complete prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - '/etc/prometheus/alerts.yml'

scrape_configs:
  - job_name: node
    static_configs:
      - targets: ['node-exporter:9100']
        labels:
          instance: will-zappro

  - job_name: nvidia-gpu
    scrape_timeout: 30s
    static_configs:
      - targets: ['nvidia-gpu-exporter:9835']
        labels:
          instance: will-zappro

  - job_name: cadvisor
    scrape_timeout: 30s   # FIX: era 10s
    static_configs:
      - targets: ['cadvisor:8080']
        labels:
          instance: will-zappro

  - job_name: prometheus
    static_configs:
      - targets: ['localhost:9090']
```

---

## 10. Grafana Dashboard Design

### 10.1 Dashboard: Homelab Datacenter Overview

**Datasource:** Prometheus UID `efg9h1u7ja6tcb`

| Painel | Tipo | Query |
|--------|------|-------|
| CPU % | Time series | `100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)` |
| RAM % | Time series | `100 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100` |
| Container Count | Stat | `count(container_last_seen)` |
| Disk /srv % | Gauge | `(1 - (node_filesystem_avail_bytes{mountpoint="/srv"} / node_filesystem_size_bytes{mountpoint="/srv"})) * 100` |
| ZFS Pool tank % | Gauge | `(1 - (node_filesystem_avail_bytes{device="tank", fstype="zfs"} / node_filesystem_size_bytes{device="tank", fstype="zfs"})) * 100` |
| GPU Temperature | Time series | `nvidia_smi_temperature_gpu{uuid="bc42e64f-64d5-4711-e976-6141787b60a2"}` |
| GPU VRAM % | Time series | `(nvidia_smi_memory_used_bytes / nvidia_smi_memory_total_bytes) * 100` |
| Exporter Health | Table | `up{job=~"node|nvidia-gpu|cadvisor"}` |
| Alert Count (24h) | Stat | `count_over_time(ALERTS[24h])` |

### 10.2 Dashboard: Healing Events

| Painel | Tipo | Query |
|--------|------|-------|
| Restart Events (7d) | Time series | `increase(container_restart_count[1h])` by container |
| Blocked Loops | Table | `rate(container_restart_count{restart_type="blocked"}[5m]) > 0` |
| Healing Actions | Log panel | Loki: `{app="healer"} \|= "healing action"` |
| ZFS Snapshots (7d) | Table | `zfs_snapshots_created{type="pre-heal"}` |

---

## 11. Governance Rules

### 11.1 Version Policy

| Componente | Política | Trigger |
|-----------|----------|---------|
| Prometheus | Pinned to digest `3.11.1` | Security patch only |
| Grafana | Pinned to digest `12.4.2` | Security patch only |
| AlertManager | Pinned to digest `0.31.1` | Security patch only |
| cAdvisor | Pinned to digest `0.56.2` | Security patch only |
| node-exporter | Pinned to digest `1.11.1` | Security patch only |
| Exporters | Pinned to digest, update quarterly with Prometheus | |
| Grafana Alloy | Latest stable `1.12.0` | Promail EOL migration |

### 11.2 Change Process

1. **Snapshot ZFS** antes de qualquer mudança em monitoring stack
2. **Approval** de will-zappro
3. **Test** em ambiente não-production (se disponível)
4. **Rollback** via `zfs rollback` se falhar

### 11.3 Secret Management

Todos os secrets para monitoring stack via **Infisical** (`vault.zappro.site`):
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `GF_AUTH_GOOGLE_CLIENT_ID`
- `GF_AUTH_GOOGLE_CLIENT_SECRET`

---

## 12. Success Criteria

- [ ] node-exporter COM Docker HEALTHCHECK
- [ ] loki COM Docker HEALTHCHECK
- [ ] Restart loop protection implementado (10min block + ZFS snapshot)
- [ ] Pinned container whitelist configurado
- [ ] cadvisor scrape timeout 30s
- [ ] Double-run cron health_agent.sh corrigido (flock)
- [ ] Logs com max-size:10m, max-file:3 em todos containers
- [ ] Prometheus targets todos `Up`
- [ ] Alert routing Prometheus → AlertManager → Telegram funcionando
- [ ] Grafana dashboard com healing events
- [ ] Promail → Grafana Alloy migration planejado

---

## 13. Related SPECs

- **SPEC-002-homelab-monitor-agent.md** — Python asyncio agent (Docker+Ollama+LiteLLM+ZFS+Coolify)
- **SPEC-016-voice-pipeline-cursor-loop.md** — Voice pipeline auto-healer shell-based
- **SPEC-020-openwebui-openclaw-bridge.md** — Bridge stack

---

## 14. Documentos Gerados

| Ficheiro | Descrição |
|----------|-----------|
| `docs/GOVERNANCE/MONITORING-STACK-POLICY.md` | Version policy + change process |
| `docs/GOVERNANCE/HEALING-RULES.md` | Restart loop protection + pinned containers |
| `docs/GOVERNANCE/ALERT-ROUTING.md` | AlertManager → Telegram routing |
| `tasks/smoke-tests/pipeline-monitoring.yaml` | Smoke tests para monitoring stack |
| `tasks/smoke-tests/pipeline-healing.yaml` | Smoke tests para healing system |

---

**Authority:** will-zappro
**Created:** 2026-04-10
**Última Verificação:** 2026-04-10
**Review Cycle:** Trimestral (próximo: 2026-07-10)
