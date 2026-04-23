# Telegram Bot Ecosystem — Hermes Agency

## Visão Geral

Ecossistema de 4 bots Telegram para a Hermes Agency + homelab operations. Arquitetura modular com roteamento inteligente, segurança reforçada e processamento multimodal.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TELEGRAM BOT ECOSYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐ │
│  │  @CEO_REFRIMIX_bot   │  │  @editor_social_bot  │  │ @Athlos_Life_bot│ │
│  │  HERMES_AGENCY_BOT   │  │  EDITOR_SOCIAL_BOT   │  │  ATHLOS_BOT      │ │
│  │                      │  │                      │  │                  │ │
│  │  • Roteamento CEO    │  │  • Video editing    │  │  • Brand Athlos  │ │
│  │  • Campanhas         │  │  • Social media     │  │  • Lifestyle     │ │
│  │  • Analytics         │  │  • Scheduling       │  │  • Content       │ │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘ │
│             │                         │                       │           │
│             └─────────────────────────┼───────────────────────┘           │
│                                       ▼                                     │
│                          ┌────────────────────────┐                       │
│                          │   agency_router.ts     │                       │
│                          │   (roteamento central) │                       │
│                          └────────────────────────┘                       │
│                                       │                                     │
│  ┌──────────────────────┐             │                                     │
│  │  @HOMELAB_LOGS_bot   │             ▼                                     │
│  │  HOMELAB_LOGS_BOT    │     ┌────────────────────┐                       │
│  │                      │     │  Hermes Gateway    │                       │
│  │  • System alerts     │◄────│  /api/telegram/*    │                       │
│  │  • CI/CD notifs      │     └────────────────────┘                       │
│  │  • Error reports     │                                                  │
│  └──────────────────────┘                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Bots e Especialização

### 1. CEO_REFRIMIX_bot (HERMES_AGENCY_BOT_TOKEN)

**Papel:** Bot líder, ponto de entrada para todas as solicitações da agência.

**Comandos:**
```
/start        — Boas-vindas + menu principal
/agency       — Dashboard da agência
/brief        — Iniciar novo campaign brief
/campaign     — Gestão de campanhas
/tasks        — Ver tarefas ativas
/analytics    — Relatório de métricas
/voice        — Ativar resposta por voz
/text         — Desativar resposta por voz
/health       — Status do sistema (admin)
/help         — Menu de ajuda
```

**Capacidades:**
- Voz → STT (Whisper medium) → Route → TTS (Kokoro)
- Imagem → Vision (qwen2.5vl:7b via Ollama)
- Texto → Roteamento inteligente via agency_router.ts
- Multimedia → Download, validação, processamento

### 2. editor_social_bot (EDITOR_SOCIAL_BOT_TOKEN)

**Papel:** Editor de vídeo e gestão de redes sociais.

**Comandos:**
```
/start        — Boas-vindas
/edit         — Iniciar edição de vídeo
/schedule     — Agendar post
/posts        — Ver posts agendados
/assets       — Biblioteca de assets
/clip         — Extrair clip de vídeo
/transcribe   — Transcrever vídeo
/analytics    — Métricas de social media
/help         — Ajuda
```

**Capacidades:**
- Upload de vídeo → Download + Transcrição
- Key moments extraction via AI
- Scheduling de posts (integração futura com API de redes sociais)
- Asset management

### 3. Athlos_Life_bot (ATHLOS_BOT_TOKEN)

**Papel:** Identidade de marca separada para Athlos.

**Comandos:**
```
/start        — Boas-vindas Athlos
/brand        — Guidelines de marca
/content      — Gerar conteúdo Athlos
/campaign     — Campanhas Athlos
/analytics    — Métricas da marca
/settings     — Configurações
/help         — Ajuda
```

**Capacidades:**
- Brand consistency enforcement
- Content generation específico para Athlos
- Campaign management separado
- Analytics segregados por marca

### 4. HOMELAB_LOGS_bot (HOMELAB_LOGS_BOT_TOKEN)

**Papel:** Agregação de alertas e notifications do homelab.

**Comandos:**
```
/start        — Boas-vindas
/alerts       — Ver alertas ativos
/ack          — Acknowledgement de alerta
/history      — Histórico de alertas
/subscribe    — Assinar canais de notificação
/unsubscribe  — Cancelar assinatura
/settings     — Configurações de notificação
/health       — Health check completo
/help         — Ajuda
```

**Capacidades:**
- System alerts (disk, memory, CPU)
- CI/CD notifications (GitHub Actions, Gitea)
- Error reports (logs agregados)
- Alert acknowledgment workflow

## Arquitetura de Roteamento

### agency_router.ts

```
                           ┌─────────────────────────────┐
                           │     agency_router.ts        │
                           │   (Roteamento Central CEO)  │
                           └──────────────┬──────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
           ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
           │   Campaign   │       │    Social   │       │   Brand     │
           │   Handler    │       │   Handler   │       │   Handler   │
           └─────────────┘       └─────────────┘       └─────────────┘
                    │                     │                     │
                    └─────────────────────┼─────────────────────┘
                                          ▼
                                 ┌─────────────┐
                                 │   Skill     │
                                 │   Router    │
                                 └─────────────┘
```

### Fluxo de Mensagem

1. **Mensagem chega ao bot** → Rate limit check
2. **Validação de ficheiro** (se aplicável) → Magic bytes + size
3. **Roteamento por tipo:**
   - Voz → STT → Router
   - Imagem → Vision → Router
   - Texto → NLP → Router
4. **Router determina skill/ação**
5. **Execução** → Response
6. **Resposta** → Texto ou Voz (TTS)

## Polling vs Webhook

### Desenvolvimento (Polling)

```bash
# Usar telegram-cli (tdcli) para polling local
tdcli -d -C  # Daemon mode com console

# Ou polling nativo Telegraf (dev)
BOT_MODE=polling bun run src/telegram/bot.ts
```

### Produção (Webhook)

```
┌────────────────────────────────────────────────────────────────┐
│                     PRODUCTION WEBHOOK                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Telegram API                                                  │
│       │                                                        │
│       ▼                                                        │
│  https://hermes-agency.zappro.site/webhook/{bot_name}         │
│                                                                │
│       │                                                        │
│       ▼                                                        │
│  Hermes Gateway (:8642)                                        │
│       │                                                        │
│       ├── /webhook/ceo_refrimix     → CEO Bot                  │
│       ├── /webhook/editor_social    → Editor Bot              │
│       ├── /webhook/athlos_life      → Athlos Bot               │
│       └── /webhook/homelab_logs     → Homelab Bot              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**URLs de Webhook:**
```
CEO_REFRIMIX:     https://hermes-agency.zappro.site/webhook/ceo_refrimix
editor_social:    https://hermes-agency.zappro.site/webhook/editor_social
athlos_life:      https://hermes-agency.zappro.site/webhook/athlos_life
homelab_logs:     https://hermes-agency.zappro.site/webhook/homelab_logs
```

## Segurança

### Admin Whitelist

```typescript
// Variáveis de ambiente
HERMES_ADMIN_USER_IDS=123456789,987654321
ATHLOS_ADMIN_USER_IDS=123456789
EDITOR_ADMIN_USER_IDS=123456789
HOMELAB_ADMIN_USER_IDS=123456789
```

### Rate Limiting

| Bot | Mensagens/min | Janela | Burst |
|-----|---------------|--------|-------|
| CEO_REFRIMIX | 10 | 60s | 3 concurrent |
| editor_social | 15 | 60s | 5 concurrent |
| Athlos_Life | 10 | 60s | 3 concurrent |
| HOMELAB_LOGS | 30 | 60s | 10 concurrent |

### Validação de Ficheiros

```typescript
// Tamanhos máximos
MAX_FILE_SIZE=20971520        // 20MB
MAX_TTS_SIZE=52428800         // 50MB
MAX_DOWNLOAD_SIZE=20971520    // 20MB

// MIME types permitidos
Images:  jpeg, png, gif, webp, heic, heif
Audio:   ogg, mp3, wav, aac
Video:   mp4
```

### Validação de Comandos

- Comandos `/private` não respondem em grupos
- Comandos de admin verificados contra whitelist
- CSRF protection via Telegram secret token

## Processamento Multimédia

### Photo → Vision

```
Foto → Download (streaming, max 20MB)
     → Validação MIME (magic bytes)
     → Base64 encode
     → Ollama qwen2.5vl:7b
     → Análise + Ação
```

### Video → Transcription

```
Video → Download (streaming, max 50MB)
      → Extract audio stream
      → Whisper medium STT
      → Key moments extraction (futuro)
      → Summary
```

### Voice → STT → TTS

```
Voice → Download
      → Validação
      → faster-whisper (Whisper medium)
      → Transcrição
      → agency_router.ts (NLP)
      → Resposta
      → Kokoro TTS
      → Resposta de voz
```

### Document → RAG

```
Document → Text extraction (pdf, docx)
         → Chunking
         → Embedding (via Ollama)
         → Indexing (vetor database)
         → Query capability
```

## Estratégia de Notificações

### Campaign Milestones → CEO Bot → Client Chat

```
Campanha Created     → CEO Bot notification
Milestone Reached    → CEO Bot + Client notification
Campaign Completed   → CEO Bot + Client notification
```

### System Alerts → HOMELAB_LOGS Bot → Admin

```
Disk Critical (>90%)     → HOMELAB_LOGS_bot → Admin channel
Memory Critical (>90%)   → HOMELAB_LOGS_bot → Admin channel
Service Down             → HOMELAB_LOGS_bot → Admin channel
CI/CD Failure            → HOMELAB_LOGS_bot → #ci-cd channel
```

### Error Reports → Both Bots (verbosity different)

```
CEO Bot:        Resumo executive (1-2 linhas)
HOMELAB_LOGS:   Log completo + stack trace
```

## Variáveis de Ambiente

### CEO_REFRIMIX_bot

```bash
HERMES_AGENCY_BOT_TOKEN=           # Token do bot
HERMES_AGENCY_WEBHOOK_URL=         # https://hermes-agency.zappro.site/webhook/ceo_refrimix
HERMES_GATEWAY_URL=                # http://localhost:8642
HERMES_ADMIN_USER_IDS=             # CSV de user IDs
HERMES_MAX_CONCURRENT=3
HERMES_RATE_WINDOW_MS=10000
HERMES_RATE_MAX_MSGS=5
HERMES_MAX_FILE_SIZE=20971520
HERMES_MAX_TTS_SIZE_BYTES=52428800
HERMES_MAX_DOWNLOAD_BYTES=20971520
HERMES_VISION_MODEL=qwen2.5vl:7b
HERMES_VOICE=pm_santa
STT_DIRECT_URL=                    # http://localhost:8204
TTS_BRIDGE_URL=                    # http://localhost:8013
OLLAMA_URL=                        # http://localhost:11434
AI_GATEWAY_FACADE_KEY=
```

### editor_social_bot

```bash
EDITOR_SOCIAL_BOT_TOKEN=
EDITOR_SOCIAL_WEBHOOK_URL=        # https://hermes-agency.zappro.site/webhook/editor_social
EDITOR_ADMIN_USER_IDS=
EDITOR_MAX_CONCURRENT=5
EDITOR_RATE_WINDOW_MS=10000
EDITOR_RATE_MAX_MSGS=10
EDITOR_MAX_FILE_SIZE=52428800     # 50MB para vídeos
```

### Athlos_Life_bot

```bash
ATHLOS_BOT_TOKEN=
ATHLOS_WEBHOOK_URL=               # https://hermes-agency.zappro.site/webhook/athlos_life
ATHLOS_ADMIN_USER_IDS=
ATHLOS_MAX_CONCURRENT=3
ATHLOS_RATE_WINDOW_MS=10000
ATHLOS_RATE_MAX_MSGS=5
ATHLOS_MAX_FILE_SIZE=20971520
```

### HOMELAB_LOGS_bot

```bash
HOMELAB_LOGS_BOT_TOKEN=
HOMELAB_LOGS_WEBHOOK_URL=         # https://hermes-agency.zappro.site/webhook/homelab_logs
HOMELAB_ADMIN_USER_IDS=
HOMELAB_MAX_CONCURRENT=10
HOMELAB_RATE_WINDOW_MS=10000
HOMELAB_RATE_MAX_MSGS=20
HOMELAB_MAX_FILE_SIZE=5242880     # 5MB para logs
```

## Estrutura de Ficheiros

```
/srv/monorepo/apps/hermes-agency/src/telegram/
├── bot.ts                         # Bot principal (refactored para 4 bots)
├── bot_manager.ts                 # Factory de bots
├── rate_limiter.ts                 # Rate limiting (Redis + in-memory)
├── file_validator.ts              # Validação MIME + size
├── distributed_lock.ts            # Redis distributed locks
├── redis.ts                       # Redis client
├── handlers/
│   ├── voice.ts                   # Handler de voz
│   ├── photo.ts                   # Handler de imagem
│   ├── video.ts                   # Handler de vídeo
│   ├── document.ts                # Handler de documentos
│   ├── command.ts                 # Handlers de comando
│   └── callback_query.ts           # Callback queries
├── routers/
│   ├── agency_router.ts           # Roteamento CEO
│   ├── social_router.ts           # Roteamento editor
│   ├── brand_router.ts            # Roteamento Athlos
│   └── alert_router.ts            # Roteamento homelab
├── services/
│   ├── stt.ts                     # Speech-to-text
│   ├── tts.ts                     # Text-to-speech
│   ├── vision.ts                  # Vision analysis
│   ├── transcription.ts           # Video transcription
│   └── rag.ts                     # RAG indexing
└── middleware/
    ├── auth.ts                    # Admin whitelist
    ├── rate_limit.ts             # Rate limit middleware
    ├── validation.ts              # Input validation
    └── logging.ts                # Audit logging
```

## Deployment

### Setup Webhook (script)

```bash
# Todos os bots
npx tsx scripts/setup-telegram-webhook.ts

# Bot específico
npx tsx scripts/setup-telegram-webhook.ts --bot CEO_REFRIMIX
npx tsx scripts/setup-telegram-webhook.ts --bot EDITOR_SOCIAL
npx tsx scripts/setup-telegram-webhook.ts --bot ATHLOS
npx tsx scripts/setup-telegram-webhook.ts --bot HOMELAB
```

### Verification

```bash
# Verificar webhook activo
curl "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"

# Verificar webhook info para todos os bots
npx tsx scripts/setup-telegram-webhook.ts --verify
```

## Comandos de Manutenção

```bash
# Ver todos os webhooks
curl -s "https://api.telegram.org/bot${HERMES_AGENCY_BOT_TOKEN}/getWebhookInfo"

# Delete webhook (para voltar a polling)
curl -s -X POST "https://api.telegram.org/bot${HERMES_AGENCY_BOT_TOKEN}/deleteWebhook"

# Ver updates pendentes
curl -s "https://api.telegram.org/bot${HERMES_AGENCY_BOT_TOKEN}/getUpdates"

# Limpar updates (se stuck)
curl -s -X POST "https://api.telegram.org/bot${HERMES_AGENCY_BOT_TOKEN}/getUpdates?limit=1&offset=-1"
```
