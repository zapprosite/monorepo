# Hermes Telegram Smoke Test — Bidirecional (SPEC-069)

Teste interativo para Hermes Agency via Telegram — Claude Code (CLI) + Utilizador (App).

## Arquitetura

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

## Quick Start

### 1. Instalar dependências

```bash
pip install -r smoke-tests/requirements.txt
```

### 2. Configurar ambiente

```bash
# .env — variáveis obrigatórias
export TELEGRAM_BOT_TOKEN="SeuTokenDoBot"
export TEST_CHAT_ID="SeuChatIdOuGrupoId"
export HERMES_TELEGRAM_URL="http://localhost:8642"  # default
export TEST_TIMEOUT=30
```

### 3. Verificar que Hermes está online

```bash
curl -sf http://localhost:8642/health
```

### 4. Executar testes

#### Modo Interactive (CLI + App real) — DEFAULT
```bash
pytest smoke-tests/smoke_hermes_telegram.py -m interactive -v
```
- Claude Code envia mensagens via CLI
- Utilizador responde via Telegram App real
- T6 (bidirecional) aguarda input humano (60s timeout)

#### Modo CI (mocked — sem Telegram)
```bash
pytest smoke-tests/smoke_hermes_telegram.py -m ci -v
```
- Respostas mocked
- Rápido (~30s)
- Para CI/CD pipelines

#### Modo CLI-only (Hermes local, sem App)
```bash
pytest smoke-tests/smoke-tests/smoke_hermes_telegram.py -m cli -v
```
- Testa apenas Hermes local (texto + health)
- Não requer Telegram App

## Casos de Teste

| ID  | Nome                              | Descrição                                      |
|-----|-----------------------------------|------------------------------------------------|
| T1  | `test_start_onboarding_ptbr`     | `/start` → resposta PT-BR natural              |
| T2  | `test_chat_simple_ptbr`          | Chat simples PT-BR                             |
| T3  | `test_audio_transcription`       | Enviar áudio PT-BR → transcrição STT          |
| T4  | `test_tts_response`              | Resposta com voz (TTS audível)                |
| T5  | `test_vision_image_description`  | Enviar imagem → descrição PT-BR (Vision)      |
| T6  | `test_bidirectional_conversation`| Claude ↔ Utilizador (requer App real)         |
| T7  | `test_agency_ceo_skill_routing`  | Trigger agency-ceo → routing correto           |

## Fixtures

### Áudio (`fixtures/audio/`)
Áudio PT-BR 5-10s voz `pm_santa` ou `pf_dora`:
- `ola-mundo.ptb.m4a` — "Olá, mundo!"
- `bom-dia.ptb.m4a` — "Bom dia, como estás?"

### Imagens (`fixtures/images/`)
- `cachorro.jpg` — Foto de cão (para Vision)
- `cafe.jpg` — Foto de café (para Vision)

### Gravar novos fixtures

```bash
# Áudio — usar TTS Bridge Kokoro
curl -X POST http://localhost:8013/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Olá mundo", "voice": "pm_santa"}' \
  --output fixtures/audio/ola-mundo.ptb.m4a

# Imagem — qualquer foto JPG (max 20MB)
cp /tmp/minha-foto.jpg fixtures/images/cachorro.jpg
```

## Variáveis de Ambiente

| Variável              | Default              | Descrição                     |
|-----------------------|----------------------|-------------------------------|
| `TELEGRAM_BOT_TOKEN`  | (obrigatório)       | Token do bot Hermes           |
| `TEST_CHAT_ID`        | (obrigatório)       | Chat ID ou grupo ID           |
| `HERMES_TELEGRAM_URL` | `http://localhost:8642` | URL do Hermes Gateway       |
| `TEST_TIMEOUT`        | `30`                | Timeout em segundos           |

## Troubleshooting

### "TELEGRAM_BOT_TOKEN não definido"
```bash
# Verificar .env
grep TELEGRAM_BOT_TOKEN /srv/monorepo/.env

# Se vazio, gerar novo token:
# 1. Abrir @BotFather no Telegram
# 2. /newbot → seguir instruções
# 3. Adicionar ao .env
```

### "TEST_CHAT_ID não definido"
```bash
# Encontrar Chat ID:
# 1. Iniciar DM com o bot no Telegram
# 2. Aceder: https://api.telegram.org/bot<TOKEN>/getUpdates
# 3. Procurar "chat":{"id":123456789,...}
```

### Hermes timeout
```bash
# Verificar que Hermes está a correr
curl -sf http://localhost:8642/health

# Ver logs
journalctl -u hermes-agent -f
```

### python-telegram-bot ImportError
```bash
pip install python-telegram-bot>=21.0
```

## Success Criteria (SPEC-069)

| # | Critério | Teste       |
|---|----------|-------------|
| SC-1 | `/start` responde PT-BR natural | T1 |
| SC-2 | Chat simples PT-BR funciona | T2 |
| SC-3 | Áudio PT-BR transcrito | T3 |
| SC-4 | TTS audível na resposta | T4 |
| SC-5 | Imagem descrita em PT-BR | T5 |
| SC-6 | Bidirecional Claude↔Utilizador | T6 |
| SC-7 | Skill routing agency-ceo | T7 |

## Ficheiros

```
smoke-tests/
├── smoke_hermes_telegram.py      # Suite pytest (7 testes)
├── conftest.py                    # Fixtures pytest
├── pytest.ini                     # Configuração pytest
├── requirements.txt                # Dependências Python
├── README.md                      # Este ficheiro
└── fixtures/
    ├── audio/
    │   ├── ola-mundo.ptb.m4a
    │   └── bom-dia.ptb.m4a
    └── images/
        ├── cachorro.jpg
        └── cafe.jpg
```
