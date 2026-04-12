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
  curl https://bot.zappro.site/ → 502
```

**Verificar SEMPRE:**
```bash
docker ps | grep <container-name>  # existe?
curl https://<domain>/health        # responde 200?
```

---

## Regra 5: Gateway OpenClaw É Loopback

`OPENCLAW_GATEWAY_BIND=loopback` → `localhost:18789` **nunca** funciona externamente.

**Smoke test CERTO:**
```bash
# usa Cloudflare Tunnel
curl https://bot.zappro.site/   # 401 = routing OK, só precisa auth

# ou localhost:8080 (Traefik)
curl http://localhost:8080/health
```

**Smoke test ERRADO:**
```bash
curl http://localhost:18789/health  # loopback-only, SEMPRE falha
```

---

## Regra 6: Network Shared = Traefik Consegue Atingir

```bash
# Ver se dois containers partilham rede
docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}' | python3 -c "import sys,json; print(list(json.load(sys.stdin).keys()))"
docker inspect openclaw-... --format '{{json .NetworkSettings.Networks}}' | python3 -c "import sys,json; print(list(json.load(sys.stdin).keys()))"
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
nslookup openclaw.191.17.50.123.sslip.io

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
curl -sf -m 10 -o /dev/null -w "%{http_code}" "https://bot.zappro.site/"

# LiteLLM → wav2vec2 funciona?
docker exec zappro-litellm curl -sf -m 5 "http://wav2vec2:8201/health"
```

---

## Anti-Patterns

| Anti-Pattern | Porque | Alternativa |
|---|---|---|
| Host process como backend | Docker bridge TCP fails | Containerizar |
| Testar do host só | loopback não é rota real | Testar do container |
| DNS OK = service OK | Tunnel pode estar UP sem container | Verificar container |
| `localhost:18789` | loopback-only | `https://bot.zappro.site/` |
| Health check OK = routing OK | pode ser route isolado | Testar rota completa |

---

## Voice Stack (PT-BR)

**Canonical Stack (SPEC-009):**
- STT: `wav2vec2` @ :8201 (whisper-api container, host :8202→:8201)
- STT Proxy: `wav2vec2-deepgram-proxy` @ :8203 (Deepgram API format)
- TTS: `Kokoro` @ :8880 via `TTS Bridge` @ :8013
- Voices: `pm_santa` (male default), `pf_dora` (female fallback)
- Vision: `litellm/qwen2.5-vl` (not llava)
- LLM: MiniMax M2.7 direct (not via LiteLLM)

**Ports:**

| Service | Port | Container |
|---------|------|-----------|
| whisper-api (wav2vec2) | 8202→8201 | zappro-wav2vec2 |
| wav2vec2-deepgram-proxy | 8203 | zappro-wav2vec2 |
| TTS Bridge | 8013 | zappro-tts-bridge |
| Kokoro | 8880 | koro-zappro |

**PROIBIDO:**
- Kokoro direto (sem TTS Bridge)
- Deepgram cloud direto (use wav2vec2-proxy :8203)
- Whisper como STT
- llava para vision
- speaches, chatterbox (REMOVIDOS em 2026-03)
