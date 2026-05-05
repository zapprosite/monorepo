# AGENTS.md — libs/memory

> 🦍 Leia: [CONTRACT.md](../../homelab-context/CONTRACT.md) — Modo Gorila: direto, focado, token-efficient.

HCE v2.1 Memory Manager — SQLite-based short-term memory for context sessions.
Handles DB bootstrap, corruption detection, schema migration, and session-scoped
CRUD. Configurable via MEMORY_DB_PATH env var.
