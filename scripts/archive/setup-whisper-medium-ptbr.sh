#!/usr/bin/env bash
# =============================================================================
# setup-whisper-medium-ptbr.sh — Instala e serve whisper-medium PT-BR
#
# Modelo: jlondonobo/whisper-medium-pt (HuggingFace)
#         WER 6.6% PT-BR vs wav2vec2 ~12% — muito melhor em termos técnicos
#
# O que faz:
#   1. Instala faster-whisper + dependências CUDA
#   2. Download do modelo HuggingFace (cache em ~/.cache/huggingface/)
#   3. Inicia servidor OpenAI-compat em :8204 (nova porta, não conflita com :8201/:8202)
#   4. Regista no .env como STT_MEDIUM_URL
#
# Anti-hardcoded: tudo via .env / env vars
# Porta: 8204 (livre segundo PORTS.md)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-/srv/monorepo/.env}"
PORT="${WHISPER_MEDIUM_PORT:-8204}"
MODEL_ID="${WHISPER_MEDIUM_MODEL:-jlondonobo/whisper-medium-pt}"
CACHE_DIR="${HOME}/.cache/huggingface/hub"
LOGFILE="/tmp/whisper-medium-ptbr.log"

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; BLU=$'\033[0;34m'; NC=$'\033[0m'
log()  { echo "${BLU}[INFO]${NC} $*"; }
ok()   { echo "${GRN}[ OK ]${NC} $*"; }
warn() { echo "${YEL}[WARN]${NC} $*"; }
die()  { echo "${RED}[ERR ]${NC} $*"; exit 1; }

# ── Preflight ─────────────────────────────────────────────────────────────────

log "Whisper Medium PT-BR setup — modelo: $MODEL_ID — porta: $PORT"

command -v python3 >/dev/null || die "python3 não encontrado"
command -v pip3 >/dev/null || die "pip3 não encontrado"

# Verificar GPU disponível
if python3 -c "import torch; print(torch.cuda.is_available())" 2>/dev/null | grep -q "True"; then
  DEVICE="cuda"
  COMPUTE_TYPE="float16"
  ok "GPU CUDA disponível — usando float16"
else
  warn "GPU não disponível — usando CPU (mais lento)"
  DEVICE="cpu"
  COMPUTE_TYPE="int8"
fi

# ── Instalar dependências ─────────────────────────────────────────────────────

log "Instalando faster-whisper + transformers..."
pip3 install -q faster-whisper huggingface_hub 2>/dev/null || \
  pip install -q faster-whisper huggingface_hub

ok "Dependências instaladas"

# ── Download modelo ───────────────────────────────────────────────────────────

log "Download: $MODEL_ID (pode demorar ~1GB)..."

python3 - << PYEOF
from huggingface_hub import snapshot_download
import os

model_id = "$MODEL_ID"
cache_dir = "$CACHE_DIR"

try:
    path = snapshot_download(repo_id=model_id, cache_dir=cache_dir)
    print(f"Modelo em: {path}")
except Exception as e:
    print(f"Erro no download: {e}")
    raise
PYEOF

ok "Modelo descarregado"

# ── Criar servidor OpenAI-compat ─────────────────────────────────────────────

SERVER_SCRIPT="/tmp/whisper-medium-server.py"
cat > "$SERVER_SCRIPT" << 'PYEOF'
#!/usr/bin/env python3
"""
Whisper Medium PT-BR — OpenAI-compat STT server (:8204)
Modelo: jlondonobo/whisper-medium-pt (HuggingFace via faster-whisper)
Anti-hardcoded: modelo e porta via env vars
"""
import os, sys, json, tempfile, logging
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger('whisper-medium')

# Anti-hardcoded: tudo via env
PORT       = int(os.environ.get('WHISPER_MEDIUM_PORT', '8204'))
MODEL_ID   = os.environ.get('WHISPER_MEDIUM_MODEL', 'jlondonobo/whisper-medium-pt')
DEVICE     = os.environ.get('WHISPER_DEVICE', 'cuda')
COMPUTE    = os.environ.get('WHISPER_COMPUTE_TYPE', 'float16')
CACHE_DIR  = os.environ.get('HF_HOME', os.path.expanduser('~/.cache/huggingface/hub'))
LANGUAGE   = os.environ.get('WHISPER_LANGUAGE', 'pt')

logger.info(f"Loading {MODEL_ID} on {DEVICE} ({COMPUTE})...")
os.environ['LD_LIBRARY_PATH'] = '/usr/local/lib/ollama/cuda_v12:' + os.environ.get('LD_LIBRARY_PATH', '')

try:
    from faster_whisper import WhisperModel
    model = WhisperModel(MODEL_ID, device=DEVICE, compute_type=COMPUTE, download_root=CACHE_DIR)
    logger.info("Model loaded OK")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    sys.exit(1)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        logger.info(fmt % args)

    def do_GET(self):
        if self.path in ('/health', '/v1/health'):
            self._json(200, {'status': 'ok', 'model': MODEL_ID, 'device': DEVICE})
        elif self.path in ('/v1/models', '/models'):
            self._json(200, {'data': [{'id': 'whisper-medium-pt'}]})
        else:
            self._json(404, {'error': 'not found'})

    def do_POST(self):
        if self.path == '/v1/audio/transcriptions':
            self._handle_transcription()
        else:
            self._json(404, {'error': 'not found'})

    def _handle_transcription(self):
        content_type = self.headers.get('Content-Type', '')
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)

        # Extract file from multipart/form-data
        audio_bytes = self._extract_file(body, content_type)
        if not audio_bytes:
            self._json(400, {'error': 'no file in request'})
            return

        # Detect format and write to temp file
        ext = 'ogg' if 'ogg' in content_type else 'wav' if 'wav' in content_type else 'mp3'
        with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            segments, info = model.transcribe(
                tmp_path,
                language=LANGUAGE,
                vad_filter=True,
                beam_size=5,
            )
            text = ' '.join(s.text.strip() for s in segments if s.text.strip())
            logger.info(f"Transcribed {len(text)} chars, lang={info.language}")
            self._json(200, {'text': text})
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            self._json(500, {'error': str(e)})
        finally:
            os.unlink(tmp_path)

    def _extract_file(self, body: bytes, content_type: str) -> bytes:
        bm = None
        for part in content_type.split(';'):
            part = part.strip()
            if part.startswith('boundary='):
                bm = part[9:].strip('"\'')
                break
        if not bm:
            return body  # treat whole body as audio

        body_str = body.decode('latin1')
        sep = f'--{bm}'
        parts = body_str.split(sep)
        for part in parts:
            if 'name="file"' in part or 'audio/' in part:
                idx = part.find('\r\n\r\n')
                if idx != -1:
                    data = part[idx + 4:].rstrip('\r\n')
                    return data.encode('latin1')
        return body

    def _json(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    logger.info(f"Starting Whisper Medium PT-BR on :{PORT}")
    HTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
PYEOF

ok "Servidor criado em $SERVER_SCRIPT"

# ── Actualizar .env ───────────────────────────────────────────────────────────

if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^STT_MEDIUM_URL=" "$ENV_FILE"; then
    sed -i "s|^STT_MEDIUM_URL=.*|STT_MEDIUM_URL=http://localhost:${PORT}|" "$ENV_FILE"
  else
    echo "STT_MEDIUM_URL=http://localhost:${PORT}" >> "$ENV_FILE"
    echo "WHISPER_MEDIUM_PORT=${PORT}" >> "$ENV_FILE"
    echo "WHISPER_MEDIUM_MODEL=${MODEL_ID}" >> "$ENV_FILE"
  fi
  ok ".env actualizado (STT_MEDIUM_URL=http://localhost:${PORT})"
fi

# Actualizar .env.example
ENV_EXAMPLE="${SCRIPT_DIR}/../.env.example"
if [[ -f "$ENV_EXAMPLE" ]] && ! grep -q "STT_MEDIUM_URL" "$ENV_EXAMPLE"; then
  cat >> "$ENV_EXAMPLE" << 'ENVEOF'

# Whisper Medium PT-BR (SPEC-048 — setup-whisper-medium-ptbr.sh)
STT_MEDIUM_URL=http://localhost:8204
WHISPER_MEDIUM_PORT=8204
WHISPER_MEDIUM_MODEL=jlondonobo/whisper-medium-pt
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
ENVEOF
  ok ".env.example actualizado"
fi

# ── Iniciar servidor ──────────────────────────────────────────────────────────

# Verificar se já está a correr
if curl -s --max-time 2 "http://localhost:${PORT}/health" 2>/dev/null | grep -q "ok"; then
  ok "Servidor já em execução em :${PORT}"
  exit 0
fi

log "Iniciando servidor em :${PORT} (log: $LOGFILE)..."

WHISPER_MEDIUM_PORT="$PORT" \
WHISPER_MEDIUM_MODEL="$MODEL_ID" \
WHISPER_DEVICE="$DEVICE" \
WHISPER_COMPUTE_TYPE="$COMPUTE_TYPE" \
nohup python3 "$SERVER_SCRIPT" > "$LOGFILE" 2>&1 &

SERVER_PID=$!
echo "$SERVER_PID" > "/tmp/whisper-medium-ptbr.pid"
log "PID=$SERVER_PID"

# Aguardar arranque
for i in 1 2 3 4 5; do
  if curl -s --max-time 3 "http://localhost:${PORT}/health" 2>/dev/null | grep -q "ok"; then
    ok "Servidor arrancou em :${PORT}"
    break
  fi
  [[ $i -eq 5 ]] && warn "Servidor ainda a iniciar (modelo a carregar) — ver $LOGFILE"
done

echo ""
ok "Setup concluído!"
echo "  STT Medium URL : http://localhost:${PORT}"
echo "  Modelo         : ${MODEL_ID}"
echo "  Teste           : curl -F 'file=@audio.ogg' http://localhost:${PORT}/v1/audio/transcriptions"
echo "  Para usar no gateway: export STT_DIRECT_URL=http://localhost:${PORT}"
echo "  Log             : $LOGFILE"
