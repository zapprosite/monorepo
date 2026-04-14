# Skill: LiteLLM Usage Guide

**Purpose:** Usar os modelos LiteLLM via CLI (TTS, STT, Vision, LLM)
**Complexity:** Low
**Risk:** Read-only (testes) / Modifies only temp files
**When to Use:** Testar vozes Kokoro, transcrição, visão, ou LLMs sem Telegram

## Pré-requisitos

```bash
# Exportar credenciais
export LITELLM_KEY="[LITELLM_API_KEY]"
export LITELLM_URL="${LITELLM_URL:-http://localhost:4000}"
```

---

## TTS — Text-to-Speech (Kokoro)

### Síntese básica

```bash
curl -s -X POST "$LITELLM_URL/v1/audio/speech" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","input":"Olá, como vai você?","voice":"pm_santa"}' \
  -o /tmp/test_tts.mp3

# Verificar resultado
ls -lh /tmp/test_tts.mp3
file /tmp/test_tts.mp3
```

### Vozes disponíveis

| Voice ID | Descrição | Exemplo |
|----------|-----------|---------|
| `pm_santa` | Male, deep | "Smoke test successful" |
| `pm_alex` | Male, neutral | "Olá, como vai você?" |
| `pf_dora` | Female, PT-BR | "Smoke test female voice" |
| `pf_sarah` | Female, neutral | — |

### Gerar WAV em vez de MP3

Kokoro output é sempre MP3. Para WAV, usar ffmpeg:

```bash
ffmpeg -i /tmp/test_tts.mp3 -acodec pcm_s16le /tmp/test_tts.wav 2>/dev/null
```

---

## STT — Speech-to-Text (wav2vec2)

### Transcrição via LiteLLM

```bash
curl -s -X POST "$LITELLM_URL/v1/audio/transcriptions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -F "file=@/tmp/test_tts.mp3" \
  -F "model=whisper-1" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('text','FAIL'))"
```

### Transcrição direta (sem LiteLLM)

```bash
# wav2vec2 está no container zappro-wav2vec2, porta 8201/8202
curl -s -X POST http://localhost:8202/v1/audio/transcriptions \
  -F "file=@/tmp/test_tts.mp3" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('text','FAIL'))"
```

---

## Vision — qwen2.5-vl

### Pergunta simples (sem imagem)

```bash
RESP=$(curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5-vl","messages":[{"role":"user","content":[{"type":"text","text":"Say only: OK"}]}],"max_tokens":10}')

echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])"
```

### Com imagem (base64)

```bash
# Codificar imagem
IMG_DATA=$(base64 -w0 /tmp/smoke_img.jpg 2>/dev/null)

# Enviar para visão
RESP=$(curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"qwen2.5-vl\",\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"Describe this image in one word.\"},{\"type\":\"image_url\",\"image_url\":{\"url\":\"data:image/jpeg;base64,$IMG_DATA\"}}]}],"max_tokens":20}")

echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])"
unset IMG_DATA  # limpar da memória
```

---

## LLM — Tom Cat 8B (PT-BR)

```bash
RESP=$(curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"tom-cat-8b","messages":[{"role":"user","content":"Olá! Como você está? Responda em uma palavra."}],"max_tokens":50}')

echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])"
```

---

## Todos os modelos disponíveis

```bash
curl -s -H "Authorization: Bearer $LITELLM_KEY" "$LITELLM_URL/v1/models" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(m['id']) for m in d.get('data',[])]"
```

**Output atual:**
```
tts-1
whisper-1
qwen2.5-vl
tom-cat-8b
embedding-nomic
```

---

## Telegram — Enviar Audio/Voz

**Bot Token:** `[TELEGRAM_BOT_TOKEN]`

```bash
TELEGRAM_BOT_TOKEN="[TELEGRAM_BOT_TOKEN]"
TEST_CHAT_ID="${TEST_CHAT_ID:?TEST_CHAT_ID not set}"

# Enviar audio
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendVoice" \
  -F "chat_id=$TEST_CHAT_ID" \
  -F "voice=@/tmp/test_tts.mp3" \
  -F "caption=Teste de voz" | grep -q '"ok":true' && echo "✅ Enviado" || echo "❌ Falhou"

# Enviar foto
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendPhoto" \
  -F "chat_id=$TEST_CHAT_ID" \
  -F "photo=https://picsum.photos/200" \
  -F "caption=Vision test" | grep -q '"ok":true' && echo "✅ Enviado" || echo "❌ Falhou"

# Enviar mensagem
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -F "chat_id=$TEST_CHAT_ID" \
  -F "text=Smoke test via CLI" | grep -q '"ok":true' && echo "✅ Enviado" || echo "❌ Falhou"
```

### Obter Chat ID

Se não sabes o teu `TEST_CHAT_ID`, envia uma mensagem ao bot e depois:

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(u['message']['chat']['id'], u['message']['chat']['first_name']) for u in d.get('result',[])]"
```

---

## LiteLLM — Health Check Rápido

```bash
# Health
curl -sf -m 5 http://localhost:4000/health 2>&1 | head -3

# Models disponíveis
curl -s -H "Authorization: Bearer $LITELLM_KEY" http://localhost:4000/v1/models \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(m['id']) for m in d.get('data',[])]"
```

---

## Rede — LiteLLM ↔ Container

O LiteLLM (`zappro-litellm`) está na network `zappro-lite_default` e alcança:

| Serviço | Host interno | Porta | Rota LiteLLM |
|---------|-------------|-------|-------------|
| wav2vec2 STT | `wav2vec2` | 8201 | `whisper-1` |
| Kokoro TTS | `10.0.2.4` | 8880 | `tts-1` |
| Ollama (VL/LLM) | `10.0.1.1` | 11434 | `qwen2.5-vl`, `tom-cat-8b` |

Para testar conectividade interna:

```bash
# Do container LiteLLM para wav2vec2
docker exec zappro-litellm curl -sf http://wav2vec2:8201/health

# Do container LiteLLM para Ollama
docker exec zappro-litellm curl -sf http://10.0.1.1:11434/api/tags
```

---

## See Also

- `litellm-health-check.md` — Health check detalhado do LiteLLM
- `kokoro-health-check.md` — Kokoro TTS standalone
- `wav2vec2-health-check.md` — wav2vec2 STT standalone
- `pipeline-openclaw-voice.sh` — Smoke test completo (referência)
