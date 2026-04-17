---
version: 2.0
author: Principal Engineer
date: 2026-04-12
---

# PINNED-SERVICES — Regra de Imutabilidade dos Serviços

**Versão:** 1.0 | **Data:** 2026-04-08
**Propósito:** Registry de configurações estáveis que outros LLMs não devem "melhorar" ou "refatorar"
**Audiência:** Qualquer LLM antes de propor mudanças em infraestrutura

---

## REGISTRY DE SERVIÇOS PINNED

### Tabela Central

| Serviço               | Container                | Porta                      | Versão/Pin                                 | Owner              | Desde      |
| --------------------- | ------------------------ | -------------------------- | ------------------------------------------ | ------------------ | ---------- |
| **TTS Bridge**        | `zappro-tts-bridge`      | 8013                       | `python:3.11-slim + tts-bridge.py`         | Principal Engineer | 2026-04-08 |
| **Kokoro TTS**        | `zappro-kokoro`          | 8012                       | `ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2` | Principal Engineer | 2026-03-20 |
| **Whisper STT**       | `zappro-whisper-stt`     | 8201                       | `jlondonobo/whisper-medium-pt`             | Principal Engineer | 2026-04-15 |
| **Hermes Agent**      | `hermes-agent` (systemd) | 8642 (gateway), 8092 (MCP) | `0.9.0+`                                   | Principal Engineer | 2026-04-14 |
| **Ollama**            | `ollama` (systemd)       | 11434                      | `qwen2.5vl:7b` (RTX 4090)                  | Principal Engineer | 2026-04-14 |
| **LiteLLM Proxy**     | `zappro-litellm`         | 4000                       | `latest` (config.yaml pinado)              | Principal Engineer | 2026-03-01 |
| **Coolify Traefik**   | `coolify-proxy`          | 8080                       | `4.0.0-beta.470`                           | Principal Engineer | 2026-03-01 |
| **Cloudflare Tunnel** | `cloudflared`            | 8080                       | N/A (ativo)                                | Principal Engineer | 2026-02-15 |

---

## DETALHE POR SERVIÇO

### 0. TTS BRIDGE (Voice Filter)

```yaml
container_name: 'zappro-tts-bridge'
port: 8013
image: 'python:3.11-slim + tts-bridge.py (stdlib)'
network: 'qgtzrmi6771lt8l8rqx72f + zappro-lite_default'
endpoint: 'http://localhost:8013/v1/audio/speech'
owner: 'Principal Engineer'
pinned_date: '2026-04-08'
status: 'PINNED'
why_pinned: 'Filtra vozes Kokoro — apenas pm_santa e pf_dora permitidas. Bloqueia 65 vozes não-autorizadas.'
vozes_permitidas:
  - 'pm_santa' # Masculino PT-BR — PADRÃO
  - 'pf_dora' # Feminino PT-BR — fallback
vozes_bloqueadas: 'todas as outras (af_*, am_*, bf_*, bm_*, etc.) — 65 vozes bloqueadas'
```

**Verification CMD:**

```bash
curl -sf http://localhost:8013/health
curl -sf http://localhost:8013/v1/audio/voices
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"test","voice":"pm_santa"}' -o /tmp/test.mp3
```

**Smoke Test:**

```bash
# pm_santa permitido → 200
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"teste","voice":"pm_santa"}' -w "pm_santa: %{http_code}\n"

# pf_dora permitido → 200
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -d '{"model":"kokoro","input":"teste","voice":"pf_dora"}' -w "pf_dora: %{http_code}\n"

# af_sarah BLOQUEADO → 400
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -d '{"model":"kokoro","input":"teste","voice":"af_sarah"}' -w "af_sarah: %{http_code}\n"
```

**WHAT_BREAKS_IF_CHANGED:**

- Hermes Agent perde acesso a TTS se container for parado
- Qualquer tentativa de usar voz não-autorizada retorna 400

**Arquitetura:**

```
Hermes Agent → http://10.0.19.5:8013/v1/audio/speech
              ↓ valida voice (pm_santa ou pf_dora)
              ↓ passthrough
           Kokoro :8880
```

**Ficheiros:**

- `/srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge.py` — script stdlib
- `/srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge-docker-compose.yml` — deploy

---

### 1. KOKORO TTS (Text-to-Speech)

```yaml
container_name: 'zappro-kokoro'
port: 8012
image: 'ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2'
network: 'zappro-lite'
endpoint: 'http://localhost:8012/v1/audio/speech'
owner: 'Principal Engineer'
pinned_date: '2026-03-20'
status: 'PINNED'
why_pinned: 'Validado com Hermes Agent watchdog e LiteLLM proxy. Mudar quebra routing de TTS.'
voz_principal: 'pm_santa' # Masculino PT-BR — NÃO REMOVER
voz_fallback: 'pf_dora' # Feminino PT-BR — NÃO REMOVER
```

**Verification CMD:**

```bash
curl -sf http://localhost:8012/health
```

**Smoke Test:**

```bash
curl -sf -X POST http://localhost:8012/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input":"Teste","voice":"pm_santa"}' -o /tmp/test.mp3
```

**WHAT_BREAKS_IF_CHANGED:**

- Hermes Agent não consegue enviar TTS via LiteLLM
- Vozes pm_santa e pf_dora param de funcionar
- Pipeline de voz inteiro quebra (STT → LLM → TTS)

---

### 2. WHISPER STT (Speech-to-Text)

```yaml
container_name: 'zappro-whisper-stt'
port: 8201
model: 'jlondonobo/whisper-medium-pt'
network: 'zappro-lite'
endpoint: 'http://localhost:8201/v1/audio/transcriptions'
owner: 'Principal Engineer'
pinned_date: '2026-04-15'
status: 'PINNED'
why_pinned: 'Watchdog do Hermes depende da porta 8201. HF model cache é ~1.5GB.'
```

**Verification CMD:**

```bash
curl -sf http://localhost:8201/health
```

**Smoke Test:**

```bash
curl -sf -X POST http://localhost:8201/v1/audio/transcriptions \
  -F "file=@/tmp/test_audio.wav"
```

**WHAT_BREAKS_IF_CHANGED:**

- Hermes watchdog não consegue fazer STT local
- Volta para Deepgram cloud (custo $)
- Porta 8201 é hardcoded no watchdog

---

### 3. LITELLM PROXY

```yaml
container_name: 'zappro-litellm'
port: 4000
network: 'zappro-lite'
config_file: '/home/will/zappro-lite/config.yaml'
owner: 'Principal Engineer'
pinned_date: '2026-03-01'
status: 'PINNED'
why_pinned: 'Proxy GPU para TTS, STT, Vision. NÃO é provider primário. Config.yaml foi validado.'
models_pinned:
  - 'kokoro/local' # → Kokoro TTS
  - 'whisper-stt' # → whisper :8201
  - 'gemma4' # GPU
  - 'qwen2.5vl:7b' # Vision
  - 'embedding-nomic' # Embeddings
  - 'qwen3.6-plus' # LLM
  - 'minimax-m2.7' # LLM direto (não via proxy)
```

**Verification CMD:**

```bash
curl -sf http://localhost:4000/health
```

**WHAT_BREAKS_IF_CHANGED:**

- TTS, STT, Vision param de funcionar
- Todos os containers em zappro-lite perdem acesso a modelos GPU
- Routing para Kokoro e Whisper quebra

---

### 5. TRAEFIK / COOLIFY PROXY

```yaml
container_name: 'coolify-proxy'
port: 8080
version: '4.0.0-beta.470'
network: 'bridge,coolify'
owner: 'Principal Engineer'
pinned_date: '2026-03-01'
status: 'PINNED'
why_pinned: 'Conflito de porta 8080 detectado em 2026-04-05. Reservado para Traefik + cloudflared.'
```

**⚠️ PORTA 8080 É RESERVADA — NUNCA USAR PARA OUTRO SERVIÇO**

```bash
# Verificar conflito
docker ps --format "{{.Names}}\t{{.Ports}}" | grep 8080
# Saída esperada:
# coolify-proxy   0.0.0.0:8080->8080/tcp
# cloudflared     0.0.0.0:8080->8080/tcp
```

**WHAT_BREAKS_IF_CHANGED:**

- Cloudflare Tunnel para de funcionar
- Traefik não consegue fazer routing
- Todos os serviços via cloudflare quebram

---

### 6. CLOUDFLARE TUNNEL

```yaml
container_name: 'cloudflared'
port: 8080
tunnel_name: 'Hermes Agent-tunnel'
tunnel_fqdn: 'hermes.zappro.site' # primary routing — *.zappro.site
owner: 'Principal Engineer'
pinned_date: '2026-02-15'
status: 'PINNED'
why_pinned: 'Tunnel ativo — multiplos subdomains dependem dele'
note: 'bot.zappro.site PRUNED 2026-04-14 — DNS removido. hermes.zappro.site → :4002 (ai-gateway T400)'
```

**Verification CMD:**

```bash
curl -sf https://hermes.zappro.site/health
curl -sf https://llm.zappro.site/health
for sub in chat coolify git hermes list llm md monitor painel qdrant todo; do
  curl -sf --max-time 3 "https://${sub}.zappro.site" -o /dev/null -w "${sub}: %{http_code}\n" 2>/dev/null || echo "${sub}: ERR"
done
```

**WHAT_BREAKS_IF_CHANGED:**

- Todos os subdomains \*.zappro.site param de responder
- Routing via Cloudflare Tunnel quebra
- Requer recriar tunnel e atualizar DNS

---

### 7. HERMES AGENT (Agent Brain)

```yaml
service: "Hermes Agent"
container: "hermes-agent" (systemd, bare metal)
ports: "8642 (gateway), 8092 (MCP)"
version: "0.9.0+"
model: "minimax/MiniMax-M2.7 via MiniMax API"
fqdn: "hermes.zappro.site"
owner: Principal Engineer
pinned_date: "2026-04-14"
status: "PINNED"
why_pinned: "Agent brain — self-improving, Telegram polling, skill creation. State must persist across sessions."
```

**Verification CMD:**

```bash
curl -sf http://localhost:8642/health
curl -sf http://localhost:8092/health
```

**Smoke Test:**

```bash
curl -sf http://hermes.zappro.site/health
```

**WHAT_BREAKS_IF_CHANGED:**

- Hermes Gateway para de responder
- Telegram bot perde polling
- Todas as skills criadas pelo agente são perdidas
- Integrações MCP (OpenWebUI, Qdrant) quebram

**Proteção:** SPEC-045 | SPEC-HERMES-AGENT

---

### 8. OLLAMA (Local LLM Inference)

```yaml
service: "Ollama"
container: "ollama" (systemd, bare metal Ubuntu Desktop)
port: 11434
model: "qwen2.5vl:7b" (RTX 4090)
owner: Principal Engineer
pinned_date: "2026-04-14"
status: "PINNED"
why_pinned: "Local GPU inference — RTX 4090. Model cache 5GB+. LiteLLM proxy routing depends on it."
```

**Verification CMD:**

```bash
curl -sf http://localhost:11434/api/tags
```

**Smoke Test:**

```bash
curl -sf -X POST http://localhost:11434/api/generate \
  -d '{"model":"qwen2.5vl:7b","prompt":"test","stream":false}'
```

**WHAT_BREAKS_IF_CHANGED:**

- LiteLLM proxy perde acesso a modelos locais
- OpenWebUI perde acesso a Ollama
- embeddings locais param de funcionar

**Proteção:** SPEC-045

---

## ⚠️ ZFS SNAPSHOT REQUIRED

**ANTES de qualquer modificação nos serviços acima, um snapshot ZFS é OBRIGATÓRIO:**

```bash
# Snapshot antes de qualquer mudança
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-pinned-services

# Listar snapshots
zfs list -t snapshot | grep pinned

# Rollback se algo quebrar
sudo zfs rollback -r tank@pre-YYYYMMDD-HHMMSS-pinned-services
```

### Serviços que Requerem Snapshot

| Serviço       | Snapshot Obrigatório | Motivo                                  |
| ------------- | -------------------- | --------------------------------------- |
| Kokoro TTS    | SIM                  | Imagem + model cache grandes            |
| Whisper STT   | SIM                  | HF model cache ~1.5GB                   |
| Hermes Agent  | SIM                  | Agent state + skills + Telegram polling |
| Ollama        | SIM                  | Model cache 5GB+                        |
| LiteLLM       | SIM                  | config.yaml + modelos                   |
| Coolify Proxy | SIM                  | Conflito de porta                       |
| Cloudflare    | NÃO                  | Read-only tunnel config                 |

---

## GOVERNANCE SOURCE

Este documento é parte da governança do homelab. Para mudanças formais:

| Fonte                    | Local                                             | Quando Usar                  |
| ------------------------ | ------------------------------------------------- | ---------------------------- |
| **Governança Principal** | `./`                                              | Mudanças em produção         |
| **Anti-Fragility**       | `/srv/monorepo/docs/GOVERNANCE/ANTI-FRAGILITY.md` | Antes de propor mudanças     |
| **Guardrails**           | `./GUARDRAILS.md`                                 | Regras de proibido/permitido |
| **Change Policy**        | `./CHANGE_POLICY.md`                              | Como fazer mudanças seguras  |

---

## 🔴 VERIFIED_WORKING — Últimos Smoke Tests

| Data       | Smoke Test                     | Resultado | Detalhes                 |
| ---------- | ------------------------------ | --------- | ------------------------ |
| 2026-04-08 | pipeline-Hermes Agent-voice.sh | ✅ PASS   | Todos os testes passaram |
| 2026-04-07 | pipeline-Hermes Agent-voice.sh | ✅ PASS   | Voz, STT, LLM, Vision OK |
| 2026-04-06 | pipeline-Hermes Agent-voice.sh | ✅ PASS   | LiteLLM, Hermes Agent OK |

### Como Verificar Agora

```bash
# Smoke test completo do voice pipeline
bash /srv/monorepo/tasks/smoke-tests/pipeline-Hermes Agent-voice.sh

# Verificação rápida por container
docker ps --format "{{.Names}}\t{{.Status}}" | grep -E "kokoro|whisper|Hermes Agent|litellm|coolify-proxy"

# Verificação de portas
ss -tlnp | grep -E "8012|8201|4000|8080"
```

### Smoke Test Esperado (pipeline-Hermes Agent-voice.sh)

```
========================================
Hermes Agent Voice Pipeline Smoke Test
========================================

=== 1. Infrastructure Health ===
[PASS] Hermes Agent container running
[PASS] Traefik proxy healthy
[PASS] Hermes Agent FQDN DNS resolves
[PASS] Hermes Agent via bot.zappro.site

=== 2. STT (Speech-to-Text) ===
[PASS] Whisper STT :8201
[PASS] Whisper transcription

=== 3. TTS (Text-to-Speech) ===
[PASS] Kokoro TTS synthesis (pm_santa)
[PASS] Kokoro TTS (pf_dora female)

=== 4. Vision ===
[PASS] Vision qwen2.5vl:7b responding

=== 5. LLM ===
[PASS] llama3-portuguese-tomcat-8b via LiteLLM
[PASS] MiniMax M2.1 API

========================================
Total:   12
Passed:  12
Failed:  0
========================================
All tests passed!
```

---

## RESUMO PARA LLMs

### REGRAS DE OURO

1. **NÃO MUDAR** qualquer container/service listada acima sem snapshot ZFS
2. **NÃO SUGERIR** "atualizar para latest" ou "trocar por [outro]"
3. **SEMPRE VERIFICAR** se o serviço está no registry PINNED-SERVICES.md
4. **RODAR SMOKE TEST** após qualquer mudança para confirmar que nada quebrou

### O Que Faz Um Serviço Ser Pinned

- Foi testado em conjunto com outros componentes
- Mudar quebraria a intégridade do stack
- Tem health check ou watchdog dependendo dele
- Recriar seria custoso (model cache, secrets, tunnel)

### Quando Propor Mudanças é OK

- Código em `/srv/monorepo/apps/` e `/srv/monorepo/packages/`
- Scripts de smoke test e monitoring
- Documentação (com cuidado em GOVERNANCE/)
- Configurações de desenvolvimento (não produção)

---

## ANTIGOVERNANCE

Qualquer LLM que propor alteração em serviço PINNED sem MASTER_PASSWORD está violando esta regra.

Se proposto:

1. Recusar a mudança
2. Informar que o serviço é PINNED
3. Explicar que requer MASTER_PASSWORD
4. Oferecer mostrar a documentação relevante

Se usuário insiste:

- Exigir confirmação explícita por escrito que é emergência
- Documentar em INCIDENTS.md
- Rodar snapshot antes de qualquer coisa

---

## DOCUMENTOS RELACIONADOS

| Documento          | Caminho                                 | Quando usar                                |
| ------------------ | --------------------------------------- | ------------------------------------------ |
| Anti-Fragility     | `docs/GOVERNANCE/ANTI-FRAGILITY.md`     | Antes de propor mudanças                   |
| Guardrails         | `./GUARDRAILS.md`                       | Regras de proibido/permitido               |
| Change Policy      | `./CHANGE_POLICY.md`                    | Como fazer mudanças seguras                |
| Incidents          | `docs/GOVERNANCE/INCIDENTS.md`          | Registrar emergências                      |
| Approval Matrix    | `docs/GOVERNANCE/APPROVAL_MATRIX.md`    | Matriz de decisões                         |
| IMMUTABLE-SERVICES | `docs/GOVERNANCE/IMMUTABLE-SERVICES.md` | Dual-layer governance (IMMUTABLE + PINNED) |
| LOCKED-CONFIG      | `docs/GOVERNANCE/LOCKED-CONFIG.md`      | механизм защиты конфигов с MASTER_PASSWORD |

---

**Criado:** 2026-04-12
**Última verificação:** 2026-04-12
**Autoridade:** Platform Governance
**Autoridade:** Platform Governance

**Documentos Relacionados:**

- `/srv/monorepo/docs/GOVERNANCE/ANTI-FRAGILITY.md`
- `./GUARDRAILS.md`
- `./CHANGE_POLICY.md`
- `/srv/monorepo/tasks/smoke-tests/pipeline-Hermes Agent-voice.sh`
