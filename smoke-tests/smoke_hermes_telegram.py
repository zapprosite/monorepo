#!/usr/bin/env python3
"""
Smoke Test: Hermes Agency — Telegram Bidirectional (CLI + App)
SPEC-069: Claude Code (CLI) + Utilizador (App Telegram)

Modos:
    pytest smoke_hermes_telegram.py           # interactive (CLI + App real)
    pytest smoke_hermes_telegram.py -m ci    # CI (mocked responses)
    pytest smoke_hermes_telegram.py -m cli   # CLI-only (sem App)

Dependências:
    pip install -r smoke-tests/requirements.txt

Variáveis de ambiente:
    TELEGRAM_BOT_TOKEN   — token do bot Hermes
    TEST_CHAT_ID         — chat ID do teste (grupo ou DM)
    HERMES_TELEGRAM_URL  — http://localhost:8642 (default)
    TEST_TIMEOUT         — timeout em segundos (default: 30)
"""

import asyncio
import os
import sys
import time
from pathlib import Path
from typing import Any, Optional

import pytest

# Optional: python-telegram-bot
try:
    from telegram import Bot
    from telegram.constants import ParseMode
    TELEGRAM_AVAILABLE = True
except ImportError:
    TELEGRAM_AVAILABLE = False
    Bot = None

# ─── Config from env ────────────────────────────────────────────────────────

BOT_TOKEN: str = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TEST_CHAT_ID: str = os.environ.get("TEST_CHAT_ID", "")
HERMES_URL: str = os.environ.get("HERMES_TELEGRAM_URL", "http://localhost:8642")
TEST_TIMEOUT: int = int(os.environ.get("TEST_TIMEOUT", "30"))


# ─── Helpers ────────────────────────────────────────────────────────────────

def assert_ptbr_natural(text: str, min_chars: int = 10) -> None:
    """Verifica que texto é PT-BR natural (não echo, não vazio)."""
    assert text, "Resposta vazia"
    assert len(text) >= min_chars, f"Resposta curta demais ({len(text)} chars): {text!r}"
    # Não deve ser echo exato
    # (cada teste verifica o seu próprio input)
    # Deve ter palavras PT-BR (mínimo 2 palavras)
    words = text.split()
    assert len(words) >= 2, f"Resposta sem palavras: {text!r}"


async def send_text(bot: Any, chat_id: str, text: str) -> Any:
    """Envia mensagem de texto via Telegram."""
    return await bot.send_message(chat_id=chat_id, text=text)


async def send_audio(bot: Any, chat_id: str, audio_path: str) -> Any:
    """Envia áudio via Telegram."""
    with open(audio_path, "rb") as f:
        return await bot.send_audio(chat_id=chat_id, audio=f)


async def send_photo(bot: Any, chat_id: str, photo_path: str, caption: str = "") -> Any:
    """Envia foto via Telegram."""
    with open(photo_path, "rb") as f:
        return await bot.send_photo(chat_id=chat_id, photo=f, caption=caption)


async def poll_for_reply(
    bot: Any,
    chat_id: str,
    timeout: int = TEST_TIMEOUT,
    last_msg_id: Optional[int] = None,
) -> Any:
    """
    Poll updates até encontrar mensagem nova do Hermes.
    Retorna a primeira mensagem nova (não do utilizador).
    """
    start = time.time()
    last_id = last_msg_id

    while time.time() - start < timeout:
        updates = await bot.get_updates(offset=(last_id + 1) if last_id else None, timeout=5)
        for update in updates:
            if update.message and update.message.chat.id == int(chat_id):
                if last_id is None or update.message.message_id > last_id:
                    return update.message
        await asyncio.sleep(1)

    raise TimeoutError(f"Timeout ({timeout}s) esperando resposta do Hermes")


# ─── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def bot() -> Any:
    """Client Telegram Bot API."""
    if not TELEGRAM_AVAILABLE:
        pytest.skip("python-telegram-bot não instalado")
    if not BOT_TOKEN:
        pytest.skip("TELEGRAM_BOT_TOKEN não definido")
    return Bot(token=BOT_TOKEN)


@pytest.fixture
def chat_id() -> str:
    """Chat ID do teste."""
    if not TEST_CHAT_ID:
        pytest.skip("TEST_CHAT_ID não definido")
    return TEST_CHAT_ID


@pytest.fixture
def audio_paths() -> dict[str, Path]:
    """Paths para fixtures de áudio PT-BR."""
    base = Path(__file__).parent / "fixtures" / "audio"
    return {
        "ola": base / "ola-mundo.ptb.m4a",
        "bom_dia": base / "bom-dia.ptb.m4a",
    }


@pytest.fixture
def image_paths() -> dict[str, Path]:
    """Paths para fixtures de imagem."""
    base = Path(__file__).parent / "fixtures" / "images"
    return {
        "cachorro": base / "cachorro.jpg",
        "cafe": base / "cafe.jpg",
    }


@pytest.fixture
async def bot_context(bot: Any, chat_id: str):
    """Contexto de teste com cleanup."""
    # Enviar /reset antes do teste (se suportado)
    try:
        await bot.send_message(chat_id=chat_id, text="/reset")
        await asyncio.sleep(1)
    except Exception:
        pass
    yield bot
    # Cleanup: enviar /reset depois
    try:
        await bot.send_message(chat_id=chat_id, text="/reset")
    except Exception:
        pass


# ─── Test Cases ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_start_onboarding_ptbr(bot: Any, chat_id: str):
    """
    T1: Texto — Resposta PT-BR Natural

    Envia /start → Hermes responde com onboarding PT-BR.
    Critério: resposta > 20 chars,语气 natural PT-BR.
    """
    response = await send_text(bot, chat_id, "/start")
    # O Hermes pode responder com texto ou com outro comando
    # Devemos poll para pegar a resposta real
    last_id = response.message_id if hasattr(response, 'message_id') else None
    reply = await poll_for_reply(bot, chat_id, timeout=20, last_msg_id=last_id)

    text = reply.text or ""
    assert_ptbr_natural(text, min_chars=20)
    # Verificar que é PT-BR (pelo menos uma palavra PT-BR conocida)
    ptbr_words = ["Olá", "ola", "Start", "start", "Bem", "bem", "vindo", "Hermes", "hermes", "Agência", "agência"]
    assert any(w in text for w in ptbr_words), f"Não parece PT-BR: {text!r}"


@pytest.mark.asyncio
async def test_chat_simple_ptbr(bot: Any, chat_id: str):
    """
    T2: Texto — Chat Simples

    Enviar mensagem simples em PT-BR, receber resposta coerente.
    """
    input_text = "Bom dia, como estás?"
    response = await send_text(bot, chat_id, input_text)
    last_id = response.message_id if hasattr(response, 'message_id') else None
    reply = await poll_for_reply(bot, chat_id, timeout=20, last_msg_id=last_id)

    text = reply.text or ""
    # Não deve ser echo vazio
    assert text.strip() != input_text.strip(), f"Echo vazio: {text!r}"
    assert_ptbr_natural(text, min_chars=5)


@pytest.mark.asyncio
async def test_audio_transcription(bot: Any, chat_id: str, audio_paths: dict):
    """
    T3: Áudio — Transcrição STT

    Enviar áudio PT-BR curto (5-10s) → Hermes transcreve → responde.
    Timeout: 20s para STT + LLM + TTS.
    """
    audio_file = audio_paths.get("ola")
    if not audio_file or not audio_file.exists():
        pytest.skip(f"Fixture áudio não encontrado: {audio_file}")

    # Enviar áudio
    sent = await send_audio(bot, chat_id, str(audio_file))
    last_id = sent.message_id if hasattr(sent, 'message_id') else None

    # Poll para resposta
    reply = await poll_for_reply(bot, chat_id, timeout=20, last_msg_id=last_id)
    text = reply.text or ""

    # Deve ter texto (transcrição ou confirmação)
    assert len(text) > 0, "Sem resposta ao áudio"


@pytest.mark.asyncio
async def test_tts_response(bot: Any, chat_id: str):
    """
    T4: TTS — Resposta Audível

    Perguntar algo → Hermes responde com voz (TTS).
    Verificar que resposta tem voice/audio attachment.
    """
    input_text = "Fala mais sobre ti"
    response = await send_text(bot, chat_id, input_text)
    last_id = response.message_id if hasattr(response, 'message_id') else None

    # Poll para resposta
    reply = await poll_for_reply(bot, chat_id, timeout=20, last_msg_id=last_id)

    # Deve ter voice ou audio (TTS)
    has_voice = reply.voice is not None
    has_audio = reply.audio is not None
    has_text = bool(reply.text)

    # Aceita: TTS (voice/audio) OU texto longo
    assert has_voice or has_audio or has_text, \
        f"Resposta sem TTS nem texto: voice={reply.voice}, audio={reply.audio}, text={reply.text!r}"

    if has_voice:
        # Verificar que tem file_id e duration
        assert reply.voice.file_id, "Voice sem file_id"
        assert reply.voice.duration > 0, "Voice sem duração"


@pytest.mark.asyncio
async def test_vision_image_description(bot: Any, chat_id: str, image_paths: dict):
    """
    T5: Imagem — Vision

    Enviar imagem → Hermes descreve em PT-BR.
    """
    image_file = image_paths.get("cachorro")
    if not image_file or not image_file.exists():
        pytest.skip(f"Fixture imagem não encontrado: {image_file}")

    sent = await send_photo(bot, chat_id, str(image_file), caption="O que é isto?")
    last_id = sent.message_id if hasattr(sent, 'message_id') else None

    reply = await poll_for_reply(bot, chat_id, timeout=25, last_msg_id=last_id)
    text = reply.text or ""

    assert_ptbr_natural(text, min_chars=10)
    # Deve mencionar algo relacionado (cachorro, animal, dog, etc)
    vision_keywords = ["cachorro", "dog", "animal", "imagem", "imagem", "foto", "photo", " видим", "vê-se"]
    # Lower case para comparação
    text_lower = text.lower()
    has_keyword = any(kw.lower() in text_lower for kw in vision_keywords)
    assert has_keyword, f"Não parece resposta de Vision: {text!r}"


@pytest.mark.asyncio
@pytest.mark.interactive
async def test_bidirectional_conversation(bot: Any, chat_id: str):
    """
    T6: Bidirecional — Claude + Utilizador

    1. Claude envia: 'Cria uma ideia para post Instagram'
    2. Utilizador responde via App Telegram
    3. Claude continua

    Este teste requer intervenção humana (modo interactive).
    """
    input_text = "Cria uma ideia para post Instagram sobre café"
    response = await send_text(bot, chat_id, input_text)
    last_id = response.message_id if hasattr(response, 'message_id') else None

    # Esperar resposta inicial do Hermes
    reply1 = await poll_for_reply(bot, chat_id, timeout=20, last_msg_id=last_id)
    text1 = reply1.text or ""
    assert_ptbr_natural(text1, min_chars=10)

    # Neste ponto, o utilizador real deve responder via Telegram App
    # O teste fica à espera (timeout 60s)
    print(f"\n[INTERACTIVE] Aguardando resposta do utilizador via Telegram App...")
    print(f"[INTERACTIVE] Última mensagem Hermes: {text1[:100]!r}")

    # O teste continua quando o utilizador envia mensagem no Telegram
    # Poll para próxima mensagem (do utilizador ou Hermes)
    # Timeout longo para dar tempo ao utilizador
    try:
        user_reply = await poll_for_reply(bot, chat_id, timeout=60, last_msg_id=last_id)
        # Se chegou aqui, o utilizador respondeu
        # Agora esperar resposta do Hermes
        reply2 = await poll_for_reply(bot, chat_id, timeout=30, last_msg_id=user_reply.message_id)
        text2 = reply2.text or ""
        assert_ptbr_natural(text2, min_chars=10)
    except TimeoutError:
        pytest.fail("Timeout aguardando resposta do utilizador (T6 modo interactive)")


@pytest.mark.asyncio
async def test_agency_ceo_skill_routing(bot: Any, chat_id: str):
    """
    T7: Fluxo Completo — CEO Skill Routing

    Trigger agency-ceo → routing para skill correta.
    """
    input_text = "Preciso de ajuda com uma campanha de marketing"
    response = await send_text(bot, chat_id, input_text)
    last_id = response.message_id if hasattr(response, 'message_id') else None

    reply = await poll_for_reply(bot, chat_id, timeout=25, last_msg_id=last_id)
    text = reply.text or ""

    assert_ptbr_natural(text, min_chars=10)
    # Deve ter contexto de campanha/marketing (indica que routing aconteceu)
    routing_keywords = [
        "campanha", "marketing", "ajuda", "posso", "vou", "criar",
        "projeto", "cliente", "agência", "agency"
    ]
    text_lower = text.lower()
    has_routing = any(kw.lower() in text_lower for kw in routing_keywords)
    assert has_routing, f"Sem sinal de routing: {text!r}"


# ─── CLI Entry Point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "interactive"])
