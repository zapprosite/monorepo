# Telegram Bot Ecosystem — Arquitetura Real

## Visão Geral

Ecossistema de bots Telegram para o Hermes Gateway + homelab operations.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TELEGRAM BOT ECOSYSTEM                                    │
│                    (Hermes Gateway - bare-metal Python)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────┐                                          │
│  │     HERMES GATEWAY                │                                          │
│  │     (bare-metal Python)           │                                          │
│  │     Porta: 8642                   │                                          │
│  │                                   │                                          │
│  │  ┌────────────────────────────┐   │                                          │
│  │  │  @CEO_REFRIMIX_bot        │   │                                          │
│  │  │  Token: 8759194...        │   │                                          │
│  │  │                           │   │                                          │
│  │  │  Polling INDEPENDENTE     │   │                                          │
│  │  │  • Campanhas CEO          │   │                                          │
│  │  │  • Analytics              │   │                                          │
│  │  │  • Voz → STT → TTS       │   │                                          │
│  │  └────────────────────────────┘   │                                          │
│  │                                   │                                          │
│  │  ┌────────────────────────────┐   │                                          │
│  │  │  @HOMELAB_LOGS_bot        │   │                                          │
│  │  │  Token: 8738372...        │   │                                          │
│  │  │                           │   │                                          │
│  │  │  • System alerts          │   │                                          │
│  │  │  • CI/CD notifications    │   │                                          │
│  │  │  • Error reports          │   │                                          │
│  │  └────────────────────────────┘   │                                          │
│  └──────────────────────────────────┘                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Arquitetura Real — Detalhada

### Sistema 1: Hermes Gateway (bare-metal Python)

| Atributo | Valor |
|----------|-------|
| **Localização** | bare-metal Python (não Docker) |
| **Porta** | 8642 |
| **URL Base** | `http://127.0.0.1:8642` |
| **Bots** | @CEO_REFRIMIX_bot, @HOMELAB_LOGS_bot |
| **Modo** | Polling (independente) |

**Tokens:**
```
HERMES_GATEWAY_BOT_TOKEN=${HERMES_GATEWAY_BOT_TOKEN}  # @CEO_REFRIMIX_bot
HOMELAB_LOGS_BOT_TOKEN=${HOMELAB_LOGS_BOT_TOKEN}  # @HOMELAB_LOGS_bot
```

### Regras de Ouro (para LLMs futuros)

1. **Polling vs Webhook** — Gateway usa polling
2. **CEO_REFRIMIX_bot** está no Gateway

## Tabela de Tokens Reais

| Bot | Token (parcial) | Sistema | Porta | Modo |
|-----|-----------------|---------|-------|------|
| @CEO_REFRIMIX_bot | `${HERMES_GATEWAY_BOT_TOKEN}` | Hermes Gateway | 8642 | Polling |
| @HOMELAB_LOGS_bot | `${HOMELAB_LOGS_BOT_TOKEN}` | Hermes Gateway | 8642 | Polling |

## URLs de Webhook

```
CEO_REFRIMIX:     https://hermes-gateway.zappro.site/webhook/ceo_refrimix
homelab_logs:     https://hermes-gateway.zappro.site/webhook/homelab_logs
```

## Bots e Especialização

### 1. CEO_REFRIMIX_bot (Sistema: Hermes Gateway)

**Token:** `HERMES_GATEWAY_BOT_TOKEN=${HERMES_GATEWAY_BOT_TOKEN}`

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
- Texto → Processamento CEO
- Multimedia → Download, validação, processamento

### 2. HOMELAB_LOGS_bot (Sistema: Hermes Gateway)

**Token:** `HOMELAB_LOGS_BOT_TOKEN=${HOMELAB_LOGS_BOT_TOKEN}`

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

## Variáveis de Ambiente Reais

### Hermes Gateway (Sistema 1)

```bash
HERMES_GATEWAY_URL=http://127.0.0.1:8642
HERMES_GATEWAY_BOT_TOKEN=${HERMES_GATEWAY_BOT_TOKEN}
HOMELAB_LOGS_BOT_TOKEN=${HOMELAB_LOGS_BOT_TOKEN}
HERMES_ADMIN_USER_IDS=7220607041
HERMES_MAX_FILE_SIZE=20971520  # 20MB
HERMES_MAX_CONCURRENT=3
HERMES_RATE_WINDOW_MS=10000
HERMES_RATE_MAX_MSGS=5
HERMES_MAX_TTS_SIZE_BYTES=52428800  # 50MB
HERMES_MAX_DOWNLOAD_BYTES=20971520  # 20MB
HERMES_VISION_MODEL=qwen2.5vl:7b
HERMES_VOICE=pm_santa
```


## Segurança

### Admin Whitelist

```bash
HERMES_ADMIN_USER_IDS=7220607041
TELEGRAM_ALLOWED_USERS=7220607041
```

### Rate Limiting

| Bot | Mensagens/min | Janela | Burst |
|-----|---------------|--------|-------|
| CEO_REFRIMIX | 5 | 10s | 3 concurrent |
| HOMELAB_LOGS | 20 | 10s | 10 concurrent |

## Deployment

### Hermes Gateway (bare-metal)

```bash
# Polling nativo
python hermes-gateway/main.py
```

