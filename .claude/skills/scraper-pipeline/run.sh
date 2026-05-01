#!/usr/bin/env bash
# scraper-pipeline.sh — Executa pipeline completo de scraping HVAC
# Uso: ./run.sh <brand> [max]
# Exemplo: ./run.sh lg 3
# Ambientes: lg, samsung, daikin, springer

set -euo pipefail

# === CONFIG ===
SCRAPER_DIR="/srv/hvacr-swarm/cmd/manual-scraper"
QDRANT_ENDPOINT="10.0.19.2:6333"
OLLAMA_ENDPOINT="http://localhost:11434"
OUTPUT_DIR="/srv/data/hvac-manuals"
CHROME_BIN="/usr/bin/google-chrome"

# === VALIDATE ===
BRAND="${1:-}"
MAX="${2:-3}"

if [[ -z "$BRAND" ]]; then
  echo "❌ Uso: $0 <brand> [max]"
  echo "   brands: lg, samsung, daikin, springer"
  exit 1
fi

VALID_BRANDS="lg samsung daikin springer"
if [[ ! "$VALID_BRANDS" == *"$BRAND"* ]]; then
  echo "❌ Brand inválido: $BRAND"
  echo "   Válidos: $VALID_BRANDS"
  exit 1
fi

# === PREREQUISITES ===
echo "🔍 Verificando pré-requisitos..."

# Chrome
if [[ ! -x "$CHROME_BIN" ]]; then
  echo "❌ Chrome não encontrado em $CHROME_BIN"
  exit 1
fi
echo "   ✅ Chrome: $($CHROME_BIN --version 2>/dev/null | cut -d' ' -f1-2)"

# Ollama
if curl -s --connect-timeout 5 "$OLLAMA_ENDPOINT/api/tags" > /dev/null 2>&1; then
  echo "   ✅ Ollama: $OLLAMA_ENDPOINT"
else
  echo "❌ Ollama não acessível em $OLLAMA_ENDPOINT"
  exit 1
fi

# Ollama model
if curl -s "$OLLAMA_ENDPOINT/api/tags" | python3 -c "import json,sys; models=[m['name'] for m in json.load(sys.stdin).get('models',[])]; print('OK' if 'nomic-embed-text' in models else 'MISSING')" 2>/dev/null | grep -q "OK"; then
  echo "   ✅ Embedding: nomic-embed-text"
else
  echo "⚠️  AVISO: nomic-embed-text não encontrado em Ollama"
fi

# Qdrant
QDRANT_RESP=$(curl -s --connect-timeout 5 "$QDRANT_ENDPOINT/collections/hvac_service_manuals" \
  -H "api-key: vmEbyCYrU68bR7lkzCbL05Ey4BPnTZgr" 2>/dev/null)
if echo "$QDRANT_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK')" 2>/dev/null | grep -q "OK"; then
  POINTS=$(echo "$QDRANT_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('result',{}).get('points_count',0))" 2>/dev/null)
  echo "   ✅ Qdrant: $QDRANT_ENDPOINT (collection: hvac_service_manuals, points: $POINTS)"
else
  echo "❌ Qdrant não acessível ou collection não existe: $QDRANT_ENDPOINT"
  exit 1
fi

# Chrome profile dir
PROFILE_DIR="/srv/data/hvac-manual-downloader/chrome-profiles/$BRAND"
if [[ -d "$PROFILE_DIR" ]]; then
  echo "   ✅ Chrome profile: $PROFILE_DIR"
else
  echo "⚠️  Chrome profile não existe: $PROFILE_DIR (será criado)"
fi

# Output dir
mkdir -p "$OUTPUT_DIR/$BRAND"
echo "   ✅ Output: $OUTPUT_DIR/$BRAND"

# === RUN ===
echo ""
echo "🚀 Iniciando pipeline: brand=$BRAND max=$MAX"
echo "=========================================="

cd "$SCRAPER_DIR"

CHROME_BIN="$CHROME_BIN" go run . \
  --pipeline="$BRAND" \
  --max="$MAX" \
  --verbose \
  --qdrant="$QDRANT_ENDPOINT" \
  --ollama="$OLLAMA_ENDPOINT" \
  --output="$OUTPUT_DIR"

EXIT_CODE=$?

# === RESULT ===
echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ Pipeline concluído com sucesso"

  # Count downloaded files
  FILES=$(find "$OUTPUT_DIR/$BRAND" -name "*.pdf" 2>/dev/null | wc -l)
  echo "   📄 PDFs baixados: $FILES"

  # Count Qdrant points after
  NEW_POINTS=$(curl -s "$QDRANT_ENDPOINT/collections/hvac_service_manuals" \
    -H "api-key: vmEbyCYrU68bR7lkzCbL05Ey4BPnTZgr" | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('result',{}).get('points_count',0))" 2>/dev/null)
  echo "   🔢 Qdrant points após: $NEW_POINTS"
else
  echo "❌ Pipeline falhou com código: $EXIT_CODE"
  exit $EXIT_CODE
fi
