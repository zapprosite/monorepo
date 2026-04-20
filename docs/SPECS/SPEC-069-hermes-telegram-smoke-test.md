---
name: SPEC-069-hermes-telegram-smoke-test
description: "Smoke test bidirecional pytest — Claude Code (CLI) + Utilizador (App Telegram) — PT-BR natural, texto + TTS, teste local Hermes Agency"
status: PENDING
priority: critical
author: Principal Engineer
date: 2026-04-17
---

# SPEC-069: Hermes Telegram Smoke Test — Bidirecional CLI + App

## Problema

Não existe smoke test interativo para Hermes Agency que teste o pipeline completo PT-BR: texto + voz (TTS) + visão (Vision), de forma bidirecional — Claude Code (CLI) e Utilizador (App Telegram).

## Objectivo

Criar suite pytest que:
1. **Claude Code** envia mensagens de texto + áudio via CLI (Telegram Bot API)
2. **Utilizador** responde via Telegram App (audio ou texto)
3. **Verifica** resposta PT-BR natural, TTS audível, e output correto

## Arquitetura do Teste

```
┌─────────────────────────────────────────────────────────────┐
│  pytest smoke_hermes_telegram.py                           │
│                                                             │
│  ┌──────────────┐    Telegram Bot     ┌──────────────────┐ │
│  │ Claude Code  │ ── texto/áudio ──→  │  Hermes Agency   │ │
│  │ (CLI - me)   │ ←── resposta ─────  │  :8642           │ │
│  └──────────────┘                     └──────────────────┘ │
│        ↑                                      │             │
│        │         ┌──────────────────┐         │             │
│        └─────────│   Utilizador     │ ←───────┘             │
│           audio │   (App Telegram)  │  texto/áudio          │
│                  └──────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Configuração

### Ficheiros

```
smoke-tests/
├── smoke_hermes_telegram.py      # Suite pytest principal
├── conftest.py                    # Fixtures (bot client, user session)
├── requirements.txt               # python-telegram-bot, pytest, asyncio
└── README.md                     # Como executar
```

### Dependências Python

```
pytest>=8.0
pytest-asyncio>=0.23
python-telegram-bot>=21.0
aiohttp>=3.9
```

## Casos de Teste

### T1: Texto — Resposta PT-BR Natural

**Teste:** Claude Code envia `/start` → Hermes responde com onboarding PT-BR.

```python
async def test_start_onboarding_ptbr():
    """Envia /start, verifica resposta em PT-BR com tom natural."""
    response = await bot.send_message(chat_id=TEST_CHAT_ID, text="/start")
    assert "Olá" in response.text or "Start" in response.text
    assert len(response.text) > 20  # resposta não genérica
```

**Critério:** Resposta > 20 chars,[REMOVIDO-CJK] natural PT-BR.

### T2: Texto — Chat Simples

**Teste:** Enviar mensagem simples em PT-BR, receber resposta coerente.

```python
async def test_chat_simple_ptbr():
    """Chat simples: 'Bom dia, como estás?'"""
    response = await bot.send_message(chat_id=TEST_CHAT_ID, text="Bom dia, como estás?")
    assert len(response.text) > 5
    # Verificar que não é echo vazio
    assert response.text != "Bom dia, como estás?"
```

### T3: Áudio — Transcrição STT

**Teste:** Enviar áudio PT-BR → Hermes transcreve → responde.

```python
async def test_audio_transcription():
    """Enviar áudio PT-BR curto (5-10s), verificar transcrição."""
    audio_path = "fixtures/audio/ola-mundo.ptb.m4a"
    with open(audio_path, "rb") as f:
        await bot.send_audio(chat_id=TEST_CHAT_ID, audio=f)

    # Hermes deve processar e responder com transcrição ou confirmação
    # Timeout: 15s para STT + LLM + TTS
```

**Nota:** Áudio guardado em `fixtures/audio/` — PT-BR voz `pm_santa` ou `pf_dora`.

### T4: TTS — Resposta Audível

**Teste:** Perguntar algo → Hermes responde com voz (TTS).

```python
async def test_tts_response():
    """Resposta deve ter audio attachment (TTS)."""
    await bot.send_message(chat_id=TEST_CHAT_ID, text="Fala mais sobre ti")
    # Poll updates até receber resposta com voice/audio
    update = await bot.wait_for_reply(timeout=20)
    assert update.message.voice or update.message.audio, "Resposta sem TTS"
```

### T5: Imagem — Vision

**Teste:** Enviar imagem → Hermes descreve.

```python
async def test_vision_image_description():
    """Enviar imagem, verificar descrição PT-BR."""
    image_path = "fixtures/images/cachorro.jpg"
    with open(image_path, "rb") as f:
        await bot.send_photo(chat_id=TEST_CHAT_ID, photo=f)

    response = await bot.wait_for_reply(timeout=20)
    assert len(response.text) > 10
    assert any(word in response.text.lower() for word in ["cachorro", "dog", "animal", "imagem"])
```

### T6: Bidirecional — Claude + Utilizador

**Teste:** Claude envia prompt → Utilizador responde → Claude continua.

```python
async def test_bidirectional_conversation():
    """
    1. Claude envia: 'Cria uma ideia para post Instagram'
    2. Utilizador responde: 'Usa cores vibrantes'
    3. Claude continua: 'Perfeito! Vou criar o design'
    """
    # Fase 1: Claude envia
    await bot.send_message(chat_id=TEST_CHAT_ID,
        text="Cria uma ideia para post Instagram sobre café")

    # Fase 2: Simular utilizador (mock ou human-in-loop)
    # Se human-in-loop: esperar input do utilizador
    # Se mock: injetar resposta do utilizador

    # Fase 3: Verificar que Claude continua
    response = await bot.wait_for_reply(timeout=20)
    assert len(response.text) > 10
```

### T7: Fluxo Completo — CEO Skill Routing

**Teste:** Trigger skill `agency-ceo` → routing para skill correta.

```python
async def test_agency_ceo_skill_routing():
    """Envia 'Preciso de ajuda com uma campanha' → agency-ceo deve routear."""
    response = await bot.send_message(
        chat_id=TEST_CHAT_ID,
        text="Preciso de ajuda com uma campanha de marketing"
    )
    # Verificar que routing aconteceu (log ou resposta contextual)
    assert response.text is not None
```

## Modos de Execução

### Modo 1: Human-in-the-Loop (default)

```bash
pytest smoke-tests/smoke_hermes_telegram.py -m interactive
```

- Claude Code envia mensagens via CLI
- Utilizador responde via Telegram App real
- Teste polls Telegram até receber resposta do utilizador (timeout 60s)
- Depois verifica resposta do Hermes

### Modo 2: Mocked (CI)

```bash
pytest smoke-tests/smoke_hermes_telegram.py -m ci
```

- Respostas do utilizador são mocked ( pré-gravadas)
- Sem intervenção humana
- Rápido (~30s)

### Modo 3: Claude-CLI-Only (debug)

```bash
pytest smoke-tests/smoke_hermes_telegram.py -m cli
```

- Claude Code envia e recebe tudo via CLI
- Sem Telegram App
- Para verificar que Hermes responde corretamente

##Fixtures (conftest.py)

```python
@pytest.fixture
def bot_client():
    """Client Telegram Bot API (python-telegram-bot)."""
    return telegram.Bot(token=os.getenv("TELEGRAM_BOT_TOKEN"))

@pytest.fixture
def test_chat_id():
    """Chat ID do teste (grupo ou DM)."""
    return int(os.getenv("TEST_CHAT_ID"))

@pytest.fixture
async def bot_context(bot_client, test_chat_id):
    """Contexto de teste com cleanup."""
    yield bot_client
    # Cleanup: enviar /reset ou similar

@pytest.fixture
def audio_fixture():
    """Fixtures de áudio PT-BR."""
    return {
        "ola": "fixtures/audio/ola-mundo.ptb.m4a",
        "bom_dia": "fixtures/audio/bom-dia.ptb.m4a",
    }

@pytest.fixture
def image_fixture():
    """Fixtures de imagem."""
    return {
        "cachorro": "fixtures/images/cachorro.jpg",
        "cafe": "fixtures/images/cafe.jpg",
    }
```

## Variáveis de Ambiente

```bash
# .env (obrigatório)
TELEGRAM_BOT_TOKEN=     # Token do bot Hermes (do .env principal)
TEST_CHAT_ID=           # Chat ID do teste (grupo ou DM)
HERMES_TELEGRAM_URL=    # http://localhost:8642 (default)

# pytest.ini
[pytest]
markers =
    interactive: Teste que requer utilizador humano
    ci: Teste fully automated (mocked)
    cli: Teste CLI-only (sem Telegram App)
asyncio_mode = auto
```

## Success Criteria

| # | Critério | Verificação |
|---|----------|-------------|
| SC-1 | `/start` responde PT-BR natural | pytest T1 |
| SC-2 | Chat simples PT-BR funciona | pytest T2 |
| SC-3 | Áudio PT-BR transcrito corretamente | pytest T3 |
| SC-4 | TTS audível na resposta | pytest T4 |
| SC-5 | Imagem descrita em PT-BR | pytest T5 |
| SC-6 | Bidirecional Claude↔Utilizador funciona | pytest T6 |
| SC-7 | Skill routing agency-ceo funciona | pytest T7 |

## Acceptance Criteria

- [ ] `smoke_hermes_telegram.py` criado com todos os 7 testes
- [ ] `conftest.py` com fixtures completos
- [ ] `requirements.txt` com dependências
- [ ] `pytest.ini` com markers (interactive/ci/cli)
- [ ] Áudio fixtures PT-BR gravados em `fixtures/audio/`
- [ ] Imagem fixtures em `fixtures/images/`
- [ ] README.md com instruções de execução
- [ ] Testes passam em modo CI (mocked)
- [ ] Testes funcionam em modo interactive (CLI + App)

## O que NÃO é

- ❌ Não é teste de carga (load test)
- ❌ Não é teste de performance (benchmarks)
- ❌ Não substitui os smoke tests existentes (SPEC-053 voice pipeline)

## Dependências

- SPEC-053 (Hermes voice pipeline — STT/TTS funcionando)
- SPEC-058 (Hermes Agency Suite — 11 skills)
- SPEC-059 (Datacenter hardening — rate limits, locks)

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Áudio fixture desatualizado | Gravar novo áudio antes de cada sessão |
| Timeout em redes lentas | Timeout configurável via env `TEST_TIMEOUT=60` |
| Chat ID inválido | Validate antes de executar |
