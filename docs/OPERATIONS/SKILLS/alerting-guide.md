# Alerting Guide — AlertManager + Telegram Pipeline

**Scope:** Configure, manage, and debug the AlertManager-to-Telegram alerting pipeline
**Stack:** Prometheus → AlertManager (:9093) → alert-sender (:8080) → Telegram @HOMELAB_LOPS_bot
**Audience:** Any LLM or operator working in the homelab-monorepo

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  PROMETHEUS (:9090)                                             │
│  alert rules (alerts.yml)                                       │
│    - container_down, high_memory, gpu_temperature, zfs_pool...  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fires alerts
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ALERTMANAGER (:9093)                                           │
│  alertmanager.yml                                               │
│    route/       → severity-based routing                        │
│    receivers/  → webhook to alert-sender                        │
│    inhibit_rules → suppress warning when critical active       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ webhook POST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ALERT-SENDER (:8080) — Python 3.12-slim container             │
│  Webhook receiver → formats message → calls Telegram API        │
│  Env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (from Infisical)│
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP POST to api.telegram.org
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  TELEGRAM @HOMELAB_LOPS_bot                                     │
│  Channel/group configured in Infisical vault.zappro.site        │
└─────────────────────────────────────────────────────────────────┘
```

**Severity Routing:**

| Severity | Action |
|----------|--------|
| `critical` | Telegram: 🔴 CRITICAL + send_resolved:true |
| `warning` | Telegram: 🟡 WARNING + send_resolved:false |
| `info` | Telegram: ℹ️ INFO (silenced by default) |

---

## 2. AlertManager Configuration

**Config file:** `/srv/data/monitoring/alertmanager/alertmanager.yml`

### 2.1 Complete alertmanager.yml

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'instance']
  group_wait: 30s          # Wait this long to aggregate before first notification
  group_interval: 5m      # Interval between subsequent grouping
  repeat_interval: 4h      # Repeat interval for resolved alerts
  receiver: telegram
  routes:
    - match:
        severity: critical
      receiver: telegram-critical
      continue: true      # Continue matching child routes
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
        send_resolved: true   # Notify when alert resolves

  - name: telegram-warning
    webhook_configs:
      - url: http://alert-sender:8080/webhook
        send_resolved: false  # No resolve notification

  - name: telegram-info
    webhook_configs:
      - url: http://alert-sender:8080/webhook
        send_resolved: false

inhibit_rules:
  # Suppress warning alerts when critical is active for same instance
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: ['instance']
```

### 2.2 Alert Routing Rules Explained

**group_by:** Groups alerts by `alertname` and `instance` to prevent duplicate floods from the same source.

**group_wait 30s:** Prometheus may fire multiple alerts within 30s; AlertManager waits before sending to batch them.

**repeat_interval 4h:** After an alert is sent, do not repeat it for 4h (unless it fires again).

**continue: true (critical):** Critical alerts continue to match child routes so they can be processed by multiple receivers if needed.

### 2.3 Reloading AlertManager Config

```bash
# Option 1: Via wget inside the container
docker exec alertmanager wget -qO- -T 5 http://localhost:9093/-/reload

# Option 2: Send SIGHUP
docker kill -s SIGHUP alertmanager

# Option 3: Check config is valid before reloading
docker exec alertmanager amtool --config.file=/etc/alertmanager/alertmanager.yml verify
```

### 2.4 Verifying AlertManager Status

```bash
# Check AlertManager is up
curl -s http://localhost:9093/-/healthy

# Check runtime config (shows merged config)
curl -s http://localhost:9093/api/v1/status/runtimeconfig | python3 -m json.tool | less

# Check alert routing tree
curl -s http://localhost:9093/api/v1/status | python3 -m json.tool
```

---

## 3. Prometheus Alert Rules

**Config file:** `/srv/apps/monitoring/prometheus.yml` (or `/etc/prometheus/alerts.yml`)

### 3.1 Container Alerts

```yaml
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
```

### 3.2 Host Alerts

```yaml
  - name: host_alerts
    rules:
      - alert: HighMemory
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory on {{ $labels.instance }}"
          description: "Memory usage above 90%"

      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes{mountpoint="/srv"} / node_filesystem_size_bytes{mountpoint="/srv"})) * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space low on {{ $labels.instance }}"
```

### 3.3 ZFS Alerts

```yaml
  - name: zfs_alerts
    rules:
      - alert: ZFSPoolUsageHigh
        expr: (1 - (node_filesystem_avail_bytes{device="tank", fstype="zfs"} / node_filesystem_size_bytes{device="tank", fstype="zfs"})) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "ZFS pool tank usage above 85%"
```

### 3.4 GPU Alerts

```yaml
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

---

## 4. alert-sender Container

**Purpose:** Webhook receiver that formats Prometheus alerts and sends to Telegram API.
**Image:** Custom Python 3.12-slim
**Port:** 8080 (internal)
**Secrets (Infisical `vault.zappro.site`):**
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

### 4.1 Docker Compose Entry

```yaml
services:
  alert-sender:
    image: python:3.12-slim
    container_name: alert-sender
    restart: unless-stopped
    ports:
      - "8051:8080"     # External port (matches SPEC-023 :8051)
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
    networks:
      - monitoring_monitoring
    volumes:
      - /srv/data/alert-sender:/srv/alert-sender  # Persistent state
    command: >
      sh -c "pip install flask requests && python /srv/alert-sender/alert_sender.py"
```

### 4.2 alert-sender.py (Minimal Implementation)

```python
#!/usr/bin/env python3
"""alert-sender — Prometheus webhook receiver → Telegram"""
import os
import json
import logging
from flask import Flask, request
import requests

app = Flask(__name__)

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

def build_message(alerts):
    """Format alerts as Telegram message."""
    lines = []
    for alert in alerts:
        severity = alert.get("labels", {}).get("severity", "unknown").upper()
        emoji = {"CRITICAL": "🔴", "WARNING": "🟡", "INFO": "ℹ️"}.get(severity, "⚪")
        alertname = alert.get("labels", {}).get("alertname", "unknown")
        summary = alert.get("annotations", {}).get("summary", "")
        instance = alert.get("labels", {}).get("instance", "N/A")
        starts_at = alert.get("startsAt", "")

        lines.append(f"{emoji} [{severity}] {alertname}")
        lines.append(f"Instance: {instance}")
        if summary:
            lines.append(f"Summary: {summary}")
        lines.append(f"Time: {starts_at}")
        lines.append("")

    return "\n".join(lines) if lines else "No alerts"

def send_telegram(message):
    """Send message via Telegram bot."""
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }
    resp = requests.post(url, json=payload, timeout=10)
    resp.raise_for_status()
    return resp.json()

@app.route("/webhook", methods=["POST"])
def webhook():
    """Receive Prometheus AlertManager webhook."""
    data = request.get_json()
    log.info("Received webhook: %s", json.dumps(data, indent=2))

    alerts = data.get("alerts", [])
    if not alerts:
        return "no alerts", 200

    # Filter by status (firing vs resolved)
    firing = [a for a in alerts if a.get("status") == "firing"]
    resolved = [a for a in alerts if a.get("status") == "resolved"]

    if firing:
        msg = build_message(firing)
        send_telegram(msg)
        log.info("Sent %d firing alerts to Telegram", len(firing))

    if resolved:
        msg = build_message(resolved)
        send_telegram(msg)
        log.info("Sent %d resolved alerts to Telegram", len(resolved))

    return "ok", 200

@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
```

---

## 5. Telegram Message Formats

### 5.1 Critical Alert

```
🔴 [CRITICAL] ContainerDown
Instance: will-zappro
Summary: Container openclaw-qgtzrmi6771lt8l7x8rqx72f is down
Time: 2026-04-11T08:30:00Z
```

### 5.2 Warning Alert

```
🟡 [WARNING] HighMemory
Instance: will-zappro
Summary: High memory on will-zappro
Time: 2026-04-11T08:25:00Z
```

### 5.3 Resolved Alert

```
✅ [RESOLVED] ContainerDown
Instance: will-zappro
Summary: Container openclaw-qgtzrmi6771lt8l7x8rqx72f is down
Time: 2026-04-11T08:35:00Z
```

---

## 6. Testing the Alerting Pipeline

### 6.1 Smoke Tests (pipeline-alerting.yaml)

| ID | Test | Command |
|----|------|---------|
| AL-001 | AlertManager container running | `docker ps --filter name=alertmanager --format '{{.Status}}'` |
| AL-002 | alert-sender endpoint | `curl -s -o /dev/null -w '%{http_code}' http://localhost:8051/health` |
| AL-003 | Cron health-check active | `crontab -l 2>/dev/null | grep 'health-check'` |
| AL-004 | Telegram bot token valid | `curl -s 'https://api.telegram.org/bot<TOKEN>/getMe' \| grep 'ok'` |
| AL-005 | AlertManager config reload | `docker exec alertmanager wget -qO- -T 2 'http://localhost:9093/-/reload'` |

### 6.2 Manual Telegram Test

```bash
# Test bot is reachable
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | python3 -m json.tool

# Send a test message directly
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'"${TELEGRAM_CHAT_ID}"'",
    "text": "🧪 [TEST] Alert pipeline test — '"$(date -Iseconds)"'",
    "parse_mode": "HTML"
  }' | python3 -m json.tool

# Expected: {"ok": true, "result": {...}}
```

### 6.3 Test alert-sender Webhook Directly

```bash
# Send a fake AlertManager webhook payload to alert-sender
curl -s -X POST http://localhost:8051/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "TestAlert",
          "severity": "critical",
          "instance": "test-host"
        },
        "annotations": {
          "summary": "This is a test alert"
        },
        "startsAt": "2026-04-11T08:00:00Z"
      }
    ]
  }'
# Expected: "ok"
```

### 6.4 Test AlertManager Silencing

```bash
# Create a silence for a specific alert
curl -s -X POST http://localhost:9093/api/v1/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [
      {"name": "alertname", "value": "TestAlert", "isRegex": false}
    ],
    "startsAt": "2026-04-11T08:00:00Z",
    "endsAt": "2026-04-12T08:00:00Z",
    "createdBy": "operator@test",
    "comment": "Testing silence"
  }' | python3 -m json.tool

# List active silences
curl -s http://localhost:9093/api/v1/silences | python3 -m json.tool

# Delete a silence (use silence ID from list)
curl -s -X DELETE http://localhost:9093/api/v1/silence/{silence_id}
```

### 6.5 End-to-End Alert Test

Trigger a real alert by simulating a container down:

```bash
# 1. Stop a non-critical container (e.g., openwebui if available)
docker stop openclaw-qgtzrmi6771lt8l7x8rqx72f 2>/dev/null && \
  echo "Container stopped — wait 60s for alert" || echo "Container not found, skipping"

# 2. Monitor AlertManager logs
docker logs -f alertmanager --since 30s 2>&1 | grep -E "FIRING|ERROR" || true

# 3. Check alert-sender received the webhook
docker logs -f alert-sender --since 30s 2>&1 | grep -E "webhook|FIRING|ERROR" || true

# 4. Verify Telegram received the message (check the channel)

# 5. Restore the container
docker start openclaw-qgtzrmi6771lt8l7x8rqx72f 2>/dev/null || true
```

---

## 7. Managing Alert Routes and Inhibition Rules

### 7.1 Adding a New Route

To route alerts from a specific service to a different receiver, add a sub-route:

```yaml
route:
  # ... existing routes ...
  routes:
    - match:
        severity: critical
      receiver: telegram-critical
      continue: true
    - match:
        severity: warning
      receiver: telegram-warning
    # Add route for GPU alerts to a separate high-priority group
    - match:
        severity: warning
        job: nvidia-gpu
      receiver: telegram-critical  # Upgrade GPU warnings to critical
      continue: false
```

### 7.2 Inhibition Rules

Inhibition rules suppress alerts when a higher-priority alert is already firing. The config above suppresses `warning` when `critical` is active for the same `instance`.

**Key fields:**
- `source_match`: The alert that causes suppression
- `target_match`: The alert to suppress
- `equal`: Labels that must match for the inhibition to apply

### 7.3 Viewing Active Inhibition Rules

```bash
curl -s http://localhost:9093/api/v1/status/runtimeconfig | \
  python3 -c "import sys,json; d=json.load(sys.stdin); [print(r) for r in d.get('config',{}).get('inhibit_rules',[])]"
```

---

## 8. Debugging Alert Delivery Issues

### 8.1 Checklist

```
[ ] AlertManager container is Up
    docker ps --filter name=alertmanager

[ ] alert-sender container is Up
    docker ps --filter name=alert-sender

[ ] alert-sender /health returns 200
    curl -s http://localhost:8051/health

[ ] Telegram bot token is valid
    curl -s https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe | grep '"ok":true'

[ ] TELEGRAM_CHAT_ID is correct (bot must be member of the channel)
    curl -s https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates | python3 -m json.tool

[ ] Network connectivity (alert-sender can reach api.telegram.org)
    docker exec alert-sender curl -s -o /dev/null -w '%{http_code}' https://api.telegram.org/botTOKEN/getMe

[ ] AlertManager can reach alert-sender
    docker exec alertmanager wget -qO- -T 5 http://alert-sender:8080/health

[ ] Prometheus is firing alerts (check /alerts in Prometheus UI)
    curl -s http://localhost:9090/api/v1/alerts | python3 -c "import sys,json; d=json.load(sys.stdin); [print(a['name'],a['state']) for a in d['data']]"

[ ] AlertManager received the alerts
    curl -s http://localhost:9093/api/v1/alerts | python3 -m json.tool

[ ] Check alert-sender logs for errors
    docker logs alert-sender --since 5m 2>&1 | tail -50
```

### 8.2 Common Issues

**Issue: Alert fires but no Telegram message**
```
1. Check alert-sender logs: docker logs alert-sender --since 1m
2. Verify network: docker exec alert-sender ping api.telegram.org
3. Verify bot token: curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe
4. Verify chat_id: bot must be admin/member of the target channel
```

**Issue: Telegram returns 400 "chat not found"**
```
1. Bot must be added to the target channel first
2. For private channels: bot needs to be admin with "Post Messages" permission
3. For groups: invite the bot, then send /start to the group
```

**Issue: AlertManager webhook returns 0 (success) but no message**
```
1. alert-sender may be silently failing — check logs: docker logs alert-sender
2. Verify TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set correctly
3. Try sending direct curl to Telegram API from alert-sender container
```

**Issue: Many duplicate alerts**
```
1. Check group_wait (should be 30s) and group_interval (should be 5m)
2. Increase group_wait if alerts are batching poorly
3. Consider adding alert deduplication (see alert-deduplicator.md)
```

**Issue: AlertManager config reload fails**
```
1. Validate config: docker exec alertmanager amtool --config.file=/etc/alertmanager/alertmanager.yml verify
2. Check file permissions: chown will:will /srv/data/monitoring/alertmanager/alertmanager.yml
3. Check nflog permissions: chown -R will:will /srv/data/monitoring/alertmanager/
```

---

## 9. Secrets Management

All Telegram credentials are stored in **Infisical** at `vault.zappro.site`.

### 9.1 Required Secrets

| Secret | Purpose |
|--------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Target channel/group ID |

### 9.2 Rotating the Bot Token

1. Go to @BotFather on Telegram
2. Issue `/revoke` for the current bot
3. Get the new token
4. Update in Infisical: `vault.zappro.site` → secrets → `TELEGRAM_BOT_TOKEN`
5. Restart alert-sender container: `docker restart alert-sender`
6. Verify: `curl -s https://api.telegram.org/bot<NEW_TOKEN>/getMe`

---

## 10. Alert Deduplication

For high-volume environments, use the **alert-deduplicator** skill to prevent alert fatigue.

See: `/srv/monorepo/docs/OPERATIONS/SKILLS/alert-deduplicator.md`

**Three-layer approach:**
1. **Fingerprinting** — Generate hash from level + normalized title + context category
2. **Smart Grouping** — Batch 3+ alerts with same fingerprint within 5min into one message
3. **Cooldown Suppression** — Suppress duplicates for 15min after sending

---

## 11. Reference

### 11.1 Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Prometheus | `:9090` | Alert rules evaluation |
| AlertManager | `:9093` | Alert routing and delivery |
| alert-sender | `:8051` | Webhook receiver + Telegram bridge |
| Grafana | `:3100` (internal) | Dashboards |

### 11.2 Files

| File | Purpose |
|------|---------|
| `/srv/data/monitoring/alertmanager/alertmanager.yml` | AlertManager config |
| `/srv/apps/monitoring/prometheus.yml` | Prometheus scrape + alert rules |
| `/srv/data/monitoring/alertmanager/` | Data dir (silences, nflog) |
| `/srv/data/alert-sender/` | Persistent state for alert-sender |

### 11.3 Key Ports

| Port | Service |
|------|---------|
| 9093 | AlertManager |
| 8051 | alert-sender (external) |
| 8080 | alert-sender (internal) |
| 9090 | Prometheus |

### 11.4 Related Documents

- `SPEC-023-unified-monitoring-self-healing.md` — Full alerting stack design
- `SPEC-024-unified-monitoring-self-healing-implementation.md` — Implementation details
- `alert-deduplicator.md` — Alert deduplication skill
- `docs/GOVERNANCE/ALERT-ROUTING.md` — Routing rules governance
- `pipeline-alerting.yaml` — Smoke tests for alerting

---

**Authority:** will-zappro
**Last Updated:** 2026-04-11
