---
spec: SPEC-201
title: Resolução Dual-Polling @CEO_REFRIMIX_bot vs @editor_social_bot
status: active
date: 2026-04-24
author: SRE Session
---

# SPEC-201 — Resolução Dual-Polling: Hermes Gateway vs Hermes Agency

## Problema

Python Hermes Gateway e TypeScript Hermes Agency estavam ambos usando o mesmo `@CEO_REFRIMIX_bot` token (TELEGRAM_BOT_TOKEN=8759194670:AAH...).

No Telegram, apenas **um processo** pode fazer long-polling por bot token simultaneamente. Mensagens eram "roubadas" entre os dois sistemas.

## Solução Aplicada

**Bots separados:**

| Sistema | Bot | Token Var | Status |
|---------|-----|-----------|--------|
| Hermes Gateway (Python) | @CEO_REFRIMIX_bot | TELEGRAM_BOT_TOKEN | ATIVO |
| Hermes Agency (TypeScript) | @editor_social_bot | EDITOR_SOCIAL_BOT_TOKEN | ATIVO |

## Implementação

### Hermes Agency — docker-compose.yml

```yaml
environment:
  - NODE_ENV=production
  - TELEGRAM_BOT_TOKEN=8740522933:AAEkDbKfMeUyZW70SZRZGJ-B8cB6lkJFhcA
  - QDRANT_URL=http://zappro-qdrant:6333
  - REDIS_URL=redis://:Fifine156458*@zappro-redis:6379
```

### Hermes Gateway — .env (já existente)

```env
TELEGRAM_BOT_TOKEN=8759194670:AAHntxPUsfvbSrYNwOhBGuNUpmeCUw1-qY
```

## Verificação

```bash
# Ver qual bot cada sistema está usando
grep -E "BOT_TOKEN|editor_social" /srv/monorepo/.env

# Ver containers rodando
docker ps | grep hermes
```

## Resultado

- Python Gateway polling @CEO_REFRIMIX_bot (8759194670:...)
- TypeScript Agency polling @editor_social_bot (8740522933:...)
- **Sem conflito de polling**
- Cada sistema responde em contextos diferentes (gateway = operacional, agency = marketing)

## Status

✅ RESOLVIDO — 2026-04-24