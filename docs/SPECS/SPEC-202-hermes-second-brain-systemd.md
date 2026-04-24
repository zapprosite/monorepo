---
spec: SPEC-202
title: Systemd Unit para hermes-second-brain (:6334)
status: pending
date: 2026-04-24
author: SRE Session
---

# SPEC-202 — Systemd Unit para Hermes Second Brain

## Problema

Hermes Second Brain (`/srv/hermes-second-brain/`) não tem systemd unit. Existe apenas duplicata user-level que falha.

## Solução Proposta

Criar `/etc/systemd/system/hermes-second-brain.service`:

```ini
[Unit]
Description=Hermes Second Brain — Mem0 + Qdrant + SQLite API
After=network.target zappro-qdrant.service

[Service]
Type=simple
User=will
WorkingDirectory=/srv/hermes-second-brain
ExecStart=/srv/hermes-second-brain/venv/bin/uvicorn apps.api.main:app --host 127.0.0.1 --port 6334 --workers 1
Restart=unless-stopped
RestartSec=10
Environment=PYTHONPATH=/srv/hermes-second-brain

[Install]
WantedBy=multi-user.target
```

## Ação Secundária

Desabilitar user-level duplicata:
```bash
systemctl --user disable hermes-gateway.service
systemctl --user stop hermes-gateway.service
```

## Verificação

```bash
# Status
systemctl status hermes-second-brain

# Logs
journalctl -u hermes-second-brain -n 50

# Health check
curl http://127.0.0.1:6334/health
```

## Status

⏳ PENDENTE — Aguarda implementação