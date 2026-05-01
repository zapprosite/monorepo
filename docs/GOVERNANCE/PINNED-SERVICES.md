# PINNED-SERVICES — Serviços que NÃO DEVEM Mudar

**Versão:** 1.0 | **Data:** 2026-04-08
**Propósito:** Registry de configurações estáveis que outros LLMs não devem "melhorar" ou "refatorar"
**Audiência:** Qualquer LLM antes de propor mudanças em infraestrutura

---

## REGISTRY DE SERVIÇOS PINNED

### Tabela Central

| Serviço | Container | Porta | Versão/Pin | Owner | Desde |
|---------|-----------|-------|------------|-------|-------|
| **TTS Bridge** | `zappro-tts-bridge` | 8013 | `python:3.11-slim + tts-bridge.py` | will-zappro | 2026-04-08 |
| **Edge TTS** | `edge-tts` | 8014 | `rany两句/edge-tts` | will-zappro | 2026-04-20 |
| **OpenClaw Bot** | `openclaw-qgtzrmi6771lt8l7x8rqx72f` | 8080 | `2026.2.6` | will-zappro | 2026-03-10 |
| **LiteLLM Proxy** | `zappro-litellm` | 4000 | `latest` (config.yaml pinado) | will-zappro | 2026-03-01 |
| **Coolify Traefik** | `coolify-proxy` | 8080 | `4.0.0-beta.470` | will-zappro | 2026-03-01 |
| **Cloudflare Tunnel** | `cloudflared` | 8080 | N/A (ativo) | will-zappro | 2026-02-15 |

---

## DETALHE POR SERVIÇO

### 0. TTS BRIDGE (Voice Filter)

```yaml
container_name: "zappro-tts-bridge"
port: 8013
image: "python:3.11-slim + tts-bridge.py (stdlib)"
network: "qgtzrmi6771lt8l8rqx72f + zappro-lite_default"
endpoint: "http://localhost:8013/v1/audio/speech"
owner: "will-zappro"
pinned_date: "2026-04-08"
status: "PINNED"
why_pinned: "Proxy TTS via Edge TTS — apenas vozes PT-BR validadas."
vozes_permitidas:
  - "pt-BR-DональдNeural"  # Masculino PT-BR — PADRÃO
  - "pt-BR-AnaNeural"       # Feminino PT-BR — fallback
```

**Verification CMD:**
```bash
curl -sf http://localhost:8013/health
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"edge","input":"test","voice":"pt-BR-DональдNeural"}' -o /tmp/test.mp3
```

**WHAT_BREAKS_IF_CHANGED:**
- OpenClaw perde acesso a TTS se container for parado

**Arquitetura:**
```
OpenClaw → TTS Bridge :8013 → Edge TTS :8014
```

**Ficheiros:**
- `/srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge.py` — script stdlib
- `/srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge-docker-compose.yml` — deploy

---

### 1. OPENCLAW BOT

```yaml
container_name: "openclaw-qgtzrmi6771lt8l7x8rqx72f"
port: 8080 (interno)
image: "ghcr.io/openclaw/openclaw:2026.2.6"
network: "openclaw-qgtzrmi6771lt8l7x8rqx72f"
fqdn: "openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io"
tunnel_fqdn: "bot.zappro.site"
owner: "will-zappro"
pinned_date: "2026-03-10"
status: "PINNED"
primary_model: "minimax/MiniMax-M2.7"
api_format: "anthropic-messages"  # NUNCA MUDAR
```

**⚠️ REGRAS CRÍTICAS DO OPENCLAW:**
- `model.primary` NUNCA pode ser `liteLLM/*` (crash api:undefined)
- `minimax.api` SEMPRE deve ser `anthropic-messages`
- LiteLLM só para GPU/visão (NÃO como provider primário)
- NÃO usar porta 8080 para outros serviços (reservada)

**Verification CMD:**
```bash
docker ps --filter "name=openclaw-qgtzrmi6771lt8l7x8rqx72f" --format "{{.Status}}"
nslookup openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io
curl -sf https://bot.zappro.site/ping
```

**WHAT_BREAKS_IF_CHANGED:**
- Bot para de responder
- Routing via Cloudflare Tunnel quebra
- Modelo MiniMax-M2.7 é o único validado

---

### 2. LITELLM PROXY

```yaml
container_name: "zappro-litellm"
port: 4000
network: "zappro-lite"
config_file: "/home/will/zappro-lite/config.yaml"
owner: "will-zappro"
pinned_date: "2026-03-01"
status: "PINNED"
why_pinned: "Proxy GPU para Vision. NÃO é provider primário. Config.yaml foi validado."
models_pinned:
  - "gemma4"              # GPU
  - "llava"               # Vision
  - "embedding-nomic"     # Embeddings
  - "qwen3.6-plus"        # LLM
  - "minimax-m2.7"        # LLM direto (não via proxy)
```

**Verification CMD:**
```bash
curl -sf http://localhost:4000/health
```

**WHAT_BREAKS_IF_CHANGED:**
- Vision param de funcionar
- Todos os containers em zappro-lite perdem acesso a modelos GPU

---

### 3. TRAEFIK / COOLIFY PROXY

```yaml
container_name: "coolify-proxy"
port: 8080
version: "4.0.0-beta.470"
network: "bridge,coolify"
owner: "will-zappro"
pinned_date: "2026-03-01"
status: "PINNED"
why_pinned: "Conflito de porta 8080 detectado em 2026-04-05. Reservado para Traefik + cloudflared."
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

### 4. CLOUDFLARE TUNNEL

```yaml
container_name: "cloudflared"
port: 8080
tunnel_name: "openclaw-tunnel"
tunnel_fqdn: "bot.zappro.site"
owner: "will-zappro"
pinned_date: "2026-02-15"
status: "PINNED"
why_pinned: "Tunnel ativo não pode ser recriado sem perder o bot.zappro.site"
```

**Verification CMD:**
```bash
curl -sf https://bot.zappro.site/ping
```

**WHAT_BREAKS_IF_CHANGED:**
- bot.zappro.site para de responder
- OpenClaw não é mais acessível via HTTPS
- Requer recriar tunnel e atualizar DNS

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

| Serviço | Snapshot Obrigatório | Motivo |
|---------|---------------------|--------|
| OpenClaw | SIM | Config complexo + secrets |
| LiteLLM | SIM | config.yaml + modelos |
| Coolify Proxy | SIM | Conflito de porta |
| Cloudflare | NÃO | Read-only tunnel config |

---

## GOVERNANCE SOURCE

Este documento é parte da governança do homelab. Para mudanças formais:

| Fonte | Local | Quando Usar |
|-------|-------|------------|
| **Governança Principal** | `/srv/ops/ai-governance/` | Mudanças em produção |
| **Anti-Fragility** | `/srv/monorepo/docs/GOVERNANCE/ANTI-FRAGILITY.md` | Antes de propor mudanças |
| **Guardrails** | `/srv/ops/ai-governance/GUARDRAILS.md` | Regras de proibido/permitido |
| **Change Policy** | `/srv/ops/ai-governance/CHANGE_POLICY.md` | Como fazer mudanças seguras |

---

## 🔴 VERIFIED_WORKING — Últimos Smoke Tests

| Data | Smoke Test | Resultado | Detalhes |
|------|------------|-----------|----------|
| 2026-04-08 | pipeline-openclaw-voice.sh | ✅ PASS | Todos os testes passaram |
| 2026-04-07 | pipeline-openclaw-voice.sh | ✅ PASS | Voz, STT, LLM, Vision OK |
| 2026-04-06 | pipeline-openclaw-voice.sh | ✅ PASS | LiteLLM, OpenClaw OK |

### Como Verificar Agora

```bash
# Smoke test completo do voice pipeline
bash /srv/monorepo/tasks/smoke-tests/pipeline-openclaw-voice.sh

# Verificação rápida por container
docker ps --format "{{.Names}}\t{{.Status}}" | grep -E "openclaw|litellm|coolify-proxy"

# Verificação de portas
ss -tlnp | grep -E "4000|8080"
```

### Smoke Test Esperado (pipeline-openclaw-voice.sh)

```
========================================
OpenClaw Voice Pipeline Smoke Test
========================================

=== 1. Infrastructure Health ===
[PASS] OpenClaw container running
[PASS] Traefik proxy healthy
[PASS] OpenClaw FQDN DNS resolves
[PASS] OpenClaw via bot.zappro.site

=== 2. STT (Speech-to-Text) ===
[PASS] Groq Whisper STT

=== 3. TTS (Text-to-Speech) ===
[PASS] Edge TTS synthesis

=== 4. Vision ===
[PASS] Vision qwen2.5-vl responding

=== 5. LLM ===
[PASS] Tom Cat 8B PT-BR via LiteLLM
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

**Criado:** 2026-04-08
**Última Verificação:** 2026-04-08
**Próxima Verificação:** 2026-04-15 (semanal)
**Autoridade:** will-zappro

**Documentos Relacionados:**
- `/srv/monorepo/docs/GOVERNANCE/ANTI-FRAGILITY.md`
- `/srv/ops/ai-governance/GUARDRAILS.md`
- `/srv/ops/ai-governance/CHANGE_POLICY.md`
- `/srv/monorepo/tasks/smoke-tests/pipeline-openclaw-voice.sh`
Updated: 2026-05-01
