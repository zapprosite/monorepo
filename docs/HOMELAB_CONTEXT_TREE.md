# 🧠 HOMELAB CONTEXT TREE

> **Gerado automaticamente.** Leia isto antes de tocar em qualquer coisa.

> **Data:** 2026-05-05T01:29:16-03:00

---

## 🖥️  /srv/ — Serviços e Dados

- `README.md` — file
- **`apps/`** — dir (4.0K)
- **`backup/`** — dir (4.0K)
- **`backups/`** — dir (1.2G)
- **`data/`** — dir (8.0G)
- **`docker-data/`** — dir (1.5K)
- **`edge-tts/`** — dir (16K)
- **`logs/`** — dir (20K)
- **`models/`** — dir (6.2G)
- **`monorepo/`** — Monorepo principal (este repo)
- **`ops/`** — dir (91M)

## 🏠 /home/will/ — Configurações do Usuário

- **`..hermes/`** — Hermes Agent (assistente pessoal) (4.9G)
- **`..claude/`** — Configurações Claude Code (9.8M)
- **`..config/`** — Configurações de apps (8.9G)
- **`..local/`** — Dados locais de apps (31G)
- **`.Desktop/`** — Área de trabalho (40K)
- **`.Documents/`** — Documentos (4.0K)

## 🐳 Docker Containers Ativos

- **`gitea-runner`** — `gitea/act_runner:latest` (no ports)
- **`ai-gateway`** — `ai-gateway:dev-20260503` (0.0.0.0:4002->4002/tcp, [::]:4002->4002/tcp)
- **`litellm-proxy`** — `ghcr.io/berriai/litellm:main-latest` (0.0.0.0:4018->4000/tcp, [::]:4018->4000/tcp)
- **`crm-api`** — `crm-api:local` (127.0.0.1:4001->4001/tcp, 127.0.0.1:4000->4001/tcp)
- **`crm-web`** — `crm-web:local` (127.0.0.1:3080->80/tcp)
- **`registry`** — `registry:2` (127.0.0.1:5000->5000/tcp)
- **`keycloak`** — `keycloak/keycloak:latest` (127.0.0.1:8080->8080/tcp, 127.0.0.1:8443->8443/tcp, 9000/tcp)
- **`task-orchestrator`** — `python:3.11-slim` (no ports)
- **`openwebui-hvac`** — `openwebui/open-webui:latest` (no ports)
- **`coolify`** — `ghcr.io/coollabsio/coolify:latest` (8443/tcp, 9000/tcp, 127.0.0.1:8000->8080/tcp)
- **`coolify-realtime`** — `ghcr.io/coollabsio/coolify-realtime:1.0.13` (127.0.0.1:6001-6002->6001-6002/tcp)
- **`gitea`** — `gitea/gitea:latest` (127.0.0.1:2222->22/tcp, 127.0.0.1:3300->3000/tcp)
- **`pgadmin`** — `dpage/pgadmin4:latest` (443/tcp, 127.0.0.1:4050->80/tcp)
- **`homelab-qdrant`** — `qdrant/qdrant:v1.17.1` (127.0.0.1:6333-6334->6333-6334/tcp)
- **`grafana`** — `grafana/grafana:10.2.0` (127.0.0.1:3100->3000/tcp)
- **`prometheus`** — `prom/prometheus:latest` (127.0.0.1:9090->9090/tcp)
- **`alertmanager`** — `prom/alertmanager:latest` (127.0.0.1:9093->9093/tcp)
- **`coolify-db`** — `postgres:15-alpine` (5432/tcp)
- **`coolify-redis`** — `redis:7-alpine` (6379/tcp)
- **`litellm-db`** — `postgres:15-alpine` (5432/tcp)
- **`homelab-redis`** — `redis:7.2.4-alpine` (127.0.0.1:6379->6379/tcp)
- **`edge-tts`** — `edge-tts-edge-tts` (127.0.0.1:8012->8015/tcp)
- **`node-exporter`** — `prom/node-exporter:latest` (no ports)

## 🔌 Portas em Uso (principais)


## ⚙️ Systemd Services Ativos

- `accounts-daemon.service`
- `alsa-restore.service`
- `apparmor.service`
- `apport.service`
- `auditd.service`
- `bolt.service`
- `clamav-daemon.service`
- `cloudflared.service`
- `cloudflared@primary.service`
- `cloudflared@secondary.service`
- `colord.service`
- `console-setup.service`
- `containerd.service`
- `docker-user-rules.service`
- `docker.service`
- `fail2ban.service`
- `fwupd.service`
- `gdm.service`
- `gpu-performance.service`
- `hvac-rag.service`

## 📦 Monorepo Estrutura (Resumo)

Ver `AGENTS.md` para detalhes completos.

```
apps/          — Gateways e APIs (api, web, ai-gateway)
libs/          — Frameworks internos (nexus, memory)
packages/      — Bibliotecas compartilhadas (ui, zod-schemas, config)
scripts/       — Automações e utilitários
services/      — Microserviços Docker
deployments/   — Docker Compose e infra
docs/          — Documentação e SPECs
tests/         — Testes
```

---

*Gerado por scripts/gen-homelab-context.py*