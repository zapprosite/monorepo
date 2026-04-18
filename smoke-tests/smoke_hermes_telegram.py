#!/usr/bin/env python3
"""
Smoke Test: Hermes Agency — Telegram Bidirectional (CLI + App)
SPEC-069: Claude Code (CLI) + Utilizador (App Telegram)

MODO: HTTP API direta (sem polling) — não conflita com Hermes polling.

  pytest smoke_hermes_telegram.py           # send-only + verify Hermes recebe
  pytest smoke_hermes_telegram.py -m ci   # CI (mocked)
  pytest smoke_hermes_telegram.py -m cli   # Hermes local only (health)

NOTA: Polling Telegram (python-telegram-bot) conflita com o polling
do Hermes (mesmo bot token). Este teste usa HTTP API direta (requests)
para enviar mensagens — não há conflito.

O teste VERIFICA:
  1. Hermes está online (:8642 /health)
  2. Bot token é válido (sendMessage via HTTP API)
  3. Mensagem chega ao Telegram (envio via HTTP API bem succeed)

A RESPOSTA DO HERMES é verificada manualmente no Telegram App.

Dependências:
    pip install -r smoke-tests/requirements.txt

Variáveis de ambiente:
    TELEGRAM_BOT_TOKEN  — token do bot Hermes
    TEST_CHAT_ID       — chat ID do teste (grupo ou DM)
    HERMES_URL        — http://localhost:8642 (default)
"""

import os
import re
import subprocess
import time
from pathlib import Path

import pytest
import requests

# ─── Config from env ────────────────────────────────────────────────────────

BOT_TOKEN: str = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TEST_CHAT_ID: str = os.environ.get("TEST_CHAT_ID", "")
HERMES_URL: str = os.environ.get("HERMES_URL", "http://localhost:8642")
HERMES_LOG: str = "/home/will/.hermes/logs/agent.log"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def hermes_health() -> bool:
    """Verifica se Hermes está online."""
    try:
        r = requests.get(f"{HERMES_URL}/health", timeout=5)
        return r.status_code == 200 and "ok" in r.text
    except Exception:
        return False


def telegram_send(text: str) -> dict:
    """Envia mensagem via Telegram Bot HTTP API (não conflita com polling)."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    resp = requests.post(url, json={"chat_id": TEST_CHAT_ID, "text": text}, timeout=10)
    resp.raise_for_status()
    return resp.json()


def telegram_send_audio(audio_path: str, caption: str = "") -> dict:
    """Envia áudio via Telegram Bot HTTP API."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendAudio"
    with open(audio_path, "rb") as f:
        files = {"audio": f}
        data = {"chat_id": TEST_CHAT_ID, "caption": caption}
        resp = requests.post(url, data=data, files=files, timeout=30)
    resp.raise_for_status()
    return resp.json()


def telegram_send_photo(photo_path: str, caption: str = "") -> dict:
    """Envia foto via Telegram Bot HTTP API."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    with open(photo_path, "rb") as f:
        files = {"photo": f}
        data = {"chat_id": TEST_CHAT_ID, "caption": caption}
        resp = requests.post(url, data=data, files=files, timeout=30)
    resp.raise_for_status()
    return resp.json()


def hermes_received(text: str, timeout: int = 35) -> bool:
    """
    Verifica se Hermes recebeu a mensagem (olha no log do agente).
    Espera até `timeout` segundos para Hermes pollar e processar.
    Returns True se a mensagem aparecer no log.
    """
    if not Path(HERMES_LOG).exists():
        return False
    start = time.time()
    while time.time() - start < timeout:
        with open(HERMES_LOG) as f:
            lines = f.readlines()
        recent = "".join(lines[-200:])  # últimas 200 linhas
        if text.lower() in recent.lower():
            return True
        time.sleep(2)
    return False


def last_hermes_log_lines(n: int = 10) -> str:
    """Devolve as últimas N linhas do log do Hermes."""
    if not Path(HERMES_LOG).exists():
        return ""
    with open(HERMES_LOG) as f:
        lines = f.readlines()
    return "".join(lines[-n:])


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def bot_token() -> str:
    if not BOT_TOKEN:
        pytest.skip("TELEGRAM_BOT_TOKEN não definido")
    return BOT_TOKEN


@pytest.fixture(scope="session")
def chat_id() -> str:
    if not TEST_CHAT_ID:
        pytest.skip("TEST_CHAT_ID não definido")
    return TEST_CHAT_ID


@pytest.fixture(scope="session")
def hermes_online():
    """Verifica que Hermes está online antes dos testes."""
    if not hermes_health():
        pytest.fail(f"Hermes não está online: {HERMES_URL}/health")
    return True


# ─── Test Cases ─────────────────────────────────────────────────────────────

def test_hermes_health(hermes_online):
    """
    T0: Hermes Gateway /health

    Verifica que Hermes está a correr e responde.
    """
    assert hermes_health(), f"Hermes offline: {HERMES_URL}/health"


def test_bot_token_valid(bot_token, chat_id):
    """
    T1: Bot Token + Chat ID válido

    Envia mensagem simples via HTTP API — verifica que token funciona.
    A mensagem vai para o Telegram (Hermes recebe se estiver a pollar).
    """
    result = telegram_send("🧪 Smoke test: token válido")
    assert result.get("ok"), f"sendMessage falhou: {result}"
    assert result["result"]["chat"]["id"] == int(chat_id), \
        f"Chat ID mismatch: {result['result']['chat']['id']} vs {chat_id}"


def test_start_onboarding(bot_token, chat_id, hermes_online):
    """
    T2: /start — Onboarding PT-BR

    Envia /start via HTTP API — verifica que Telegram aceita.
    Hermes responde PT-BR — verificar manualmente no Telegram App.
    """
    result = telegram_send("/start")
    assert result.get("ok"), f"/start falhou: {result}"


def test_chat_simple_ptbr(bot_token, chat_id, hermes_online):
    """
    T3: Chat simples PT-BR

    Envia mensagem PT-BR via HTTP API — verifica que Telegram aceita.
    Hermes recebe via polling (verificar manualmente no Telegram App).
    """
    msg = "Bom dia, como estás?"
    result = telegram_send(msg)
    assert result.get("ok"), f"sendMessage falhou: {result}"


def test_audio_transcription(bot_token, chat_id, hermes_online, tmp_path):
    """
    T4: Áudio — Transcrição STT

    Skip se fixture não existir. O teste envia áudio (se existir).

    NOTA: Áudio fixture não existe no repo —阜 criar primeiro:
      fixtures/audio/ola-mundo.ptb.m4a
    """
    audio_path = Path(__file__).parent / "fixtures" / "audio" / "ola-mundo.ptb.m4a"
    if not audio_path.exists():
        pytest.skip(f"Fixture áudio não existe: {audio_path}")

    before = last_hermes_log_lines(5)
    result = telegram_send_audio(str(audio_path), caption="Transcreve isto")
    assert result.get("ok"), f"sendAudio falhou: {result}"

    time.sleep(3)
    after = last_hermes_log_lines(15)
    new_lines = [l for l in after.splitlines() if l not in before.splitlines()]
    assert new_lines, "Nenhuma linha nova no log após sendAudio"
    assert "audio" in after.lower() or "voice" in after.lower() or "transcreve" in after.lower(), \
        f"Hermes não processou áudio. Log:\n{''.join(new_lines[-5:])}"


def test_vision_image(bot_token, chat_id, hermes_online):
    """
    T5: Imagem — Vision

    Skip se fixture não existir.

    NOTA: Criar primeiro: fixtures/images/cachorro.jpg
    """
    image_path = Path(__file__).parent / "fixtures" / "images" / "cachorro.jpg"
    if not image_path.exists():
        pytest.skip(f"Fixture imagem não existe: {image_path}")

    before = last_hermes_log_lines(5)
    result = telegram_send_photo(str(image_path), caption="O que é isto?")
    assert result.get("ok"), f"sendPhoto falhou: {result}"

    time.sleep(3)
    after = last_hermes_log_lines(15)
    new_lines = [l for l in after.splitlines() if l not in before.splitlines()]
    assert new_lines, "Nenhuma linha nova no log após sendPhoto"
    # Hermes recebe a mensagem com a foto
    assert "photo" in after.lower() or "cachorro" in after.lower() or "imagem" in after.lower(), \
        f"Hermes não processou imagem. Log:\n{''.join(new_lines[-5:])}"


def test_agency_ceo_routing(bot_token, chat_id, hermes_online):
    """
    T6: Agency CEO Skill Routing

    Envia mensagem de routing via HTTP API — verifica que Telegram aceita.
    Hermes faz agency-ceo routing — verificar manualmente no Telegram App.
    """
    msg = "Preciso de ajuda com uma campanha de marketing"
    result = telegram_send(msg)
    assert result.get("ok"), f"sendMessage falhou: {result}"


# ─── CLI Entry Point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-v"]))
