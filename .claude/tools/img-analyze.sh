#!/usr/bin/env bash
#
# img-analyze.sh — Analisa imagem com LLaVA local via Ollama
# Uso: ./img-analyze.sh <caminho-da-imagem> [prompt-opcional]
#
set -euo pipefail

IMAGE_PATH="${1:-}"
PROMPT="${2:-Descreva esta imagem em português brasileiro. Seja conciso, máximo 2 frases.}"

if [ -z "$IMAGE_PATH" ]; then
    echo "Usage: $0 <image-path> [prompt]"
    exit 1
fi

if [ ! -f "$IMAGE_PATH" ]; then
    echo "Erro: ficheiro não encontrado: $IMAGE_PATH"
    exit 1
fi

# Verificar Ollama
if ! curl -s --max-time 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "Erro: Ollama não está acessível em localhost:11434"
    exit 1
fi

# Verificar LLaVA
if ! curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; 'llava' in str(json.load(sys.stdin)['models'])" 2>/dev/null; then
    echo "Erro: modelo llava não está disponível"
    exit 1
fi

# Ficheiros temp
PAYLOAD_FILE=$(mktemp /tmp/llava-payload-XXXXXX.json)
RESPONSE_FILE=$(mktemp /tmp/llava-response-XXXXXX.json)
trap "rm -f $PAYLOAD_FILE $RESPONSE_FILE" EXIT

# Criar payload via Python (evita arg list too long para imagens grandes)
python3 - "$IMAGE_PATH" "$PROMPT" "$PAYLOAD_FILE" << 'PYEOF'
import json, sys, base64, os

image_path = sys.argv[1]
prompt = sys.argv[2]
payload_file = sys.argv[3]

with open(image_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('utf-8')

payload = {
    'model': 'llava',
    'prompt': prompt,
    'images': [img_b64],
    'stream': False
}

with open(payload_file, 'w') as f:
    json.dump(payload, f)
PYEOF

# Chamar LLaVA
curl -s --max-time 90 -X POST http://localhost:11434/api/generate \
    -H "Content-Type: application/json" \
    -d "@$PAYLOAD_FILE" > "$RESPONSE_FILE"

# Extrair resposta
RESULT=$(python3 - "$RESPONSE_FILE" << 'PYEOF2'
import sys, json
try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
    print(d.get('response', 'Sem resposta'))
except Exception as e:
    print(f'Erro: {e}')
PYEOF2
)

echo "$RESULT"
