---
type: adr
name: ADR-002 Hermes Gateway Loopback Hardening
description: Hermes API server bound to 127.0.0.1 with cloudflared tunnel as single entry point
status: active
generated: 2026-04-20
author: William
---

# ADR-002 — Hermes Gateway Loopback Hardening

## Problema

Hermes Gateway API server was showing "No API key configured" warning and was potentially accessible on all interfaces (0.0.0.0:8642). Since Hermes is accessed via cloudflared tunnel, public binding is unnecessary and violates defense-in-depth.

## Decisões

1. **Loopback binding:** Hermes API server bound to `127.0.0.1:8642` only
2. **Cloudflared as entry:** All external access via `hermes.zappro.site` through cloudflared tunnel
3. **API key optional:** When bound to loopback, API key is optional (only local processes can reach)
4. **Config nesting:** `platforms.api_server.extra.host/port/key` structure in YAML (not flat `api_server`)

## Arquitectura Resultante

```
Internet → Cloudflare → cloudflared tunnel → localhost:8642 → Hermes
                                            ↑
                                       127.0.0.1 only
```

## Configuração

```yaml
platforms:
  api_server:
    extra:
      host: "127.0.0.1"
      port: 8642
      key: ""  # opcional quando em loopback
```

## Trade-offs

| Prós | Contras |
|------|---------|
| Sem exposição direta à internet | Acesso local requer SSH tunnel |
| Defense-in-depth (tunnel + loopback) | -- |
| API key opcional reduz complexidade | -- |
| cloudflared gere auth via Cloudflare Access | -- |
