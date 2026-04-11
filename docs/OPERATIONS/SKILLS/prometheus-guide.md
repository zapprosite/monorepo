# Skill: Prometheus Operations Guide

**Purpose:** Complete reference for querying Prometheus, managing scrape configs, recording rules, alerting rules, and integrating with Grafana and AlertManager
**Complexity:** Medium-High
**Risk:** Read-only for queries; medium risk for rule changes
**When to Use:** Monitoring diagnostics, alert tuning, metric exploration, dashboard creation

## Architecture Overview

```
Prometheus (:9090)
    ├── Scrapes: node-exporter (:9100), cadvisor (:8080), loki (:3101), alertmanager (:9093), nvidia-gpu-exporter (:9835)
    ├── Remote write: Grafana Loki (deprecated — Grafana Alloy is current target)
    ├── Alerts: AlertManager (:9093)
    └── Dashboards: Grafana (:3100)

Scrape interval: 15s (default), 30s for heavy targets (cadvisor, loki, nvidia-gpu)
TSDB retention: 30 days
Network: monitoring_monitoring (10.0.16.x)
```

---

## 1. Querying Prometheus API v1

### 1.1 Instant Query (Current Value)

```bash
# Basic instant query
curl -s 'http://localhost:9090/api/v1/query?query=up'

# Query with 5m lookback
curl -s 'http://localhost:9090/api/v1/query?query=up&time=$(date +%s)'

# Response format
{
  "status": "success",
  "data": {
    "resultType": "vector",
    "result": [
      {
        "metric": {"__name__": "up", "job": "node-exporter", "instance": "node-exporter:9100"},
        "value": [1744300000.123, "1"]
      }
    ]
  }
}
```

### 1.2 Range Query (Time Series)

```bash
# Range query over last 5 minutes, 15s step
curl -s 'http://localhost:9090/api/v1/query_range?query=up&start=$(date -d "5 minutes ago" +%s)&end=$(date +%s)&step=15s'

# With RFC3339 timestamps
curl -s 'http://localhost:9090/api/v1/query_range?query=up&start=2026-04-11T00:00:00Z&end=2026-04-11T00:05:00Z&step=15s'
```

### 1.3 Query Labels (Series Metadata)

```bash
# Get all label names
curl -s 'http://localhost:9090/api/v1/label/__name__/values'

# Find all series matching a selector
curl -s -G 'http://localhost:9090/api/v1/series' --data-urlencode 'match[]=up' --data-urlencode 'match[]=node_cpu_seconds_total'

# Find series by label matchers
curl -s -G 'http://localhost:9090/api/v1/series' --data-urlencode 'match[]={job="node"}'
```

### 1.4 Targets (Scrape Health)

```bash
# All scrape targets with health status
curl -s 'http://localhost:9090/api/v1/targets' | python3 -c "
import json, sys
d = json.load(sys.stdin)
for t in d['data']['activeTargets']:
    health = t['health']
    job = t['labels']['job']
    err = t.get('lastError', '')
    print(f\"{'✅' if health=='up' else '🔴'} {job}: {health} {err[:60] if err else ''}\"
)"

# Targets in relaunch state
curl -s 'http://localhost:9090/api/v1/targets?state=active'
```

### 1.5 Rules (Alerting + Recording)

```bash
# Get all rules (alerting and recording)
curl -s 'http://localhost:9090/api/v1/rules'

# Get only alerting rules
curl -s 'http://localhost:9090/api/v1/rules?type=alert'

# Get only recording rules
curl -s 'http://localhost:9090/api/v1/rules?type=record'

# Get currently firing alerts
curl -s 'http://localhost:9090/api/v1/alerts'
```

### 1.6 Query Targets (Service Discovery)

```bash
# Active targets grouped by scrape pool
curl -s 'http://localhost:9090/api/v1/targets'

# Targets in relaunch (being rescheduled)
curl -s 'http://localhost:9090/api/v1/status/series?match[]=up'
```

### 1.7 Prometheus Status

```bash
# Runtime info
curl -s 'http://localhost:9090/api/v1/status/runtimeinfo'

# Build info
curl -s 'http://localhost:9090/api/v1/status/buildinfo'

# Flags
curl -s 'http://localhost:9090/api/v1/status/flags'

# TSDB stats
curl -s 'http://localhost:9090/api/v1/status/tsdb'
```

---

## 2. PromQL Examples

### 2.1 Common Metric Queries

```promql
# CPU usage percentage (all modes)
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage percentage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Memory available
node_memory_MemAvailable_bytes

# Disk usage for /srv mount
(1 - (node_filesystem_avail_bytes{mountpoint="/srv"} / node_filesystem_size_bytes{mountpoint="/srv"})) * 100

# ZFS pool usage (tank)
(1 - (node_filesystem_avail_bytes{device="tank", fstype="zfs"} / node_filesystem_size_bytes{device="tank", fstype="zfs"})) * 100

# Container count
count(container_last_seen)

# Container restarts (rate over 1h)
increase(container_restart_count[1h])

# GPU temperature
nvidia_smi_temperature_gpu{uuid="bc42e64f-64d5-4711-e976-6141787b60a2"}

# GPU memory usage %
(nvidia_smi_memory_used_bytes / nvidia_smi_memory_total_bytes) * 100

# Exporter health
up{job=~"node|cadvisor|nvidia-gpu|loki"}
```

### 2.2 Rate and Increase

```promql
# Requests per second (rate)
rate(http_requests_total[5m])

# Total requests over 1h (increase)
increase(http_requests_total[1h])

# Requests per second by method
rate(http_requests_total[5m]) by (method)

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100
```

### 2.3 Aggregations

```promql
# Sum by label
sum(rate(container_network_receive_bytes_total[5m])) by (container)

# Count distinct
count(up)

# Top 5 CPU consumers
topk(5, sum by (container) (rate(container_cpu_usage_seconds_total[5m])))

# Bottom 3 memory users
bottomk(3, node_memory_MemAvailable_bytes)
```

### 2.4 Time Functions

```promql
# Timestamp of vector
timestamp(node_cpu_seconds_total{mode="idle"})

# Predict when disk will be full (linear regression)
predict_linear(node_filesystem_avail_bytes{mountpoint="/srv"}[1h], 4*3600)

# Delta between two samples
delta(cpu_seconds_total{mode="idle"}[5m])

# Over time (change rate)
changes(container_restart_count[1h])

# Absent (alert if no data)
absent(up{job="node-exporter"})
```

### 2.5 Binary Operators

```promql
# Comparison with bool (returns 1 or 0)
node_memory_MemAvailable_bytes < 1e9  # returns 1 if true

# Boolean comparisons
node_memory_MemAvailable_bytes > 1e9

# Math
rate(container_cpu_usage_seconds_total[5m]) * 100

# on() clause for label matching
container_network_receive_bytes_total{container="prometheus"} * on(container) group_left(pod) container_network_transmit_bytes_total
```

### 2.6 Subqueries

```promql
# Max CPU in last 1h with 5m resolution
max_over_time(node_cpu_seconds_total[1h:5m])

# 30-day average with 6h resolution
avg_over_time(node_cpu_seconds_total[30d:6h])
```

---

## 3. Scrape Configs and Relabeling

### 3.1 prometheus.yml Structure

```yaml
global:
  scrape_interval: 15s        # Default scrape interval
  evaluation_interval: 15s    # Rule evaluation interval
  scrape_timeout: 10s         # Default scrape timeout
  external_labels:             # Labels added to all time series
    cluster: homelab
    owner: will-zappro

rule_files:
  - /etc/prometheus/rules/*.yml
  - /etc/prometheus/alerts/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    scrape_interval: 15s
    static_configs:
      - targets: ['node-exporter:9100']
        labels:
          instance: will-zappro

  - job_name: 'cadvisor'
    scrape_interval: 30s
    scrape_timeout: 30s         # cAdvisor is slow, override global 10s
    static_configs:
      - targets: ['cadvisor:8080']
        labels:
          instance: will-zappro

  - job_name: 'loki'
    scrape_interval: 30s
    scrape_timeout: 30s
    static_configs:
      - targets: ['loki:3101']
        labels:
          instance: will-zappro

  - job_name: 'nvidia-gpu'
    scrape_interval: 30s
    scrape_timeout: 30s
    static_configs:
      - targets: ['nvidia-gpu-exporter:9835']
        labels:
          instance: will-zappro
```

### 3.2 Relabeling

```yaml
scrape_configs:
  - job_name: 'node'
    relabel_configs:
      # Add instance label from __meta_ fields
      - source_labels: [__meta_docker_network_ip]
        target_label: instance_ip
        replacement: '${1}'

      # Drop metrics matching regex
      - source_labels: [__name__]
        regex: 'node_network_receive_drop_total'
        action: drop

      # Keep only metrics matching regex
      - source_labels: [__name__]
        regex: 'node_cpu.*'
        action: keep

      # Replace label value
      - source_labels: [instance]
        regex: '(.+):9100'
        target_label: node
        replacement: '${1}'

      # Copy to another label before dropping __meta
      - source_labels: [__meta_docker_container_name]
        regex: '/(.*)'
        target_label: container_name

      # Add constant label
      - target_label: datacenter
        replacement: 'homelab'
```

### 3.3 Key Labels (Preserved vs Dropped)

| Label | Source | Use |
|-------|--------|-----|
| `__name__` | Metric name | The metric identifier |
| `__address__` | Target address | Scraped endpoint |
| `__meta_*` | Service discovery | Docker, EC2, etc. metadata |
| `instance` | Usually hostname:port | Target identification |
| `job` | Job name from config | Logical grouping |

Metrics are relabeled **after** scraping. Use `metric_relabel_configs` to modify metrics before storage.

---

## 4. Recording Rules

Recording rules pre-compute frequently queried PromQL expressions into new time series, improving query performance.

### 4.1 Rule File Structure

```yaml
# /etc/prometheus/rules/recording_rules.yml
groups:
  - name: cpu_rules
    interval: 30s
    rules:
      # CPU usage percentage per instance
      - record: instance:cpu_usage_percent:avg5m
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

      # CPU usage percentage per container
      - record: container:cpu_usage_percent:avg5m
        expr: sum by (container) (rate(container_cpu_usage_seconds_total[5m])) * 100

  - name: memory_rules
    interval: 30s
    rules:
      # Memory usage percentage per instance
      - record: instance:memory_usage_percent:avg5m
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

      # Memory usage percentage per container
      - record: container:memory_usage_percent:avg5m
        expr: (1 - (container_memory_working_set_bytes / container_spec_memory_limit_bytes)) * 100

  - name: container_rules
    interval: 30s
    rules:
      # Container restart rate
      - record: container:restart_rate:5m
        expr: rate(container_restart_count[5m])

      # Container network I/O
      - record: container:network_receive_bytes:rate5m
        expr: rate(container_network_receive_bytes_total[5m])

      - record: container:network_transmit_bytes:rate5m
        expr: rate(container_network_transmit_bytes_total[5m])

  - name: gpu_rules
    interval: 30s
    rules:
      # GPU temperature
      - record: gpu:temperature:celsius:avg5m
        expr: nvidia_smi_temperature_gpu{uuid="bc42e64f-64d5-4711-e976-6141787b60a2"}

      # GPU memory usage percentage
      - record: gpu:memory_usage_percent:avg5m
        expr: (nvidia_smi_memory_used_bytes / nvidia_smi_memory_total_bytes) * 100

  - name: disk_rules
    interval: 60s
    rules:
      # Disk usage for key mounts
      - record: instance:disk_usage_percent:mountpoint_srv
        expr: (1 - (node_filesystem_avail_bytes{mountpoint="/srv"} / node_filesystem_size_bytes{mountpoint="/srv"})) * 100

      # ZFS pool usage
      - record: tank:pool_usage_percent
        expr: (1 - (node_filesystem_avail_bytes{device="tank", fstype="zfs"} / node_filesystem_size_bytes{device="tank", fstype="zfs"})) * 100
```

### 4.2 Naming Convention

```
level:metric:aggregation
```

| Component | Example | Meaning |
|-----------|---------|---------|
| `level` | `instance`, `container`, `gpu` | Scope |
| `metric` | `cpu_usage_percent`, `memory_usage_percent` | Base metric |
| `aggregation` | `avg5m`, `rate5m`, `sum` | Time/sample aggregation |

### 4.3 Managing Rules with promtool

```bash
# Validate rules file
docker exec prometheus promtool check rules /etc/prometheus/rules/recording_rules.yml

# Dry-run rules against test data
docker exec prometheus promtool test rules test.rules.yml

# Update rules (requires SIGHUP or restart)
docker exec prometheus kill -HUP 1
```

---

## 5. Alerting Rules (Prometheus-Style)

### 5.1 Alert Rule Structure

```yaml
# /etc/prometheus/alerts/alert_rules.yml
groups:
  - name: container_alerts
    interval: 30s
    rules:
      # Container is down
      - alert: ContainerDown
        expr: container_last_seen == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Container {{ $labels.container }} is down"
          description: "{{ $labels.container }} has been down for more than 1 minute"

      # Restart loop detected
      - alert: ContainerRestartLoop
        expr: increase(container_restart_count[1h]) >= 3
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Container {{ $labels.container }} in restart loop"
          description: "{{ $labels.container }} restarted {{ $value | printf \"%.0f\" }} times in the last hour"

  - name: host_alerts
    interval: 30s
    rules:
      # High CPU
      - alert: HighCPU
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU on {{ $labels.instance }}"
          description: "CPU usage is above 90% for 5 minutes"

      # High memory
      - alert: HighMemory
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory on {{ $labels.instance }}"

      # Disk space low
      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes{mountpoint="/srv"} / node_filesystem_size_bytes{mountpoint="/srv"})) * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space low on {{ $labels.instance }}"

  - name: zfs_alerts
    interval: 60s
    rules:
      # ZFS pool usage high
      - alert: ZFSPoolUsageHigh
        expr: (1 - (node_filesystem_avail_bytes{device="tank", fstype="zfs"} / node_filesystem_size_bytes{device="tank", fstype="zfs"})) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "ZFS pool tank usage above 85%"

  - name: gpu_alerts
    interval: 30s
    rules:
      # GPU temperature high
      - alert: GPUTemperatureHigh
        expr: nvidia_smi_temperature_gpu{uuid="bc42e64f-64d5-4711-e976-6141787b60a2"} > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "GPU temperature above 80C"

      # GPU memory usage high
      - alert: GPUMemoryUsageHigh
        expr: (nvidia_smi_memory_used_bytes / nvidia_smi_memory_total_bytes) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "GPU memory usage above 90%"

  - name: exporter_alerts
    interval: 30s
    rules:
      # Exporter down
      - alert: ExporterDown
        expr: up{job=~"node|cadvisor|nvidia-gpu|loki"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Exporter {{ $labels.job }} is down"
          description: "{{ $labels.job }} has been down for more than 2 minutes"
```

### 5.2 Alert Fields

| Field | Required | Description |
|-------|----------|-------------|
| `alert` | Yes | Alert name |
| `expr` | Yes | PromQL expression to evaluate |
| `for` | No | Duration to wait before firing (0m = instant) |
| `labels` | No | Key-value pairs attached to alert |
| `annotations` | No | Descriptive text (supports templates) |

### 5.3 Label Selectors for Routing (AlertManager)

```yaml
# AlertManager receives alerts and routes based on labels
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
```

### 5.4 Alert Template Variables

```promql
# Available in annotations
{{ $labels.* }}       # Label values
{{ $value }}          # Current value of the expression
{{ $groupLabels.* }}  # Group labels
{{ $commonLabels.* }} # Labels common to all alerts in group
{{ $externalURL }}    # Link back to Prometheus
{{ $fingerprint }}     # Alert fingerprint
```

---

## 6. Grafana Integration

### 6.1 Datasource Configuration

```bash
# Prometheus datasource URL from Grafana container
http://prometheus:9090

# Grafana UID: efg9h1u7ja6tcb
# Access: Proxy (server)
```

### 6.2 Query Editor Examples

```promql
# Panel: CPU Usage %
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Panel: Memory Usage %
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Panel: Container Count
count(container_last_seen)

# Panel: GPU Temperature
nvidia_smi_temperature_gpu{uuid="bc42e64f-64d5-4711-e976-6141787b60a2"}

# Panel: Exporter Health Table
up{job=~"node|cadvisor|nvidia-gpu|loki"}
```

### 6.3 Dashboard JSON (Simplified Structure)

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
      "targets": [{
        "expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
        "legendFormat": "{{instance}}"
      }]
    },
    {
      "id": 2,
      "title": "Memory Usage %",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
      "targets": [{
        "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
        "legendFormat": "{{instance}}"
      }]
    },
    {
      "id": 3,
      "title": "Container Count",
      "type": "stat",
      "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8},
      "targets": [{"expr": "count(container_last_seen)"}]
    },
    {
      "id": 4,
      "title": "GPU Temperature",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
      "targets": [{
        "expr": "nvidia_smi_temperature_gpu{uuid=\"bc42e64f-64d5-4711-e976-6141787b60a2\"}"
      }]
    }
  ]
}
```

### 6.4 Grafana API (Provisioning)

```bash
# Get datasource UID
curl -s -u admin:$GRAFANA_PASS 'http://localhost:3100/api/datasources' | python3 -c "
import json, sys
for ds in json.load(sys.stdin):
    print(f\"{ds['uid']}: {ds['name']} @ {ds['url']}\"
)"

# Create dashboard via API
curl -s -X POST 'http://localhost:3100/api/dashboards/db' \
  -u admin:$GRAFANA_PASS \
  -H 'Content-Type: application/json' \
  -d '{
    "dashboard": {...},
    "overwrite": true,
    "message": "Updated via API"
  }'
```

---

## 7. AlertManager Integration

### 7.1 AlertManager Configuration

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

### 7.2 AlertManager API

```bash
# Get AlertManager status
curl -s 'http://localhost:9093/api/v1/status'

# Get current alerts
curl -s 'http://localhost:9093/api/v1/alerts'

# Get silenced alerts
curl -s 'http://localhost:9093/api/v1/silences'

# Create silence
curl -s -X POST 'http://localhost:9093/api/v1/silences' \
  -H 'Content-Type: application/json' \
  -d '{
    "matchers": [{"name": "alertname", "value": "ContainerDown"}],
    "startsAt": "2026-04-11T00:00:00Z",
    "endsAt": "2026-04-12T00:00:00Z",
    "createdBy": "admin",
    "comment": "Maintenance window"
  }'

# Delete silence
curl -s -X DELETE "http://localhost:9093/api/v1/silence/{silence_id}"
```

### 7.3 Alert Flow

```
Prometheus evaluates alert rules
    ↓
Alert fires → Prometheus sends to AlertManager
    ↓
AlertManager groups by alertname, instance
    ↓
AlertManager routes to receiver (telegram-critical, telegram-warning, etc.)
    ↓
alert-sender receives webhook, formats Telegram message
    ↓
Telegram message sent to @HOMELAB_LOPS
```

---

## 8. Debugging and Diagnostics

### 8.1 Prometheus Targets Down

```bash
# Step 1: Verify exporter is running
docker ps | grep -E 'node-exporter|cadvisor|nvidia-gpu|loki'

# Step 2: Check exporter health endpoint
curl -s http://localhost:9100/metrics | head -3  # node-exporter
curl -s http://localhost:9250/healthz            # cadvisor
curl -s http://localhost:9835/metrics | grep nvidia  # nvidia-gpu-exporter
curl -s http://localhost:3101/ready              # loki

# Step 3: Verify Prometheus can reach exporter (from container)
docker exec prometheus wget -qO- http://node-exporter:9100/metrics

# Step 4: Check scrape config
docker exec prometheus cat /etc/prometheus/prometheus.yml

# Step 5: Restart Prometheus to reload config
docker exec prometheus kill -HUP 1
```

### 8.2 Query Returns No Data

```bash
# Step 1: Check if metric exists
curl -s -G 'http://localhost:9090/api/v1/series' --data-urlencode 'match[]=node_cpu_seconds_total'

# Step 2: Check time range in Grafana (try last 1h instead of 5m)

# Step 3: Check recording rule name (might have been deleted)
curl -s 'http://localhost:9090/api/v1/rules?type=record'

# Step 4: Check Prometheus logs
docker logs prometheus --tail=50 | grep -iE 'error|warn'
```

### 8.3 Alerts Not Firing

```bash
# Step 1: Check alert rules loaded
curl -s 'http://localhost:9090/api/v1/rules?type=alert' | python3 -c "
import json, sys
d = json.load(sys.stdin)
for g in d['data']['groups']:
    for r in g['rules']:
        if r['type'] == 'alerting':
            print(f\"{r['name']}: state={r['state']}, health={r['health']}\"
)"

# Step 2: Test alert expression manually
curl -s -G 'http://localhost:9090/api/v1/query' --data-urlencode 'query=container_last_seen == 0'

# Step 3: Check AlertManager connectivity
curl -s http://localhost:9093/-/healthy

# Step 4: Verify Prometheus knows AlertManager
curl -s 'http://localhost:9090/api/v1/status/flags' | grep alertmanager
```

### 8.4 High Cardinality / Memory Issues

```bash
# Check TSDB stats
curl -s 'http://localhost:9090/api/v1/status/tsdb' | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f\"Head: {d['data']['headStats']}\"
)"

# Check number of series
curl -s 'http://localhost:9090/api/v1/query?query=prometheus_tsdb_head_series'

# Check memory usage
docker stats prometheus --no-stream
```

---

## 9. Quick Reference

### 9.1 Ports

| Service | Internal Port | External | URL |
|---------|--------------|----------|-----|
| Prometheus | 9090 | 9090 | http://localhost:9090 |
| Grafana | 3000 | 3100 | https://monitor.zappro.site |
| AlertManager | 9093 | 9093 | http://localhost:9093 |
| node-exporter | 9100 | 9100 | http://localhost:9100 |
| cadvisor | 8080 | 9250 | http://localhost:9250 |
| nvidia-gpu-exporter | 9835 | 9835 | http://localhost:9835 |
| Loki | 3101 | 3101 | http://localhost:3101 |

### 9.2 Key Metrics

| Metric | Source | Use |
|--------|--------|-----|
| `up{job="..."}` | All exporters | Target health |
| `node_cpu_seconds_total` | node-exporter | CPU utilization |
| `node_memory_MemAvailable_bytes` | node-exporter | Memory availability |
| `node_filesystem_avail_bytes` | node-exporter | Disk space |
| `container_last_seen` | cadvisor | Container health |
| `container_restart_count` | cadvisor | Container restarts |
| `nvidia_smi_temperature_gpu` | nvidia-gpu-exporter | GPU temp |
| `nvidia_smi_memory_used_bytes` | nvidia-gpu-exporter | GPU memory |

### 9.3 Docker Commands

```bash
# Restart Prometheus (reload config)
docker exec prometheus kill -HUP 1

# Check Prometheus config
docker exec prometheus cat /etc/prometheus/prometheus.yml

# Validate rules
docker exec prometheus promtool check rules /etc/prometheus/rules/*.yml

# View Prometheus logs
docker logs prometheus --tail=100 -f

# Restart AlertManager
docker restart alertmanager

# Check AlertManager config
docker exec alertmanager cat /etc/alertmanager/alertmanager.yml
```

### 9.4 Alert Levels

| Severity | Trigger | Action |
|----------|---------|--------|
| critical | Container down, restart loop, disk > 90% | Immediate Telegram + ZFS snapshot |
| warning | CPU > 90%, memory > 90%, GPU > 80%, pool > 85% | Telegram warning |
| info | Container restarted successfully | Log only |

---

## Related Documents

- `monitoring-health-check.md` — Regular health verification procedure
- `monitoring-diagnostic.md` — Troubleshooting decision tree
- `container-self-healer.md` — Automatic container recovery
- `SPEC-023-unified-monitoring-self-healing.md` — Full monitoring specification
- `SPEC-024-unified-monitoring-self-healing-implementation.md` — Implementation details

---

**Authority:** will-zappro
**Last update:** 2026-04-11
