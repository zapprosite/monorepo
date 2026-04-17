# RESEARCH-3: Prometheus Observability 2026

**Data:** 2026-04-17
**Focus:** Recording rules, exemplars, alerting, dashboard JSON structure
**Contexto:** SPEC-065 — Testing + Observability + Database

---

## 1. Estado Atual do Projeto

### Prometheus Setup
- **alerts.yml:** `apps/monitoring/prometheus/alerts.yml` — 4 alertas GPU-centric (GPUHighMemory, GPUHighTemp, ContainerDown, HighCPU)
- **Grafana:** `apps/monitoring/grafana/provisioning/dashboards/homelab/homelab.json` — Dashboard "Homelab Overview" com 8 painéis
- **Recording rules:** NENHUMA definida
- **Exemplars:** NÃO configurados
- **ai-gateway:** NÃO expõe `/metrics` Prometheus (Fastify sem prom-client)

### Lacunas Identificadas
| Área | Status | Gap |
|------|--------|-----|
| Recording rules | ❌ Ausente | Queries `rate()`/`histogram_quantile()` recalculadas a cada scrape |
| Exemplars | ❌ Ausente | Sem trace linkage nos histograms |
| Alertas | ⚠️ Básico | Só GPU + container down |
| Dashboard | ⚠️ Genérico | Falta dashboards dedicados por serviço (ai-gateway, STT, TTS, Hermes) |
| Metrics app | ❌ Ausente | ai-gateway não expõe Prometheus |

---

## 2. Recording Rules — Best Practices 2026

### Por Que Usar
Recording rules pré-computam queries expensive (rate + histogram_quantile), reduzem carga do Prometheus e melhoram dashboard responsiveness.

### Padrão Recommended (YAML)

```yaml
groups:
  - name: ai-gateway-recording
    interval: 30s
    rules:
      # Latência por endpoint
      - record: ai_gateway:request_latency_p99:rate5m
        expr: |
          histogram_quantile(0.99,
            sum by (le, endpoint, method) (
              rate(ai_gateway_http_request_duration_seconds_bucket[5m])
            )
          )

      # Taxa de erro por endpoint
      - record: ai_gateway:error_rate:rate5m
        expr: |
          sum by (endpoint, status_code) (
            rate(ai_gateway_http_requests_total{status_code=~"5.."}[5m])
          ) / sum by (endpoint) (
            rate(ai_gateway_http_requests_total[5m])
          )

      #throughput por model
      - record: ai_gateway:model_request_count:rate1m
        expr: |
          sum by (model) (
            rate(ai_gateway_requests_total[1m])
          )

  - name: hermes-agency-recording
    interval: 30s
    rules:
      - record: hermes:task_queue_depth:rate1m
        expr: |
          sum by (queue_name) (
            rate(hermes_task_queue_size[1m])
          )

      - record: hermes:skill_latency_p95:rate5m
        expr: |
          histogram_quantile(0.95,
            sum by (le, skill_name) (
              rate(hermes_skill_duration_seconds_bucket[5m])
            )
          )
```

### Estrutura de Nomenclatura
```
{service}:{metric_name}:{aggregation}:{window}
```
Exemplo: `ai_gateway:request_latency_p99:rate5m`

---

## 3. Exemplars — Best Practices

### O Que São
Exemplars são small trace pointers (traceID, spanID) attachados a histogram buckets, permitindo drill-down do Grafana para traces Distributed.

### Como Ativar (prom-client)

```typescript
// apps/ai-gateway/src/metrics.ts
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();

// Histogram com exemplars (requer prom-client >= 14)
const httpRequestDuration = new Histogram({
  name: 'ai_gateway_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'endpoint', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
  enableExemplars: true,  // ← Ativar
});

// Nos handlers, attach trace exemplar:
const exemplar = {
  traceId: request.headers['x-trace-id'],
  spanId: request.headers['x-span-id'],
};
httpRequestDuration.observe({ method, endpoint, status_code }, duration, exemplar);
```

### Native Prometheys OTLP → Exemplars
Se usar OTEL SDK diretamente, exemplars são automatic em `prometheus.otlp_write_exemplars`.

---

## 4. Alerting — Best Practices 2026

### Multi-Level Alerts (SLO-Based)

```yaml
groups:
  - name: ai-gateway-alerts
    interval: 30s
    rules:
      # SLO: Error rate > 1%
      - alert: AIGatewayHighErrorRate
        expr: |
          (
            sum(rate(ai_gateway_http_requests_total{status_code=~"5.."}[5m]))
            /
            sum(rate(ai_gateway_http_requests_total[5m]))
          ) > 0.01
        for: 2m
        labels:
          severity: critical
          slo: error-rate
        annotations:
          summary: "AI Gateway error rate above 1%"
          description: "Current: {{ $value | humanizePercentage }}"

      # SLO: Latency P99 > 2s
      - alert: AIGatewayHighLatency
        expr: |
          histogram_quantile(0.99,
            sum by (le) (rate(ai_gateway_http_request_duration_seconds_bucket[5m]))
          ) > 2
        for: 5m
        labels:
          severity: warning
          slo: latency
        annotations:
          summary: "AI Gateway P99 latency above 2s"

      # Service down
      - alert: AIGatewayDown
        expr: up{job="ai-gateway"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "AI Gateway is down"

      # STT downstream failing
      - alert: STTDownstreamFailing
        expr: |
          rate(ai_gateway_stt_errors_total[5m]) > 0
        for: 1m
        labels:
          severity: warning
          service: stt
        annotations:
          summary: "STT downstream errors detected"

      # TTS latency spike
      - alert: TTSHighLatency
        expr: |
          histogram_quantile(0.95,
            sum by (le) (rate(ai_gateway_tts_duration_seconds_bucket[5m]))
          ) > 10
        for: 3m
        labels:
          severity: warning
          service: tts
        annotations:
          summary: "TTS P95 latency above 10s"
```

### RULES de Alerta
- `for: 1m` mínimo para transient spikes
- Labels `slo: error-rate|latency|availability` para filtering
- Descrições com `{{ $value }}` para contexto
- Severity alinhado: critical = SLO breach, warning = degrading

---

## 5. Grafana Dashboard JSON Structure

### Estrutura SOTA (Grafana 10.x)

```json
{
  "__inputs": [],
  "__requires": [
    { "type": "grafana", "id": "grafana", "name": "Grafana", "version": "10.2.0" }
  ],
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": { "type": "grafana", "uid": "-- Grafana --" },
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "id": null,
  "links": [
    {
      "asDropdown": false,
      "icon": "external link",
      "includeVars": true,
      "keepTime": true,
      "tags": ["ai-gateway", "observability"],
      "targetBlank": true,
      "title": "Related",
      "tooltip": "",
      "type": "link",
      "url": "/d/hermes-agency"
    }
  ],
  "liveNow": false,
  "panels": [
    {
      "collapsed": false,
      "gridPos": { "h": 1, "w": 24, "x": 0, "y": 0 },
      "id": 1,
      "panels": [],
      "title": "Overview — SLOs",
      "type": "row"
    },
    {
      "datasource": { "type": "prometheus", "uid": "Prometheus" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "axisBorderShow": false,
            "axisCenteredZero": false,
            "axisColorMode": "text",
            "axisLabel": "",
            "axisPlacement": "auto",
            "barAlignment": 0,
            "drawStyle": "line",
            "fillOpacity": 10,
            "gradientMode": "none",
            "hideFrom": { "legend": false, "tooltip": false, "viz": false },
            "insertNulls": false,
            "lineInterpolation": "smooth",
            "lineWidth": 2,
            "pointSize": 5,
            "scaleDistribution": { "type": "linear" },
            "showPoints": "never",
            "spanNulls": false,
            "stacking": { "group": "A", "mode": "none" },
            "thresholdsStyle": { "mode": "line+area" }
          },
          "mappings": [],
          "max": 1,
          "min": 0,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green",  "value": null },
              { "color": "yellow", "value": 0.99 },
              { "color": "red",    "value": 0.95 }
            ]
          },
          "unit": "percentunit"
        },
        "overrides": []
      },
      "gridPos": { "h": 6, "w": 12, "x": 0, "y": 1 },
      "id": 2,
      "options": {
        "legend": { "calcs": ["last", "mean"], "displayMode": "table", "placement": "bottom", "showLegend": true },
        "tooltip": { "mode": "multi", "sort": "desc" }
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "Prometheus" },
          "expr": "1 - ai_gateway:error_rate:rate5m",
          "legendFormat": "Availability",
          "refId": "A"
        }
      ],
      "title": "SLO — Availability (target: 99.5%)",
      "type": "timeseries"
    },
    {
      "datasource": { "type": "prometheus", "uid": "Prometheus" },
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "thresholds" },
          "mappings": [],
          "max": 5,
          "min": 0,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 1 },
              { "color": "red", "value": 2 }
            ]
          },
          "unit": "s"
        },
        "overrides": []
      },
      "gridPos": { "h": 6, "w": 6, "x": 12, "y": 1 },
      "id": 3,
      "options": {
        "orientation": "auto",
        "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
        "showThresholdLabels": false,
        "showThresholdMarkers": true
      },
      "targets": [
        {
          "datasource": { "type": "prometheus", "uid": "Prometheus" },
          "expr": "ai_gateway:request_latency_p99:rate5m",
          "legendFormat": "P99",
          "refId": "A"
        }
      ],
      "title": "P99 Latency",
      "type": "gauge"
    }
  ],
  "refresh": "30s",
  "schemaVersion": 38,
  "style": "dark",
  "tags": ["ai-gateway", "observability", "slo"],
  "templating": {
    "list": [
      {
        "current": { "selected": false, "text": "Prometheus", "value": "Prometheus" },
        "hide": 0,
        "includeAll": false,
        "label": "Datasource",
        "multi": false,
        "name": "DS_PROMETHEUS",
        "options": [],
        "query": "prometheus",
        "queryValue": "",
        "refresh": 1,
        "regex": "",
        "skipUrlSync": false,
        "type": "datasource"
      }
    ]
  },
  "time": { "from": "now-1h", "to": "now" },
  "timepicker": {
    "refresh_intervals": ["10s", "30s", "1m", "5m", "15m", "30m", "1h"]
  },
  "timezone": "browser",
  "title": "AI Gateway — Observability",
  "uid": "ai-gateway-observability",
  "version": 1,
  "weekStart": ""
}
```

### Melhorias Sobre o Dashboard Atual

| Aspecto | Atual (homelab.json) | SOTA |
|---------|----------------------|------|
| Exemplars | Não configurado | Heatmap com exemplar support |
| Recording rules | Direct queries | Usar `ai_gateway:*:rate5m` |
| Row grouping | Sem collapse | Rows colapsáveis por serviço |
| Links | Empty | Cross-dashboard links |
| Variables | Empty | Datasource variable |
| Panel IDs | Integer | Ulids para merge safety |
| Tooltip | single | multi + sort |

---

## 6. Gap Analysis — ai-gateway metrics

### Problema Crítico
**ai-gateway não expõe `/metrics` Prometheus.**

Hoje o único metrics source é o `node-exporter` + `DCGM` via Dockercad. O Fastify app não tem `prom-client`.

### Ação Required (Coder-1)

```typescript
// src/metrics.ts — NOVO
import { register, Histogram, Counter, Gauge } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'ai_gateway_http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'endpoint', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

export const requestTotal = new Counter({
  name: 'ai_gateway_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'endpoint', 'status_code'],
  registers: [register],
});

// src/index.ts — adicionar rota
fastify.get('/metrics', async (request, reply) => {
  reply.header('Content-Type', register.contentType);
  return register.metrics();
});
```

---

## 7. Recommendations para SPEC-065

### Prioridade Alta (SPRINT 1)
1. **Add prom-client to ai-gateway** — sem metrics não há dashboard SOTA
2. **Create recording rules** — `ai-gateway-recording.yml`, `hermes-recording.yml`
3. **Add SLO alerts** — error rate >1%, latency P99 >2s

### Prioridade Média (SPRINT 2)
4. **Create dedicated dashboards** — ai-gateway.json, hermes-agency.json, STT.json, TTS.json
5. **Configure exemplars** — OTEL → prom-client exemplar attachment
6. **Expand alerts** — STT/TTS downstream failure, Hermes skill latency

### Prioridade Baixa (SPRINT 3)
7. **Link Grafana dashboards** — navigation entre ai-gateway → hermes → downstream
8. **Variables/templates** — service selector, time range

---

## 8. Tooling Recommendations

| Tool | Uso | Version |
|------|-----|---------|
| prom-client | Prometheus metrics (Node.js) | ^15.x |
| prometheus-api-metrics | Decorator-based metrics | ^3.x |
| @types/prometheus-api-metrics | TypeScript types | latest |
| Grafana JSON provisioning | Dashboards as code | 10.x |

### No Prometheus Stack (para apps)
- LiteLLM expõe `/metrics` nativamente — usar como fallback
- Ollama NÃO expõe Prometheus (só logs)
- faster-whisper: NÃO expõe Prometheus
- Kokoro TTS Bridge: verificar se `/metrics` existe

---

## 9. Referências

- [Prometheus recording rules docs](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)
- [Grafana exemplars](https://grafana.com/docs/grafana/latest/fundamentals/exemplars/)
- [SLO alerting with Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/#multi-level-alerting)
- [prom-client exemplars](https://github.com/siimon/prom-client#exemplars)
