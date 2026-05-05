# AGENTS.md — services/orchestrator

> 🦍 Leia: [CONTRACT.md](../../homelab-context/CONTRACT.md) — Modo Gorila: direto, focado, token-efficient.

Dockerized FastAPI service — JSON-RPC tools server for Hermes. Exposes MCPO
tools (start, status, checkpoint, resume) backed by LangGraph state graph
and session persistence (SQLite). Health check at /health, tool listing at
/tools, RPC dispatch at /rpc.
