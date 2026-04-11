# SPEC-024 — Unified Monitoring & Self-Healing Implementation

**Status:** SPECIFIED
**Created:** 2026-04-10
**Updated:** 2026-04-10
**Author:** will
**Related:** SPEC-023 (parent), SPEC-023-unified-healing-cli (CLI commands)

---

## Objective

Implementar o sistema completo de monitoring + self-healing para o homelab will-zappro. Este documento consolida toda a pesquisa de 10 agentes especializados e define o plano de implementacao para: health checks com Docker HEALTHCHECK, restart loop protection com ZFS snapshots, Grafana dashboards, Prometheus alerting com Telegram, e a CLI `/heal`.

---

## Tech Stack

### 1.1 Stable Versions (Pinned to Digest)

| Component | Technology | Version | Digest/Tag | Notes |
|-----------|------------|---------|------------|-------|
| Prometheus | monitoring | 3.11.1 | `prom/prometheus:3.11.1` | TSDB 30d retention |
| Grafana | visualization | 12.4.2 | `grafana/grafana:12.4.2` | UID: `efg9h1u7ja6tcb` |
| AlertManager | alerting | 0.31.1 | `prom/alertmanager:0.31.1` | |
| cAdvisor | container metrics | 0.56.2 | `gcr.io/cadvisor/cadvisor:0.56.2` | Docker metrics |
| node-exporter | host metrics | 1.11.1 | `prom/node-exporter:1.11.1` | SEM Docker HEALTHCHECK |
| nvidia-gpu-exporter | GPU metrics | 1.4.1 | `utkuozdemir/nvidia_gpu_exporter:1.4.1` | DCGM 4.5.2 |
| Loki | log aggregation | 3.7.0 | `grafana/loki:3.7.0` | SEM Docker HEALTHCHECK |
| Grafana Alloy | log shipping | 1.12.0 | `grafana/alloy:1.12.0` | Promail EOL migration target |
| docker-autoheal | container heal | latest | `willfarrell/autoheal:latest` | |
| alert-sender | Telegram alerts | 1.0 | custom Python | Python 3.12-slim |
| ZFS | filesystem | — | OpenZFS on Linux | tank pool |

### 1.2 Network

```
Monitoring network: monitoring_monitoring (10.0.16.x)
Prometheus scrape: via Docker DNS names (node-exporter:9100, etc.)
Grafana: https://monitor.zappro.site (:3100 external, :3000 internal)
AlertManager: :9093
Loki: :3101
```

---

## Critical Gaps (from SPEC-023)

### Gaps Identified

| Gap | Severity | Impact | Solution |
|-----|----------|--------|----------|
| **node-exporter SEM Docker HEALTHCHECK** | 🔴 HIGH | Prometheus nao detecta se exporter cai | Adicionar healthcheck ao container |
| **loki SEM Docker HEALTHCHECK** | 🔴 HIGH | Loki pode estar DOWN sem deteccao | Adicionar healthcheck ao container |
| **SEM restart loop protection** | 🔴 HIGH | Container em restart loop causa cascading failures | Implementar: RestartCount >= 3 em 1h OR avg interval < 30s → block 10min + ZFS snapshot |
| **SEM ZFS snapshot before healing** | 🔴 HIGH | Healing scripts nao criam snapshot antes de heal | Integrar snapshot no heal pipeline |
| **cadvisor DOWN em Prometheus** | 🔴 HIGH | cAdvisor marca `Up` mas Prometheus scrape falha por timeout 10s | Aumentar scrape timeout para 30s em prometheus.yml |
| **SEM pinned container whitelist** | 🟡 MED | Autohealer pode restartar servicos criticos | Criar whitelist: coolify-db, prometheus, grafana, loki, alertmanager |
| **logs SEM rotacao** | 🟡 MED | Docker json-file log cresce indefinidamente | `max-size: 10m, max-file: 3` JA configurado — verificar |
| **health_agent.sh double-run** | 🟡 MED | health_agent.sh executa 2x ao mesmo tempo | Lockfile com `flock` |
| **Promail EOL** | 🟢 LOW | Promail descontinuado em marco 2026 | Migrar para Grafana Alloy (1.12.0) |
| **AlertManager nflog permission** | 🟢 LOW | permission denied em /srv/data/monitoring/alertmanager/ | Garantir owner `will:will` |

---

## Implementation Plan

### Phase 1: Docker HEALTHCHECK (node-exporter, loki)

#### 1.1 node-exporter HEALTHCHECK

```yaml
# docker-compose.monitoring.yml
services:
  node-exporter:
    image: prom/node-exporter:v1.11.1
    container_name: node-exporter
    restart: unless-stopped
    ports:
      - "9100:9100"
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/host'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    networks:
      - monitoring_monitoring
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:9100/-/healthy || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

#### 1.2 loki HEALTHCHECK

```yaml
services:
  loki:
    image: grafana/loki:3.7.0
    container_name: loki
    restart: unless-stopped
    ports:
      - "3101:3101"
    volumes:
      - /srv/data/loki:/etc/loki
      - /srv/data/loki:/var/loki
    networks:
      - monitoring_monitoring
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3101/ready || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

---

### Phase 2: Restart Loop Protection Algorithm

#### 2.1 Algorithm Specification

```
PARA CADA CONTAINER:
  restart_count = count_restarts_last_1h(container)
  intervals = get_restart_intervals_last_1h(container)
  avg_interval = mean(intervals)  # em segundos

  SE restart_count >= 3 AND avg_interval < 30s:
    → BLOQUEAR restart por 10 minutos
    → CRIAR ZFS snapshot tank@heal-blocked-YYYYMMDD-HHMMSS
    → ENVIAR Telegram CRITICAL alert (container em loop de restart)
    → REGISTRAR em /tmp/container-restart-attempts.json
  SENAO SE restart_count >= 3:
    → CRIAR ZFS snapshot antes do proximo restart
    → ENVIAR Telegram WARNING alert
  SENAO:
    → EXECUTAR restart normal
```

#### 2.2 Rate Limit File Schema

```json
{
  "container_name": {
    "count": 3,
    "window_start": 1744301400,
    "blocked_until": 1744302000,
    "blocked_reason": "restart_loop"
  }
}
```

File location: `/tmp/container-restart-attempts.json`

#### 2.3 Lockfile for health_agent.sh (flock)

```bash
#!/bin/bash
# /srv/monorepo/docs/OPERATIONS/SKILLS/health_agent.sh

exec 200>/tmp/health_agent.lock
flock -n 200 || exit 0

# ... resto do script ...

flock -u 200
```

Cron entry:
```
* * * * * flock /tmp/health_agent.lock -n /srv/monorepo/docs/OPERATIONS/SKILLS/health_agent.sh || true
```

---

### Phase 3: Pinned Container Whitelist

#### 3.1 Registry

```bash
PINNED_CONTAINERS=(
  "coolify-db"
  "coolify-proxy"
  "coolify-redis"
  "prometheus"
  "grafana"
  "loki"
  "alertmanager"
  "n8n-jbu1zy377ies2zhc3qmd03gz"
  "cloudflared"
  "openclaw-qgtzrmi6771lt8l7x8rqx72f"
  "zappro-kokoro"
  "zappro-tts-bridge"
  "zappro-wav2vec2"
)

is_pinned() {
  local container=$1
  for pinned in "${PINNED_CONTAINERS[@]}"; do
    [[ "$container" == "$pinned" ]] && return 0
  done
  return 1
}
```

#### 3.2 Implementation in docker-autoheal

```yaml
# Usar label AUTOHEAL_CONTAINER_LABEL=monitoring
# Aplicar label "monitoring" apenas aos containers que devem ser healados
environment:
  AUTOHEAL_CONTAINER_LABEL: "monitoring"
  AUTOHEAL_INTERVAL: 60
```

Containers que DEVEM ter label `monitoring`: todos EXCETO pinned containers.

---

### Phase 4: Prometheus Scrape Config (cadvisor timeout 30s)

```yaml
# prometheus.yml
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
    scrape_interval: 30s
    static_configs:
      - targets: ['cadvisor:8080']
        labels:
          instance: will-zappro

  - job_name: loki
    scrape_timeout: 30s
    static_configs:
      - targets: ['loki:3101']
        labels:
          instance: will-zappro
```

---

### Phase 5: Grafana Dashboard Design

#### 5.1 Dashboard JSON: Homelab Datacenter Overview

```json
{
  "title": "Homelab Datacenter Overview",
  "uid": "efg9h1u7ja6tcb",
  "version": 1,
  "panels": [
    {
      "id": 1,
      "title": "CPU Usage %",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
      "targets": [
        {
          "expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
          "legendFormat": "{{instance}}"
        }
      ]
    },
    {
      "id": 2,
      "title": "Memory Usage %",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
      "targets": [
        {
          "expr": "100 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100",
          "legendFormat": "{{instance}}"
        }
      ]
    },
    {
      "id": 3,
      "title": "Container Count",
      "type": "stat",
      "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8},
      "targets": [
        {
          "expr": "count(container_last_seen)"
        }
      ]
    },
    {
      "id": 4,
      "title": "Disk /srv Usage %",
      "type": "gauge",
      "gridPos": {"h": 4, "w": 6, "x": 6, "y": 8},
      "targets": [
        {
          "expr": "(1 - (node_filesystem_avail_bytes{mountpoint=\"/srv\"} / node_filesystem_size_bytes{mountpoint=\"/srv\"})) * 100"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {"color": "green", "value": null},
              {"color": "yellow", "value": 80},
              {"color": "red", "value": 90}
            ]
          }
        }
      }
    },
    {
      "id": 5,
      "title": "ZFS Pool tank %",
      "type": "gauge",
      "gridPos": {"h": 4, "w": 6, "x": 12, "y": 8},
      "targets": [
        {
          "expr": "(1 - (node_filesystem_avail_bytes{device=\"tank\", fstype=\"zfs\"} / node_filesystem_size_bytes{device=\"tank\", fstype=\"zfs\"})) * 100"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {"color": "green", "value": null},
              {"color": "yellow", "value": 85},
              {"color": "red", "value": 93}
            ]
          }
        }
      }
    },
    {
      "id": 6,
      "title": "GPU Temperature",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
      "targets": [
        {
          "expr": "nvidia_smi_temperature_gpu{uuid=\"bc42e64f-64d5-4711-e976-6141787b60a2\"}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {"color": "green", "value": null},
              {"color": "yellow", "value": 75},
              {"color": "red", "value": 85}
            ]
          }
        }
      }
    },
    {
      "id": 7,
      "title": "GPU VRAM %",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
      "targets": [
        {
          "expr": "(nvidia_smi_memory_used_bytes / nvidia_smi_memory_total_bytes) * 100"
        }
      ]
    },
    {
      "id": 8,
      "title": "Exporter Health",
      "type": "table",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 20},
      "targets": [
        {
          "expr": "up{job=~\"node|nvidia-gpu|cadvisor|loki\"}",
          "format": "table"
        }
      ]
    },
    {
      "id": 9,
      "title": "Alert Count (24h)",
      "type": "stat",
      "gridPos": {"h": 4, "w": 6, "x": 12, "y": 20},
      "targets": [
        {
          "expr": "count_over_time(ALERTS[24h])"
        }
      ]
    }
  ]
}
```

#### 5.2 Dashboard: Healing Events

```json
{
  "title": "Healing Events",
  "uid": "healing-events",
  "version": 1,
  "panels": [
    {
      "id": 1,
      "title": "Restart Events (7d)",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
      "targets": [
        {
          "expr": "increase(container_restart_count[1h])",
          "legendFormat": "{{container}}"
        }
      ]
    },
    {
      "id": 2,
      "title": "Blocked Loops",
      "type": "table",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
      "targets": [
        {
          "expr": "rate(container_restart_count{restart_type=\"blocked\"}[5m]) > 0",
          "format": "table"
        }
      ]
    },
    {
      "id": 3,
      "title": "Healing Actions",
      "type": "logs",
      "gridPos": {"h": 8, "w": 24, "x": 0, "y": 8},
      "targets": [
        {
          "expr": "{app=\"healer\"} |= \"healing action\"",
          "datasource": "Loki"
        }
      ]
    },
    {
      "id": 4,
      "title": "ZFS Snapshots (7d)",
      "type": "table",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16},
      "targets": [
        {
          "expr": "zfs_snapshots_created{type=\"pre-heal\"}",
          "format": "table"
        }
      ]
    }
  ]
}
```

---

### Phase 6: Alert Routing (Prometheus → AlertManager → Telegram)

#### 6.1 AlertManager Configuration

```yaml
# /srv/data/monitoring/alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'instance']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: telegram
  routes:
    - match:
        severity: critical
      receiver: telegram-critical
      continue: true
    - match:
        severity: warning
      receiver: telegram-warning
    - match:
        severity: info
      receiver: telegram-info

receivers:
  - name: telegram-critical
    webhook_configs:
      - url: http://alert-sender:8080/webhook
        send_resolved: true

  - name: telegram-warning
    webhook_configs:
      - url: http://alert-sender:8080/webhook
        send_resolved: false

  - name: telegram-info
    webhook_configs:
      - url: http://alert-sender:8080/webhook
        send_resolved: false

inhibit_rules:
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: ['instance']
```

#### 6.2 Prometheus Alerts

```yaml
# /etc/prometheus/alerts.yml
groups:
  - name: container_alerts
    rules:
      - alert: ContainerDown
        expr: container_last_seen == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Container {{ $labels.container }} is down"
          description: "{{ $labels.container }} has been down for more than 1 minute"

      - alert: ContainerRestartLoop
        expr: rate(container_restart_count[1h]) >= 3
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Container {{ $labels.container }} in restart loop"
          description: "{{ $labels.container }} restarted {{ $value }} times in the last hour"

  - name: host_alerts
    rules:
      - alert: HighCPU
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU on {{ $labels.instance }}"
          description: "CPU usage is above 90%"

      - alert: HighMemory
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory on {{ $labels.instance }}"

      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes{mountpoint="/srv"} / node_filesystem_size_bytes{mountpoint="/srv"})) * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space low on {{ $labels.instance }}"

  - name: zfs_alerts
    rules:
      - alert: ZFS PoolUsageHigh
        expr: (1 - (node_filesystem_avail_bytes{device="tank", fstype="zfs"} / node_filesystem_size_bytes{device="tank", fstype="zfs"})) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "ZFS pool tank usage above 85%"

  - name: gpu_alerts
    rules:
      - alert: GPUTemperatureHigh
        expr: nvidia_smi_temperature_gpu{uuid="bc42e64f-64d5-4711-e976-6141787b60a2"} > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "GPU temperature above 80C"
```

#### 6.3 Telegram Message Format (alert-sender)

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

---

### Phase 7: Loki → Grafana Alloy Migration (Promail EOL)

#### 7.1 Grafana Alloy Configuration

```yaml
// /srv/data/monitoring/alloy/config.alloy
discovery.docker "monitoring" {
  host = "unix:///var/run/docker.sock"
}

loki.source.docker "monitoring" {
  host = "unix:///var/run/docker.sock"
  forward: false
}

loki.process "monitoring" {
  stage.regex {
    expression = "(?P<timestamp>\\S+ \\S+) (?P<level>\\S+) (?P<message>.*)"
  }
  stage.labels {
    values = {
      level = "",
    }
  }
}

loki.write "loki" {
  endpoint {
    url = "http://loki:3101/loki/api/v1/push"
  }
}
```

---

### Phase 8: Log Rotation Verification

```bash
# Verificar configuracao de log em todos os containers
docker inspect --format='{{.Name}}: log-driver={{.HostConfig.LogConfig.Type}}, max-size={{.HostConfig.LogConfig.Config.MaxSize}}, max-files={{.HostConfig.LogConfig.Config.MaxFiles}}' $(docker ps -a --format '{{.Names}}')
```

Todos os containers devem ter:
- `LogConfig.Type`: `json-file`
- `MaxSize`: `10m`
- `MaxFiles`: `3`

---

## /heal CLI Command Family

### Command Reference

| Command | Purpose |
|---------|---------|
| `/heal status` | Show all containers with health and restart stats |
| `/heal restart <container>` | Manually restart a container (if not pinned) |
| `/heal unblock <container>` | Clear restart loop protection for a container |
| `/heal logs <container>` | Tail logs of a specific container |
| `/heal snapshot` | Manually trigger a ZFS snapshot |
| `/heal alert test` | Send a test Telegram alert |
| `/heal dashboard` | Open Grafana dashboard URL |

### Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Output in JSON format |
| `--quiet`, `-q` | Suppress informational messages |
| `--dry-run` | Preview action without executing |

### 1. `/heal status`

Show all containers with health status, restart count, and blocked state.

```
╔══════════════════════════════════════════════════════════════════════╗
║  HEAL STATUS — 2026-04-10 14:35:00                                  ║
╠══════════════════════╦════════╦══════════╦═══════════╦═══════════════╣
║ CONTAINER            ║ STATUS ║ HEALTH   ║ RESTARTS  ║ FLAGS        ║
╠══════════════════════╬════════╬══════════╬═══════════╬═══════════════╣
║ openclaw-...72f      ║ Up     ║ healthy  ║ 2         ║ [PINNED]      ║
║ zappro-litellm       ║ Up     ║ healthy  ║ 0         ║               ║
║ zappro-wav2vec2      ║ Up     ║ healthy  ║ 1         ║               ║
║ coolify-proxy        ║ Up     ║ healthy  ║ 0         ║ [PINNED]      ║
║ zappro-litellm-db    ║ Exited ║ —        ║ 3         ║ [BLOCKED]     ║
╚══════════════════════╩════════╩══════════╩═══════════╩═══════════════╝

Summary: 4 Up | 1 Exited | 0 Blocked
```

### 2. `/heal restart <container>`

Manually restart a container. Fails if container is pinned or in rate-limited state.

**Success:**
```
[OK] Restarting container 'zappro-wav2vec2'...
[OK] Container 'zappro-wav2vec2' restarted successfully
[OK] Health check passed after 5s
```

**Failure — Pinned:**
```
[FAIL] Container 'coolify-proxy' is PINNED
[FAIL] Pinned containers cannot be restarted manually
[INFO] See: /srv/monorepo/docs/GOVERNANCE/PINNED-SERVICES.md
```

**Failure — Blocked:**
```
[FAIL] Container 'zappro-litellm-db' is BLOCKED (rate limit: 3/3 restarts in last hour)
[FAIL] Use '/heal unblock zappro-litellm-db' to clear the block
```

### 3. `/heal unblock <container>`

Clear the restart loop protection for a container, resetting its rate limit counter.

**Success:**
```
[OK] Cleared rate limit for 'zappro-litellm-db'
[OK] Counter reset to 0 (window: 1 hour)
[INFO] Container can be restarted again
```

### 4. `/heal logs <container>`

Tail logs of a specific container in real-time.

```
--- Tailing logs: zappro-wav2vec2 (Ctrl+C to stop) ---
2026-04-10T14:35:01.123Z INFO  Listening on port 8201
2026-04-10T14:35:02.456Z INFO  Model loaded: jonatasgrosman/wav2vec2-large-xlsr-53-portuguese
```

Flags: `--lines`, `-n` (default: 50), `--follow`, `-f`, `--timestamps`, `-t`, `--since`

### 5. `/heal snapshot`

Manually trigger a ZFS snapshot of the `tank` pool.

**Success:**
```
[OK] Creating ZFS snapshot: tank@manual-20260410-143500
[OK] Snapshot created successfully
[OK] Snapshot: tank@manual-20260410-143500
```

Flags: `--pool` (default: `tank`), `--name`, `--dry-run`, `--recursive`, `-r`

### 6. `/heal alert test`

Send a test Telegram alert to verify notification pipeline.

**Success:**
```
[OK] Sending test alert to Telegram...
[OK] Alert sent successfully
[INFO] Message: [TEST] Heal system test — 2026-04-10 14:35:00
```

### 7. `/heal dashboard`

Print the Grafana dashboard URL for monitoring.

```
Dashboard: https://monitor.zappro.site
[INFO] Open in browser? Run: open https://monitor.zappro.site
```

Flags: `--open`, `-o`, `--host`

### Error Codes

| Code | Meaning |
|------|---------|
| `E_DOCKER_NOT_RUNNING` | Docker daemon not accessible |
| `E_CONTAINER_NOT_FOUND` | Container name does not exist |
| `E_CONTAINER_PINNED` | Container is pinned, cannot restart |
| `E_RATE_LIMITED` | Container is blocked due to restart loop |
| `E_SNAPSHOT_FAILED` | ZFS snapshot creation failed |
| `E_ALERT_FAILED` | Telegram alert delivery failed |

---

## Implementation Roadmap

### Phase 1: Core Health Checks (Week 1)
- [ ] Add Docker HEALTHCHECK to node-exporter
- [ ] Add Docker HEALTHCHECK to loki
- [ ] Verify cadvisor scrape timeout 30s in prometheus.yml
- [ ] Verify log rotation (max-size:10m, max-file:3) on all containers

### Phase 2: Restart Loop Protection (Week 2)
- [ ] Implement rate limit tracking in `/tmp/container-restart-attempts.json`
- [ ] Implement restart loop detection algorithm
- [ ] Add ZFS snapshot before healing
- [ ] Integrate with docker-autoheal
- [ ] Add flock to health_agent.sh

### Phase 3: Alerting (Week 2-3)
- [ ] Configure AlertManager with Telegram routing
- [ ] Write Prometheus alert rules (container, host, GPU, ZFS)
- [ ] Deploy alert-sender container
- [ ] Test alert delivery to Telegram

### Phase 4: Dashboards (Week 3)
- [ ] Create Grafana dashboard JSON (Homelab Datacenter Overview)
- [ ] Create Healing Events dashboard
- [ ] Verify datasource connections (Prometheus UID `efg9h1u7ja6tcb`)

### Phase 5: CLI Integration (Week 3-4)
- [ ] Implement `/heal status`
- [ ] Implement `/heal restart`
- [ ] Implement `/heal unblock`
- [ ] Implement `/heal logs`
- [ ] Implement `/heal snapshot`
- [ ] Implement `/heal alert test`
- [ ] Implement `/heal dashboard`

### Phase 6: Grafana Alloy Migration (Week 4-5)
- [ ] Install Grafana Alloy container
- [ ] Write Alloy config for Docker logs
- [ ] Verify Loki receives logs from Alloy
- [ ] Decommission Promail

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | node-exporter e loki tem Docker HEALTHCHECK | `docker inspect node-exporter --format='{{.State.Health.Status}}'` retorna `healthy` |
| SC-2 | Restart loop detection funciona | Container em loop e bloqueado apos 3 restarts em 1h com intervalo < 30s |
| SC-3 | ZFS snapshot criado antes de healing | `zfs list -t snapshot -r tank` mostra snapshot com prefixo `heal-` |
| SC-4 | Pinned containers nunca sao restartados | coolify-proxy, grafana, loki, prometheus, alertmanager sempre no estado original |
| SC-5 | cadvisor scrape timeout 30s | Prometheus targets mostram cadvisor `Up` sem timeout errors |
| SC-6 | health_agent.sh nao executa 2x | Lockfile `/tmp/health_agent.lock` existe e funciona |
| SC-7 | Logs com rotacao | `docker inspect` mostra max-size=10m, max-files=3 |
| SC-8 | Prometheus targets todos Up | Grafana exporter health panel mostra 100% |
| SC-9 | Alert routing Prometheus → AlertManager → Telegram | Test alert chega no Telegram @HOMELAB_LOPS |
| SC-10 | Grafana dashboard healing events | Panel mostra restart events e blocked loops |
| SC-11 | Promail → Grafana Alloy migration | Loki recebe logs via Alloy |
| SC-12 | `/heal status` mostra todos containers | Output inclui status, health, restart count, flags |
| SC-13 | `/heal restart` respeita pinned whitelist | Tentativa de restart em pinned retorna erro |
| SC-14 | `/heal unblock` limpa rate limit | Apos unblock, container pode ser restartado |

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | node-exporter HEALTHCHECK returns healthy | `curl -sf http://localhost:9100/-/healthy` exits 0 |
| AC-2 | loki HEALTHCHECK returns healthy | `curl -sf http://localhost:3101/ready` exits 0 |
| AC-3 | Restart loop blocked after 3 restarts < 30s apart | Script test with rapid restarts shows block |
| AC-4 | ZFS snapshot created before heal | `zfs list -t snapshot tank | grep heal` shows snapshot |
| AC-5 | Pinned container restart fails | `/heal restart coolify-proxy` returns error |
| AC-6 | cadvisor scrapes successfully | Prometheus UI shows cadvisor target Up |
| AC-7 | health_agent.sh acquires lock | Two cron instances: second fails with lock error |
| AC-8 | Log rotation verified | `docker inspect` on each container shows config |
| AC-9 | Telegram alert delivered | `/heal alert test` shows success message |
| AC-10 | Grafana dashboard loads | Dashboard UID `efg9h1u7ja6tcb` loads in Grafana |
| AC-11 | Loki receives Alloy logs | Loki query shows logs with docker labels |
| AC-12 | `/heal status` output format correct | Output matches table format in spec |
| AC-13 | `/heal unblock` clears rate limit | JSON file entry removed after unblock |
| AC-14 | Double-run prevented by flock | Concurrent execution test shows single execution |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-10 | Grafana Alloy 1.12.0 for Promail migration | Promail EOL March 2026, Alloy is Grafana's official replacement |
| 2026-04-10 | Restart loop: 3 restarts in 1h with avg interval < 30s | Conservative threshold to avoid false positives |
| 2026-04-10 | 10-minute block for restart loops | Time enough for operator to investigate |
| 2026-04-10 | AUTOHEAL_CONTAINER_LABEL=monitoring | More precise than `all` — excludes pinned containers |
| 2026-04-10 | cadvisor scrape timeout 30s | cAdvisor is slow to respond, 10s too aggressive |
| 2026-04-10 | Python alert-sender for Telegram | Simpler than alternative, uses existing Telegram bot |

---

## Related Documents

- SPEC-023 — Unified Monitoring & Self-Healing Datacenter System
- SPEC-023-unified-healing-cli — Unified Healing System CLI Commands
- ADR-024 — Grafana Alloy Migration Decision
- docs/GOVERNANCE/MONITORING-STACK-POLICY.md
- docs/GOVERNANCE/HEALING-RULES.md
- docs/GOVERNANCE/ALERT-ROUTING.md
- docs/GOVERNANCE/PINNED-SERVICES.md

---

**Authority:** will-zappro
**Last update:** 2026-04-10
**Review Cycle:** Trimestral (proximo: 2026-07-10)
