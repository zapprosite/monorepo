---
version: 1.0
author: will-zappro
date: 2026-04-08
---

# OpenClaw Bot Debug — Guia de Debug e Configuracao Pinada

**Host:** will-zappro | **Atualizado:** 2026-04-08
**Bot:** @CEO_REFRIMIX_bot | **Container:** openclaw-qgtzrmi6771lt8l7x8rqx72f
**Versao:** OpenClaw 2026.2.6 (PINADA)
**Fix 2026-04-07:** qwen2.5-vl [DEPRECATED - era llava] registrado no provider liteLLM com provider map corrigido
**Fix 2026-04-08:** TTS Bridge adicionado — filtro de vozes Kokoro (apenas pm_santa + pf_dora)

---

## Arquitetura de Decisao

```
                    MiniMax M2.7 (DIRETO)
                    api.minimax.io/anthropic
                    Provider: minimax
                    API: anthropic-messages
                          |
            +-------------+-------------+
            |                           |
      [CEREBRO]                   [BOCA - TTS]
      minimax/MiniMax-M2.7       TTS Bridge (:8013)
      (chat principal)             ├─► pm_santa ✓ → Kokoro :8880
                                  └─► pf_dora ✓ → Kokoro :8880
                                       [OUTRAS] ✗ → 400 Bad Request
            |
      +-----+-----+
      |           |
  [OLHOS]    [OUVIDOS]
  liteLLM/   Whisper local
  qwen2.5-vl (:8201 via LiteLLM)
  (GPU)      (DEEPGRAM REMOVIDO 2026-04-07)
```

**REGRA:** MiniMax M2.7 e chamado DIRETO pelo OpenClaw, sem passar pelo LiteLLM.
**MOTIVO:** LiteLLM nao tem `api` field compativel com OpenClaw (causa crash `api: undefined`).

**REGRA:** MiniMax M2.7 e chamado DIRETO pelo OpenClaw, sem passar pelo LiteLLM.
**MOTIVO:** LiteLLM nao tem `api` field compativel com OpenClaw (causa crash `api: undefined`).

---

## Papel do LiteLLM (10.0.1.1:4000)

LiteLLM serve APENAS como proxy para servicos GPU locais:

| Modelo LiteLLM | Backend | Uso |
|---|---|---|
| `qwen2.5-vl` | Ollama GPU | Visao (olhos do bot) - UNICO modelo no liteLLM |
| `gemma4` | Ollama GPU | LLM local fallback (nao usado pelo OpenClaw) |
| `kokoro-tts` | Kokoro 10.0.19.6:8880 | TTS local |
| `embedding-nomic` | Ollama GPU | Embeddings |

**NAO colocar MiniMax M2.7 no LiteLLM.** MiniMax é PRIMARY direto no OpenClaw.
**MOTIVO:** LiteLLM nao tem campo `api` compativel causing crash `api: undefined`.

**STT (2026-04-07):** Whisper local em `:8201` via `OLLAMA_BASE_URL`.
Deepgram cloud REMOVIDO.

---

## Arquivos Criticos

| Arquivo | O que contem | Protecao |
|---|---|---|
| Container: `/data/.openclaw/openclaw.json` | Config completa do bot | Backup em `.bak` |
| Host: `/home/will/zappro-lite/config.yaml` | Config LiteLLM (bind mount RO) | Restart para aplicar |
| Coolify: `/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/.env` | Env vars | Coolify sobrescreve no deploy |
| Coolify: `.../docker-compose.yml` | Compose do servico | Coolify gerencia |

---

## Debug: Bot Nao Responde

### Passo 1: Verificar logs

```bash
docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f --tail 30
```

**O que procurar:**
- `[gateway] agent model: minimax/MiniMax-M2.7` — modelo correto
- `[telegram] [default] starting provider` — Telegram ativo
- `clients=0` — normal se nenhum UI conectado (bot usa embedded agent)
- `telegram inbound:` — mensagem chegou do Telegram
- `embedded run start:` — agent comecou a processar

### Passo 2: Verificar erros comuns

| Erro | Causa | Fix |
|---|---|---|
| `No API provider registered for api: undefined` | Provider sem campo `api` | Modelo primario DEVE ser `minimax/MiniMax-M2.7` (nao liteLLM/) |
| `Unhandled promise rejection` | Crash no agent loop | Ver erro completo no log detalhado |
| `401 Unauthorized` | API key invalida | Verificar key do MiniMax no openclaw.json |
| `connection refused 10.0.1.1:4000` | LiteLLM down | `docker restart zappro-litellm` |
| Telegram nao conecta | Token invalido | Verificar `channels.telegram.botToken` |

### Passo 3: Log detalhado

```bash
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f cat /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | \
  grep -E "error|Error|inbound|embedded|provider|api" | tail -50
```

### Passo 4: Verificar config

```bash
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f cat /data/.openclaw/openclaw.json | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
p = d['models']['providers']['minimax']
m = d['agents']['defaults']['model']
t = d['messages']['tts']
print(f'Primary: {m[\"primary\"]}')
print(f'Image: {d[\"agents\"][\"defaults\"].get(\"imageModel\",{}).get(\"primary\",\"N/A\")}')
print(f'Minimax api: {p.get(\"api\",\"FALTANDO!\")}')
print(f'Minimax baseUrl: {p[\"baseUrl\"]}')
print(f'Minimax models: {[x[\"id\"] for x in p[\"models\"]]}')
print(f'TTS baseUrl: {t[\"openai\"].get(\"baseUrl\",\"FALTANDO!\")}')
print(f'TTS model: {t[\"openai\"][\"model\"]}')
print(f'TTS voice: {t[\"openai\"][\"voice\"]}')
"
```

**Saida esperada:**
```
Primary: minimax/MiniMax-M2.7
Image: litellm/qwen2.5-vl (com providers: {"litellm/qwen2.5-vl": {"provider": "liteLLM"}})
Minimax api: anthropic-messages
Minimax baseUrl: https://api.minimax.io/anthropic
Minimax models: ['MiniMax-M2.1', 'MiniMax-M2.7']
TTS baseUrl: http://10.0.19.6:8880/v1
TTS model: kokoro
TTS voice: pm_santa
liteLLM models: ['minimax-m2.7', 'qwen2.5-vl']
```

### Passo 5: Testar MiniMax direto

```bash
curl -s -X POST "https://api.minimax.io/anthropic/v1/messages" \
  -H "x-api-key: $(docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f \
    cat /data/.openclaw/openclaw.json | python3 -c \
    'import sys,json; print(json.load(sys.stdin)["models"]["providers"]["minimax"]["apiKey"])')" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"MiniMax-M2.7","max_tokens":20,"messages":[{"role":"user","content":"ola"}]}'
```

### Passo 6: Testar Kokoro TTS

```bash
curl -s http://10.0.19.6:8880/v1/audio/speech -X POST \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"teste de voz","voice":"pm_santa"}' \
  -o /tmp/test.mp3 -w "%{http_code}"
# Esperado: 200
```

### Passo 7: Testar LLaVA (visao)

```bash
# Teste direto LiteLLM
curl -s -H "Authorization: Bearer [LITELLM_API_KEY]" \
  http://10.0.1.1:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5-vl","messages":[{"role":"user","content":[{"type":"text","text":"Hello"},{"type":"image_url","image_url":{"url":"https://picsum.photos/100"}}]}]}'
# Esperado: resposta em portugues com descricao da imagem
```

### Passo 8: Verificar qwen2.5-vl no openclaw.json

```bash
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f cat /data/.openclaw/openclaw.json | python3 -c "
import sys,json
d = json.load(sys.stdin)
img = d['agents']['defaults'].get('imageModel',{})
print('imageModel primary:', img.get('primary'))
print('imageModel providers:', json.dumps(img.get('providers',{})))
qwen_in_litellm = any(m['id']=='qwen2.5-vl' for m in d['models']['providers']['liteLLM']['models'])
print('qwen2.5-vl in liteLLM models:', qwen_in_litellm)
"

---

## Restart Seguro

```bash
# 1. Restart gateway (aplica mudancas no openclaw.json)
docker restart openclaw-qgtzrmi6771lt8l7x8rqx72f

# 2. Restart LiteLLM (aplica mudancas no config.yaml)
docker restart zappro-litellm

# 3. Verificar health apos restart
sleep 10
docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f --tail 10
curl -s http://10.0.1.1:4000/health
```

---

## Armadilhas Conhecidas

1. **Coolify .env sobrescreve:** O Coolify reseta variaveis de ambiente a cada deploy.
   `OPENCLAW_PRIMARY_MODEL` no .env NAO e confiavel. A config real esta em
   `/data/.openclaw/openclaw.json` dentro do volume persistente.

2. **LiteLLM + Anthropic endpoint:** O LiteLLM NAO roteia corretamente via
   `/v1/messages` (Anthropic format). So funciona via `/v1/chat/completions`
   (OpenAI format). Por isso o OpenClaw NAO deve usar LiteLLM como provider
   primario.

3. **Provider minimax so tinha M2.1:** O modelo M2.7 precisou ser adicionado
   manualmente ao array `models[]` do provider minimax.

4. **TTS baseUrl:** O campo `messages.tts.openai.baseUrl` NAO e aceito pela
   validacao CLI (`openclaw config set`). Deve ser editado diretamente no JSON.

5. **Docker doctor:** A cada restart, o OpenClaw roda `doctor` que pode resetar
   configs. O volume persistente (`qgtzrmi6771lt8l7x8rqx72f_openclaw-data`)
   mantem o openclaw.json entre restarts.

6. **LLaVA image model crash (2026-04-07 FIXADO) [DEPRECATED - agora qwen2.5-vl]:** O modelo `litellm/llava`
  必须有 provider correto em `imageModel.providers`. O fix:
   ```json
   "imageModel": {
     "primary": "litellm/llava",
     "providers": {"litellm/llava": {"provider": "liteLLM"}}
   }
   ```
   Alem disso, `llava` deve constar em `models[].id` do provider liteLLM.

---

## Historico de Incidentes

### 2026-04-07: LLaVA vision crash [DEPRECATED - agora qwen2.5-vl] "Unknown model: litellm/llava"
- **Sintoma:** OpenClaw acusava `Unknown model: litellm/llava` ao processar imagens
- **Causa raiz:** `imageModel.providers` estava vazio `{}` e `llava` nao constava
  no array `models[]` do provider liteLLM
- **Fix:** Adicionou `llava` ao models[] do liteLLM e configurou provider map:
  ```json
  "imageModel": {
    "primary": "litellm/llava",
    "providers": {"litellm/llava": {"provider": "liteLLM"}}
  }
  ```
- **Prevencao:** Documentacao atualizada + backup em `/data/.openclaw/openclaw.json.bak`

### 2026-04-05: Bot nao respondia mensagens
- **Sintoma:** Telegram conectava, mensagens chegavam, mas nenhuma resposta
- **Causa raiz:** `agents.defaults.model.primary` era `liteLLM/minimax-m2.7`.
  O provider LiteLLM nao tinha campo `api`, causando crash:
  `Error: No API provider registered for api: undefined`
- **Fix:** Mudou primario para `minimax/MiniMax-M2.7` (direto).
  Adicionou M2.7 ao provider minimax. Definiu `api: anthropic-messages`.
- **Prevencao:** Esta documentacao + rule em `~/.claude/rules/`

---

**Referencia:** `~/.claude/rules/openclaw-litellm-governance.md` (rule para LLMs)
