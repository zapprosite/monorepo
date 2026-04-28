---
name: SPEC-HOMELAB-GOVERNANCE-DEFINITIVO
description: Governance definitivo do homelab — nunca mais quebrar
status: IN_PROGRESS
priority: critical
author: will-zappro
date: 2026-04-12
specRef: SPEC-AUDIT-HOMELAB-2026-04-12.md, SPEC-AUDIT-FIXES-2026-04-12.md
---

# SPEC-HOMELAB-GOVERNANCE-DEFINITIVO — Datacenter Enterprise Pattern

## Objetivo

Criar um governance framework que garante **zero breakage** do homelab, mesmo quando LLMas propõem "melhorias", quando modelos são atualizados, ou quando muda. Documenta o estado desejado, os caminhos de upgrade seguros, e as regras que TODOS os agentes (Claude, Codex, Copilot, Gemini, etc.) DEVEM ler antes de propor qualquer mudança.

---

## Pilares do Governance

```
┌─────────────────────────────────────────────────────────┐
│                    GOVERNANCE FRAMEWORK                  │
├──────────────┬──────────────┬──────────────┬─────────────┤
│  IMMUTABLE  │  UPGRADE    │  SELF-       │  MONITOR   │
│  SERVICES    │  PATHS      │  HEALING     │  & ALERT   │
│  (never)    │  (safe)     │  (automatic) │  (watch)   │
└──────────────┴──────────────┴──────────────┴─────────────┘
```

---

## PARTE 1 — SERVIÇOS IMUTÁVEIS

### 1.1 Registry de Serviços Imutáveis

| Serviço | Container | Porta | Versão | Motivo Imutabilidade |
|---------|-----------|-------|--------|----------------------|
| **Kokoro TTS** | `zappro-kokoro` | 8012 | `ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2` | Validado com OpenClaw; voz pm_santa/pf_dora testadas |
| **wav2vec2 STT** | `zappro-wav2vec2` | 8201 | `jonatasgrosman/wav2vec2-large-xlsr-53-portuguese` | Watchdog OpenClaw depende da API exacta |
| **OpenClaw Bot** | `openclaw-qgtzrmi...` | 8080 | `2026.2.6` | Mudar modelo primary quebra `api: undefined` |
| **TTS Bridge** | `zappro-tts-bridge` | 8013 | `python:3.11-slim + tts-bridge.py` | Filtro de vozes — 65 vozes bloqueadas |
| **LiteLLM Proxy** | `zappro-litellm` | 4000 | `latest` (config.yaml pinado) | Proxy GPU para vision/embeddings |
| **Coolify Traefik** | `coolify-proxy` | 8080 | `4.0.0-beta.470` | Conflito porta 8080 documentado |
| **Cloudflare Tunnel** | `cloudflared` | 8080 | N/A | Tunnels ativos não podem ser recriados |
| **Prometheus** | `prometheus` | 9090 | `3.11.1` | IMMUTABLE — métricas longas |
| **Grafana** | `grafana` | 3000 | `12.4.2` | IMMUTABLE — dashboards |
| **Loki** | `loki` | 3100 | `3.4.2` | IMMUTABLE — logs |
| **AlertManager** | `alertmanager` | 9093 | `0.31.1` | IMMUTABLE — alertas |
| **Qdrant** | `qdrant` | 6333 | latest | Vector DB |
| **Infisical** | `infisical-db` | 5432 | latest | Secrets vault |

### 1.2 Vozes PT-BR Protegidas

| Voice ID | Tipo | Uso | Status |
|----------|------|-----|--------|
| `pm_santa` | Masculino PT-BR | **PADRÃO** | ✅ Protegida |
| `pf_dora` | Feminino PT-BR | Fallback | ✅ Protegida |

**Todas as outras vozes retornam HTTP 400 via TTS Bridge.**

### 1.3 Redes Docker Protegidas

| Rede | Containers | Motivo |
|------|-----------|--------|
| `zappro-lite_default` | Kokoro, wav2vec2, LiteLLM | Stack de voz validado junto |
| `openclaw-qgtzrmi...` | OpenClaw + Traefik | Routing depende desta rede |

---

## PARTE 2 — CAMINHOS DE UPGRADE SEGUROS

### 2.1 Princípio Geral

```
MODELS: upgrade when ready — changes are backward-compatible
SERVICES: upgrade only with snapshot + approval + smoke test
GOVERNANCE DOCS: upgrade never without explicit user approval
```

### 2.2 Ollama Models — Safe Upgrade Pattern

**Arquitetura:** Ollama carrega modelos GGUF. API é estável.

**Regra:** upgrade de modelo = backup do alias + teste + rollback em 1 comando.

```bash
# ANTES: criar rollback point
ollama cp gemma2-9b-it gemma2-9b-it-v1
ollama cp llava llava-v1  # [DEPRECATED - qwen2.5-vl agora é o modelo de visão]
ollama cp nomic-embed-text nomic-embed-text-v1

# UPGRADE: pull novo modelo
ollama pull gemma2:9b-it

# TESTE: smoke test sem tráfego de produção
curl http://localhost:11434/api/generate \
  -d '{"model":"gemma2:9b-it","prompt":"teste","stream":false}'

# SE OK: promover
# SE FALHOU: rollback
ollama rm gemma2-9b-it
ollama cp gemma2-9b-it-v1 gemma2-9b-it
```

**Quando fazer upgrade:**
- Novo modelo traz melhoria mensurável (latência, qualidade)
- security patch no Ollama runtime
- Nunca: "latest is better" sem critério

### 2.3 Kokoro TTS — Safe Upgrade Pattern

**Arquitetura:** Container + voice models (HuggingFace). Actualização do container requer smoke test completo.

```bash
# 1. ZFS snapshot PRIMEIRO
sudo zfs snapshot -r tank@pre-kokoro-upgrade-$(date +%Y%m%d-%H%M%S)

# 2. Pull nova versão em staging
docker pull ghcr.io/remsky/kokoro-fastapi-gpu:v0.3.x

# 3. Testar vozes pm_santa e pf_dora
curl -X POST http://localhost:8012/v1/audio/speech \
  -d '{"model":"kokoro","input":"Teste","voice":"pm_santa"}' | head -c 100

# 4. Se OK: update tag em docker-compose/Coolify
# 5. Se falhou: rollback
docker tag ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2 ghcr.io/remsky/kokoro-fastapi-gpu:latest
```

**Version atual Kokoro:** v0.2.2 (pinada em 2026-03-20)
**Próxima versão a avaliar:** v0.3.x — requer validação completa.

### 2.4 wav2vec2 STT — Safe Upgrade Pattern

**Arquitetura:** Modelo HuggingFace + servidor Python. API `/v1/audio/transcriptions` é estável.

```bash
# Modelo é content-addressed por SHA — atualização rara
# Safe upgrade: novos pesos não afetam API

# Upgrade do modelo:
# 1. Snapshot ZFS
sudo zfs snapshot -r tank@pre-wav2vec2-upgrade-$(date +%Y%m%d-%H%M%S)

# 2. Pull novo modelo ( HuggingFace)
python -c "from transformers import AutoModel; AutoModel.from_pretrained('jonatasgrosman/wav2vec2-large-xlsr-53-portuguese')"

# 3. Teste A/B WER
# Comparar WER no corpus PT-BR entre versão anterior e nova

# 4. Se WER melhorou E latency OK: usar nova versão
```

### 2.5 MiniMax M2.7 — Upgrade do Provider

**Arquitetura:** Chamada direta a `https://api.minimax.io/anthropic` (NÃO via LiteLLM). LiteLLM não tem campo `api` compatível — causa crash `api: undefined`.

```bash
# Mudar para novo endpoint API requer:
# 1. Atualizar openclaw.json com novo base URL
# 2. Teste de smoke com mensagem simples
# 3. Verificar que streaming funciona
# 4. Rollback: reverter openclaw.json
```

### 2.6 Docker Images — Upgrade de Serviço

**Regra:** Imagens Docker em serviços PINNED requerem:

```
1. ZFS snapshot do dataset
2. Pull da nova imagem em staging
3. Smoke test pass (pipeline-openclaw-voice.sh)
4. Aprovação explícita de will
5. Update do docker-compose/Coolify
6. Monitoring 24h após deploy
```

### 2.7 GPU VRAM — Gestão de Memória

**Configuração atual (RTX 4090 24GB):**

| Config | Valor | Recomendação |
|--------|-------|--------------|
| `OLLAMA_MAX_LOADED_MODELS` | 2 | Máximo 2 modelos concurrently |
| `OLLAMA_NUM_PARALLEL` | 2 | Máximo 2 requests paralelos |
| `OLLAMA_MAX_QUEUE` | 512 | Fila de espera |
| `zfs_arc_max` | 8GB | 25% RAM — já configurado |
| `zfs_arc_min` | 1GB | Mínimo 1GB para ZFS metadata |

**Alertas de VRAM:**
```
> 20GB (83%): WARNING — model loading ризиroso
> 22GB (92%): CRITICAL — OOM eminente
> 23GB (96%): GPU OOM kill
```

**Monitoring:**
```bash
alias vram-check='nvidia-smi --query-gpu=memory.used,memory.total --format=csv && ollama ps'
```

---

## PARTE 3 — SELF-HEALING ARCHITECTURE

### 3.1 Camadas de Self-Healing

```
┌──────────────────────────────────────────────────────┐
│  CAMADA 5: HUMAN GATE                                 │
│  /heal unblock → override restart loop protection     │
├──────────────────────────────────────────────────────┤
│  CAMADA 4: ZFS SNAPSHOT BEFORE RESTART               │
│  Snapshot automatic before restart of critical svc   │
├──────────────────────────────────────────────────────┤
│  CAMADA 3: PROMETHUS + ALERTMANAGER                  │
│  container_down alert → page/notify → human decides │
├──────────────────────────────────────────────────────┤
│  CAMADA 2: DOCKER-AUTOHEAL + VOICE-PIPELINE-LOOP   │
│  Unhealthy → restart with exponential backoff        │
│  Rate limit: 3 restarts/hour per container           │
├──────────────────────────────────────────────────────┤
│  CAMADA 1: DOCKER HEALTHCHECKS                        │
│  /healthz every 30s → marks container UP/UNHEALTHY  │
└──────────────────────────────────────────────────────┘
```

### 3.2 Restart Loop Protection

**Problema:** Container em crash loop reinicia infinitamente.

**Solução implementada:**

| Configuração | Valor |
|--------------|-------|
| `RESTART_DELAY` base | 60s |
| `BACKOFF_MULTIPLIER` | 2x (exponential) |
| `MAX_DELAY` | 300s (5 min) |
| `MAX_RESTARTS` | 3 por hora por container |
| `start_period` | 60s (grace period inicial) |

**Containers que NÃO devem ser auto-restarted (whitelist):**

| Container | Reason |
|-----------|--------|
| `coolify-db` | Stateful — restart pode corromper WAL |
| `prometheus` | Perda de métricas históricas |
| `loki` | Potencial gap de logs |
| `grafana` | Dashboards sobrevivem, mas alertas podem ser perdidos |
| `alertmanager` | Pode perder firing de alertas |
| `cloudflared` | Tunnel drops afetam todo routing inbound |
| `coolify-proxy` | Disrupção de routing para todos os serviços |
| `docker-autoheal` | Restart durante incidente = blind |

**Regra:** Se container com label `autoheal: "false"` falhar, **NÃO restartar automaticamente** — alertar human.

### 3.3 Docker Healthcheck Configuration

**Para todos os serviços em produção:**

```yaml
healthcheck:
  test: ["CMD", "curl", "-sf", "http://localhost:${PORT}/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

**Excepções:**
- `node-exporter` — não tem `/health` nativo. Usar `wget --spider http://localhost:9100/metrics`
- `loki` — usar `/ready` endpoint: `wget --spider http://localhost:3100/ready`
- `prometheus` — built-in `/-/healthy` endpoint (não requer healthcheck adicional)

### 3.4 OOM Prevention

**Problema:** Exit code 137 = SIGKILL por OOM. Container restart com `--memory` ajuda.

**Configuração para containers memória-pesada:**

```yaml
# TTS Bridge / Kokoro
mem_limit: 1g           # Kokoro heap ~384MB + native ~400MB + headroom
memswap_limit: 1g       # NO swap — real-time audio
memory-swappiness: 0    # Disable swap para latency-sensitive
oom_score_adj: -100     # Prioridade acima de containers normais
restart: on-failure:3  # Máximo 3 restarts em caso de OOM

# Ollama
mem_limit: 8g
memswap_limit: 8g
memory-swappiness: 0
oom_score_adj: -200     # Alta prioridade
restart: on-failure:3
```

**Regra:** Se container teve exit 137 (OOM), **NÃO restartar imediatamente**. Investigar memory leak ou limite insuficiente antes de restartar.

### 3.5 Voice Pipeline Watchdog

**Script:** `tasks/smoke-tests/voice-pipeline-loop.sh`
**Cron:** `*/5 * * * *` (a cada 5 minutos)

```
Loop execution:
  1. curl TTS Bridge :8013/health
  2. curl OpenClaw :8080/health
  3. curl wav2vec2 :8201/health
  4. curl LiteLLM :4000/health

  Se todos UP: reset counters, exit 0
  Se algum DOWN:
    - Tentar docker restart/start do container
    - Aguardar 15s
    - Recheck
    - Se alert_count >= 3: Telegram ALERT
```

**Enhancements recomendados:**
- Silent degradation: se TTS DOWN, retornar text-only em vez de hard fail
- GPU memory threshold: alertar se VRAM < 1.5GB (precursor de OOM)
- Request timeout watchdog: matar requests > 60s para evitar pipeline freeze

---

## PARTE 4 — MONITORING & ALERTING

### 4.1 Prometheus Targets

| Target | Endpoint | Status | Healthcheck |
|--------|----------|--------|-------------|
| node-exporter | :9100 | ✅ UP | `wget --spider :9100/metrics` |
| cadvisor | :9323 | ✅ UP | Built-in metrics |
| prometheus | :9090 | ✅ UP | `/-/healthy` |
| grafana | :3000 | ✅ UP | Dashboard access |
| loki | :3100 | ✅ UP | `wget --spider :3100/ready` |
| alertmanager | :9093 | ✅ UP | `/-/healthy` |

### 4.2 Critical Alerts

```yaml
groups:
  - name: homelab_critical
    rules:
      - alert: ContainerMemoryHigh
        expr: (container_memory_working_set_bytes / container_spec_memory_limit_bytes) > 0.85
        for: 2m
        severity: warning

      - alert: ContainerOOMKilled
        expr: rate(container_oom_events_total[5m]) > 0
        for: 1m
        severity: critical

      - alert: GPUMemoryCritical
        expr: (nvidia_smi_memory_used_bytes / nvidia_smi_memory_total_bytes) > 0.90
        for: 30s
        severity: critical

      - alert: ZFSARCSize
        expr: (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) < 0.15
        for: 5m
        severity: warning
```

### 4.3 Grafana Dashboards

**Recommended panels para homelab overview:**

| Painel | Métrica | Propósito |
|--------|---------|-----------|
| CPU Usage | `100 - avg by (mode) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100` | Load geral |
| Memory Usage | `node_memory_MemTotal - node_memory_MemAvailable` / `node_memory_MemTotal` | RAM saturation |
| GPU VRAM | `nvidia-smi --query-gpu=memory.used,memory.total` | GPU memory |
| Container Count | `count(container_memory_usage_bytes)` | Densidade |
| Swap Usage | `node_memory_SwapTotal - node_memory_SwapFree` | Swap pressure |
| ZFS ARC Hit Ratio | `arc_stats_hits / (arc_stats_hits + arc_stats_misses)` | Cache efficiency |

---

## PARTE 5 — BACKUP 3-2-1 STRATEGY

### 5.1 Current Backup State

| Service | Schedule | Retention | Location |
|---------|----------|-----------|----------|
| Gitea dump | 02:30 daily | 7 dias | /srv/backups/gitea-dump-YYYYMMDD.tar.gz |
| Infisical DB | 02:45 daily | 7 dias | /srv/backups/infisical-db-YYYYMMDD.sql |
| Qdrant | 03:00 daily | 7 dias | /srv/backups/qdrant-YYYYMMDD.tar.gz |
| ZFS snapshots | 6h interval | 7 daily / 4 weekly / 6 monthly | tank (local) |

### 5.2 3-2-1 Backup Rule

```
3 COPIES:  Original (tank NVMe) + Local snapshot + Offsite
2 MEDIA:   ZFS NVMe + USB external drive
1 OFFSITE: USB rotated weekly to physical offsite location
```

### 5.3 ZFS Send to USB (Weekly)

```bash
#!/bin/bash
# /srv/ops/scripts/backup-zfs-usb.sh
set -euo pipefail

LASTSNAP=$(cat /srv/ops/backup-lastsnap.txt 2>/dev/null || echo "none")
NEW_SNAP="tank@usb-backup-$(date +%Y%m%d-%H%M%S)"

sudo zfs snapshot -r "$NEW_SNAP"

if [[ "$LASTSNAP" == "none" ]]; then
    sudo zfs send -R "$NEW_SNAP" | sudo zfs receive -Fdu backuppool/tank
else
    sudo zfs send -R -i "$LASTSNAP" "$NEW_SNAP" | sudo zfs receive -Fdu backuppool/tank
fi

echo "$NEW_SNAP" > /srv/ops/backup-lastsnap.txt
```

**Crontab:**
```bash
# Sunday 4am — ZFS send to USB
0 4 * * 0 sudo /srv/ops/scripts/backup-zfs-usb.sh >> /srv/ops/backup-logs/zfs-usb.log 2>&1
```

### 5.4 Backup Verification (Quarterly)

```bash
# 1. Gitea dump integrity
tar -tzf /srv/backups/gitea-dump-$(date +%Y%m%d).tar.gz | head -5

# 2. PostgreSQL dump integrity
docker exec infisical-db psql -U infisical \
  -c "SELECT 1 FROM information_schema.tables LIMIT 1" \
  < /srv/backups/infisical-db-$(date +%Y%m%d).sql | head -3

# 3. Qdrant checksum
sha256sum /srv/backups/qdrant-*.tar.gz && cat /srv/backups/qdrant-*.sha256

# 4. ZFS snapshot dry-run
sudo zfs send -n tank@backup-tank-$(date +%Y%m%d) 2>&1 | grep send
```

### 5.5 Encryption for Offsite

```bash
# GPG symmetric encryption antes de enviar para USB/offsite
gpg --symmetric --cipher-algo AES256 --batch \
    --passphrase-file /srv/ops/secrets/backup-passphrase \
    -o /srv/backups/encrypted/gitea-backup-$(date +%Y%m%d).tar.gz.gpg \
    /srv/backups/gitea-dump-$(date +%Y%m%d).tar.gz
```

---

## PARTE 6 — CI/CD COM GITEA ACTIONS

### 6.1 Runner Configuration

**act_runner registration:**
```bash
./act_runner register \
  --instance https://gitea.zappro.site \
  --token <runner-token> \
  --no-interactive
```

**Concurrency:** `concurrency` block no workflow YAML.

### 6.2 Recommended Workflow Structure

```
.monorepo/
├── .gitea/workflows/
│   ├── ci.yml         # test + lint + typecheck
│   ├── build.yml       # docker build + push to registry
│   ├── deploy.yml     # coolify deploy trigger
│   └── release.yml     # semantic versioning + git tag
├── turbo.json
└── .dockerignore
```

### 6.3 CI Pipeline Pattern

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - name: Setup Turborepo
        run: npm install -g turbo && npx turbo login --ci
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}
      - name: Run tests
        run: npx turbo test --filter=...
        env:
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}

  docker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build with cache
        uses: docker/build-push-action@v5
        with:
          push: false
          cache-from: type=registry,ref=registry.zappro.site/app:buildcache
          cache-to: type=registry,ref=registry.zappro.site/app:buildcache,mode=max
```

### 6.4 Docker Layer Caching

```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    push: true
    tags: registry.zappro.site/app:latest
    cache-from: type=registry,ref=registry.zappro.site/app:buildcache
    cache-to: type=registry,ref=registry.zappro.site/app:buildcache,mode=max
```

### 6.5 Secrets em Gitea Actions

```yaml
- name: Fetch secrets from Infisical
  run: |
    npm install -g @infisical/infisical-cli
    infisical secrets pull --format=env --env=production > .env
  env:
    INFISICAL_TOKEN: ${{ secrets.INFISICAL_TOKEN }}
```

### 6.6 Semantic Release

```bash
# Conventional commits: feat, fix, chore, docs, refactor, perf, test
# Tag format: vMAJOR.MINOR.PATCH
# Process tag: phase/N-name

# Release workflow:
git tag v$(date +%Y%m%d%H%M)
git push origin v$(date +%Y%m%d%H%M)
git checkout -b feat/next-$(date +%s)
```

---

## PARTE 7 — CLOUDFLARE ACCESS POLICY

### 7.1 chat.zappro.site Access

**App ID:** 99c85419
**Policy ID:** 4a668d84
**Status:** Terraform apply pending

### 7.2 Policy Pattern

```
Policy 1: Bypass
  Include: Path > equals > /oauth/*
  Include: Path > starts with > /oauth/

Policy 2: Allow
  Include: Google OAuth > @zappro.site domain
  Include: GitHub OAuth > zapprosite org
```

### 7.3 Bypass Rules

⚠️ Bypass requests **NÃO são logados** — usar apenas para health checks e OAuth callbacks.

### 7.4 DO NOT REQUIRE

- Device posture checks (bloqueia users legítimos sem WARP)
- SAML (usar OIDC — mais simples)

---

## PARTE 8 — ANTI-FRAGILITY FRAMEWORK

### 8.1 O Que NUNCA Sugerir (Anti-Patterns)

| Situação | Resposta Correta |
|----------|-----------------|
| "Vamos atualizar para latest" | ❌ REJEITAR — stack validado usa versão pinada |
| "Trocar Kokoro por Silero TTS" | ❌ REJEITAR — OpenClaw routing depende de Kokoro |
| "Usar Deepgram direto" | ❌ REJEITAR — wav2vec2 é o STT kanônico |
| "TTS direto ao Kokoro" | ❌ REJEITAR — usar TTS Bridge :8013 |
| "LiteLLM como primario MiniMax" | ❌ REJEITAR — causa `api: undefined` crash |
| "Vamos limpar containers órfãos" | ❌ REJEITAR — pode remover modelos Ollama |
| "Usar porta 8080" | ❌ REJEITAR — coolify-proxy + cloudflared usam |

### 8.2 Circuit Breaker para MiniMax API

**Problema:** Se MiniMax API falha, OpenClaw fica hanging sem fallback.

**Fallback chain:**
```
MiniMax M2.7 (direct)
  └→ FAIL (5xx, timeout) → retry once
       └→ FAIL → circuit open 60s
            └→ fallback: text-only mode (no voice)
```

### 8.3 STT Graceful Degradation

```
wav2vec2 :8201 → UP → transcribe
          └→ TIMEOUT 15s → retry once
                    └→ FAIL → text input mode
                              └→ notify user "STT unavailable"
```

### 8.4 TTS Cached Audio Fallback

```
Kokoro :8880 → UP → synthesize
         └→ FAIL 503 → Redis cache hit
                      └→ MISS → return cached greeting or text-only
```

---

## PARTE 9 — GOVERNANCE COMPLIANCE

### 9.1 Obrigatório para Todos os Agentes

**ANTES de propor qualquer mudança, o agente DEVE:**

```
□ 1. Ler este documento (SPEC-HOMELAB-GOVERNANCE-DEFINITIVO.md)
□ 2. Verificar se o serviço affected é IMUTABLE (Parte 1)
□ 3. Se IMUTABLE → PARAR e indicar "Este serviço é imutável — requer aprovação"
□ 4. Se não é imutável → verificar upgrade path (Parte 2)
□ 5. Se mudança requer snapshot → fazer snapshot ZFS primeiro
□ 6. Documentar mudança proposta + rollback plan
□ 7. Obter aprovação explícita antes de implementar
```

### 9.2 Checklist de Verificação

```bash
# É serviço IMUTABLE?
grep -l "PINNED\|IMUTÁVEL" /srv/monorepo/docs/GOVERNANCE/*.md | \
  xargs grep -l "service_name" && echo "❌ IMUTABLE — PARAR"

# Snapshot ZFS antes de mudança?
zfs list -t snapshot -r tank | grep "$(date +%Y%m%d)" && echo "✅ Snapshot feito"

# Verificar se memory limits aplicados?
docker inspect zappro-tts-bridge --format '{{json .HostConfig.Memory}}'

# Verificar se healthcheck existe?
docker inspect zappro-tts-bridge --format '{{json .State.Health}}'
```

### 9.3 Violação de Governance

Se um agente viola este governance:

1. **PARAR** — não executar a mudança proposta
2. **ASSESS** — verificar se houve dano
3. **RECOVER** — rollback ZFS se necessário
4. **DOCUMENT** — incident report em `docs/INCIDENTS/`
5. **UPDATE** — adicionar rule para prevenir recorrência

---

## PARTE 10 — ROADMAP DE IMPLEMENTAÇÃO

### P0 — Critical (agora)

| Task | Status | Evidência |
|------|--------|-----------|
| TTS Bridge memory limits (--memory=512m) | 🔄 Pendente | Container restart sem limits aplicado |
| node-exporter HEALTHCHECK | 🔄 Pendente | Prometheus mostra DOWN |
| loki HEALTHCHECK | 🔄 Pendente | Prometheus mostra DOWN |
| Restart loop protection (rate limit 3/hour) | 🔄 Em spec | SPEC-023 healing CLI |
| chat.zappro.site terraform apply | 🔄 Pendente | Policy criada mas não aplicada |

### P1 — High (esta semana)

| Task | Status |
|------|--------|
| ZFS send to USB (3-2-1 copy 2) | 🔄 Script pronto, USB needed |
| Backup verification quarterly | 🔄 Procedures documented |
| Ollama VRAM monitoring alert | 🔄 Config documented |
| Anti-fragility circuit breaker MiniMax | 🔄 Design documented |
| Grafana homelab overview dashboard | 🔄 Panels documented |

### P2 — Medium (este mês)

| Task | Status |
|------|--------|
| TTS cached audio fallback | 🔄 Design documented |
| GPU memory threshold alert | 🔄 Design documented |
| Secret scanning pre-commit hook | 🔄 Infisical supports |
| Ollama model upgrade rollback test | 🔄 Procedure documented |
| Voice pipeline chaos testing | 🔄 Design documented |

---

## ANEXO A — Version Reference

| Component | Version | Pin Date | Next Review |
|-----------|---------|-----------|-------------|
| Kokoro TTS | v0.2.2 | 2026-03-20 | 2026-06-20 |
| wav2vec2 model | jonatasgrosman/wav2vec2-large-xlsr-53-portuguese | 2026-03-15 | 2026-09-15 |
| OpenClaw | 2026.2.6 | 2026-03-10 | 2026-06-10 |
| TTS Bridge | stdlib + tts-bridge.py | 2026-04-08 | 2026-07-08 |
| Prometheus | 3.11.1 | 2026-03-01 | IMMUTABLE |
| Grafana | 12.4.2 | 2026-03-01 | IMMUTABLE |
| Loki | 3.4.2 | 2026-03-01 | IMMUTABLE |
| ZFS ARC max | 8GB | 2026-04-12 | 2026-05-12 |
| Ollama models | gemma2-9b-it, qwen2.5-vl [DEPRECATED - era llava], nomic-embed-text | various | Per model |

---

## ANEXO B — Quick Reference Commands

```bash
# VRAM check
vram-check

# ZFS ARC current
cat /sys/module/zfs/parameters/zfs_arc_max

# Container restart loop protection
docker inspect <container> --format '{{.RestartCount}}'

# Voice pipeline smoke test
bash tasks/smoke-tests/voice-pipeline-loop.sh

# Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | .labels.job, .health'

# OOM check
docker inspect <container> --format '{{.OOMKilled}}'

# ZFS snapshot list
zfs list -t snapshot -r tank | grep "$(date +%Y%m%d)"

# Backup verification
ls -lh /srv/backups/
```

---

**Documento criado:** 2026-04-12
**Próxima revisão:** 2026-05-12
**Authority:** will-zappro
**Todos os agentes DEVEM ler antes de propor mudanças**
