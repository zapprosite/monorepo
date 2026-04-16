# SPEC-040: Homelab Unified Alerting & Rate Limiting Architecture

> **Status:** IN_PROGRESS — Alert pipeline FIXED ✅ (alert-sender deployed 2026-04-14), Loki deploying
> **Priority:** 🟡 MEDIUM — rate limiting + Loki remaining
> **Author:** Principal Engineer
> **Date:** 2026-04-14
> **Branch:** feature/quantum-helix-done

---

## Implementation Status (2026-04-14)

### ✅ Working

| Component                                  | Status     | Notes                                       |
| ------------------------------------------ | ---------- | ------------------------------------------- |
| Prometheus                                 | Running    | localhost:9090, all targets UP              |
| AlertManager                               | Running    | localhost:9093, webhook receiver configured |
| Grafana                                    | Running    | localhost:3100, dashboards available        |
| Gotify                                     | Running    | localhost:8050, P3 alerts OK                |
| Docker-autoheal                            | Running    | Container restart on failure                |
| cadvisor/node-exporter/nvidia-gpu-exporter | Running    | Metrics collection OK                       |
| GPU alerts (Prometheus rules)              | Configured | GPUCryptojacking, GPUMemory, GPUTemp        |

### ❌ Broken / Missing

| Component        | Issue                                                               | Fix Required                               |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------ |
| **alert-sender** | ✅ DEPLOYED 2026-04-14                                              | Container healthy, Telegram 200 OK         |
| **Loki**         | Container deploying                                                 | Loki 3.2.1 pulled, starting                |
| **Promtail**     | Not in docker-compose                                               | Loki/Promtail nice-to-have (deprioritized) |
| **Alert path**   | ✅ Prometheus → AlertManager → alert-sender:8080/webhook → Telegram | Working 2026-04-14                         |

### ✅ Alert Pipeline (Fixed 2026-04-14)

```
Prometheus → AlertManager → alert-sender:8080/webhook → ✅ Telegram (working)
                                              ↓
                                    Telegram (所有人) ✅ RECEIVES
```

**Implementation:** alert-sender/app.py (Python 3.12-slim, port 8051, healthy)
**Verification:** 2 test alerts sent to Telegram (HTTP 200) at 11:04

### 🔧 Priority Actions

1. ~~Deploy simple alert-sender~~ ✅ DONE 2026-04-14
2. Loki/Promtail: deprioritize (nice-to-have, not blocking)
3. Loki: started, waiting for health check

---

## 1. Objective

Criar um sistema unificado de:

1. **Alerting** — Grafana + Prometheus alerts → Telegram/Gotify (eliminar alertas redundantes)
2. **Rate Limiting** — Cálculo e distribuição de limites por serviço (GPU partilhada)
3. **GPU Security** — Deteção de cryptojacking na RTX 4090
4. **SRE Monitor** — Superar o auto-healer antigo (8812f46c) e resource-monitor (4cb53930)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  MONITORING STACK                        │
│                                                          │
│  Prometheus ──── Grafana ──── AlertManager               │
│       ↑                                    ↓             │
│   Collectors                    Telegram / Gotify        │
│   (node-exporter,                                  ↓             │
│    nvidia-gpu-exporter,        will (Telegram)           │
│    cadvisor)                                        │
│                                                          │
│  SRE Monitor ──── Docker Auto-heal ──── Alerting        │
│  (coolify-sre)                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  RATE LIMIT LAYER                       │
│                                                          │
│  nginx / LiteLLM                                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Per-service limits (req/min)                     │    │
│  │   ollama:        60 req/min (context lengths)  │    │
│  │   openwebui:     30 req/min (human users)       │    │
│  │   n8n:          120 req/min (webhooks)          │    │
│  │   hermes:        20 req/min (Telegram polling)  │    │
│  │   litellm:       90 req/min (proxy aggregate)  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. GPU Security — Deteção de Cryptojacking

### Baseline Atual (RTX 4090)

| Métrica       | Valor Normal            | Threshold Alerta    | Threshold Crítico       |
| ------------- | ----------------------- | ------------------- | ----------------------- |
| VRAM Usage    | 20-24GB                 | >24GB (105%)        | >24GB + unknown process |
| GPU Util      | 40-80%                  | >90% sustained 5min | >98% sustained 2min     |
| Temperature   | 40-65°C                 | >80°C               | >85°C                   |
| Power Draw    | 200-350W                | >400W               | >430W                   |
| GPU Processes | ollama, litellm, python | unknown process     | non-ollama process >2GB |

### Regras Prometheus — GPU Alerts

```yaml
groups:
  - name: gpu_security
    interval: 30s
    rules:
      - alert: GPUCryptojackingSuspected
        expr: |
          (DCGM_FI_DEV_GPU_UTIL > 95) and
          (DCGM_FI_DEV_FB_USED / DCGM_FI_DEV_FB_FREE > 0.95) and
          (rate(nvidia_gpu_processes_used_gpu_memory_bytes[5m]) > 0)
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'GPU cryptojacking SUSPECTED on {{ $labels.instance }}'
          description: |
            GPU Util: {{ $values.B0.Value }}%
            VRAM: {{ $values.B1.Value }}%
            Unknown process consuming GPU

      - alert: GPUMemoryNearFull
        expr: (DCGM_FI_DEV_FB_USED / DCGM_FI_DEV_FB_TOTAL) * 100 > 98
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: 'GPU memory nearly full: {{ $value | printf "%.1f" }}%'

      - alert: GPUTemperatureHigh
        expr: DCGM_FI_DEV_GPU_TEMP > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'GPU temperature high: {{ $value }}°C'
```

### Verificação Manual (corrida during SRE Monitor)

```bash
# Check for unknown GPU processes
nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv

# If unknown process found:
ps aux | grep <pid>
docker ps | grep <pid>
cat /proc/<pid>/cmdline
```

---

## 4. Rate Limiting — Cálculo

### GPU Budget (RTX 4090 — 24GB VRAM)

| Serviço              | VRAM Reserved | Max Concurrent | Limite req/min |
| -------------------- | ------------- | -------------- | -------------- |
| Ollama (Qwen2.5 7B)  | 14GB          | 2              | 60             |
| Ollama (Qwen2.5 72B) | 0 (não usado) | -              | -              |
| LiteLLM Proxy        | 4GB           | 4              | 90             |
| wav2vec2 STT         | 2GB           | 1              | 30             |
| Kokoro TTS           | 1GB           | 1              | 30             |
| **Buffer**           | 3GB           | -              | -              |

### Per-Service Rate Limits

| Serviço                | Algoritmo      | Limite      | Burst | Janela |
| ---------------------- | -------------- | ----------- | ----- | ------ |
| Ollama `/api/generate` | Token Bucket   | 60 req/min  | 10    | 60s    |
| OpenWebUI              | Token Bucket   | 30 req/min  | 5     | 60s    |
| LiteLLM                | Token Bucket   | 90 req/min  | 15    | 60s    |
| n8n Webhooks           | Leaky Bucket   | 120 req/min | 20    | 60s    |
| Hermes Agent           | Token Bucket   | 20 req/min  | 3     | 60s    |
| Grafana API            | Sliding Window | 300 req/min | 50    | 60s    |

### Implementation

**nginx rate limiting (upstream):**

```nginx
# /etc/nginx/conf.d/rate-limit.conf
limit_req_zone $binary_remote_addr zone=ollama:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=openwebui:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=litellm:10m rate=90r/m;

server {
  location /api/generate {
    limit_req zone=ollama burst=10 nodelay;
    proxy_pass http://localhost:11434;
  }
}
```

**LiteLLM config.yaml:**

```yaml
litellm_settings:
  num_parallel_requests: 10
  max_parallel_requests: 20

router_settings:
  redis_host: localhost
  redis_password: ${REDIS_PASSWORD}
  rpm_limit_per_user: 60
  concurrent_request_limit_per_user: 5
```

---

## 5. Alerting Hierarchy

### Severity Levels

| Level | Name     | Color  | Action     | Channel           |
| ----- | -------- | ------ | ---------- | ----------------- |
| 🔴 P1 | Critical | Red    | Immediate  | Telegram (所有人) |
| 🟠 P2 | Warning  | Orange | 5min delay | Telegram (@will)  |
| 🟡 P3 | Info     | Yellow | Log only   | Gotify            |
| ⚪ P4 | Debug    | Gray   | Dashboard  | Grafana           |

### Alert Routing

```
Alert fires
    ↓
Grafana AlertManager
    ↓
┌─────────────────────────────────────────┐
│ severity=critical → Telegram P1 channel │
│ severity=warning   → Telegram P2 channel│
│ severity=info      → Gotify             │
│ severity=debug     → Grafana only       │
└─────────────────────────────────────────┘
```

### Unified SRE Alert Rules

```yaml
# Grafana Alerting Rules
groups:
  - name: homelab_sre
    interval: 1m
    rules:
      - alert: ContainerDown
        expr: up{job="docker"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Container {{ $labels.container_name }} is DOWN'

      - alert: ContainerUnhealthy
        expr: docker_container_health == 1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'Container {{ $labels.container_name }} unhealthy'

      - alert: HighCPU
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'CPU usage above 90%: {{ $value | printf "%.1f" }}%'

      - alert: HighMemory
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Memory usage above 90%: {{ $value | printf "%.1f" }}%'

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'Disk space below 10%'

      - alert: SubdomainDown
        expr: probe_success{job="subdomains"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'Subdomain {{ $labels.instance }} is DOWN'
```

---

## 6. Grafana Dashboard

### Dashboard: Homelab Overview

**Panels:**

1. GPU Utilization (gauge, 0-100%)
2. GPU Memory (gauge, 0-24GB)
3. GPU Temperature (graph, 0-100°C)
4. Container Status (table: name, status, health, uptime)
5. Subdomain Status (table: subdomain, HTTP code, latency)
6. CPU/Memory per container (heatmap)
7. Network I/O (graph)
8. Alert State (badge: firing/pending/none)

### Dashboard: Rate Limiting

**Panels:**

1. Requests per minute per service (graph, stacked)
2. Rate limit usage % (gauge per service)
3. Queue depth (graph)
4. Token consumption (for Ollama context tokens)
5. Concurrent requests (graph, per service)

---

## 7. Files to Modify/Create

| File                                                              | Action | Purpose                     |
| ----------------------------------------------------------------- | ------ | --------------------------- |
| `apps/monitoring/grafana/provisioning/dashboards/homelab.yml`     | Create | Homelab overview dashboard  |
| `apps/monitoring/grafana/provisioning/dashboards/rate-limit.yml`  | Create | Rate limiting dashboard     |
| `apps/monitoring/prometheus/alerts.yml`                           | Modify | Add GPU security alerts     |
| `apps/monitoring/grafana/provisioning/datasources/prometheus.yml` | Modify | Ensure Prometheus DS exists |
| `apps/monitoring/alertmanager.yml`                                | Modify | Add Telegram/Gotify routing |
| `.claude/skills/coolify-sre/scripts/sre-monitor.sh`               | Modify | Fix IFS bug, add GPU check  |
| `docs/SPECS/SPEC-040-homelab-alerting-rate-limit.md`              | Create | This spec                   |

---

## 8. Success Criteria

| #    | Criterion                            | Verification                                          |
| ---- | ------------------------------------ | ----------------------------------------------------- |
| SC-1 | GPU cryptojacking detection works    | `nvidia-smi` unknown process → alert fires            |
| SC-2 | Rate limits enforced                 | Load test with >100 req/min to Ollama → 429 returned  |
| SC-3 | P1 alerts reach Telegram immediately | Container DOWN → Telegram < 30s                       |
| SC-4 | SRE Monitor heals healthy containers | Unhealthy container → auto-restart → healthy          |
| SC-5 | Grafana dashboard shows all services | Single view: GPU, containers, subdomains, rate limits |

---

## 9. Open Questions

- [ ] Rate limiting via nginx upstream or via LiteLLM router?
- [ ] Use Redis for distributed rate limiting or local in-memory?
- [ ] n8n already tem rate limiting interno — preciso configurar explicitamente?
- [ ] Prometheus `DCGM_FI_DEV_*` metrics disponíveis via nvidia-gpu-exporter?
- [ ] Alertmanager consegue enviar para Telegram diretamente ou precisa de alert-sender?

---

## 10. Homelab Audit — Complete RAM/VRAM/Storage Report (2026-04-14)

### System Memory State

| Metric        | Value             | Verdict                       |
| ------------- | ----------------- | ----------------------------- |
| RAM Total     | 30 GB             | —                             |
| RAM Used      | 14 GB (47%)       | ✅ Healthy                    |
| RAM Available | 16 GB             | ✅ Plenty of headroom         |
| Swap Total    | 8 GB              | —                             |
| **Swap Used** | **7.8 GB (97%)**  | ⚠️ LOOKS WORSE THAN IT IS     |
| ZFS ARC       | 996 MB / 8 GB max | ✅ ARC healthy, not the cause |

**Swap Verdict: Normal behavior, not a problem.**

- `swappiness=5` is correctly tuned
- Idle processes (Ollama 1.7GB, Python heaps) are swapped out by design
- 16 GB RAM available = no memory pressure
- No action needed unless you want cleaner numbers

### GPU State — NO CRYPTOJACKING ✅

| Metric      | Value                  |
| ----------- | ---------------------- |
| GPU         | NVIDIA RTX 4090        |
| VRAM Used   | 4.5 GB / 24 GB (18.5%) |
| Temperature | 54°C (normal)          |
| Power Draw  | 247W (normal)          |

**VRAM Breakdown:**

- `Qwen3-VL-8B-Instruct` (Ollama): 3.2 GB VRAM — legitimate vision model
- TTS Bridge uvicorn: 2.1 GB VRAM — legitimate
- wav2vec2: 1.6 GB VRAM — legitimate

**GPU Verdict: NO HACKERS. All processes identified and legitimate.**

### Docker Container RAM (total ~1 GB active)

| Container                  | RAM     | Status             | Recommendation     |
| -------------------------- | ------- | ------------------ | ------------------ |
| n8n                        | 193 MB  | Active             | ✅ Keep            |
| grafana                    | 139 MB  | Active             | ✅ Keep            |
| prometheus                 | 103 MB  | Active             | ✅ Keep            |
| loki                       | 50 MB   | Active             | ✅ Keep            |
| cadvisor                   | 54 MB   | Active             | ✅ Keep            |
| zappro-litellm             | 75 MB   | Active             | ✅ Keep            |
| open-webui                 | 65 MB   | Active             | ✅ Keep            |
| coolify (all)              | 308 MB  | Active             | ✅ Keep (minimal)  |
| **SearXNG**                | 16 MB   | **0 requests/24h** | 🔴 **REMOVE**      |
| **infisical + DB + Redis** | ~500 MB | **Fallback mode**  | 🟡 Consider STOP   |
| **infisical-db**           | ~50 MB  | DB                 | 🟡 part of above   |
| **infisical-redis**        | ~10 MB  | Redis              | 🟡 part of above   |
| supabase-health-proxy      | 8 MB    | Not cloud DB       | 🟡 Check if needed |
| perplexity-agent           | 12 MB   | Research agent     | ✅ Keep            |
| gitea-runner               | 16 MB   | CI/CD              | ✅ Keep            |
| gotify                     | 14 MB   | Notifications      | ✅ Keep            |

### PRUNE LIST — Services to Remove/Stop

| #   | Service                       | Reason                                                                | Command                                                                                                                                                      |
| --- | ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **SearXNG**                   | 0 requests/24h, no identified consumer, ~15 MB RAM                    | `docker stop searxng && docker rm searxng`                                                                                                                   |
| 2   | **Infisical stack**           | .env is canonical (ADR-001), all services use .env, SDK fallback only | `docker stop infisical infisical-db infisical-redis`                                                                                                         |
| 3   | **supabase-health-proxy**     | Supabase is cloud-only (no local Supabase), proxy unnecessary         | `docker stop supabase-health-proxy && docker rm supabase-health-proxy`                                                                                       |
| 4   | **Orphaned openclaw volumes** | Volumes from removed container, disk waste                            | `docker volume rm openclaw-data qgtzrmi6771lt8l7x8rqx72f_openclaw-data`                                                                                      |
| 5   | **n8n + postgresql-n8n**      | 0 workflows, 0 executions, 0 webhooks — never used                    | `docker stop n8n-jbu1zy377ies2zhc3qmd03gz postgresql-jbu1zy377ies2zhc3qmd03gz && docker rm n8n-jbu1zy377ies2zhc3qmd03gz postgresql-jbu1zy377ies2zhc3qmd03gz` |

### Services to Investigate (Uncertain)

| Service                 | Question                                                     | Action                                     |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| **grafana.zappro.site** | DNS intentionally removed (duplicate of monitor.zappro.site) | No action needed — use monitor.zappro.site |
| **task-runners**        | SRE Monitor found unhealthy — what are they?                 | Investigate before restarting              |

### grafana.zappro.site — NOT BROKEN, REMOVED

The SRE Monitor shows "HTTP 000" for grafana.zappro.site but this is **expected**:

- `grafana.zappro.site` was intentionally removed as duplicate of `monitor.zappro.site`
- DNS CNAME was deleted
- The correct URL is **`monitor.zappro.site`** which returns HTTP 302 (Cloudflare Access redirect → login → Grafana)
- Grafana container is healthy (139 MB RAM, 200 OK locally)

### Desktop RAM Bloat

| Process                  | RAM         | Notes                                           |
| ------------------------ | ----------- | ----------------------------------------------- |
| Chrome (35 tabs)         | 4.5 GB      | Largest consumer — consider closing unused tabs |
| GNOME Shell              | 217 MB swap | Normal                                          |
| Claude Code (3 sessions) | 643 MB swap | Idle sessions in swap                           |

### Swap Cleanup (Optional — No Urgency)

To clear swap without rebooting:

```bash
# Restart biggest swap consumers
sudo systemctl restart ollama
# This clears ~1.7GB swap from ollama alone
```

To set swappiness to 0 (aggressive RAM retention):

```bash
echo 1 | sudo tee /proc/sys/vm/swappiness
# Or permanently: sudo sysctl -w vm.swappiness=1
```

---

## 10. Dependencies

- `nvidia-gpu-exporter` container running (port 9835)
- Prometheus scrape target: `nvidia-gpu-exporter:9835`
- Grafana provisioned dashboards
- Telegram bot token (${TELEGRAM_BOT_TOKEN})
- Gotify server (port 8050)
