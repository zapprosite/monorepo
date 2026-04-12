---
version: 1.1
author: will-zappro
date: 2026-04-06
---

# GUARDRAILS — Infraestrutura Zappro (will-zappro)
## Versão: 1.1 | 2026-04-06

## 🚫 ZONAS PROIBIDAS — LLM NÃO PODE TOCAR

### Coolify (PaaS Controller)
- NUNCA: curl -fsSL https://coolify.io/install.sh
- NUNCA: docker pull coollabsio/coolify:latest
- NUNCA: editar /data/coolify/source/docker-compose.prod.yml
- NUNCA: coolify update ou qualquer subcomando de upgrade
- VERSÃO PINADA: 4.0.0-beta.470

### Drivers e Kernel
- NUNCA: apt upgrade / apt dist-upgrade / do-release-upgrade
- NUNCA: reinstalar drivers NVIDIA
- NUNCA: nvidia-container-toolkit update
- Kernel: 6.17.0-20-generic — NÃO ATUALIZAR

### ZFS Pool (tank)
- NUNCA: zpool upgrade tank
- NUNCA: zfs destroy em datasets de produção
- Snapshots: só criar/listar — NUNCA destruir sem aprovação

### Rede e DNS
- NUNCA: editar /etc/cloudflared/*.yml
- NUNCA: revogar Cloudflare API tokens
- NUNCA: terraform destroy

### Secrets
- NUNCA: ler, copiar ou exibir aurelia.env

## ✅ PERMITIDO SEM APROVAÇÃO
- Ler logs, restart containers de app (não coolify-*)
- Editar código em /srv/monorepo e /home/will/dev

## ⚠️ REQUER CONFIRMAÇÃO
- Restart de coolify, coolify-db, coolify-redis
- docker pull em imagens de infra
- Operações em /srv/ops/terraform/

### Voice / Audio Pipeline (BOCA + OUVIDO) — KIT PROTEGIDO ⚠️

**Arquitetura atual (2026-04-08):**
```
OpenClaw → TTS Bridge (:8013) → Kokoro (:8880)
           └─► pm_santa, pf_dora ONLY
           └─► [OUTRAS] → 400 Bad Request
OpenClaw → wav2vec2 (:8201) → STT PT-BR
```

**TTS Bridge (porta 8013):**
- **INTOCÁVEL** — proxy Python stdlib
- **Vozes:** ONLY pm_santa (masculino) e pf_dora (feminino)
- **Todas outras vozes:** HTTP 400
- **Endpoint:** `http://10.0.19.5:8013/v1` (NAO Kokoro direto)
- NUNCA: mudar baseUrl para Kokoro direto
- NUNCA: propor outras vozes Kokoro

**STT (porta 8201):**
- **Modelo:** wav2vec2 jonatasgrosman/wav2vec2-large-xlsr-53-portuguese
- **VRAM:** ~2GB
- **Linguagem:** PT-BR Native (5.8M+ downloads)
- NUNCA: usar Deepgram, Whisper ou outro STT
- ENDPOINT: `http://wav2vec2:8201/v1/audio/transcriptions`

**PROIBIDO — Voice/Audio:**
| O que | Por que |
|-------|---------|
| Kokoro direto (`:8880`) | Sem filtro de vozes |
| Deepgram como STT | Foi REMOVIDO em 2026-04-07 |
| Whisper como STT | Nao e PT-BR native |
| Outras vozes Kokoro | TTS Bridge bloqueia |
| LiteLLM como primario | Causa crash `api: undefined` |

**Se LLM sugerir mudança → REJEITAR e reportar violação.**

### OpenClaw Bot (@CEO_REFRIMIX_bot)
- NUNCA: mudar model.primary para liteLLM/* (crash api:undefined)
- NUNCA: remover MiniMax-M2.7 do provider minimax
- NUNCA: mudar minimax.api (DEVE ser anthropic-messages)
- NUNCA: usar LiteLLM como provider primario (SO para GPU/voz/visao)
- PINADO: OpenClaw 2026.2.6 | minimax/MiniMax-M2.7 direto
- DEBUG: ./OPENCLAW_DEBUG.md

### LiteLLM Proxy (10.0.1.1:4000)
- NUNCA: mudar papel do LiteLLM (proxy GPU, NAO provider primario)
- CONFIG: /home/will/zappro-lite/config.yaml
- MODELOS: gemma4, qwen2.5-vl, embedding-nomic, qwen3.6-plus, minimax-m2.7, kokoro-tts, whisper-stt (direto :8201)

---

## ⚠️ CONFLITO PORTA 8080 (CRÍTICO)

**PROBLEMA:** coolify-proxy expõe :8080 na LAN (0.0.0.0:8080->8080/tcp) e cloudflared também usa :8080. Conflito resolvido em 2026-04-05 removendo open-webui do :8080.

**STATUS ATUAL:**
- coolify-proxy: 0.0.0.0:8080->8080/tcp (OK — Traefik interno do Coolify)
- cloudflared: 0.0.0.0:8080->8080/tcp (OK — daemon tunnel)
- open-webui: REMOVIDO do :8080 (antes causava conflito)

**REGRA:** NUNCA deployar nada na porta :8080 do host. Reservada para cloudflared e coolify-proxy.

---

## ⚠️ CONTAINERS ÓRFÃOS (FANTASMAS)

**Estes containers podem aparecer no `docker ps` mas são REMOVIDOS ou JÁ NÃO EXISTEM:**

| Container Pattern | Status | Ação |
|-----------------|--------|------|
| `speaches-*` | ⚠️ REMOVIDO | Substituído por Deepgram cloud |
| `chatterbox-tts-*` | ⚠️ REMOVIDO | Substituído por Kokoro local |
| `voice-proxy-*` | ⚠️ NUNCA DEPLOYADO | Nginx TTS proxy — não existiu |
| `captain-*` | ⚠️ REMOVIDO | CapRover substituído por Coolify (2026-03) |
| `supabase-*` | ⚠️ REMOVIDO | 13 containers removidos em 2026-04 |

**SE APARECEREM:** Investigar — são fantasmas de stacks antigas. Remover com:
```bash
# Identificar containers orfaos
docker ps --format "{{.Names}}" | grep -E "speaches|chatterbox|voice-proxy|captain|supabase"

# Remover (APOS CONFIRMAR)
docker rm -f <container_name>
```

---

## ⚠️ PRUNE DOCKER — GUARDRAILS

**Executar prune pode destruir dados irreversíveis. Regras de segurança:**

### ✅ PRUNE SEGURO (sem aprovação)
- `docker container prune -f` — Remove apenas containers parados (OK)
- `docker image prune -f` — Remove apenas imagens dangling (OK)
- `docker volume prune -f` — ⚠️ CUIDADO — volumes orfos podem ter dados

### ⚠️ PRUNE REQUER APROVAÇÃO
- `docker system prune -a` — Remove TODAS as imagens não usadas (inclui Ollama, Kokoro, etc)
- `docker system prune --volumes` — Remove imagens + containers + **VOLUMES** (destructive)

### ❌ NUNCA EXECUTAR
- `docker system prune -a --volumes` sem snapshotted tank primeiro
- Qualquer prune se ZFS pool estiver com menos de 10% livre
- Prune em produção sem confirmar o que vai ser removido

### ANTES DE PRUNE (checklist)
```bash
# 1. Ver espaco ZFS
df -h /srv

# 2. Listar volumes para confirmar
docker volume ls

# 3. Ver imagens que serao afetadas
docker image ls

# 4. Snapshot se for system prune
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-prune
```

### Ollama Models (GPU - RTX 4090)

**NUNCA:** ollama pull com :latest (atualiza modelo unpredictably)
**NUNCA:** ollama rm model (perde modelo pinned)
**ATUALIZAR:** apenas via /srv/ops/scripts/ com snapshot ZFS antes

Models currently installed:
- gemma4 (8B, Q4_K_M) → voz pipeline correção, screenshot
- qwen2.5-vl (7B, Q4_0) → visão screenshot
- nomic-embed-text (137M, F16) → embeddings via LiteLLM

---

## 📌 ANTI-FRAGILITY MARKERS (2026-04-08)

### Para Agentes: O Que Significa "Pinned"

Quando um serviço ou config tem marker **📌 PINNED**, significa:
- **NÃO PROPOR** mudanças, otimizações, ou "melhoramentos"
- **NÃO SUGERIR** substituição por alternativas "melhores"
- **NÃO REFATORAR** sem snapshot ZFS + aprovação explícita
- **SE PEDIDO** para mudar algo pinned: recusar educadamente, indicar este doc

### Marcadores de Estabilidade

| Marcador | Significado | Ação do Agente |
|----------|-------------|----------------|
| `📌 PINNED` | Imutável sem snapshot | Recusar sugestões |
| `⚠️ KIT PROTECTED` | Stack validated como unit | Não quebrar dependências |
| `🔒 LOCKED` | Testado em conjunto | Propor mudança = violação |
| `✅ STABLE` | Verificado funcionando | Mudanças requerem novo teste |

### Serviços Com Marcadores de Estabilidade (2026-04-08)

| Serviço | Marcador | Notas |
|---------|----------|-------|
| Kokoro TTS (zappro-kokoro) | ⚠️ KIT PROTECTED | Voice pipeline unit — não substituir |
| wav2vec2 STT (zappro-wav2vec2) | ⚠️ KIT PROTECTED | STT pipeline unit — não substituir |
| OpenClaw Bot | ⚠️ KIT PROTECTED + 🔒 LOCKED | Config validado 08/04/2026 |
| LiteLLM Proxy (zappro-litellm) | 🔒 LOCKED | Roteamento GPU/voice dependente |
| Traefik + Cloudflare Tunnel | 📌 PINNED | DNS routing — mudança requer Terraform |
| Voice Pipeline (completo) | ⚠️ KIT PROTECTED | Testado como unit 15/15 |

### Como Verificar Estabilidade

Antes de propor qualquer mudança em serviços listados:
```bash
# 1. Verificar se está marcado pinned
grep -r "PINNED\|KIT PROTECTED\|LOCKED" /srv/monorepo/docs/GOVERNANCE/

# 2. Verificar última execução do smoke test
cat /srv/monorepo/tasks/smoke-tests/pipeline-openclaw-voice.sh | head -5

# 3. Verificar ZFS snapshots recentes
sudo zfs list -t snapshot -r tank | tail -10
```

### O Que Acontece Se um Agente Propor Mudança em Serviço Pinned

1. Recusar educadamente: "Este serviço está marcado como PINNED/KIT PROTECTED. Mudanças requerem snapshot ZFS + aprovação do Principal Engineer."
2. Indicar este documento como fonte
3. Propor pipeline completo de teste se mudança for aprovada
4. Documentar razão da mudança para futuro

### Revisão

Este sistema de marcadores foi criado 2026-04-08 após incidentes onde LLMs propuseram "otimizações" que quebraram voice pipeline estável.
**Próxima revisão:** 2026-05-08
