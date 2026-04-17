# Homelab Survival Guide — Lições de 08/04/2026

> Regras de ouro para nunca mais ter os incidentes de hoje.

---

## Regra 1: Snapshot Antes de Tudo

```bash
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-$(whoami)
```

**Antes de:** deploy, update de container, mudança de network, config Traefik.

---

## Regra 2: Docker Bridge ≠ Host Native Services

**NUNCA:**

```bash
# nativo do host como backend de container
Container → TCP → host:8201 (processo Python/Node)
```

**SEMPRE:**

```bash
# serviço containerizado na mesma network
Container → TCP → outro-container:8201 (mesma Docker network)
```

**Porque:** Docker bridge não consegue TCP para portas de processos nativos do host (mesmo quando ping funciona).

---

## Regra 3: Testar a Rota Real, Não a Local

**ERRADO:**

```bash
curl localhost:8201  # funciona do host → "está tudo bem"
```

**CERTO:**

```bash
docker exec liteLLM curl http://wav2vec2:8201/health  # rota real
```

---

## Regra 4: DNS/Tunnel UP ≠ Service UP

```
Cloudflare Tunnel UP
        ↓
  Container pode não existir
        ↓
  curl https://hermes.zappro.site/ → 200 OK (Hermes Gateway)
  curl https://bot.zappro.site/ → 530 (PRUNED — DNS removido)
```

**Verificar SEMPRE:**

```bash
docker ps | grep <container-name>  # existe?
curl https://hermes.zappro.site/health        # responde 200?
```

---

## Regra 5: Hermes Gateway Via Cloudflare Tunnel

`hermes.zappro.site` → Hermes Gateway (port 8642) via Cloudflare Tunnel.

**Smoke test CERTO:**

```bash
# Hermes Gateway via Cloudflare Tunnel
curl https://hermes.zappro.site/health   # 200 = Hermes Gateway OK
curl http://localhost:8642/health        # localhost health check

# LiteLLM proxy
curl https://llm.zappro.site/health       # 200 = LiteLLM OK
```

**Smoke test ERRADO:**

```bash
# loopback-only endpoints don't work externally
curl http://localhost:18789/health  # loopback-only, SEMPRE falha
```

---

## Regra 6: Network Shared = Traefik Consegue Atingir

```bash
# Ver se dois containers partilham rede
docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}' | python3 -c "import sys,json; print(list(json.load(sys.stdin).keys()))"
docker inspect hermes-agent-... --format '{{json .NetworkSettings.Networks}}' | python3 -c "import sys,json; print(list(json.load(sys.stdin).keys()))"
```

Se não partilham nenhuma network → **Traefik não consegue routear**.

---

## Regra 7: Health Check ≠ Rota Funcional

Container "Up (healthy)" ≠ routing funciona.

```bash
docker ps  # "Up (healthy)" → pode parecer OK
        ↓
curl https://bot.zappro.site/  # pode ser 502
```

**Verificar rota completa:**

```bash
# 1. DNS
nslookup hermes-agent.191.17.50.123.sslip.io

# 2. Traefik
curl http://localhost:80/ping  # 200 = Traefik OK

# 3. Backend routing
curl https://bot.zappro.site/  # 200/401 = routing funciona
```

---

## Regra 8: Deploy Checklist

```
ANTES DE ANUNCIAR "PRONTO":
[ ] Container "Up (healthy)" no Coolify
[ ] curl https://<domain>/health → 200
[ ] curl https://<domain>/ → 200 ou 401 (não 502)
[ ] Smoke test passa
[ ] Gitea Action testado com push real
[ ] Snapshot ZFS feito antes
```

---

## Quick Diagnostic Commands

```bash
# Traefik OK?
curl http://localhost:80/ping

# Container a correr?
docker ps | grep <name>

# Networks partilhadas?
docker inspect <container> --format '{{json .NetworkSettings.Networks}}'

# Rota completa funciona?
curl -sf -m 10 -o /dev/null -w "%{http_code}" "https://hermes.zappro.site/health"

# LiteLLM → wav2vec2 funciona?
docker exec zappro-litellm curl -sf -m 5 "http://wav2vec2:8201/health"
```

---

## Anti-Patterns

| Anti-Pattern                 | Porque                             | Alternativa                |
| ---------------------------- | ---------------------------------- | -------------------------- |
| Host process como backend    | Docker bridge TCP fails            | Containerizar              |
| Testar do host só            | loopback não é rota real           | Testar do container        |
| DNS OK = service OK          | Tunnel pode estar UP sem container | Verificar container        |
| `localhost:18789`            | loopback-only                      | `https://bot.zappro.site/` |
| Health check OK = routing OK | pode ser route isolado             | Testar rota completa       |

---

## Voice Stack (PT-BR)

**Canonical Stack (SPEC-027, SPEC-053):**

- STT: `faster-whisper-medium-pt` @ :8204 (canonical — NOT wav2vec2)
- TTS: `Kokoro` @ :8012 via `TTS Bridge` @ :8013 (voices: `pm_santa`, `pf_dora`)
- LLM: `qwen2.5vl:7b` via Ollama :11434 (primary — 100% local)
- Vision: `qwen2.5vl:7b` via Ollama :11434
- Hermes Gateway: :8642 (Telegram bot @CEO_REFRIMIX_bot)

**Ports:**

| Service          | Port | Container                |
| ---------------- | ---- | ------------------------ |
| STT (faster-whisper) | 8204 | faster-whisper-medium-pt |
| TTS Bridge      | 8013 | zappro-tts-bridge        |
| Kokoro          | 8880 | zappro-kokoro-restarted  |

**PROIBIDO:**

- Kokoro direto (sem TTS Bridge — usar sempre :8013)
- Deepgram cloud direto (deprecated — usar faster-whisper local)
- llava [DEPRECATED — usar qwen2.5vl:7b para vision]
- Speaches, chatterbox (REMOVIDOS em 2026-03)
- MiniMax M2.7 direct [DEPRECATED — 100% local via Ollama]
