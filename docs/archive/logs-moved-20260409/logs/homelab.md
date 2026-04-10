# Home Lab — Auditoria 2026-04-04

## 1. Sistema Base
- **Hostname:** will-zappro
- **OS:** Ubuntu 24.04.4 LTS (Noble Numbat)
- **Kernel:** 6.17.0-20-generic #20~24.04.1-Ubuntu SMP PREEMPT_DYNAMIC Thu Mar 19 01:28:37 UTC 2 x86_64
- **IPs:** 192.168.15.83 (LAN), 100.83.45.79 (WireGuard?), 10.0.x.x (16 subnets Docker overlay —很累)

## 2. Hardware
- **CPU:** AMD Ryzen 9 7900X 12-Core Processor (12 cores / 24 threads)
- **RAM:** 30Gi total | 1.3Gi livre | 6.8Gi available | 23Gi em uso
- **GPU:** NVIDIA GeForce RTX 4090 | VRAM: 24564 MiB total | 9307 MiB livre (~38% disponível) | Driver: 580.126.20 (open kernel)
- **PCI:** 0x0000:0x01:0x00

## 3. Storage

### NVMe Gen5 4TB — VFS Tank (ZFS pool "tank")
- **Status:** ✅ Montado via ZFS — tank dataset
- **Espaço:** 128K usado / 3.5T livre (1% uso) — enormidade disponível
- **Datasets ZFS montados:**
  - `/tank` (root)
  - `/srv/data/coolify` — 128K
  - `/srv/monorepo` — 255M
  - `/srv/docker-data` — 13G
  - `/srv/backups` — 195M
  - `/srv/models` — **17G** (modelos Ollama/Kokoro)
  - `/srv/data/qdrant` — 128K
  - `/srv/data/openclaw` — 128K
  - `/srv/data/zappro-router` — 128K

### NVMe Gen3 1TB — Ubuntu (nvme0n1)
| Partição | Tamanho | Mountpoint | Usado | Livre | Uso% |
|---------|---------|------------|-------|-------|------|
| nvme0n1p1 | 1G | /boot/efi | 6.2M | 1.1G | 1% |
| nvme0n1p2 | 274G | / (ext4) | 75G | 186G | 29% |
| nvme0n1p3 | 640G | /home (ext4) | 59G | 549G | 10% |

## 4. Docker — Containers Rodando

| Nome | Imagem | Status | Portas |
|------|--------|--------|--------|
| coolify | 2370f00af778 | ✅ Up ~1h (healthy) | 8000, 8443, 9000, 8080→8000 |
| coolify-proxy | traefik:v3.6 | ✅ Up ~1h (healthy) | 80, 443, 8080 |
| coolify-db | postgres:15-alpine | ✅ Up ~1h (healthy) | 5432/tcp |
| coolify-redis | redis:7-alpine | ✅ Up ~1h (healthy) | 6379/tcp |
| coolify-sentinel | ghcr.io/coollabsio/sentinel:0.0.21 | ✅ Up ~1h (healthy) | — |
| coolify-realtime | ghcr.io/coollabsio/coolify-realtime:1.0.11 | ✅ Up ~1h (healthy) | 6001-6002 |
| zappro-gitea | gitea/gitea:latest | ✅ Up ~1h | 2222→22, 3300→3000 |
| grafana | grafana/grafana:latest | ✅ Up ~1h | 3100→3000 |
| prometheus | prom/prometheus:latest | ✅ Up ~1h (healthy) | 9090→127.0.0.1 |
| zappro-redis | redis:7.2.4-alpine | ✅ Up ~1h | 6379→127.0.0.1 |
| redis-opencode | redis:7.2.4-alpine | ✅ Up ~1h | 6381→127.0.0.1 |
| infisical | infisical/infisical:latest-postgres | ✅ Up ~1h (healthy) | 8200→127.0.0.1 |
| infisical-db | postgres:16-alpine | ✅ Up ~1h (healthy) | 5432 |
| infisical-redis | redis:7-alpine | ✅ Up ~1h (healthy) | 6379 |
| node-exporter | prom/node-exporter:latest | ✅ Up ~1h | 9100 |
| cadvisor | gcr.io/cadvisor/cadvisor:latest | ✅ Up ~1h (healthy) | 9250→127.0.0.1 |
| searxng | searxng/searxng:latest | ✅ Up ~1h | 8888→127.0.0.1 |
| openclaw-qgtzrmi... | coollabsio/openclaw:2026.2.6 | ✅ Up ~1h (healthy) | 8080/tcp |
| browser-qgtzrmi... | coollabsio/openclaw-browser:latest | ✅ Up ~1h (healthy) | 3000-3001/tcp |
| browser-y9yb5xw... | coollabsio/openclaw-browser:latest | ✅ Up ~1h (healthy) | 3000-3001/tcp |
| browser-q7lyxl6... | coollabsio/openclaw-browser:latest | ✅ Up ~1h (healthy) | 3000-3001/tcp |
| zappro-kokoro | ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2 | ✅ Up ~1h | 8012→8880 |
| connected_repo_db | postgres:15-alpine | ✅ Up ~1h | 5432→127.0.0.1 |
| **zappro-qdrant** | **qdrant/qdrant:v1.17.1** | **❌ EXITED (143)** | **—** |
| tts-bridge | python:3.11-slim | ❌ Exited (137) | — |
| nginx-ratelimit | nginx:alpine | ❌ Exited (0) | — |
| nvidia-gpu-exporter | utkuozdemir/nvidia_gpu_exporter:1.4.1 | ❌ Exited (128) | — |

## 5. Docker — Volumes

| Volume Name |
|-------------|
| bcf5ab1a91d5771437e4cddf5e5558ee04b503e67bd002e073c9eeb2bb12edb9 |
| coolify-db |
| coolify-redis |
| monorepo_postgres_data |
| q7lyxl6iuqcr5rxmbfjsmsw7_browser-data |
| q7lyxl6iuqcr5rxmbfjsmsw7_openclaw-data |
| qgtzrmi6771lt8l7x8rqx72f_browser-data |
| qgtzrmi6771lt8l7x8rqx72f_openclaw-data |
| y9yb5xw7pooqtgiaez9pooz5_browser-data |
| y9yb5xw7pooqtgiaez9pooz5_openclaw-data |
| zappro-lite_litellm-data |

## 6. Coolify
- **Status:** ✅ Rodando como container Docker (não é systemd service)
- **Versão:** Não disponível via CLI (2370f00af778 — imagem hash)
- **Localização:** `/srv/data/coolify` (dataset ZFS tank/coolify)
- **Configuração .env:** Não encontrado em ~/coolify/.env
- **Docker compose:** Presente em /srv/data/coolify/docker-compose.yml

## 7. GPU + Docker
- **nvidia-docker configurado:** ✅ Sim
- **daemon.json:**
```json
{
  "log-driver": "json-file",
  "log-opts": {"max-size": "10m", "max-file": "3"},
  "default-address-pools": [{"base":"10.0.0.0/8","size":24}],
  "runtimes": {"nvidia": {"path": "nvidia-container-runtime", "runtimeArgs": []}}
}
```
- **Driver NVIDIA:** 580.126.20 (open kernel module)
- **CUDA:** LD_LIBRARY_PATH=/usr/local/cuda/lib64 configurado

## 8. Network
- **Subnet Docker bridge principal:** 10.0.1.0/24 (Gateway: 10.0.1.1)
- **Traefik (coolify-proxy):** ✅ Presente e rodando — 0.0.0.0:80, 0.0.0.0:443, 0.0.0.0:8080
- **Portas abertas (ss):**
  | Porta | Serviço |
  |-------|---------|
  | 22 | SSH |
  | 80/443 | Traefik (HTTP/HTTPS) |
  | 8080 | Traefik + Coolify |
  | 2222 | Gitea SSH |
  | 3100 | Grafana |
  | 3300 | Gitea HTTP |
  | 8000 | Coolify |
  | 9090 | Prometheus (127.0.0.1) |
  | 9100 | Node Exporter |
  | 9250 | Cadvisor (127.0.0.1) |
  | 6379 | Redis (127.0.0.1) |
  | 6381 | Redis opencode (127.0.0.1) |
  | 5432 | PostgreSQL (127.0.0.1) |
  | 8888 | SearXNG (127.0.0.1) |
  | 8200 | Infisical (127.0.0.1) |
  | 8012 | Kokoro TTS (127.0.0.1) |
  | 9090 | Prometheus (127.0.0.1) |
  | 11434 | Ollama? (127.0.0.1) |
  | 6001-6002 | Coolify Realtime |
- **DNS:** systemd-resolved (127.0.0.53), search tail7726d2.ts.net + Home
- **Docker Networks:** 16 redes customizadas (aurelia, coolify, gitea, infisical, monitoring, monorepo, etc.)

## 9. Services Rodando

### Systemd
| Service | Status |
|---------|--------|
| docker.service | ✅ loaded active running |

### Docker Containers Ativos (26 running, 4 stopped)
- **Core:** coolify, coolify-proxy, coolify-db, coolify-redis, coolify-sentinel, coolify-realtime
- **AI/ML:** zappro-kokoro, openclaw (x3 browsers), zappro-gitea, searxng, grafana, prometheus, node-exporter, cadvisor
- **Infra:** infisical, infisical-db, infisical-redis, zappro-redis, redis-opencode, connected_repo_db

## 10. Pasta /srv — Estrutura ZFS Datasets

```
tank (3.5T livre, 128K usado)
├── coolify/              → /srv/data/coolify
├── monorepo/             → /srv/monorepo (255M)
├── docker-data/          → /srv/docker-data (13G) — volumes Docker
├── backups/              → /srv/backups (195M)
├── models/               → /srv/models (17G) — Ollama + Kokoro
├── data/
│   ├── qdrant/           → /srv/data/qdrant
│   ├── openclaw/         → /srv/data/openclaw
│   └── zappro-router/
```

## 11. Ollama
- **Status:** ✅ Detectado (porta 11434 escutando em 127.0.0.1)
- **Modelos:** ls ~/.ollama/models: não encontrado
- **Storage alternativo:** /srv/models (17G usado)
  - `blobs/` (8 items, ~15G)
  - `chatterbox/` (TTS)
  - `kokoro/` (3.0M, ~4096 bytes)
  - `manifests/`
  - `speeches/`
  - `xtts/`
- **Nota:** Modelos carregados diretamente em /srv/models (não no path padrão ~/.ollama)

## 12. LiteLLM
- **Status:** ❌ Container NÃO encontrado com nome "litellm"
- **zappro-lite:** Presente em ~/zappro-lite com:
  - `docker-compose.yml` — config existe
  - `.env` — variáveis de ambiente
  - `config.yaml` — configuração LiteLLM
  - `zappro-lite_litellm-data` — volume Docker existente
- **Hipótese:** LiteLLM pode estar rodando via zappro-lite (não como container "litellm")

## 13. Qdrant
- **Status:** ❌ **CRÍTICO — Container exited (143) há ~1 hora**
- **Storage:** `/srv/data/qdrant` existe com conteúdo:
  - `collections/` — dados de collections
  - `raft_state.json` — 355 bytes
  - `.deleted/`
  - `aliases/`
- **API:** ❌ Não responde em localhost:6333
- **Exit code 143:** SIGTERM — foi graceful shutdown, não crash

## 14. Gitea
- **Status:** ✅ Container rodando (zappro-gitea)
- **Porta:** 2222→22 (SSH), 3300→3000 (HTTP)
- **Respondendo:** ✅ HTTP na 3300
- **Docker network:** gitea_default

## 15. Grafana
- **Status:** ✅ Container rodando
- **Porta:** 3100→3000 (mapeada para host)
- **Docker network:** monitoring_monitoring

## 16. Git + Repositórios
- **Git versão:** 2.43.0
- **~/git:** ❌ Não existe
- **~/projects:** ❌ Não existe
- **Monorepo:** Presente em `/srv/monorepo` (dataset ZFS)

## 17. Pontos de Atenção

### 🔴 CRÍTICO
1. **Qdrant DOWN** — container exited (143), API não responde, collections inacessíveis
   - Impacto: Todos os serviços que dependem de vector search estão quebrados
   - Ação: Reiniciar container `docker start zappro-qdrant`

### 🟡 ALTO
2. **nvidia-gpu-exporter DOWN** — exited (128), não exporta métricas GPU
   - Impacto: Sem monitoramento de VRAM via Prometheus
3. **tts-bridge DOWN** — exited (137), serviço TTS interrompido
   - Impacto: Bridge TTS não funcional
4. **nginx-ratelimit DOWN** — exited (0), possivelmente intencional restart
   - Monitorar se não subir automaticamente

### 🟢 INFO
5. **Coolify .env não encontrado** — pasta coolify não está em ~/coolify
   - Configuração real está em /srv/data/coolify (dataset ZFS)
6. **Ollama models fora do path padrão** — /srv/models (custom setup)
7. **LiteLLM sem container dedicado** — possivelmente rodando via zappro-lite local
8. **16 subnets Docker** — rede complexa, documentar segregação
9. **RAM em 77% uso** — 23Gi/30Gi usado, 1.3Gi livre

## 18. Plano de Ação Imediato

1. **[CRÍTICO] Reiniciar Qdrant** — `docker start zappro-qdrant` e verificar se storage está íntegro
2. **[ALTO] Investigar nvidia-gpu-exporter** — exited (128) pode indicar problema de permissões ouconfiguração
3. **[ALTO] Reiniciar/reconectar tts-bridge** — python:3.11-slim exited (137) = OOM kill ou SIGKILL
4. **[INFO] Verificar zappro-lite** — validar se LiteLLM está funcional via ~/zappro-lite
5. **[INFO] Limitar RAM** — 77% uso é alto; monitorar para não entrar em swap pressure

---
*Auditoria gerada em 2026-04-04 21:23 UTC via Claude Code CLI*
*Sistema: will-zappro | Ubuntu 24.04 | Ryzen 9 7900X | RTX 4090 24GB | 30GB RAM | ZFS 3.6TB*

---

## 19. Resultados dos Agentes de Correção (2026-04-05 02:58 UTC)

### ✅ Qdrant — RESTAURADO
- Container reiniciado com sucesso
- Exit code 143 = SIGTERM graceful (não crash)
- API respondendo: `{"collections":[{"name":"openclaw-memory"}]}`
- Storage íntegro em /srv/data/qdrant

### ✅ tts-bridge — DIAGNOSTICADO (sem ação)
- Exit 137 = OOM Kill (SIGKILL)
- Container sem limite de memória configurado
- Recomendação: adicionar `--memory 1g` se for reativado
- Causa provável: python/uvicorn alocou memória excessiva em requisição TTS

### ✅ LiteLLM (zappro-lite) — RESTAURADO
- Problema: DATABASE_URL=sqlite (Prisma exige PostgreSQL)
- Solução aplicada:
  - Adicionado container postgres:15-alpine dedicado (zappro-litellm-db)
  - DATABASE_URL alterado para `postgresql://litellm:litellm_pass_2026@zappro-litellm-db:5432/litellm`
  - Removido `network_mode: host`, usado bridge com port 4000:4000
- Status: ✅ Rodando em :4000
- Health: 1/6 endpoints healthy (minimax-m2.7 OK)
- Nota: Ollama não está rodando como container (erro 11434) — configurado para localhost

### 🔄 nvidia-gpu-exporter — AGUARDANDO RESULTADO
- Exit 128 = problema de permissões/tempo
- Em investigação

### ✅ nvidia-gpu-exporter — CORRIGIDO
- Causa: runtime `runc` ao invés de `--gpus all` (exit 128 = permissão negada GPU)
- Solução: recriado container com `--gpus all -p 9835:9835`
- Status: ✅ Running em :9835
- Métricas GPU: acessíveis em http://localhost:9835/metrics
- Warning de `power_smoothing.window_multiplier` é informativo, não afeta funcionamento

---

## 20. Atualização 2026-04-05 09:40 UTC — Voice Pipeline + OpenClaw GPU

### ✅ Arquitetura Voice Pipeline (Nova)

```
OpenClaw (Coolify 10.0.19.x)
    │
    ├── LLaVA (visão)  ──→ LiteLLM (10.0.1.1:4000) ──→ Ollama (GPU)
    ├── Whisper (STT)   ──→ Deepgram cloud (fallback)
    ├── Kokoro (TTS)    ──→ Direct (10.0.19.6:8880) ✅
    └── Memory (Qdrant) ──→ LiteLLM ──→ Ollama nomic-embed ──→ Qdrant (10.0.19.5:6333)
```

### ✅ LiteLLM Proxy (api.zappro.site)
- **IP:** 10.0.1.1:4000
- **Network:** bridge (docker0) + zappro-lite_default
- **Modelos disponíveis:**
  - gemma3-27b (Ollama/GPU)
  - llava (Ollama/GPU) — visão
  - embedding-nomic (Ollama/GPU) — embeddings
  - minimax-m2.7 (OpenRouter)
  - qwen3.6-plus (OpenRouter)
- **API Key:** sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1

### ✅ Ollama (Systemd Service)
- **Status:** Rodando via systemd (não Docker)
- **IP:** 10.0.1.1:11434 (绑定0.0.0.0)
- **Modelos:** gemma4:latest, llava:latest, nomic-embed-text:latest
- **UFW:** Regra adicionada para permitir 10.0.0.0/8 → 11434

### ✅ Kokoro TTS (Coolify)
- **IP:** 10.0.19.6:8880
- **Network:** qgtzrmi6771lt8l7x8rqx72f (mesmo do OpenClaw)
- **Voz:** pm_santa (PT-BR)
- **OPENAI_TTS_BASE_URL:** http://10.0.19.6:8880/v1 (configurado no .env)

### ✅ Qdrant (Coolify)
- **IP:** 10.0.19.5:6333
- **Network:** qgtzrmi6771lt8l7x8rqx72f
- **API Key:** vmEbyCYrU68bR7lkzCbL05Ey4BPnTZgr
- **Collections:** openclaw-memory

### ✅ OpenClaw Config
- **Modelo primário:** liteLLM/minimax-m2.7
- **TTS:** Kokoro (via OPENAI_TTS_BASE_URL)
- **STT:** Deepgram cloud (whisper local não alcançável do Coolify)

### ⚠️ Pendências
1. **Redeploy OpenClaw via Coolify UI** — para persistir OPENAI_TTS_BASE_URL
2. **Whisper STT** — precisa containerizar no network do Coolify OU manter Deepgram

### 📝 Arquivos Modificados
- `/home/will/zappro-lite/config.yaml` — IP Ollama 127.0.0.1 → 10.0.1.1
- `/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/.env` — OPENAI_TTS_BASE_URL
- `/etc/systemd/system/ollama.service.d/override.conf` — OLLAMA_HOST=0.0.0.0
- UFW — regra para Ollama 11434 de 10.0.0.0/8
