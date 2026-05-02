# SLO e Burn Rate

Este documento define o primeiro contrato SLO pragmático para os serviços críticos monitorados por `scripts/sre-check.sh`.

## SLO

| Serviço | Tier | SLO mensal | Indicador |
|---|---:|---:|---|
| API | critical | 99.5% | HTTP 2xx/3xx em `/health` ou `/health/ready` |
| Hermes | critical | 99.5% | HTTP 2xx/3xx em `/health` |
| Chat | critical | 99.5% | HTTP 2xx/3xx na raiz ou health publicado |
| LLM | critical | 99.5% | HTTP 2xx/3xx ou auth gate esperado em `/health` |
| Qdrant | critical | 99.5% | health/ready local saudável |

## Política de Alerta

Começar com alerta read-only. Produção não deve reiniciar, fazer rollback ou alterar DNS automaticamente.

| Janela | Burn rate | Severidade | Ação |
|---|---:|---:|---|
| 5m | 14.4x | page | investigar imediatamente |
| 1h | 6x | ticket urgente | investigar no mesmo ciclo |
| 6h | 3x | ticket | planejar correção |
| 3d | 1x | backlog SRE | revisar tendência |

## Prometheus

Regras propostas em `prometheus/sre-burn-rate.rules.yml`.

Métrica esperada por blackbox/exporter:

```text
probe_success{service="<name>", tier="critical"}
```

Até existir exporter consolidado, `scripts/sre-check.sh prod-readonly --markdown` continua sendo a evidência operacional manual.
