# Service State

> Last updated: 2026-04-17
> Auto-generated from health checks and smoke tests

## Service State Table

| Service            | Port  | URL                    | Status | Last Check | Notes                    |
| ------------------ | ----- | ---------------------- | ------ | ---------- | ------------------------ |
| ai-gateway         | 4002  | http://localhost:4002  | CHECK  | 2026-04-17 | OpenAI-compatible facade |
| LiteLLM            | 4000  | http://localhost:4000  | CHECK  | 2026-04-17 | LLM proxy (production)   |
| Hermes Gateway     | 8642  | http://localhost:8642  | CHECK  | 2026-04-17 | Agent gateway            |
| Hermes MCPO        | 8092  | http://localhost:8092  | CHECK  | 2026-04-17 | MCP over HTTP            |
| Ollama             | 11434 | http://localhost:11434 | CHECK  | 2026-04-17 | Local LLM + Vision       |
| Kokoro TTS         | 8013  | http://localhost:8013  | CHECK  | 2026-04-17 | TTS Bridge               |
| faster-whisper STT | 8204  | http://localhost:8204  | CHECK  | 2026-04-17 | Whisper medium-pt        |
| wav2vec2 STT       | 8202  | http://localhost:8202  | CHECK  | 2026-04-17 | Canonical STT            |
| Qdrant             | 6333  | http://localhost:6333  | CHECK  | 2026-04-17 | Vector DB                |
| PostgreSQL         | 5432  | localhost:5432         | CHECK  | 2026-04-17 | Primary DB               |
| Redis              | 6379  | localhost:6379         | CHECK  | 2026-04-17 | Cache + Rate Limits      |
| n8n                | CHECK | CHECK                  | CHECK  | 2026-04-17 | Workflow automation      |
| Coolify            | 8000  | CHECK                  | CHECK  | 2026-04-17 | PaaS (Cloudflare)        |

## Status Legend

- **UP** — Service is healthy and responding
- **DOWN** — Service is not responding
- **CHECK** — Status unknown / needs verification
- **DEGRADED** — Service is up but with warnings

## Smoke Tests

Run: `bash /srv/monorepo/smoke-tests/smoke-multimodal-stack.sh`

## Auto-Health

Cron job `mcp-health-daily` runs at 08:00 and updates this file.
