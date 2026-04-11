# Grafana API & Monitoring Operations Guide

**Purpose:** Teach any LLM how to operate Grafana v12.4.2 programmatically via its REST API v1
**Scope:** API authentication, dashboard management, alerting rules, data sources, Grafana Alloy log shipping
**Host:** will-zappro homelab | Grafana: `https://monitor.zappro.site` (:3100 external, :3000 internal)
**Version:** Grafana 12.4.2 | Prometheus 3.11.1 | AlertManager 0.31.1 | Loki 3.7.0 | Grafana Alloy 1.12.0

> **AUTHENTICATION:** Grafana open source uses **Service Accounts + Tokens** — NOT API Keys (those are Grafana Cloud only).
> **Source of Truth:** See `docs/GOVERNANCE/GRAFANA-SERVICE-ACCOUNT.md` for definitive auth reference.

---

## 1. Authentication

### 1.1 Service Account Token (CORRETO — open source)

Grafana open source usa **Service Accounts + Tokens** para autenticação API.

**Header Format:**
```
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Token format:** `glsa_xxxxxxxx...`

**Base URL:** `http://localhost:3000/api` (local) ou `https://monitor.zappro.site/api` (external)

### 1.2 Getting the Token from Infisical (SDK v2)

```python
# Python: Fetch Grafana Service Account token from Infisical
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

def get_grafana_token():
    """Fetch Grafana Service Account token from Infisical vault."""
    client = InfisicalClient(settings=ClientSettings(
        access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
        site_url='http://127.0.0.1:8200',
    ))
    return client.getSecret(GetSecretOptions(
        environment='dev',
        project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
        secret_name='GRAFANA_SERVICE_ACCOUNT_TOKEN',
        path='/',
    )).secret_value
```

### 1.3 Python HTTP Client Setup

```python
# Python: Grafana API client with authentication
import os
import requests

class GrafanaClient:
    """Authenticated client for Grafana HTTP API v1."""

    BASE_URL = "https://monitor.zappro.site/api"

    def __init__(self, api_key: str):
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        })

    def get(self, endpoint: str) -> dict:
        """GET request to Grafana API."""
        return self.session.get(f"{self.BASE_URL}{endpoint}").json()

    def post(self, endpoint: str, data: dict) -> dict:
        """POST request to Grafana API."""
        return self.session.post(f"{self.BASE_URL}{endpoint}", json=data).json()

    def put(self, endpoint: str, data: dict) -> dict:
        """PUT request to Grafana API."""
        return self.session.put(f"{self.BASE_URL}{endpoint}", json=data).json()

    def delete(self, endpoint: str) -> requests.Response:
        """DELETE request to Grafana API."""
        return self.session.delete(f"{self.BASE_URL}{endpoint}")

# Usage
GRAFANA_API_KEY = os.environ.get("GRAFANA_API_KEY") or get_grafana_api_key()
grafana = GrafanaClient(GRAFANA_API_KEY)
```

---

## 2. Grafana API v1 Endpoints

### 2.1 Health Check

```python
# Check Grafana health
def health_check(client: GrafanaClient) -> bool:
    """Verify Grafana is responding."""
    try:
        result = client.get("/health")
        return result.get("status") == "OK"
    except Exception as e:
        print(f"Grafana health check failed: {e}")
        return False
```

### 2.2 API Endpoints by Category

| Category | Endpoint Prefix | Description |
|----------|-----------------|-------------|
| Admin | `/api/admin/` | Server admin operations |
| Alerting | `/api/alerting/` | Alert rules and notification policies (legacy) |
| Alerting Provisioning | `/api/v1/provisioning/alert-rules/` | Unified Alerting provisioning |
| Annotations | `/api/annotations/` | Annotation events |
| Correlations | `/api/correlations/` | Correlations between data sources |
| Dashboard | `/api/dashboards/` | Dashboard CRUD (legacy) |
| Dashboard (new) | `/apis/dashboard.grafana.app/v1beta1/` | Kubernetes-style dashboard API |
| Data Sources | `/api/datasources/` | Datasource management |
| Folders | `/api/folders/` | Folder CRUD |
| Library Elements | `/api/library-elements/` | Reusable dashboard components |
| Organization | `/api/org/` | Organization management |
| Playlists | `/api/playlists/` | Dashboard playlists |
| Search | `/api/search/` | Search dashboards and folders |
| Service Accounts | `/api/serviceaccounts/` | API key management |
| Teams | `/api/teams/` | Team management |
| Users | `/api/users/` | User management |

### 2.3 Common Request/Response Patterns

```python
# Standard success response
{
    "id": 1,
    "uid": "abc123",
    "message": "Dashboard saved"
}

# Standard error response
{
    "message": "Dashboard not found",
    "status": 404
}

# Collection response (list endpoints)
{
    "results": [...],
    "total": 100
}
```

---

## 3. Dashboard Management

### 3.1 Legacy Dashboard API (api/dashboards/)

#### Create or Update Dashboard

```python
# Python: Create or update a dashboard
def create_dashboard(client: GrafanaClient, dashboard: dict, folder_uid: str = None, overwrite: bool = True) -> dict:
    """
    Create or update a dashboard.

    Args:
        client: GrafanaClient instance
        dashboard: Dashboard JSON object (with 'id', 'uid', 'title' fields)
        folder_uid: UID of the folder to place dashboard in
        overwrite: If True, update existing dashboard with same uid

    Returns:
        dict with 'id', 'uid', 'message' on success
    """
    payload = {
        "dashboard": dashboard,
        "folderUid": folder_uid,
        "message": "Provisioned via API",
        "overwrite": overwrite
    }
    return client.post("/dashboards/db", payload)


# Example: Create Homelab Datacenter Overview dashboard
homelab_dashboard = {
    "id": None,
    "uid": "efg9h1u7ja6tcb",  # Use existing UID to update
    "title": "Homelab Datacenter Overview",
    "tags": ["homelab", "monitoring", "self-healing"],
    "timezone": "browser",
    "schemaVersion": 41,
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
                    "legendFormat": "{{instance}}",
                    "refId": "A"
                }
            ],
            "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}
        },
        {
            "id": 2,
            "title": "Memory Usage %",
            "type": "timeseries",
            "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
            "targets": [
                {
                    "expr": "100 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100",
                    "legendFormat": "{{instance}}",
                    "refId": "A"
                }
            ],
            "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}
        },
        {
            "id": 3,
            "title": "Container Count",
            "type": "stat",
            "gridPos": {"h": 4, "w": 6, "x": 0, "y": 16},
            "targets": [
                {
                    "expr": "count(container_last_seen)",
                    "refId": "A"
                }
            ],
            "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}
        },
        {
            "id": 4,
            "title": "Disk /srv Usage %",
            "type": "gauge",
            "gridPos": {"h": 4, "w": 6, "x": 6, "y": 16},
            "targets": [
                {
                    "expr": "(1 - (node_filesystem_avail_bytes{mountpoint=\"/srv\"} / node_filesystem_size_bytes{mountpoint=\"/srv\"})) * 100",
                    "refId": "A"
                }
            ],
            "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"},
            "fieldConfig": {
                "defaults": {
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {"color": "green", "value": None},
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
            "gridPos": {"h": 4, "w": 6, "x": 12, "y": 16},
            "targets": [
                {
                    "expr": "(1 - (node_filesystem_avail_bytes{device=\"tank\", fstype=\"zfs\"} / node_filesystem_size_bytes{device=\"tank\", fstype=\"zfs\"})) * 100",
                    "refId": "A"
                }
            ],
            "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"},
            "fieldConfig": {
                "defaults": {
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {"color": "green", "value": None},
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
            "gridPos": {"h": 8, "w": 12, "x": 0, "y": 24},
            "targets": [
                {
                    "expr": "nvidia_smi_temperature_gpu{uuid=\"bc42e64f-64d5-4711-e976-6141787b60a2\"}",
                    "legendFormat": "GPU Temp",
                    "refId": "A"
                }
            ],
            "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"},
            "fieldConfig": {
                "defaults": {
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {"color": "green", "value": None},
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
            "gridPos": {"h": 8, "w": 12, "x": 12, "y": 24},
            "targets": [
                {
                    "expr": "(nvidia_smi_memory_used_bytes / nvidia_smi_memory_total_bytes) * 100",
                    "legendFormat": "VRAM %",
                    "refId": "A"
                }
            ],
            "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}
        },
        {
            "id": 8,
            "title": "Exporter Health",
            "type": "table",
            "gridPos": {"h": 8, "w": 12, "x": 0, "y": 32},
            "targets": [
                {
                    "expr": "up{job=~\"node|nvidia-gpu|cadvisor|loki\"}",
                    "format": "table",
                    "refId": "A"
                }
            ],
            "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}
        },
        {
            "id": 9,
            "title": "Alert Count (24h)",
            "type": "stat",
            "gridPos": {"h": 4, "w": 6, "x": 12, "y": 32},
            "targets": [
                {
                    "expr": "count_over_time(ALERTS[24h])",
                    "refId": "A"
                }
            ],
            "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}
        }
    ],
    "time": {"from": "now-6h", "to": "now"},
    "refresh": "30s"
}

result = create_dashboard(grafana, homelab_dashboard)
print(f"Dashboard saved: uid={result.get('uid')}")
```

#### Get Dashboard by UID

```python
# Python: Fetch dashboard by UID
def get_dashboard(client: GrafanaClient, uid: str) -> dict:
    """Get dashboard by UID."""
    return client.get(f"/dashboards/uid/{uid}")

dashboard = get_dashboard(grafana, "efg9h1u7ja6tcb")
print(dashboard["dashboard"]["title"])
```

#### List Dashboards

```python
# Python: List all dashboards (with search)
def list_dashboards(client: GrafanaClient, limit: int = 100, page: int = 1) -> list:
    """List dashboards with pagination."""
    result = client.get(f"/search?limit={limit}&page={page}")
    return result

dashboards = list_dashboards(grafana)
for d in dashboards:
    print(f"{d['uid']}: {d['title']}")
```

#### Delete Dashboard

```python
# Python: Delete dashboard by UID
def delete_dashboard(client: GrafanaClient, uid: str) -> bool:
    """Delete dashboard by UID. Returns True on success."""
    response = client.delete(f"/dashboards/uid/{uid}")
    return response.status_code == 200
```

### 3.2 New Kubernetes-Style Dashboard API (v1beta1)

Grafana v12+ supports a new Kubernetes-style API for dashboards:

```python
# Python: Create dashboard via new Kubernetes-style API
def create_dashboard_v1beta1(client: GrafanaClient, name: str, title: str, spec: dict, folder_uid: str = "default") -> dict:
    """
    Create dashboard using new Kubernetes-style API (v1beta1).
    Requires API token with dashboard.grafana.app permissions.
    """
    payload = {
        "metadata": {
            "name": name,  # This becomes the dashboard UID
            "annotations": {
                "grafana.app/folder": folder_uid
            }
        },
        "spec": spec
    }
    return client.post(
        f"/apis/dashboard.grafana.app/v1beta1/namespaces/{folder_uid}/dashboards",
        payload
    )

# Example usage
spec = {
    "title": "Production Overview",
    "tags": ["production", "overview"],
    "timezone": "browser",
    "schemaVersion": 41,
    "panels": [...],
    "time": {"from": "now-6h", "to": "now"}
}

result = create_dashboard_v1beta1(grafana, "my-dashboard-uid", "Production Overview", spec)
```

### 3.3 Dashboard Provisioning via YAML

For file-based provisioning (recommended for GitOps), place YAML files in `/etc/grafana/provisioning/dashboards/`:

```yaml
# /etc/grafana/provisioning/dashboards/dashboards.yaml
apiVersion: 1

providers:
  - name: 'Default'
    orgId: 1
    folder: ''
    folderUid: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

```yaml
# /var/lib/grafana/dashboards/homelab-overview.json
{
  "dashboard": {
    "id": null,
    "uid": "efg9h1u7ja6tcb",
    "title": "Homelab Datacenter Overview",
    "tags": ["homelab"],
    "schemaVersion": 41,
    "version": 1,
    "panels": [...]
  }
}
```

---

## 4. Alerting Rules Management

### 4.1 Alerting Provisioning API (v1/provisioning/alert-rules)

The unified alerting provisioning API (`/api/v1/provisioning/alert-rules/`) uses a different structure from legacy alerting.

#### Create Alert Rule

```python
# Python: Create alert rule via provisioning API
def create_alert_rule(
    client: GrafanaClient,
    title: str,
    rule_group: str,
    folder_uid: str,
    condition_ref_id: str,
    datasource_uid: str,
    expr: str,
    annotations: dict = None,
    labels: dict = None,
    for_duration: str = "5m",
    no_data_state: str = "OK",
    exec_err_state: str = "Error"
) -> dict:
    """
    Create an alert rule via provisioning API.

    Args:
        client: GrafanaClient instance
        title: Alert rule title
        rule_group: Name of the rule group
        folder_uid: UID of the folder to store the rule
        condition_ref_id: RefId of the query that triggers the alert
        datasource_uid: UID of the Prometheus datasource
        expr: PromQL expression to evaluate
        annotations: Dict of annotations (summary, description, etc.)
        labels: Dict of labels (severity, etc.)
        for_duration: How long condition must be true before firing (e.g., '5m')
        no_data_state: State when no data ('OK', 'Alerting', 'NoData', 'Error')
        exec_err_state: State on execution error

    Returns:
        dict with 'uid' and 'message' on success
    """
    # Build query data source
    query_data = {
        "refId": "A",
        "queryType": "",
        "relativeTimeRange": {"from": 600, "to": 0},
        "datasourceUid": datasource_uid,
        "model": {
            "expr": expr,
            "hide": False,
            "intervalMs": 1000,
            "maxDataPoints": 43200,
            "refId": "A"
        }
    }

    # Build condition (classic conditions)
    condition_data = {
        "refId": "B",
        "queryType": "",
        "relativeTimeRange": {"from": 0, "to": 0},
        "datasourceUid": "-100",  # __expr__ datasource
        "model": {
            "conditions": [
                {
                    "evaluator": {"params": [0], "type": "gt"},  # Will be overridden
                    "operator": {"type": "and"},
                    "query": {"params": ["A"]},
                    "reducer": {"params": [], "type": "last"},
                    "type": "query"
                }
            ],
            "datasource": {"type": "__expr__", "uid": "-100"},
            "hide": False,
            "intervalMs": 1000,
            "maxDataPoints": 43200,
            "type": "classic_conditions"
        }
    }

    payload = {
        "title": title,
        "ruleGroup": rule_group,
        "folderUID": folder_uid,
        "noDataState": no_data_state,
        "execErrState": exec_err_state,
        "for": for_duration,
        "condition": condition_ref_id,
        "annotations": annotations or {},
        "labels": labels or {},
        "data": [query_data, condition_data]
    }

    return client.post("/v1/provisioning/alert-rules", payload)


# Example: Create container down alert
alert_result = create_alert_rule(
    client=grafana,
    title="ContainerDown",
    rule_group="container_alerts",
    folder_uid="monitoring",
    condition_ref_id="B",
    datasource_uid="efg9h1u7ja6tcb",
    expr='container_last_seen == 0',
    annotations={
        "summary": "Container {{ $labels.container }} is down",
        "description": "{{ $labels.container }} has been down for more than 1 minute"
    },
    labels={"severity": "critical"},
    for_duration="1m"
)
print(f"Alert created: {alert_result.get('uid')}")
```

#### Get All Alert Rules

```python
# Python: List all alert rules
def list_alert_rules(client: GrafanaClient) -> list:
    """Get all provisioned alert rules."""
    return client.get("/v1/provisioning/alert-rules")

rules = list_alert_rules(grafana)
for rule in rules:
    print(f"{rule['uid']}: {rule['title']} ({rule['ruleGroup']})")
```

#### Get Single Alert Rule

```python
# Python: Get alert rule by UID
def get_alert_rule(client: GrafanaClient, uid: str) -> dict:
    """Get a specific alert rule by UID."""
    return client.get(f"/v1/provisioning/alert-rules/{uid}")
```

#### Update Alert Rule

```python
# Python: Update existing alert rule
def update_alert_rule(client: GrafanaClient, uid: str, payload: dict) -> dict:
    """Update an alert rule by UID."""
    return client.put(f"/v1/provisioning/alert-rules/{uid}", payload)
```

#### Delete Alert Rule

```python
# Python: Delete alert rule by UID
def delete_alert_rule(client: GrafanaClient, uid: str) -> bool:
    """Delete alert rule by UID. Returns True on success."""
    response = client.delete(f"/v1/provisioning/alert-rules/{uid}")
    return response.status_code == 204
```

#### Export Alert Rule

```python
# Python: Export alert rule in provisioning format
def export_alert_rule(client: GrafanaClient, uid: str) -> dict:
    """Export alert rule in provisioning format (for GitOps)."""
    return client.get(f"/v1/provisioning/alert-rules/{uid}/export")

# Export all rules
def export_all_alert_rules(client: GrafanaClient) -> list:
    """Export all alert rules in provisioning format."""
    return client.get("/v1/provisioning/alert-rules/export")
```

### 4.2 Alert Rule YAML Structure (for Provisioning Files)

```yaml
# /etc/grafana/provisioning/alerting/monitoring-alerts.yml
apiVersion: 1

groups:
  - orgId: 1
    name: container_alerts
    folder: monitoring
    interval: 1m
    rules:
      - uid: container-down-001
        title: ContainerDown
        ruleGroup: container_alerts
        folderUID: monitoring
        condition: B
        data:
          - refId: A
            relativeTimeRange:
              from: 600
              to: 0
            datasourceUid: efg9h1u7ja6tcb
            model:
              expr: container_last_seen == 0
              refId: A
          - refId: B
            relativeTimeRange:
              from: 0
              to: 0
            datasourceUid: __expr__
            model:
              type: classic_conditions
              conditions:
                - evaluator:
                    params: [0]
                    type: gt
                  operator:
                    type: and
                  query:
                    params: [A]
                  reducer:
                    type: last
              refId: B
        noDataState: OK
        execErrState: Error
        for: 1m
        annotations:
          summary: "Container {{ $labels.container }} is down"
        labels:
          severity: critical

      - uid: container-restart-loop-001
        title: ContainerRestartLoop
        ruleGroup: container_alerts
        folderUID: monitoring
        condition: B
        data:
          - refId: A
            relativeTimeRange:
              from: 3600
              to: 0
            datasourceUid: efg9h1u7ja6tcb
            model:
              expr: rate(container_restart_count[1h]) >= 3
              refId: A
          - refId: B
            relativeTimeRange:
              from: 0
              to: 0
            datasourceUid: __expr__
            model:
              type: classic_conditions
              conditions:
                - evaluator:
                    params: [0]
                    type: gt
              refId: B
        noDataState: OK
        execErrState: Error
        for: 0m
        annotations:
          summary: "Container {{ $labels.container }} in restart loop"
        labels:
          severity: critical

  - orgId: 1
    name: host_alerts
    folder: monitoring
    interval: 1m
    rules:
      - uid: high-cpu-001
        title: HighCPU
        ruleGroup: host_alerts
        folderUID: monitoring
        condition: B
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: efg9h1u7ja6tcb
            model:
              expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
              refId: A
          - refId: B
            datasourceUid: __expr__
            model:
              type: classic_conditions
              conditions:
                - evaluator:
                    params: [0]
                    type: gt
              refId: B
        for: 5m
        noDataState: OK
        execErrState: Error
        annotations:
          summary: "High CPU on {{ $labels.instance }}"
          description: "CPU usage is above 90%"
        labels:
          severity: warning

      - uid: high-memory-001
        title: HighMemory
        ruleGroup: host_alerts
        folderUID: monitoring
        condition: B
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: efg9h1u7ja6tcb
            model:
              expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
              refId: A
          - refId: B
            datasourceUid: __expr__
            model:
              type: classic_conditions
              conditions:
                - evaluator:
                    params: [0]
                    type: gt
              refId: B
        for: 5m
        noDataState: OK
        execErrState: Error
        annotations:
          summary: "High memory on {{ $labels.instance }}"
        labels:
          severity: warning

  - orgId: 1
    name: gpu_alerts
    folder: monitoring
    interval: 1m
    rules:
      - uid: gpu-temp-high-001
        title: GPUTemperatureHigh
        ruleGroup: gpu_alerts
        folderUID: monitoring
        condition: B
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: efg9h1u7ja6tcb
            model:
              expr: nvidia_smi_temperature_gpu{uuid="bc42e64f-64d5-4711-e976-6141787b60a2"} > 80
              refId: A
          - refId: B
            datasourceUid: __expr__
            model:
              type: classic_conditions
              conditions:
                - evaluator:
                    params: [0]
                    type: gt
              refId: B
        for: 5m
        noDataState: OK
        execErrState: Error
        annotations:
          summary: "GPU temperature above 80C"
        labels:
          severity: warning

  - orgId: 1
    name: zfs_alerts
    folder: monitoring
    interval: 1m
    rules:
      - uid: zfs-pool-high-001
        title: ZFS PoolUsageHigh
        ruleGroup: zfs_alerts
        folderUID: monitoring
        condition: B
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: efg9h1u7ja6tcb
            model:
              expr: (1 - (node_filesystem_avail_bytes{device="tank", fstype="zfs"} / node_filesystem_size_bytes{device="tank", fstype="zfs"})) * 100 > 85
              refId: A
          - refId: B
            datasourceUid: __expr__
            model:
              type: classic_conditions
              conditions:
                - evaluator:
                    params: [0]
                    type: gt
              refId: B
        for: 5m
        noDataState: OK
        execErrState: Error
        annotations:
          summary: "ZFS pool tank usage above 85%"
        labels:
          severity: warning
```

### 4.3 Notification Policies

Notification policies are managed via a separate API:

```python
# Python: Get notification policies
def get_notification_policies(client: GrafanaClient) -> dict:
    """Get alert notification policies."""
    return client.get("/alerting/routes")

# Python: Update notification policies
def update_notification_policies(client: GrafanaClient, routes: dict) -> dict:
    """
    Update notification policies.

    Routes structure:
    {
      "receiver": "telegram",
      "routes": [
        {"match": {"severity": "critical"}, "receiver": "telegram-critical", "continue": true},
        {"match": {"severity": "warning"}, "receiver": "telegram-warning"}
      ]
    }
    """
    return client.put("/alerting/routes", routes)
```

---

## 5. Data Source Management

### 5.1 List Data Sources

```python
# Python: List all configured data sources
def list_datasources(client: GrafanaClient) -> list:
    """Get all configured data sources."""
    return client.get("/datasources")

datasources = list_datasources(grafana)
for ds in datasources:
    print(f"{ds['uid']}: {ds['name']} ({ds['type']})")
```

### 5.2 Get Data Source by UID

```python
# Python: Get datasource by UID
def get_datasource(client: GrafanaClient, uid: str) -> dict:
    """Get datasource configuration by UID."""
    return client.get(f"/datasources/uid/{uid}")

prometheus_ds = get_datasource(grafana, "efg9h1u7ja6tcb")
print(f"Prometheus: {prometheus_ds['url']}")
```

### 5.3 Create Data Source

```python
# Python: Create a new data source
def create_datasource(client: GrafanaClient, name: str, ds_type: str, url: str,
                      access: str = "proxy", is_default: bool = False,
                      json_data: dict = None, secure_json_data: dict = None) -> dict:
    """
    Create a new data source.

    Args:
        name: Display name
        ds_type: Type (prometheus, loki, influxdb, etc.)
        url: Full URL to the data source
        access: 'proxy' (server-side) or 'browser' (client-side)
        is_default: Set as default data source
        json_data: Additional JSON configuration
        secure_json_data: Sensitive data (passwords, tokens)
    """
    payload = {
        "name": name,
        "type": ds_type,
        "url": url,
        "access": access,
        "isDefault": is_default,
        "jsonData": json_data or {},
        "secureJsonData": secure_json_data or {}
    }
    return client.post("/datasources", payload)


# Example: Create Loki datasource
loki_result = create_datasource(
    client=grafana,
    name="Loki",
    ds_type="loki",
    url="http://loki:3101",
    access="proxy",
    json_data={"derivedFields": []}
)

# Example: Create Prometheus datasource (already exists as efg9h1u7ja6tcb)
prom_result = create_datasource(
    client=grafana,
    name="Prometheus",
    ds_type="prometheus",
    url="http://prometheus:9090",
    access="proxy",
    is_default=True
)
```

### 5.4 Update Data Source

```python
# Python: Update existing data source
def update_datasource(client: GrafanaClient, uid: str, payload: dict) -> dict:
    """Update data source by UID."""
    return client.put(f"/datasources/uid/{uid}", payload)
```

### 5.5 Delete Data Source

```python
# Python: Delete data source by UID
def delete_datasource(client: GrafanaClient, uid: str) -> bool:
    """Delete data source by UID. Returns True on success."""
    response = client.delete(f"/datasources/uid/{uid}")
    return response.status_code == 204
```

### 5.6 Data Source Provisioning via YAML

```yaml
# /etc/grafana/provisioning/datasources/datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    uid: efg9h1u7ja6tcb
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false

  - name: Loki
    type: loki
    uid: loki
    access: proxy
    url: http://loki:3101
    editable: false

  - name: AlertManager
    type: prometheus
    uid: alertmanager
    access: proxy
    url: http://alertmanager:9093
    editable: false
```

---

## 6. Grafana Alloy for Log Shipping

### 6.1 Overview

Grafana Alloy (v1.12.0) replaces Promail for log shipping to Loki. It runs as a container and scrapes Docker logs via the Docker socket.

**Architecture:**
```
Docker containers → Grafana Alloy (scrapes via docker.sock) → Loki (:3101) → Grafana
```

### 6.2 Docker Compose Configuration

```yaml
# docker-compose.monitoring.yml (excerpt)
services:
  alloy:
    image: grafana/alloy:1.12.0
    container_name: alloy
    restart: unless-stopped
    ports:
      - "12347:12347"  # Faro receiver (optional)
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /srv/data/monitoring/alloy:/etc/alloy
    networks:
      - monitoring_monitoring
    command: run --storage.path=/etc/alloy/data /etc/alloy/config.alloy
```

### 6.3 Alloy Configuration File

```go
// /srv/data/monitoring/alloy/config.alloy

// Discover Docker containers
discovery.docker "monitoring" {
  host = "unix:///var/run/docker.sock"
}

// Scrape logs from Docker containers
loki.source.docker "monitoring" {
  host = "unix:///var/run/docker.sock"
  forward = false

  // Add container labels as Loki labels
  labels = {
    "container_name": "{{ env \"CONTAINER_NAME\" }}",
    "container_image": "{{ env \"CONTAINER_IMAGE\" }}",
    "container_id": "{{ env \"CONTAINER_ID\" }}",
  }
}

// Process logs with regex parsing
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

// Write logs to Loki
loki.write "loki" {
  endpoint {
    url = "http://loki:3101/loki/api/v1/push"
    # Optional: basic auth for Loki
    # basic_auth {
    #   username = "admin"
    #   password = "secret"
    # }
  }
}

// Optional: Faro receiver for frontend logs
loki.receiver "faro" {
  grpc_server_port = 12347
}
```

### 6.4 Common Alloy Patterns

#### Scrape Only Containers with Specific Labels

```go
// Only scrape containers with label "monitoring=true"
discovery.relabel "monitoring" {
  targets = discovery.docker.monitoring.targets

  rule {
    action = "keep"
    source_labels = ["__meta_docker_label_monitoring"]
    regex = "true"
  }
}
```

#### Add Extra Labels

```go
// Add custom labels to all logs
loki.process "add_labels" {
  stage.labels {
    values = {
      "environment" = "homelab",
      "hostname" = "will-zappro",
    }
  }
}
```

#### Parse JSON Logs

```go
// Parse JSON-structured logs
loki.process "json_logs" {
  stage.json {
    source = "message"
    skip_timestamp_parsing = false
  }

  stage.labels {
    values = {
      "level" = "level",
      "service" = "service",
    }
  }
}
```

### 6.5 Verify Alloy is Shipping Logs

```bash
# Check Alloy container is running
docker ps | grep alloy

# Check Alloy logs
docker logs alloy --tail 20

# Verify Loki is receiving logs
curl -s "http://localhost:3101/ready" | python3 -c "import sys; d=sys.stdin.read(); print('Loki OK' if d else 'Loki FAIL')"

# Query Loki for recent logs
curl -s -G "http://localhost:3101/loki/api/v1/query" \
  --data-urlencode 'query={job="docker"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Log entries: {len(d.get(\"data\",{}).get(\"result\",[]))}')"
```

### 6.6 Migrating from Promail to Alloy

Since Promail reached EOL in March 2026, migrate using:

```bash
# 1. Stop and remove Promail container
docker stop promail && docker rm promail

# 2. Start Alloy container
docker-compose -f docker-compose.monitoring.yml up -d alloy

# 3. Verify log flow
# Wait 30 seconds, then check Loki for new logs
sleep 30 && curl -s -G "http://localhost:3101/loki/api/v1/query" \
  --data-urlencode 'query={hostname="will-zappro"}' | python3 -c \
  "import sys,json; d=json.load(sys.stdin); results=d.get('data',{}).get('result',[]); print(f'Logs flowing: {len(results)} streams') if results else print('No logs yet')"
```

---

## 7. Folder Management

### 7.1 Create Folder

```python
# Python: Create a folder for organizing dashboards
def create_folder(client: GrafanaClient, title: str, uid: str = None) -> dict:
    """
    Create a folder.

    Args:
        title: Folder title
        uid: Optional UID (generated if not provided)
    """
    payload = {"title": title}
    if uid:
        payload["uid"] = uid
    return client.post("/folders", payload)


# Example: Create monitoring folder
monitoring_folder = create_folder(grafana, "Monitoring", "monitoring")
print(f"Folder created: {monitoring_folder.get('uid')}")
```

### 7.2 List Folders

```python
# Python: List all folders
def list_folders(client: GrafanaClient) -> list:
    """Get all folders."""
    return client.get("/folders")

folders = list_folders(grafana)
for folder in folders:
    print(f"{folder['uid']}: {folder['title']}")
```

---

## 8. Quick Reference

### 8.1 Complete Python Example: Provision Homelab Dashboard

```python
#!/usr/bin/env python3
"""
Grafana Dashboard Provisioner for Homelab
Usage: python3 provision_dashboard.py
Requires: GRAFANA_API_KEY environment variable or Infisical token
"""

import os
import requests

GRAFANA_URL = "https://monitor.zappro.site/api"

def get_grafana_client():
    api_key = os.environ.get("GRAFANA_API_KEY")
    if not api_key:
        # Fetch from Infisical
        from_infisical = requests.get(
            "https://vault.zappro.site/api/v3/secrets/raw",
            headers={"Authorization": f"Bearer {os.environ.get('INFISICAL_TOKEN', '')}"},
            params={"projectId": "homelab", "environment": "production", "secretPath": "/"}
        ).json()
        for secret in from_infisical.get("secrets", []):
            if secret.get("key") == "grafana_api_key":
                api_key = secret.get("value")
                break

    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    })
    return session

def create_folder(client, title, uid=None):
    payload = {"title": title}
    if uid:
        payload["uid"] = uid
    return client.post(f"{GRAFANA_URL}/folders", json=payload)

def create_dashboard(client, dashboard, folder_uid=None, overwrite=True):
    payload = {
        "dashboard": dashboard,
        "folderUid": folder_uid,
        "message": "Provisioned via Grafana API",
        "overwrite": overwrite
    }
    return client.post(f"{GRAFANA_URL}/dashboards/db", json=payload)

if __name__ == "__main__":
    client = get_grafana_client()

    # Ensure monitoring folder exists
    create_folder(client, "Monitoring", "monitoring")

    # Homelab dashboard definition
    dashboard = {
        "id": None,
        "uid": "efg9h1u7ja6tcb",
        "title": "Homelab Datacenter Overview",
        "tags": ["homelab", "monitoring"],
        "schemaVersion": 41,
        "version": 1,
        "panels": [
            {"id": 1, "title": "CPU %", "type": "timeseries", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
             "targets": [{"expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)", "refId": "A"}],
             "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}},
            {"id": 2, "title": "Memory %", "type": "timeseries", "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
             "targets": [{"expr": "100 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100", "refId": "A"}],
             "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}},
            {"id": 3, "title": "Container Count", "type": "stat", "gridPos": {"h": 4, "w": 6, "x": 0, "y": 16},
             "targets": [{"expr": "count(container_last_seen)", "refId": "A"}],
             "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}},
            {"id": 4, "title": "Disk /srv %", "type": "gauge", "gridPos": {"h": 4, "w": 6, "x": 6, "y": 16},
             "targets": [{"expr": "(1 - (node_filesystem_avail_bytes{mountpoint=\"/srv\"} / node_filesystem_size_bytes{mountpoint=\"/srv\"})) * 100", "refId": "A"}],
             "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"},
             "fieldConfig": {"defaults": {"thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "yellow", "value": 80}, {"color": "red", "value": 90}]}}}},
            {"id": 5, "title": "ZFS Pool tank %", "type": "gauge", "gridPos": {"h": 4, "w": 6, "x": 12, "y": 16},
             "targets": [{"expr": "(1 - (node_filesystem_avail_bytes{device=\"tank\", fstype=\"zfs\"} / node_filesystem_size_bytes{device=\"tank\", fstype=\"zfs\"})) * 100", "refId": "A"}],
             "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"},
             "fieldConfig": {"defaults": {"thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "yellow", "value": 85}, {"color": "red", "value": 93}]}}}},
            {"id": 6, "title": "GPU Temperature", "type": "timeseries", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 20},
             "targets": [{"expr": "nvidia_smi_temperature_gpu{uuid=\"bc42e64f-64d5-4711-e976-6141787b60a2\"}", "refId": "A"}],
             "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}},
            {"id": 7, "title": "GPU VRAM %", "type": "timeseries", "gridPos": {"h": 8, "w": 12, "x": 12, "y": 20},
             "targets": [{"expr": "(nvidia_smi_memory_used_bytes / nvidia_smi_memory_total_bytes) * 100", "refId": "A"}],
             "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}},
            {"id": 8, "title": "Exporter Health", "type": "table", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 28},
             "targets": [{"expr": "up{job=~\"node|nvidia-gpu|cadvisor|loki\"}", "format": "table", "refId": "A"}],
             "datasource": {"type": "prometheus", "uid": "efg9h1u7ja6tcb"}},
        ],
        "time": {"from": "now-6h", "to": "now"},
        "refresh": "30s"
    }

    result = create_dashboard(client, dashboard, folder_uid="monitoring")
    print(f"Dashboard provisioned: {result}")
```

### 8.2 Quick Command Reference

```bash
# Health check
curl -s https://monitor.zappro.site/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('status')=='OK' else 'FAIL')"

# List dashboards
curl -s -H "Authorization: Bearer $GRAFANA_API_KEY" https://monitor.zappro.site/api/search | python3 -m json.tool

# Get dashboard
curl -s -H "Authorization: Bearer $GRAFANA_API_KEY" https://monitor.zappro.site/api/dashboards/uid/efg9h1u7ja6tcb | python3 -m json.tool

# List alert rules
curl -s -H "Authorization: Bearer $GRAFANA_API_KEY" https://monitor.zappro.site/api/v1/provisioning/alert-rules | python3 -m json.tool

# List datasources
curl -s -H "Authorization: Bearer $GRAFANA_API_KEY" https://monitor.zappro.site/api/datasources | python3 -m json.tool

# Create folder
curl -s -X POST -H "Authorization: Bearer $GRAFANA_API_KEY" -H "Content-Type: application/json" \
  https://monitor.zappro.site/api/folders \
  -d '{"title":"Monitoring","uid":"monitoring"}' | python3 -m json.tool
```

---

## 9. Related Documents

| Document | Path | Purpose |
|----------|------|---------|
| SPEC-023 | `docs/SPECS/SPEC-023-unified-monitoring-self-healing.md` | Monitoring stack architecture |
| SPEC-024 | `docs/SPECS/SPEC-024-unified-monitoring-self-healing-implementation.md` | Implementation details |
| Monitoring Health Check | `docs/OPERATIONS/SKILLS/monitoring-health-check.md` | Health check procedures |
| Container Self-Healer | `docs/OPERATIONS/SKILLS/container-self-healer.md` | Self-healing procedures |
| Grafana Alloy | `SPEC-024 Phase 7` | Promail migration |
| PINNED-SERVICES | `docs/GOVERNANCE/PINNED-SERVICES.md` | Immutable service configs |

---

## 10. Service Endpoints

| Service | Internal Port | External URL | Purpose |
|---------|--------------|--------------|---------|
| Grafana | 3000 | https://monitor.zappro.site:3100 | Dashboards & API |
| Prometheus | 9090 | localhost:9090 | Metrics storage |
| AlertManager | 9093 | localhost:9093 | Alert routing |
| Loki | 3101 | localhost:3101 | Log aggregation |
| Grafana Alloy | 12347 (Faro) | localhost:12347 | Log shipping |
| node-exporter | 9100 | localhost:9100 | Host metrics |
| nvidia-gpu-exporter | 9835 | localhost:9835 | GPU metrics |
| cAdvisor | 8080 | localhost:8080 | Container metrics |

---

**Authority:** will-zappro
**Created:** 2026-04-11
**Source:** SPEC-023, SPEC-024, Context7 Grafana docs