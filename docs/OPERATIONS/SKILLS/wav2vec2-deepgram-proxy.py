#!/usr/bin/env python3
"""
wav2vec2-Deepgram-Proxy — STT Bridge
=====================================
Makes local wav2vec2 (whisper-api) look like Deepgram API.
OpenClaw thinks it's calling Deepgram, but it's actually using local wav2vec2.

Usage:
    python3 wav2vec2-deepgram-proxy.py

Environment:
    PORT=8203
    WHISPER_API=http://10.0.19.8:8201  (wav2vec2 container via docker-proxy)
    OLLAMA_HOST=http://10.0.19.1:11434
    OLLAMA_MODEL=llama3-portuguese-tomcat-8b-instruct-q8:latest

API (Deepgram-compatible):
    POST /v1/listen?model=nova-3&language=pt-BR
    Authorization: Token ANYTHING
    Content-Type: audio/wav, audio/mp3, audio/ogg, etc.
    Body: binary audio

    Response (Deepgram format):
    {
      "results": {
        "channels": [{
          "alternatives": [{
            "transcript": "transcribed text",
            "confidence": 0.99,
            "words": []
          }]
        }]
      }
    }
"""

import os
import sys
import json
import subprocess
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error

# Config from env
PORT = int(os.environ.get("PORT", "8203"))
WHISPER_API = os.environ.get("WHISPER_API", "http://10.0.19.8:8201")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://10.0.19.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3-portuguese-tomcat-8b-instruct-q8:latest")
TIMEOUT = 60


class DeepgramProxyHandler(BaseHTTPRequestHandler):
    """HTTP handler that makes wav2vec2 look like Deepgram API."""

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass

    def send_json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "service": "wav2vec2-deepgram-proxy"})
            return
        if self.path == "/v1/listen":
            self.send_json(200, {"status": "ok"})
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path.startswith("/v1/listen"):
            self.handle_transcription()
            return
        self.send_json(404, {"error": "not found"})

    def handle_transcription(self):
        """Handle Deepgram-style transcription request."""
        # Extract query params (model, language)
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        model = query.get('model', ['nova-3'])[0]
        language = query.get('language', ['pt-BR'])[0]

        # Get content type
        content_type = self.headers.get("Content-Type", "audio/wav")

        # Check for chunked transfer encoding
        transfer_encoding = self.headers.get("Transfer-Encoding", "")

        # Read binary audio
        try:
            if transfer_encoding.lower() == "chunked":
                # Read chunked data
                audio_data = b""
                while True:
                    chunk_size_line = self.rfile.readline().decode('utf-8').strip()
                    if not chunk_size_line:
                        break
                    chunk_size = int(chunk_size_line, 16)
                    if chunk_size == 0:
                        break
                    chunk = self.rfile.read(chunk_size)
                    audio_data += chunk
                    self.rfile.readline()  # trailing \r\n
            else:
                # Read content length
                content_length = int(self.headers.get("Content-Length", 0))
                if content_length == 0:
                    self.send_json(400, {"error": {"message": "Empty request body"}})
                    return
                if content_length > 20 * 1024 * 1024:  # 20MB max
                    self.send_json(413, {"error": {"message": "File too large"}})
                    return
                audio_data = self.rfile.read(content_length)

        except Exception as e:
            self.send_json(400, {"error": {"message": f"Failed to read audio: {e}"}})
            return

        if not audio_data:
            self.send_json(400, {"error": {"message": "Empty audio data"}})
            return

        # Save to temp file
        suffix = ".wav"
        if "mp3" in content_type:
            suffix = ".mp3"
        elif "ogg" in content_type or "opus" in content_type:
            suffix = ".ogg"
        elif "m4a" in content_type:
            suffix = ".m4a"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_data)
            audio_path = f.name

        try:
            # Convert to WAV 16kHz mono if needed
            wav_path = self.convert_to_wav_16k(audio_path)
            if not wav_path:
                raise Exception("Conversion to WAV 16kHz failed")

            # Call whisper-api (wav2vec2)
            transcript, detected_lang, duration = self.call_whisper_api(wav_path)

            # Enhance with Ollama PT-BR
            enhanced = None
            if transcript and transcript not in ["[silêncio]", "[silence]", ""]:
                enhanced = self.enhance_with_ollama(transcript)

            final_text = enhanced if enhanced else transcript

            # Return Deepgram format
            response = {
                "results": {
                    "channels": [{
                        "alternatives": [{
                            "transcript": final_text,
                            "confidence": 0.99 if transcript else 0.0,
                            "words": []
                        }]
                    }]
                },
                "metadata": {
                    "transaction_key": "deprecated",
                    "request_id": "proxy-" + str(os.getpid()),
                    "sha256": "proxy",
                    "created": "2026-04-09T00:00:00.000Z",
                    "duration": duration or 0.0,
                    "channels": 1,
                    "models": [model],
                    "model_info": {}
                }
            }
            self.send_json(200, response)

        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json(500, {"error": {"message": str(e)}})
        finally:
            os.unlink(audio_path)
            if 'wav_path' in dir() and wav_path != audio_path:
                os.unlink(wav_path)

    def convert_to_wav_16k(self, audio_path):
        """Convert audio to WAV 16kHz mono using ffmpeg."""
        output_path = audio_path + ".wav"
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path,
             "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le",
             output_path],
            capture_output=True, timeout=30
        )
        if result.returncode != 0:
            # Try copying if conversion fails (assume it's already wav 16k)
            return audio_path
        return output_path

    def call_whisper_api(self, wav_path):
        """Call local whisper-api (wav2vec2) for transcription."""
        try:
            boundary = "----VoiceAPIFormBoundary7MA4YWxkTrZu0gW"
            with open(wav_path, "rb") as f:
                audio_bytes = f.read()

            body = (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n'
                f"Content-Type: audio/wav\r\n\r\n"
            ).encode() + audio_bytes + (
                f"\r\n--{boundary}\r\n"
                f'Content-Disposition: form-data; name="model"\r\n\r\n'
                f"wav2vec2\r\n--{boundary}\r\n"
                f'Content-Disposition: form-data; name="language"\r\n\r\n'
                f"pt-BR\r\n--{boundary}--\r\n"
            ).encode()

            req = urllib.request.Request(
                f"{WHISPER_API}/v1/audio/transcriptions",
                data=body,
                headers={
                    "Content-Type": f"multipart/form-data; boundary={boundary}",
                    "Accept": "application/json"
                },
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return (
                    result.get("text", "").strip(),
                    result.get("language", "pt"),
                    result.get("duration", 0.0)
                )
        except urllib.error.HTTPError as e:
            try:
                err = json.loads(e.read().decode("utf-8"))
            except Exception:
                err = {"error": str(e)}
            raise Exception(f"Whisper API error: {err}")
        except Exception as e:
            raise Exception(f"Whisper API call failed: {e}")

    def enhance_with_ollama(self, transcript):
        """Enhance transcript with Ollama PT-BR model."""
        if not transcript or transcript in ["[silêncio]", "[silence]", ""]:
            return None

        try:
            prompt = f"""Você é um assistente que analisa transcrições de áudio.

Transcrição: "{transcript}"

Instruções:
- SE a transcrição contém apenas ruído/silêncio/gibberish: responda 'ENTENDI: [breve descrição do áudio]'
- SE tem conteúdo legível em português: responda 'ENTENDI: [resumo breve do que foi dito]'
- SE está em outro idioma: responda 'ENTENDI: [tradução/resumo do conteúdo em português]'
- Mantenha a resposta muito curta (máx 1-2 linhas)"""

            req_body = json.dumps({
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 100}
            }).encode("utf-8")

            req = urllib.request.Request(
                f"{OLLAMA_HOST}/api/generate",
                data=req_body,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                enhanced = result.get("response", "").strip()
                if enhanced.startswith("ENTENDI:"):
                    return enhanced
                elif enhanced:
                    return f"ENTENDI: {enhanced}"
                return None
        except Exception:
            return None


def main():
    print(f"wav2vec2-Deepgram-Proxy starting on 0.0.0.0:{PORT}")
    print(f"Whisper API: {WHISPER_API}")
    print(f"Ollama: {OLLAMA_HOST} ({OLLAMA_MODEL})")
    print(f"Deepgram-compatible endpoint: POST /v1/listen?model=nova-3&language=pt-BR")
    sys.stdout.flush()

    server = HTTPServer(("0.0.0.0", PORT), DeepgramProxyHandler)
    print(f"Listening on http://0.0.0.0:{PORT}")
    sys.stdout.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
