# Monitoring Stack — Incident Report & Configuration Guide

**Data:** 2026-04-08
**Sistema:** monitor.zappro.site (Grafana + Prometheus)
**Estado:** ✅ RESOLVIDO

---

## Root Cause Analysis

### Problema: dorpainéis do Grafana mostravam "No data"

O dashboard Zappro Datacenter estava sem dados apesar do Prometheus ter todas as métricas disponíveis. A causa foi uma combinação de **3 erros críticos** na arquitetura de rede e provisionamento:

---

### Erro 1 — node-exporter em network_mode:host (CRÍTICO)

**O que estava errado:**
```yaml
# ❌ ANTES (ERRADO)
node-exporter:
  network_mode: host    # ← Container no network do HOST, não no Docker bridge
  pid: host
```

**Por que quebra:** O Prometheus está na rede `monitoring_monitoring` (Docker bridge `10.0.16.x`). Quando tenta resolver `host.docker.internal`, obtém `10.0.1.1` (docker0 bridge) — que não é o host real. O node-exporter estava no network do host e escutava em `192.168.15.83:9100`, completamente inalcançável.

**Solução:**
```yaml
# ✅ DEPOIS (CORRETO)
node-exporter:
  networks:
    - monitoring          # ← NA REDE monitoring_monitoring DO DOCKER
  pid: host               # ← pid:host ainda é necessário para acessar /proc, /sys do host
```

**Regra de ouro:** `network_mode: host` + `networks: [...]` são mutuamente exclusivos. Para que o Prometheus consiga alcançá-lo, o container precisa estar na mesma rede bridge.

---

### Erro 2 — Datasource Grafana apontando para localhost (CRÍTICO)

**O que estava errado:**
```yaml
# ❌ ANTES (ERRADO) — /srv/data/monitoring/grafana/provisioning/datasources/datasources.yml
  - name: Prometheus
    url: http://localhost:9090   # ← localhost DENTRO do container Grafana
```

**Por que quebra:** Dentro do container Grafana, `localhost` é o próprio container. O Prometheus está em outro container chamado `prometheus` na rede `monitoring_monitoring`.

**Solução:**
```yaml
# ✅ DEPOIS (CORRETO)
  - name: Prometheus
    url: http://prometheus:9090    # ← Nome do container na rede monitoring
```

**Regra de ouro:** URLs em datasources Grafana provisionados **DEVEM** usar o nome do serviço Docker (`prometheus`, `loki`), não `localhost`.

---

### Erro 3 — Dashboard datasource UID incorreto (MENOR)

**O que estava errado:** O dashboard `datacenter.json` referenciava datasource com `uid: "prometheus"`, mas o datasource real criado pelo provisionamento tinha UID gerado `efg9h1u7ja6tcb`.

**Por que quebra:** Grafana não encontrava o datasource e ignorava as queries.

**Solução:** O datasource provisioned agora é lido do arquivo YAML — UID fixo não é mais necessário pois o datasource é criado pelo provisionamento com base no YAML.

---

## Arquitetura de Rede (COMO FUNCIONA AGORA)

```
┌─────────────────────────────────────────────────────────────────────┐
│  REDE monitoring_monitoring (Docker bridge: 10.0.16.x)              │
│                                                                     │
│  ┌──────────────┐     ┌───────────────┐     ┌───────────────────┐  │
│  │  Grafana     │────▶│  Prometheus   │────▶│ node-exporter     │  │
│  │  :3000       │     │  :9090        │     │ :9100             │  │
│  │              │     │               │     │ (metrics host)     │  │
│  └──────────────┘     └───────────────┘     └───────────────────┘  │
│                              │                                        │
│                              │        ┌───────────────────┐         │
│                              ├───────▶│ cadvisor :8080    │         │
│                              │        └───────────────────┘         │
│                              │                                        │
│                              │        ┌───────────────────┐         │
│                              └───────▶│ nvidia-gpu-exporter│         │
│                                       │ :9835              │         │
│                                       └───────────────────┘         │
│                                                                     │
│  ┌──────────────┐     ┌───────────────┐     ┌───────────────────┐  │
│  │  Loki        │     │ AlertManager  │     │  Alert Sender     │  │
│  │  :3101       │     │  :9093       │     │  :8051            │  │
│  └──────────────┘     └───────────────┘     └───────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  HOST (network_mode: host)                                          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Node Exporter — acessa /proc, /sys do HOST via pid:host     │   │
│  │  Mas está na rede bridge do Docker (10.0.16.x)              │   │
│  │  Prometheus scrapeia via nome: node-exporter:9100           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

Cloudflare Tunnel: monitor.zappro.site → Grafana :3100
```

---

## Configuração Pinned (NUNCA ALTERAR SEM DOCUMENTAÇÃO)

### docker-compose.yml — Regras de Rede

| Serviço | Network | Reason |
|---------|---------|--------|
| `grafana` | `monitoring` | Precisa alcançar Prometheus via `prometheus:9090` |
| `prometheus` | `monitoring` | Scrapper — precisa alcançar todos os exportadores |
| `node-exporter` | `monitoring` + `pid:host` | Scrapper target — **NUNCA usar `network_mode: host`** |
| `cadvisor` | `monitoring` | Scrapper target — não precisa pid:host |
| `nvidia-gpu-exporter` | `monitoring` | GPU via CDI — acessível pela rede |
| `alertmanager` | `monitoring` | Alertas via webhook |
| `gotify` | `monitoring` | Notificações |
| `alert-sender` | `monitoring` | Bridge Telegram |

### prometheus.yml — Targets

```yaml
scrape_configs:
  - job_name: node           # Target: node-exporter:9100 (NÃO host.docker.internal)
  - job_name: nvidia-gpu     # Target: nvidia-gpu-exporter:9835
  - job_name: cadvisor       # Target: cadvisor:8080
  - job_name: prometheus     # Target: localhost:9090 (self-scraping)
```

**Regra CRÍTICA:** Targets **DEVEM** usar nomes de serviço Docker (`node-exporter`, `cadvisor`, etc.) — **NUNCA** `host.docker.internal` ou IPs fixos do host.

### datasources.yml — URLs Internas

```yaml
- name: Prometheus
  url: http://prometheus:9090    # Nome do serviço Docker, NÃO localhost
- name: Loki
  url: http://loki:3101         # Nome do serviço Docker, NÃO localhost
```

### Volume Mounts (Provisionamento)

```yaml
grafana:
  volumes:
    - /srv/data/monitoring/grafana:/var/lib/grafana
    - /srv/data/monitoring/grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:ro
    - /srv/data/monitoring/grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro
```

**Sem estes mounts:** Grafana usa config interna default → datasource `localhost:9090` → "No data"

---

## Checklist de Verificação (antes de qualquer restart)

```bash
# 1. Ver Prometheus targets
curl -s http://localhost:9090/api/v1/targets | python3 -c "import sys,json; d=json.load(sys.stdin); [print(t['labels']['job'],':',t['health']) for t in d['data']['activeTargets']]"

# 2. Ver datasource Grafana (deve mostrar http://prometheus:9090)
curl -s -u "admin:[GRAFANA_ADMIN_PASSWORD]" "http://localhost:3100/api/datasources" | python3 -c "import sys,json; [print(d['name'],':',d['url']) for d in json.load(sys.stdin)]"

# 3. Ver métricas do Grafana (query direta ao datasource)
curl -s -u "admin:[GRAFANA_ADMIN_PASSWORD]" "http://localhost:3100/api/datasources/proxy/1/api/v1/query?query=up" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Status:', d.get('status'), '| Resultados:', len(d.get('data',{}).get('result',[])))"

# 4. Ver dashboards carregados
curl -s -u "admin:[GRAFANA_ADMIN_PASSWORD]" "http://localhost:3100/api/search?type=dash-db" | python3 -c "import sys,json; [print(g['title'],':', g['uid']) for g in json.load(sys.stdin)]"
```

** Esperado:** todos os 4 targets UP, datasource com URL `http://prometheus:9090`, dashboards carregados.

---

## Regras de Ouro (NUNCA QUEBRAR)

1. **NUNCA usar `network_mode: host`** num stack que usa Prometheus scraper — impede que o Prometheus alcance o alvo
2. **NUNCA usar `localhost` em URLs de datasource** dentro de containers Docker — usar nomes de serviço (`prometheus`, `loki`)
3. **SEMPRE usar nomes de serviço Docker** nos targets do prometheus.yml (`node-exporter`, `cadvisor`, etc.)
4. **SEMPRE fazer hard refresh** (`Ctrl+Shift+R`) após alterar datasource ou dashboard no browser
5. **ANTES de restart**, verificar targets Prometheus e datasource Grafana com os comandos acima

---

## Snapshots (backup antes de mudanças)

```bash
# Antes de qualquer alteração no monitoring stack
sudo zfs snapshot tank@pre-monitoring-$(date +%Y%m%d-%H%M%S)

# Restaurar se algo quebrar
sudo zfs rollback tank@pre-monitoring-YYYYMMDD-HHMMSS
```

---

## Links

- **Grafana:** https://monitor.zappro.site (Google OAuth: zappro.ia@gmail.com)
- **Prometheus:** http://localhost:9090
- **Docker Compose:** `/srv/apps/monitoring/docker-compose.yml`
- **Prometheus Config:** `/srv/apps/monitoring/prometheus.yml`
- **Datasources:** `/srv/data/monitoring/grafana/provisioning/datasources/datasources.yml`
- **Dashboards:** `/srv/data/monitoring/grafana/provisioning/dashboards/`
