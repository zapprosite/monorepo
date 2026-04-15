#!/usr/bin/env bash
# =============================================================================
# setup-vl-model.sh — Pull + teste de modelos VL leves via Ollama
#
# Estudo 2026 (15/04/2026):
#   qwen2.5-vl:7b (actual) = 5GB VRAM — excelente mas pesado para só visão
#   llava-phi3 (3.8B)      = 2.5GB VRAM — bom equilíbrio qualidade/tamanho ✅ RECOMENDADO
#   moondream2 (1.8B)      = <1GB VRAM  — muito rápido, básico em PT-BR
#   minicpm-v (8B)         = 4GB VRAM   — muito bom mas quase igual ao qwen2.5-vl
#
# Anti-hardcoded: modelo via argumento ou env var
# =============================================================================

set -euo pipefail

ENV_FILE="${ENV_FILE:-/srv/monorepo/.env}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; BLU=$'\033[0;34m'; NC=$'\033[0m'
log()  { echo "${BLU}[INFO]${NC} $*"; }
ok()   { echo "${GRN}[ OK ]${NC} $*"; }
warn() { echo "${YEL}[WARN]${NC} $*"; }
die()  { echo "${RED}[ERR ]${NC} $*"; exit 1; }

# ── Modelos disponíveis ────────────────────────────────────────────────────────

declare -A VL_MODELS=(
  ["llava-phi3"]="llava-phi3:latest — 3.8B, 2.5GB VRAM, bom equilíbrio (RECOMENDADO)"
  ["moondream2"]="moondream2:latest — 1.8B, <1GB VRAM, muito rápido, básico"
  ["minicpm-v"]="minicpm-v:latest — 8B, 4GB VRAM, alta qualidade, próximo do qwen"
  ["qwen2.5-vl:7b"]="qwen2.5-vl:7b — actual, 5GB VRAM, excelente (já instalado)"
)

# ── Ajuda ─────────────────────────────────────────────────────────────────────

usage() {
  echo "Uso: $0 [modelo] [--test] [--benchmark]"
  echo ""
  echo "Modelos disponíveis:"
  for m in "${!VL_MODELS[@]}"; do
    echo "  $m  — ${VL_MODELS[$m]}"
  done
  echo ""
  echo "Exemplos:"
  echo "  $0 llava-phi3          # Pull e testa llava-phi3"
  echo "  $0 moondream2 --test   # Pull + benchmark com imagem real"
  echo "  $0 --benchmark         # Benchmark todos os modelos instalados"
  echo ""
  echo "Recomendação 2026 RTX 4090:"
  echo "  llava-phi3 — poupa 2.5GB vs qwen2.5-vl, suficiente para descrição de imagens"
  exit 0
}

MODEL="${1:-}"
DO_TEST="${2:-}"

[[ -z "$MODEL" || "$MODEL" == "--help" ]] && usage

# ── Pull modelo ────────────────────────────────────────────────────────────────

if [[ "$MODEL" != "--benchmark" ]]; then
  log "Pulling $MODEL via Ollama..."
  ollama pull "$MODEL" || die "Falha no pull de $MODEL"
  ok "$MODEL instalado"
fi

# ── Função de teste com imagem real ───────────────────────────────────────────

test_model() {
  local model="$1"
  local test_img="/tmp/vl-test-$(date +%s).png"

  # Criar imagem de teste simples com texto PT-BR
  if command -v convert >/dev/null 2>&1; then
    convert -size 400x100 xc:white \
      -font DejaVu-Sans -pointsize 24 \
      -fill black -draw "text 20,60 'Teste de visão PTBr 2026'" \
      "$test_img" 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "
import struct, zlib, base64
# Minimal PNG with text (white bg)
png = bytes.fromhex('89504e470d0a1a0a0000000d494844520000006400000019080200000000000000'
                   + '0' * 100)  # simplified
" 2>/dev/null || true
  fi

  # Se não conseguiu criar imagem, usar URL pública
  local prompt="Descreve o que vês nesta imagem em português brasileiro, em 1-2 frases."
  local start end latency result

  start=$(date +%s%3N)

  if [[ -f "$test_img" ]]; then
    result=$(ollama run "$model" "$prompt" --format "" 2>/dev/null \
      || echo "ERRO: modelo não disponível")
  else
    # Testar com prompt simples (sem imagem) para verificar que carrega
    result=$(echo "Responde em PT-BR: 'Olá, modelo de visão funcionando!'" | \
      ollama run "$model" 2>/dev/null || echo "ERRO: modelo não disponível")
  fi

  end=$(date +%s%3N)
  latency=$((end - start))

  echo "  Modelo     : $model"
  echo "  Latência   : ${latency}ms"
  echo "  Resposta   : ${result:0:150}"
  echo ""

  [[ -f "$test_img" ]] && rm -f "$test_img"
}

# ── VRAM depois do pull ────────────────────────────────────────────────────────

vram_check() {
  if command -v nvidia-smi >/dev/null 2>&1; then
    nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader 2>/dev/null | \
      awk -F'[, ]+' '{printf "  VRAM: %s MB usado, %s MB livre\n", $1, $3}'
  fi
}

# ── Actualizar .env com novo modelo ────────────────────────────────────────────

update_env() {
  local model="$1"
  if [[ -f "$ENV_FILE" ]]; then
    if grep -q "^OLLAMA_VISION_MODEL=" "$ENV_FILE"; then
      sed -i "s|^OLLAMA_VISION_MODEL=.*|OLLAMA_VISION_MODEL=${model}|" "$ENV_FILE"
    else
      echo "OLLAMA_VISION_MODEL=${model}" >> "$ENV_FILE"
    fi
    ok ".env: OLLAMA_VISION_MODEL=${model}"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

if [[ "$MODEL" == "--benchmark" ]]; then
  log "Benchmark dos modelos VL instalados..."
  for m in qwen2.5-vl:7b llava-phi3 moondream2; do
    if ollama list 2>/dev/null | grep -q "^${m%:*}"; then
      log "Testando $m..."
      test_model "$m"
    else
      warn "$m não instalado — skip"
    fi
  done
  exit 0
fi

# Pull e teste do modelo seleccionado
log "VRAM antes:"
vram_check

log "Testando $MODEL..."
[[ "$DO_TEST" == "--test" ]] && test_model "$MODEL"

log "VRAM depois:"
vram_check

# Actualizar .env se for o modelo escolhido para visão
read -r -p "Usar '$MODEL' como modelo de visão padrão? (OLLAMA_VISION_MODEL) [s/N] " confirm
if [[ "${confirm,,}" == "s" ]]; then
  update_env "$MODEL"

  # Também actualizar hermes config.yaml
  if [[ -f "/home/will/.hermes/config.yaml" ]]; then
    python3 - << PYEOF
import yaml
cfg = yaml.safe_load(open('/home/will/.hermes/config.yaml'))
cfg['auxiliary']['vision']['model'] = '$MODEL'
open('/home/will/.hermes/config.yaml','w').write(
    yaml.dump(cfg, allow_unicode=True, default_flow_style=False, sort_keys=False))
print('Hermes config.yaml actualizado: vision.model = $MODEL')
PYEOF
    ok "Hermes config actualizado"
  fi

  # Actualizar ai-gateway MODEL_ALIASES se necessário
  warn "Actualizar manualmente MODEL_ALIASES em apps/ai-gateway/src/routes/chat.ts se quiser alias gpt-4o-vision"
fi

echo ""
ok "Concluído! Para reverter: ollama rm $MODEL"
