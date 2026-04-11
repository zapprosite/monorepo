# IMMUTABLE-SERVICES — Never Touch After Done

**Versão:** 1.0 | **Data:** 2026-04-10
**Propósito:** Regras de governança para serviços que NÃO DEVEM mudar após deployment
**Audiência:** Qualquer agente/LLM antes de propor mudanças em serviços production
**Stack:** Prometheus + Grafana + Exporters (observability stack)

---

## 0. Princípios Fundamentais

### Immutability Core

1. **IMUTÁVEL** — uma vez deployed, componentes core não mudam sem full review
2. **VERSION-LOCKED** — todas container images pinned a SHA/digest específico
3. **DOCUMENTED** — todo ficheiro de config tem comentário explicando porquê
4. **SEPARATED** — healing logic separate from monitoring logic

### Definição de "Imutável"

| Componente | Imutável Significa |
|------------|-------------------|
| Container Image | Pin a digest SHA256, nunca `:latest` |
| Configuration | Hash verificado, mudanças exigem snapshot |
| Credentials | Infisical only, nunca hardcoded |
| Ports | Reservadas, nunca reatribuídas |
| Dependencies | Batch updated (não individual) |

---

## 1. Version Policy

### 1.1 Regra de Ouro: Pin to Digest

**NUNCA use tags mutáveis:**
```bash
# ❌ FORBIDDEN - tags mutáveis
image: prom/prometheus:latest
image: prom/prometheus:v2.45.0
image: grafana/grafana:latest

# ✅ CORRECT - pin a digest
image: prom/prometheus@sha256:a1b2c3d4e5f6...
image: grafana/grafana@sha256:f6e5d4c3b2a1...
```

### 1.2 Update Cadence

| Serviço | Update Frequency | Trigger | Exception |
|---------|-----------------|---------|-----------|
| **Prometheus** | Quarterly | Calendar | Security patches: within 48h |
| **Grafana** | Quarterly | Calendar | Security patches: within 48h |
| **Exporters** | With Prometheus | Bundled | Critical CVE: within 48h |
| **Alertmanager** | Quarterly | Calendar | Security patches: within 48h |
| **node_exporter** | With Prometheus | Bundled | Kernel CVE: within 48h |
| **postgres_exporter** | With Prometheus | Bundled | Postgres CVE: within 48h |

### 1.3 Security Patch Exception

**Security patches são EMERGENCY updates, não violam imutabilidade:**

```
Security Patch Flow:
1. Identificar CVE afetado
2. Obter nova imagem com patch (digest diferente)
3. Snapshot ZFS
4. Deploy nova imagem (mesmo serviço, mesmo config)
5. Validar com smoke tests
6. Log em CHANGE_LOG
```

**Tempo de resposta:**
- CRITICAL (CVSS 9-10): 24 horas
- HIGH (CVSS 7-8): 48 horas
- MEDIUM (CVSS 4-6): Next quarterly window

### 1.4 Image Pinning Procedure

```bash
# 1. Pull imagem e verificar digest
docker pull prom/prometheus:v2.54.0
docker inspect prom/prometheus:v2.54.0 --format '{{index .RepoDigests 0}}'

# Output: prom/prometheus@sha256:a1b2c3d4e5f678...

# 2. Adicionar ao docker-compose.yml
services:
  prometheus:
    image: prom/prometheus@sha256:a1b2c3d4e5f678...  # v2.54.0

# 3. Documentar
# prometheus:
#   version: v2.54.0
#   digest: sha256:a1b2c3d4e5f678...
#   pinned_date: 2026-04-10
#   reason: Version-locked, quarterly update
```

---

## 2. Change Process

### 2.1 Approval Matrix

| Change Type | Auto-Approve | ⚠️ Approval | ❌ Forbidden |
|-------------|--------------|-------------|--------------|
| Read-only (logs, status) | ✅ | - | - |
| Smoke test execution | ✅ | - | - |
| Config comment update | ✅ | - | - |
| Non-breaking config (new exporter) | - | ⚠️ will-zappro | - |
| Breaking config change | - | ⚠️ will-zappro | - |
| Version bump (security patch) | - | ⚠️ will-zappro | - |
| Version bump (quarterly) | - | ⚠️ will-zappro | - |
| Delete service | - | ⚠️ will-zappro | - |
| Add new monitoring target | - | ⚠️ will-zappro | - |
| Change alert threshold | - | ⚠️ will-zappro | - |
| Remove alert rule | - | ⚠️ will-zappro | - |
| Rollback (emergency) | ✅ | - | - |
| Pin to digest (initial) | - | ⚠️ will-zappro | - |

### 2.2 Change Classification

#### MINOR (Auto-approve)
- Ler logs, status, métricas
- Executar smoke tests
- Adicionar comentários explicativos
- Atualizar documentação (não config)

#### STANDARD (⚠️ Approval Required)
- Adicionar novo exporter
- Modificar thresholds de alert
- Adicionar novo dashboard
- Mudar retention policy
- Version bump (quarterly)

#### EMERGENCY (⚠️ Approval Required, expedited)
- Security patch deployment
- Critical alert firing
- Service down

### 2.3 Change Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ BEFORE ANY CHANGE                                            │
│ 1. Read IMMUTABLE-SERVICES.md (this file)                   │
│ 2. Read PINNED-SERVICES.md (confirm service is tracked)     │
│ 3. Read CHANGE_POLICY.md (process)                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ PROPOSE CHANGE                                              │
│ Format:                                                     │
│ - WHAT: Exact change                                        │
│ - WHY: Business/technical reason                            │
│ - RISK: What breaks if wrong                                │
│ - ROLLBACK: How to revert                                   │
│ - TEST: How to verify success                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ APPROVAL                                                    │
│ Wait for explicit "yes, proceed" from will-zappro          │
│ Emergency exceptions: proceed → inform after               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ SNAPSHOT (Standard/Emergency)                               │
│ sudo zfs snapshot -r tank@pre-YYYYMMDD-HHMMSS-monitoring   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ EXECUTE + VALIDATE                                          │
│ Apply change                                                │
│ Run smoke tests                                             │
│ Verify metrics flowing                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
                        LOG + MONITOR
```

---

## 3. Testing

### 3.1 Pre-Deployment Tests

**Antes de qualquer mudança em produção:**

```bash
# 1. Smoke test completo
bash /srv/monorepo/tasks/smoke-tests/pipeline-monitoring.sh

# 2. Verificar métricas Prometheus
curl -s http://localhost:9090/api/v1/query?query=up | jq .

# 3. Verificar Grafana reachable
curl -s http://localhost:3000/api/health | jq .

# 4. Verificar exporters
curl -s http://localhost:9100/metrics | head -20   # node_exporter
curl -s http://localhost:9187/metrics | head -20   # postgres_exporter

# 5. Verificar alert rules carregadas
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].name'
```

### 3.2 Post-Deployment Validation

```bash
# 1. Service is up
docker ps | grep -E "prometheus|grafana|exporter"

# 2. Health endpoints
curl -sf http://localhost:9090/-/healthy   # Prometheus
curl -sf http://localhost:3000/api/health  # Grafana

# 3. Targets are up (Prometheus)
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health == "up")'

# 4. No alerts firing (unless expected)
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.state == "firing")'

# 5. Logs clean (no errors)
docker logs prometheus 2>&1 | tail -50 | grep -i error
docker logs grafana 2>&1 | tail -50 | grep -i error
```

### 3.3 Smoke Test Script Template

```bash
#!/bin/bash
# pipeline-monitoring.sh - Monitoring stack smoke test

set -e

echo "=== Monitoring Stack Smoke Test ==="
echo "Date: $(date)"
echo ""

echo "--- 1. Service Health ---"
curl -sf http://localhost:9090/-/healthy && echo " [PASS] Prometheus" || echo " [FAIL] Prometheus"
curl -sf http://localhost:3000/api/health && echo " [PASS] Grafana" || echo " [FAIL] Grafana"
curl -sf http://localhost:9100/metrics && echo " [PASS] node_exporter" || echo " [FAIL] node_exporter"

echo ""
echo "--- 2. Prometheus Targets ---"
UP_COUNT=$(curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | map(select(.health == "up")) | length')
echo "Up: $UP_COUNT targets"

echo ""
echo "--- 3. Metrics Flowing ---"
curl -s http://localhost:9090/api/v1/query?query=up | jq '.data.result | length'

echo ""
echo "--- 4. Alert Rules ---"
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].name'

echo ""
echo "=== Smoke Test Complete ==="
```

---

## 4. Rollback

### 4.1 Quando Fazer Rollback

**Rollback é REQUIRED se:**
- Smoke test falha após mudança
- Métricas pararam de fluir
- Alerts estão firing sem razão
- Service não inicializa
- Configuração cause crash loop

**Rollback é OPCIONAL se:**
- Mudança não crítica
- Não afeta availability
- Pode ser corrigido rapidamente

### 4.2 Rollback Procedure

```bash
# 1. IDENTIFICAR PROBLEMA
docker logs prometheus --tail=100
curl -s http://localhost:9090/api/v1/status/flags | jq .

# 2. SNAPSHOT DO ESTADO QUEBRADO (investigação)
sudo zfs snapshot -r tank@broken-monitoring-$(date +%Y%m%d-%H%M%S)

# 3. ROLLBACK
sudo zfs rollback -r tank@pre-YYYYMMDD-HHMMSS-monitoring

# 4. RESTART SERVICES
docker compose -f /srv/monitoring/docker-compose.yml down
docker compose -f /srv/monitoring/docker-compose.yml up -d

# 5. VALIDATE
bash /srv/monorepo/tasks/smoke-tests/pipeline-monitoring.sh

# 6. LOG
# Entry in CHANGE_LOG:
# YYYY-MM-DD HH:MM:SS | AGENT | ROLLBACK | prometheus/grafana | tank@pre-YYYYMMDD-HHMMSS-monitoring | success | reason
```

### 4.3 Rollback Decision Tree

```
Smoke test fails?
    │
    ├─ YES → Is it critical (service down)?
    │           ├─ YES → Emergency rollback, then investigate
    │           └─ NO → Can fix in < 5 min?
    │                   ├─ YES → Fix and re-test
    │                   └─ NO → Rollback, then investigate
    │
    └─ NO → Monitor for 30 min, then proceed
```

### 4.4 Version Rollback Specific

```bash
# Para voltar a versão anterior (digest diferente):
# 1. Identificar digest anterior (do git history ou documentação)
# 2. Editar docker-compose.yml com digest anterior
# 3. Snapshot
# 4. Redeploy
# 5. Validate

# Example:
# v2.54.0 (broken) → v2.53.0 (known good)
# digest: sha256:abc123... → sha256:def456...

docker compose -f /srv/monitoring/docker-compose.yml down
# edit compose file
docker compose -f /srv/monitoring/docker-compose.yml up -d
```

---

## 5. Secret Management

### 5.1 Regra de Ouro: Infisical Only

**Todos os secrets OBRIGATORIAMENTE vêm do Infisical:**

| Secret Type | Source | Access |
|-------------|--------|--------|
| Prometheus credentials | Infisical `vault.zappro.site` | Via env-wrapper.sh |
| Grafana admin password | Infisical `vault.zappro.site` | Via env-wrapper.sh |
| Alertmanager webhook tokens | Infisical `vault.zappro.site` | Via env-wrapper.sh |
| Exporter passwords | Infisical `vault.zappro.site` | Via env-wrapper.sh |
| Slack/Teams webhooks | Infisical `vault.zappro.site` | Via env-wrapper.sh |

### 5.2 Forbidden Secret Locations

```
❌ Hardcoded em docker-compose.yml
❌ Em comments no código
❌ Em documentation (.md)
❌ Em backup files sem encrypt
❌ Em logs
❌ Em environment files versionados
```

### 5.3 Secret Injection Flow

```bash
# 1. Adquirir secrets do Infisical
~/.claude/scripts/env-wrapper.sh --service=monitoring

# 2. Inject via environment (docker compose)
env-file: /run/secrets/monitoring.env  # gerado pelo wrapper

# 3. Ou via docker secret (Swarm mode)
secrets:
  grafana_password:
    external: true
```

### 5.4 Secret Rotation

| Secret | Rotation | How |
|--------|----------|-----|
| Grafana admin | 6 months | Infisical → restart Grafana |
| Alertmanager webhooks | 12 months | Infisical → restart Alertmanager |
| Exporter credentials | 12 months | Infisical → restart exporters |

---

## 6. Service Inventory

### 6.1 Prometheus

```yaml
service: prometheus
port: 9090
image: prom/prometheus@sha256:XXXXX  # pinned quarterly
config: /srv/monitoring/prometheus.yml
retention: 15d
owner: will-zappro
status: IMMUTABLE
update_cadence: quarterly
smoke_test: curl localhost:9090/-/healthy
```

### 6.2 Grafana

```yaml
service: grafana
port: 3000
image: grafana/grafana@sha256:XXXXX  # pinned quarterly
config: /srv/monitoring/grafana.ini
datasources: prometheus
owner: will-zappro
status: IMMUTABLE
update_cadence: quarterly
smoke_test: curl localhost:3000/api/health
```

### 6.3 node_exporter

```yaml
service: node_exporter
port: 9100
image: prom/node-exporter@sha256:XXXXX  # pinned with Prometheus
owner: will-zappro
status: IMMUTABLE
update_cadence: with Prometheus
smoke_test: curl localhost:9100/metrics | head -5
```

### 6.4 postgres_exporter

```yaml
service: postgres_exporter
port: 9187
image: prometheuscommunity/postgres-exporter@sha256:XXXXX
env:
  DATA_SOURCE_NAME: postgresql://user:pass@localhost:5432/postgres
owner: will-zappro
status: IMMUTABLE
update_cadence: with Prometheus
smoke_test: curl localhost:9187/metrics | grep pg_up
```

### 6.5 Alertmanager

```yaml
service: alertmanager
port: 9093
image: prom/alertmanager@sha256:XXXXX  # pinned quarterly
config: /srv/monitoring/alertmanager.yml
owner: will-zappro
status: IMMUTABLE
update_cadence: quarterly
smoke_test: curl localhost:9093/-/healthy
```

---

## 7. Separation of Concerns

### 7.1 Healing vs Monitoring (NEVER MIX)

**Monitoring Logic** (Prometheus/Grafana):
- Coleta métricas
- Avalia regras
- Dispara alerts
- Display dashboards

**Healing Logic** (Separate Service):
- Detecta falhas
- Executa recovery actions
- NOT part of monitoring stack
- Exemplo: watchdog que restart serviços

```yaml
# ❌ FORBIDDEN - healing dentro do Prometheus
# rule_files:
#   - /etc/prometheus/rules/healing.yml  # NÃO!

# ✅ CORRECT - healing é processo separado
# watchdog-service:
#   image: my-watchdog
#   volumes:
#     - /var/run/docker.sock:/var/run/docker.sock
```

### 7.2 Alert Routing

```
Prometheus/Alertmanager → Alert → Notification (separate)
                               ↓
                        Grafana (display only)
                               ↓
                        PagerDuty/Slack (notification only)
```

---

## 8. Snapshot Requirements

### Quando Snapshot é Obrigatório

| Operation | Snapshot Required |
|-----------|------------------|
| Version bump | ✅ Yes |
| Config change | ✅ Yes |
| Adding new exporter | ✅ Yes |
| Removing exporter | ✅ Yes |
| Changing alert threshold | ✅ Yes |
| Emergency rollback | ✅ Yes (of broken state) |
| Read-only inspection | ❌ No |
| Running smoke tests | ❌ No |

### Snapshot Naming

```bash
# Formato
tank@pre-YYYYMMDD-HHMMSS-monitoring-{change}

# Exemplos
tank@pre-20260410-140000-monitoring-version-bump
tank@pre-20260410-141500-monitoring-new-exporter
tank@pre-20260410-143000-monitoring-config-change
tank@broken-20260410-150000-monitoring-investigation
```

---

## 9. Exception Process

### 9.1 Legitimate Exceptions

**Exceções REQUEREM aprovação explícita de will-zappro:**

1. Critical security vulnerability requiring immediate patch
2. Service completely down with no recovery alternative
3. Compliance requirement (audit finding)
4. Hardware failure requiring reconfiguration

### 9.2 Exception Request Format

```
EXCEPTION REQUEST
================
Service: prometheus
Current: sha256:abc123 (v2.53.0)
Requested: sha256:def456 (v2.54.1 - security patch)
Trigger: CVE-2026-XXXXX (CVSS 9.1)
Risk if not patched: Full compromise of monitoring
Risk if patched: Low - same config, same behavior
Approval needed: will-zappro
```

### 9.3 Post-Exception Review

Após qualquer exceção:
1. Documentar em INCIDENTS.md
2. Atualizar IMMUTABLE-SERVICES.md se política mudou
3. Verificar se exception vira nova regra ou é one-time

---

## 10. Quick Reference Card

### Para LLMs - Antes de Propor Qualquer Mudança

```
1. ESTÁ NO REGISTRY?
   → Verificar IMMUTABLE-SERVICES.md e PINNED-SERVICES.md

2. É SECURITY PATCH?
   → Sim: Emergency flow, 24-48h
   → Não: Quarterly window

3. SNAPSHOT FEITO?
   → Não: Fazer antes de qualquer mudança

4. APPROVAL OBTIDO?
   → Não: Parar e solicitar

5. SMOKE TEST PASSOU?
   → Não: Rollback, investigar

6. LOGADO?
   → Não: Adicionar entrada em CHANGE_LOG
```

### Emergency Contacts

| Role | Who | When |
|------|-----|------|
| Primary | will-zappro | Always |
| Backup | will (local) | If will-zappro unreachable |

### Related Documents

| Document | Purpose |
|----------|---------|
| PINNED-SERVICES.md | Registry de serviços estáveis |
| CHANGE_POLICY.md | Processo de mudança genérico |
| APPROVAL_MATRIX.md | Decisões can/cannot/never |
| SECRETS_POLICY.md | Regras de secrets (Infisical only) |
| INCIDENTS.md | Log de incidentes |

---

**Criado:** 2026-04-10
**Autoridade:** will-zappro
**Revisão:** Mensal ou após incidente
**GitHub:** docs/GOVERNANCE/IMMUTABLE-SERVICES.md
