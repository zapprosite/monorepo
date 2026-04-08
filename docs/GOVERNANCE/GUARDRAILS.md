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

### Voice / Kokoro TTS (BOCA) — KIT PROTEGIDO ⚠️
- **KOKORO É INTOCÁVEL** — LLM NUNCA pode sugerir substituição ou modificação
- **REGRA ZERO:** Whisper → Kokoro → pm_santa/pf_dora = imutável
- NUNCA: docker pull ghcr.io/remsky/kokoro-* (imagem pinada v0.2.2)
- NUNCA: editar docker-compose do Kokoro sem snapshot ZFS antes
- NUNCA: restart/stop do container zappro-kokoro sem necessidade
- NUNCA: substituir Kokoro por Coqui/Silero/StyleTTS/xtensa
- NUNCA: sugerir "vamos trocar por [TTS]" em qualquer contexto
- VERSÃO PINADA: ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2
- LOCK: docker-compose.yml com chattr +i (requer sudo chattr -i para modificar)
- **VOZES PT-BR PROTEGIDAS (NUNCA REMOVER/MODIFICAR):**
  - `pm_santa` — **PADRÃO** Masculino PT-BR (uso principal)
  - `pf_dora` — Feminino PT-BR (fallback)
- ENDPOINT: http://localhost:8012/v1/audio/speech
- LiteLLM: `kokoro/local` mapeado para OpenAI-compatible
- REDE: container em `zappro-lite`, porta 8012 (localhost only)
- Para OpenClaw: via LiteLLM proxy (NAO diretamente)
- Se LLM sugerir mudança → IGNORAR e reportar violação

### wav2vec2 STT (OUVIDO) — KIT PROTEGIDO ⚠️
- **wav2vec2 É INTOCÁVEL** — LLM NUNCA pode sugerir substituição
- **REGRA ZERO:** whisper → wav2vec2-ptbr = imutável
- MODELO: jonatasgrosman/wav2vec2-large-xlsr-53-portuguese
- HF PATH: /home/will/.cache/huggingface/hub/models--jonatasgrosman--wav2vec2-large-xlsr-53-portuguese
- API: http://localhost:8201/v1/audio/transcriptions (OpenAI-compatible)
- VRAM: ~2GB (GPU)
- NUNCA: substituir por Whisper, Coqui STT, Silero STT
- NUNCA: mudar porta 8201 (OpenClaw watchdog depende)
- NUNCA: parar ou desativar o serviço sem necessidade
- LINGUAGEM: PT-BR Native (5.8M+ downloads)
- Se LLM sugerir mudança → IGNORAR e reportar violação
- FALLBACK CLOUD: Deepgram (nova-3) via OpenClaw watchdog
- PROCESSO: python3 /home/will/Desktop/voice-pipeline/wav2vec2_api.py (systemd)
- LOCK: chattr +i no script wav2vec2_api.py

### OpenClaw Bot (@CEO_REFRIMIX_bot)
- NUNCA: mudar model.primary para liteLLM/* (crash api:undefined)
- NUNCA: remover MiniMax-M2.7 do provider minimax
- NUNCA: mudar minimax.api (DEVE ser anthropic-messages)
- NUNCA: usar LiteLLM como provider primario (SO para GPU/voz/visao)
- PINADO: OpenClaw 2026.2.6 | minimax/MiniMax-M2.7 direto
- DEBUG: /srv/ops/ai-governance/OPENCLAW_DEBUG.md

### LiteLLM Proxy (10.0.1.1:4000)
- NUNCA: mudar papel do LiteLLM (proxy GPU, NAO provider primario)
- CONFIG: /home/will/zappro-lite/config.yaml
- MODELOS: gemma4, llava, embedding-nomic, qwen3.6-plus, minimax-m2.7, kokoro-tts, whisper-stt (direto :8201)

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
- llava (7B, Q4_0) → visão screenshot
- nomic-embed-text (137M, F16) → embeddings via LiteLLM
