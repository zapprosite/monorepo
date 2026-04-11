# Skill: Loki Log Aggregation Guide

**Purpose:** Complete reference for querying Loki, configuring Grafana Alloy log shipping, understanding log labels/streams, managing retention, and debugging log pipeline issues
**Complexity:** Medium
**Risk:** Read-only for queries; configuration changes require approval
**When to Use:** Investigating logs, debugging services, creating dashboards, troubleshooting log pipeline

---

## 1. Architecture Overview

```
Docker Containers (json-file log driver)
         │
         │ max-size: 10m, max-file: 3
         ▼
Grafana Alloy 1.12.0 (:3101 agent)
         │
         │ loki.source.docker + loki.process + loki.write
         ▼
Loki 3.7.0 (:3101 storage)
         │
         │ LogQL queries
         ▼
Grafana Dashboards (:3100)
```

**Key Ports:**
- Loki API: `3101`
- Grafana: `3100`
- Grafana Alloy: Internal only (config at `/srv/data/monitoring/alloy/config.alloy`)

---

## 2. Loki API v1 Endpoints

### 2.1 Push Logs (Write)

```bash
# Push logs directly to Loki
curl -X POST "http://localhost:3101/loki/api/v1/push" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "streams": [{
      "stream": {"app": "myapp", "env": "prod"},
      "values": [
        ["1704067200000000000", "2024-01-01T00:00:00Z INFO Starting service"]
      ]
    }]
  }'
```

### 2.2 Query Logs (Read)

```bash
# Range query (returns logs within time range)
curl -G "http://localhost:3101/loki/api/v1/query_range" \
  --data-urlencode 'query={app="myapp"} |= "error"' \
  --data-urlencode 'start=1704067200000000000' \
  --data-urlencode 'end=1704153600000000000' \
  --data-urlencode 'limit=100'
```

### 2.3 Instant Query (Single Point in Time)

```bash
# Query logs at exact moment
curl -G "http://localhost:3101/loki/api/v1/query" \
  --data-urlencode 'query={app="myapp"} |= "error"'
```

### 2.4 Labels

```bash
# Get all label names
curl "http://localhost:3101/loki/api/v1/label"

# Get label values for a specific label
curl "http://localhost:3101/loki/api/v1/label/app"

# Get series (streams)
curl -G "http://localhost:3101/loki/api/v1/series" \
  --data-urlencode 'match[]={app=~".+"}'
```

### 2.5 Health & Ready

```bash
# Health check
curl "http://localhost:3101/loki/ready"

# Returns 200 OK when Loki is ready
```

---

## 3. LogQL: Log Query Language

### 3.1 Log Stream Selectors

Select logs by labels using `{}`:

```logql
# All logs
{ }

# Specific container
{container="grafana"}

# Multiple labels
{container="loki", env="prod"}

# Regex matching (=~ for match, !~ for exclude)
{name =~ "mysql.+"}
{name !~ "prometheus.*"}
```

### 3.2 Line Filters

Filter log content with `|=` (include) and `!=` (exclude):

```logql
# Contains "error"
{container="myapp"} |= "error"

# Does NOT contain "timeout"
{container="myapp"} != "timeout"

# Regex match
{container="myapp"} |= "error|fatal"

# Multiple filters (AND logic)
{container="myapp"} |= "error" != "ignore" |= "failed"
```

### 3.3 Log Parsers

Parse structured log content:

```logql
# JSON parser
{container="myapp"} | json | status_code != "200"

# Logfmt parser (key=value pairs)
{container="myapp"} | logfmt | duration > 30s

# Regex parser (capture groups)
{container="myapp"} | regex "(?P<status>\\d+) (?P<msg>.*)"
```

### 3.4 Label Filters

Filter based on parsed or existing labels:

```logql
# Numeric comparison
{container="myapp"} | duration > 10s

# String comparison
{app="grafana"} | level = "error"

# Range filters
{container="api"} | status_code >= 500
```

### 3.5 Log Range Aggregations

Aggregate logs over a time range:

```logql
# Count logs in 5-minute windows
count_over_time({container="myapp"}[5m])

# Rate of errors per second over 1 minute
sum by (container) (rate({} |= "error"[1m]))

# Bytes per second
sum by (app) (rate({job="myapp"} | json | bytes > 1000[1m]))

# Average line length
avg by (container) (rate({container="myapp"} | unwrap bytes | rate[5m]))
```

### 3.6 Common Query Patterns

```logql
# All error logs in last 15 minutes
{env="prod"} |= "error" | json | level="error"

# Logs from specific service excluding debug
{service="api-gateway"} != "DEBUG" != "TRACE"

# Slow requests (>5s duration)
{container="nginx"} | logfmt | duration > 5s

# Error rate per container
sum by (container) (rate({} |= "error"[5m]))

# Requests per second by status code
sum by (status) (rate({job="http-api"}[1m]))

# Recent logs from all containers
{container=~".+"} | json | level="error" | unwrap timestamp | __line__ > ago(15m)
```

---

## 4. Log Labels and Streams

### 4.1 Docker Container Labels

When using `loki.source.docker`, containers automatically receive these labels:

| Label | Description | Example |
|-------|-------------|---------|
| `container` | Container name | `grafana` |
| `container_id` | Full container ID | `abc123def456...` |
| `container_image` | Image name | `grafana/grafana:12.4.2` |
| `container_start_time` | Container start ISO8601 | `2026-04-01T00:00:00.000Z` |
| `host` | Hostname | `will-zappro` |
| `filename` | Log file path | `/var/lib/docker/containers/...` |
| `message` | Raw log line | `Log message here` |
| `labels` | Docker labels JSON | `{}` |

### 4.2 Alloy-Added Labels

Grafana Alloy adds via `loki.process`:

| Label | Description | Example |
|-------|-------------|---------|
| `level` | Parsed log level | `info`, `error`, `warn` |
| `timestamp` | Parsed timestamp | `2026-04-01 12:00:00` |

### 4.3 Custom Labels

Add custom labels in Alloy config:

```alloy
loki.source.docker "monitoring" {
  host    = "unix:///var/run/docker.sock"
  labels  = {"env" = "prod", "datacenter" = "homelab"}
  forward = false
}
```

---

## 5. Grafana Alloy Configuration

### 5.1 Complete Alloy Config for Docker Logs

Location: `/srv/data/monitoring/alloy/config.alloy`

```alloy
// /srv/data/monitoring/alloy/config.alloy

// Discover Docker containers
discovery.docker "monitoring" {
  host = "unix:///var/run/docker.sock"
}

// Collect Docker container logs
loki.source.docker "monitoring" {
  host    = "unix:///var/run/docker.sock"
  forward = false
}

// Process and parse logs
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

// Write to Loki
loki.write "loki" {
  endpoint {
    url = "http://loki:3101/loki/api/v1/push"
  }
}
```

### 5.2 Relabel Container Name to Label

```alloy
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "containers" {
  targets = discovery.docker.containers.targets

  rule {
    source_labels = ["__meta_docker_container_name"]
    target_label  = "container"
  }
}

loki.source.docker "logs" {
  host    = "unix:///var/run/docker.sock"
  targets = discovery.relabel.containers.output
  forward_to = [loki.process.process.receiver]
}

loki.process "process" {
  stage.docker { }
  forward_to = [loki.write.remote.receiver]
}

loki.write "remote" {
  endpoint {
    url = "http://loki:3101/loki/api/v1/push"
  }
}
```

### 5.3 Verify Alloy Configuration

```bash
# Check Alloy container is running
docker ps | grep alloy

# View current config
cat /srv/data/monitoring/alloy/config.alloy

# Validate config syntax
docker exec alloy alloyctl validate --file /srv/data/monitoring/alloy/config.alloy

# Check Alloy logs
docker logs alloy --tail=50
```

---

## 6. Docker Log Configuration

### 6.1 Log Driver Settings

All containers MUST use `json-file` driver with rotation:

```yaml
# In docker-compose
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

### 6.2 Verify Log Configuration

```bash
# Check all containers
docker inspect --format='{{.Name}}: log-driver={{.HostConfig.LogConfig.Type}}, max-size={{.HostConfig.LogConfig.Config.MaxSize}}, max-files={{.HostConfig.LogConfig.Config.MaxFiles}}' $(docker ps -a --format '{{.Names}}')
```

**Expected for all containers:**
- `LogConfig.Type`: `json-file`
- `MaxSize`: `10m`
- `MaxFiles`: `3`

### 6.3 Fix Log Configuration

```bash
# Recreate container with proper logging
# For docker-compose services:
docker compose down <service>
# Edit docker-compose.yml with correct logging config
docker compose up -d <service>

# For standalone containers:
docker run --log-driver=json-file --log-opt max-size=10m --log-opt max-file=3 ...
```

---

## 7. Retention Policies

### 7.1 Current Configuration

Loki retention is set to **30 days** (720h).

### 7.2 Loki Configuration for Retention

In `/srv/data/monitoring/loki/loki-config.yml`:

```yaml
schema_config:
  configs:
    - from: "2024-01-01"
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: loki_index_
        period: 24h

storage_config:
  tsdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/index_cache

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h  # 30 days

limits_config:
  max_query_lookback: 720h
```

### 7.3 Manual Retention Operations

```bash
# Check Loki storage usage
du -sh /srv/data/loki/

# List index tables
ls -la /srv/data/loki/index/

# Manual compaction (if needed)
docker exec loki wget -qO- "http://localhost:3101/compactor/finished"
```

---

## 8. Debug Log Pipeline Issues

### 8.1 Decision Tree

```
LOG PIPELINE ISSUE
│
├─ Loki not receiving logs?
│  ├─ 1. Is Loki container UP?
│  │     docker ps | grep loki
│  │
│  ├─ 2. Is Alloy container UP?
│  │     docker ps | grep alloy
│  │
│  ├─ 3. Check Alloy → Loki connectivity
│  │     docker exec alloy nc -zv loki 3101
│  │
│  └─ 4. Check Loki health
│        curl -sf http://localhost:3101/ready
│
├─ Logs present but wrong labels?
│  ├─ 1. Check discovery.docker targets
│  │     docker exec alloy alloyctl discover
│  │
│  ├─ 2. Verify relabel rules
│  │     Check /srv/data/monitoring/alloy/config.alloy
│  │
│  └─ 3. Test with explicit label query
│        curl "http://localhost:3101/loki/api/v1/label/container"
│
├─ No logs from specific container?
│  ├─ 1. Check container is running
│  │     docker ps | grep <container>
│  │
│  ├─ 2. Check container log driver
│  │     docker inspect <container> --format '{{.HostConfig.LogConfig.Type}}'
│  │
│  ├─ 3. Check container logging options
│  │     docker inspect <container> --format '{{.HostConfig.LogConfig.Config}}'
│  │
│  └─ 4. Force container to rotate log
│        docker logs --rotate <container>
│
└─ Query returns no results?
   ├─ 1. Verify time range
   │     Use "Last 15 minutes" in Grafana
   │
   ├─ 2. Check label values exist
   │     curl "http://localhost:3101/loki/api/v1/label"
   │
   └─ 3. Query all logs first
        {container=~".+"} | limit 1
```

### 8.2 Common Issues & Fixes

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| Loki shows no logs | Check Alloy is running | `docker start alloy` |
| Alloy can't find containers | Docker socket permissions | Check `will:will` owns `/var/run/docker.sock` |
| Missing container labels | Relabel rules missing | Update Alloy config with `discovery.relabel` |
| Log lines not parsed | Regex stage incorrect | Update `loki.process` regex pattern |
| Logs have wrong timestamp | Parser stage issue | Check stage ordering in Alloy |
| Query timeout | Lookback too long | Reduce time range or increase `max_query_lookback` |
| "gap in stream" errors | Loki restarted during writes | Ignore (Loki handles); if frequent, check Loki health |
| Labels show "undefined" | Container has no Docker labels | Use container name as fallback label |

### 8.3 Debug Commands

```bash
# 1. Check Loki container health
docker ps -a | grep loki
curl -sf http://localhost:3101/ready || echo "Loki not ready"

# 2. Check Alloy container
docker ps -a | grep alloy
docker logs alloy --tail=20

# 3. Verify Docker socket
ls -la /var/run/docker.sock
stat -c "%U:%G" /var/run/docker.sock

# 4. Test Loki push endpoint
curl -X POST "http://localhost:3101/loki/api/v1/push" \
  -H "Content-Type: application/json" \
  --data '{"streams":[{"stream":{"test":"loki"},"values":[["1704067200000000000","test message"]]}]}'

# 5. Query for test message
curl -G "http://localhost:3101/loki/api/v1/query_range" \
  --data-urlencode 'query={test="loki"}'

# 6. Check container discovery
docker exec alloy alloyctl discover discovery.docker.monitoring

# 7. View raw Docker logs
docker logs <container> --tail=10

# 8. Check log file size
ls -lh /var/lib/docker/containers/<container_id>/*.log
```

### 8.4 Log Pipeline Verification Checklist

- [ ] Loki container is `Up` and healthy
- [ ] Grafana Alloy container is `Up`
- [ ] Loki ready endpoint returns 200
- [ ] Alloy can connect to Loki on port 3101
- [ ] Docker socket exists and has correct permissions
- [ ] All containers use `json-file` log driver
- [ ] All containers have `max-size: 10m` and `max-file: 3`
- [ ] Alloy config has valid syntax
- [ ] Loki is receiving logs (check query)

---

## 9. Grafana Dashboard Integration

### 9.1 Add Loki Datasource in Grafana

1. Navigate to Grafana: `http://localhost:3100`
2. Go to **Connections** > **Data Sources**
3. Add **Loki** datasource:
   - URL: `http://loki:3101`
   - **No** authentication needed (internal network)

### 9.2 Explore Logs

1. Go to **Explore** (compass icon)
2. Select **Loki** datasource
3. Use Log Browser to select labels
4. Or write LogQL directly in query field

### 9.3 Example Dashboard Panels

```logql
# Error rate panel
sum by (container) (rate({container=~".+"} |= "error"[5m]))

# Log volume by container
sum by (container) (rate({container=~".+"}[1m]))

# Slow requests panel
count_over_time({container="api"} | logfmt | duration > 5s[5m])
```

---

## 10. Reference

### 10.1 Key Files

| File | Purpose |
|------|---------|
| `/srv/data/monitoring/alloy/config.alloy` | Alloy log shipping config |
| `/srv/data/loki/` | Loki data directory |
| `/srv/data/monitoring/loki/loki-config.yml` | Loki server config |
| `/srv/ops/ai-governance/logs/` | Operational logs |

### 10.2 Container Names (homelab)

| Container | Purpose |
|-----------|---------|
| `loki` | Log storage |
| `alloy` | Log shipper (Promail replacement) |
| `grafana` | Dashboards & visualization |
| `prometheus` | Metrics (not logs) |

### 10.3 Ports

| Port | Service |
|------|---------|
| 3101 | Loki API |
| 3100 | Grafana |

### 10.4 Log Rotation Summary

| Setting | Value | Description |
|---------|-------|-------------|
| `max-size` | `10m` | Max size per log file before rotation |
| `max-file` | `3` | Max number of rotated log files to keep |

---

## See Also

- `SPEC-023-unified-monitoring-self-healing.md` - Full monitoring spec
- `SPEC-024-unified-monitoring-self-healing-implementation.md` - Implementation details
- `monitoring-health-check.md` - Health verification skill
- `monitoring-diagnostic.md` - Diagnostic decision tree
