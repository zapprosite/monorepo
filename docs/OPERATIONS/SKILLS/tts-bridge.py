#!/usr/bin/env python3
"""
TTS Bridge — Voice Filter for Kokoro TTS
=========================================
Restricts Kokoro TTS to only pm_santa and pf_dora voices.
Built with only stdlib (no external deps) for maximum compatibility.

Usage:
    python3 tts-bridge.py

Environment:
    PORT=8013
    KOKORO_URL=http://10.0.19.7:8880
"""

import os
import sys
import json
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

# Allowed voices — PT-BR natural voices only
ALLOWED_VOICES = ["pm_santa", "pf_dora"]

# Kokoro backend URL
KOKORO_URL = os.environ.get("KOKORO_URL", "http://10.0.19.7:8880")

# Port
PORT = int(os.environ.get("PORT", "8013"))

# Timeout for Kokoro requests
TIMEOUT = 30


class TTSBridgeHandler(BaseHTTPRequestHandler):
    """HTTP handler that validates voice before proxying to Kokoro."""

    def log_message(self, format, *args):
        """Suppress default logging to keep output clean."""
        pass

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = {"status": "ok", "service": "tts-bridge", "allowed_voices": ALLOWED_VOICES}
            self.wfile.write(json.dumps(resp).encode())
            return

        if self.path == "/v1/audio/voices":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = {"voices": ALLOWED_VOICES, "note": "Only PT-BR natural voices are available"}
            self.wfile.write(json.dumps(resp).encode())
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path != "/v1/audio/speech":
            self.send_response(404)
            self.end_headers()
            return

        # Read request body — enforce max size to prevent memory exhaustion
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self.send_error_json(400, "Empty request body")
            return
        if content_length > 65536:
            self.send_error_json(413, "Request body too large (max 64KB)")
            return

        try:
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_error_json(400, "Invalid JSON body")
            return

        voice = data.get("voice", "")
        model = data.get("model", "kokoro")

        # Validate voice — reject if not in ALLOWED_VOICES
        if voice not in ALLOWED_VOICES:
            self.send_error_json(
                400,
                f"Voice '{voice}' is not allowed. Available voices: {', '.join(ALLOWED_VOICES)}"
            )
            return

        # Proxy to Kokoro
        try:
            kokoro_req = urllib.request.Request(
                f"{KOKORO_URL}/v1/audio/speech",
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg, application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(kokoro_req, timeout=TIMEOUT) as response:
                # Stream response back to client
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get("Content-Type", "audio/mpeg"))
                if response.headers.get("Content-Disposition"):
                    self.send_header("Content-Disposition", response.headers.get("Content-Disposition"))
                self.end_headers()
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except urllib.error.HTTPError as e:
            try:
                error_body = json.loads(e.read().decode("utf-8"))
            except Exception:
                error_body = {"error": {"message": str(e)}}
            self.send_error_json(e.code, error_body.get("error", {}).get("message", str(e)))
        except urllib.error.URLError as e:
            self.send_error_json(503, "Kokoro TTS service unavailable")
        except Exception as e:
            self.send_error_json(500, str(e))

    def send_error_json(self, code, message):
        """Send JSON error response."""
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        error = {"error": {"type": "invalid_request_error", "message": message}}
        self.wfile.write(json.dumps(error).encode())


def main():
    print(f"TTS Bridge starting on 0.0.0.0:{PORT}")
    print(f"Kokoro backend: {KOKORO_URL}")
    print(f"Allowed voices: {ALLOWED_VOICES}")

    server = HTTPServer(("0.0.0.0", PORT), TTSBridgeHandler)
    print(f"Listening on http://0.0.0.0:{PORT}")
    sys.stdout.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()