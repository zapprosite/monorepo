---
spec: SPEC-203
title: Diagnóstico e Restart zappro-litellm (:4000)
status: pending
date: 2026-04-24
author: SRE Session
---

# SPEC-203 — Diagnóstico e Restart zappro-litellm (:4000)

## Sintoma

zappro-litellm na porta `:4000` pode estar down ou não respondendo.

## Diagnóstico

```bash
# 1. Verificar se container existe
docker ps -a | grep litellm

# 2. Ver logs
cd /home/will/zappro-lite && docker compose logs litellm --tail 50

# 3. Health check
curl http://127.0.0.1:4000/health

# 4. Ver uso de memória
docker stats --no-stream | grep litellm
```

## Ação

```bash
cd /home/will/zappro-lite && docker compose up -d
```

## Se problema persistir

1. Verificar `/srv/data/zappro-router/config.yaml` (yaml válido)
2. Verificar `MINIMAX_API_BASE=https://api.minimax.io` (SEM `/anthropic/v1`)
3. Verificar variáveis de ambiente no compose

## Status

⏳ PENDENTE — Aguarda diagnóstico