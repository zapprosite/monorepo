#!/usr/bin/env python3
"""
Voice API — STT Bridge for Hermes Agent
=====================================
Proxies audio transcription requests to local whisper-api (wav2vec2).
Supports Ollama PT-BR enhancement for better transcription quality.

Usage:
    python3 voice-api.py

Environment:
    PORT=8202
    WHISPER_API=http://10.0.19.1:8202
    OLLAMA_HOST=http://10.0.19.1:11434
    OLLAMA_MODEL=Gemma4-12b-it
"""

import os
import sys
import json
import subprocess
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs
import urllib.request
import urllib.error

# Config from env
PORT = int(os.environ.get("PORT", "8202"))
WHISPER_API = os.environ.get("WHISPER_API", "http://10.0.19.1:8202")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://10.0.19.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "Gemma4-12b-it")
TIMEOUT = 60


class VoiceAPIHandler(BaseHTTPRequestHandler):
    """HTTP handler that proxies audio to whisper-api for STT."""

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass

    def send_json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def send_error_json(self, code, message):
        self.send_json(code, {"error": {"type": "invalid_request_error", "message": message}})

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "service": "voice-api"})
            return
        if self.path == "/v1/models":
            self.send_json(200, {
                "data": [{"id": "wav2vec2"}, {"id": "whisper-small"}],
                "whisper_api": WHISPER_API,
                "ollama_host": OLLAMA_HOST
            })
            return
        self.send_error_json(404, "Not found")

    def do_POST(self):
        if self.path == "/v1/audio/transcriptions":
            self.handle_transcription()
            return
        if self.path == "/v1/transcriptions":
            self.handle_transcription()
            return
        self.send_error_json(404, "Not found")

    def handle_transcription(self):
        """Handle multipart audio transcription request."""
        content_type = self.headers.get("Content-Type", "")
        if "multipart" not in content_type:
            self.send_error_json(400, "Content-Type must be multipart/form-data")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self.send_error_json(400, "Empty request body")
            return
        if content_length > 20 * 1024 * 1024:  # 20MB max
            self.send_error_json(413, "File too large (max 20MB)")
            return

        # Parse multipart form data manually
        try:
            body = self.rfile.read(content_length)
            audio_data, filename = self.parse_multipart(body, content_type)
        except Exception as e:
            self.send_error_json(400, f"Failed to parse audio: {e}")
            return

        if not audio_data:
            self.send_error_json(400, "No audio file in request")
            return

        # Convert to WAV 16kHz mono if needed
        wav_data = self.convert_to_wav(audio_data, filename)
        if not wav_data:
            self.send_error_json(400, "Failed to convert audio to WAV 16kHz mono")
            return

        # Save to temp file for whisper-api
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_data)
            wav_path = f.name

        try:
            # Call whisper-api
            transcript, lang, duration = self.call_whisper_api(wav_path)
        finally:
            os.unlink(wav_path)

        # Optionally enhance with Ollama PT-BR
        enhanced = None
        if transcript and transcript != "[silêncio]":
            enhanced = self.enhance_with_ollama(transcript)

        response = {
            "text": enhanced if enhanced else transcript,
            "language": lang or "pt",
            "duration": duration or 0.0
        }
        if enhanced:
            response["enhanced"] = True
        self.send_json(200, response)

    def parse_multipart(self, body, content_type):
        """Parse multipart form data to extract audio file."""
        # Simple multipart parser
        boundary = None
        for part in content_type.split(";"):
            part = part.strip()
            if part.startswith("boundary="):
                boundary = part[9:].strip('"')
        if not boundary:
            return None, None

        # Find audio file part
        parts = body.split(("--" + boundary).encode())
        audio_data = None
        filename = "audio.wav"

        for part in parts:
            if b"form-data" not in part:
                continue
            # Extract filename if present
            lines = part.split(b"\r\n")
            for i, line in enumerate(lines):
                if b"filename=" in line:
                    fname = line.decode("utf-8", errors="ignore")
                    fname = fname.split("filename=")[1].strip('" ')
                    filename = fname.split("/")[-1].split("\\")[-1]
                if b"Content-Type:" in line and i + 1 < len(lines):
                    # Next line is content
                    audio_data = b"\r\n".join(lines[i+1:]).strip(b"\r\n")
                    break

        return audio_data, filename

    def convert_to_wav(self, audio_data, filename):
        """Convert audio to WAV 16kHz mono using ffmpeg."""
        # Save input to temp file
        suffix = ".mp3" if "mp3" in filename.lower() else ".ogg" if "ogg" in filename.lower() else ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_data)
            input_path = f.name

        try:
            # Convert to WAV 16kHz mono using ffmpeg
            output_path = input_path + ".wav"
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", input_path,
                 "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le",
                 output_path],
                capture_output=True, timeout=30
            )
            if result.returncode != 0:
                return None

            with open(output_path, "rb") as f:
                wav_data = f.read()
            os.unlink(output_path)
            return wav_data
        finally:
            os.unlink(input_path)

    def call_whisper_api(self, wav_path):
        """Call local whisper-api for transcription."""
        try:
            # Build multipart form request
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
        if not transcript or transcript == "[silêncio]":
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
                # Clean up response
                if enhanced.startswith("ENTENDI:"):
                    return enhanced
                elif enhanced:
                    return f"ENTENDI: {enhanced}"
                return None
        except Exception:
            return None


def main():
    print(f"Voice API starting on 0.0.0.0:{PORT}")
    print(f"Whisper API: {WHISPER_API}")
    print(f"Ollama: {OLLAMA_HOST} ({OLLAMA_MODEL})")
    sys.stdout.flush()

    server = HTTPServer(("0.0.0.0", PORT), VoiceAPIHandler)
    print(f"Listening on http://0.0.0.0:{PORT}")
    sys.stdout.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
