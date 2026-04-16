#!/usr/bin/env python3
"""
faster-whisper OpenAI-compatible STT server
Supports multipart/form-data (OpenAI API) and raw PCM/WAV bytes.
"""
import os, sys, json, tempfile, subprocess, logging, re
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger('whisper-medium')

PORT = 8204
MODEL = 'Systran/faster-whisper-medium'
DEVICE = 'cuda'
COMPUTE = 'float16'
CACHE_DIR = os.path.expanduser('~/.cache/huggingface/hub')
LANGUAGE = 'pt'
SAMPLE_RATE = 16000

os.environ['LD_LIBRARY_PATH'] = '/usr/local/lib/ollama/cuda_v12:' + os.environ.get('LD_LIBRARY_PATH', '')

from faster_whisper import WhisperModel
logger.info(f'Loading {MODEL}...')
model = WhisperModel(MODEL, device=DEVICE, compute_type=COMPUTE, download_root=CACHE_DIR)
logger.info('Model loaded OK')


def parse_multipart(body, boundary):
    """Parse multipart/form-data and extract the file content."""
    boundary_bytes = boundary.encode() if isinstance(boundary, str) else boundary
    parts = body.split(b'--' + boundary_bytes)
    for part in parts:
        if b'Content-Disposition: form-data' not in part:
            continue
        if b'filename=' not in part:
            continue
        # Extract content after headers (double CRLF)
        header_end = part.find(b'\r\n\r\n')
        if header_end == -1:
            continue
        content = part[header_end + 4:]
        # Strip trailing CRLF and boundary
        content = content.rstrip(b'\r\n')
        return content
    return None


def convert_to_wav(audio_data, is_wav=False):
    """Convert audio to WAV 16kHz mono using ffmpeg."""
    fd_in = tempfile.NamedTemporaryFile(suffix='.bin', delete=False)
    fd_in.write(audio_data)
    fd_in.flush()
    fd_in.close()

    fd_out = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    fd_out.close()
    wav_path = fd_out.name

    try:
        # Detect input format
        if is_wav:
            input_format = 'wav'
        else:
            input_format = 's16le'

        cmd = [
            'ffmpeg', '-y',
            '-f', input_format,
            '-ar', str(SAMPLE_RATE),
            '-ac', '1',
            '-i', fd_in.name,
            '-ar', str(SAMPLE_RATE),
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            wav_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            # Try as generic format with auto-detection
            cmd = [
                'ffmpeg', '-y',
                '-i', fd_in.name,
                '-ar', str(SAMPLE_RATE),
                '-ac', '1',
                '-c:a', 'pcm_s16le',
                wav_path
            ]
            subprocess.run(cmd, capture_output=True, timeout=60)
    finally:
        try:
            os.unlink(fd_in.name)
        except:
            pass

    return wav_path


def transcribe(wav_path):
    """Run faster-whisper transcription."""
    segs, info = model.transcribe(wav_path, language=LANGUAGE, vad_filter=True, beam_size=5)
    txt = ' '.join(s.text.strip() for s in segs if s.text.strip())
    return txt


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        logger.info(fmt % args)

    def do_GET(self):
        if self.path in ('/health', '/v1/health'):
            self._json(200, {'status': 'ok', 'model': MODEL})
        elif self.path == '/v1/models':
            self._json(200, {
                'object': 'list',
                'data': [{'id': 'whisper-1', 'object': 'model', 'owned_by': 'faster-whisper'}]
            })
        else:
            self._json(404, {'error': 'not found'})

    def do_POST(self):
        if self.path == '/v1/audio/transcriptions':
            self._handle()
        else:
            self._json(404, {'error': 'not found'})

    def _handle(self):
        content_type = self.headers.get('Content-Type', '')
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b''
        wav_path = None

        try:
            audio_data = None
            is_wav = False

            if 'multipart/form-data' in content_type:
                # Extract boundary
                boundary = None
                for part in content_type.split(';'):
                    part = part.strip()
                    if part.startswith('boundary='):
                        boundary = part[9:].strip('"')
                        break
                if boundary:
                    audio_data = parse_multipart(body, boundary)
                if audio_data is None:
                    self._json(400, {'error': 'Could not parse audio from multipart'})
                    return
            elif 'audio/' in content_type or 'application/octet-stream' in content_type:
                # Raw audio bytes
                audio_data = body
                if content_type == 'audio/wav' or content_type == 'audio/x-wav':
                    is_wav = True
            else:
                # Try as raw PCM s16le
                audio_data = body

            if not audio_data:
                self._json(400, {'error': 'No audio data found'})
                return

            wav_path = convert_to_wav(audio_data, is_wav=is_wav)
            txt = transcribe(wav_path)
            self._json(200, {'text': txt})

        except Exception as e:
            logger.error(f'transcribe err: {e}')
            self._json(500, {'error': str(e)})
        finally:
            if wav_path and os.path.exists(wav_path):
                try:
                    os.unlink(wav_path)
                except:
                    pass

    def _json(self, code, obj):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode())


if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), H)
    logger.info(f'whisper-server v2 STARTED on port {PORT}')
    server.serve_forever()
