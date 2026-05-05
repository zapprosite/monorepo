# AGENTS.md — api

> 🦍 Leia: [CONTRACT.md](../../homelab-context/CONTRACT.md) — Modo Gorila: direto, focado, token-efficient.

Backend principal do monorepo. Duas camadas:
- **TypeScript:** Fastify + tRPC (internal, type-safe) + REST/OpenAPI (external) + OrchidORM + PostgreSQL — porta 3000.
- **Python:** FastAPI — HCE Context API v2.1 (`context.py`) na porta 8642 e Nexus Smart Router (`nexus.py`) para classificação e execução de tarefas.
