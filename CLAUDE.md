# Project Rules

## Quick Start

1. Read AGENTS.md first
2. Use `/spec` for new features (PRD→SPEC→ADRs→Pipeline)
3. Use `/pg` to generate tasks from SPECs
4. Use `/ship` for commits

## Stack

- Backend: Fastify + tRPC + Orchid ORM
- Frontend: React 19 + MUI + tRPC
- Validation: Zod (shared)
- Build: Turbo + pnpm

## Commands

| Cmd        | Use                               |
| ---------- | --------------------------------- |
| `/spec`    | Full spec-driven workflow         |
| `/pg`      | Generate pipeline.json from SPECs |
| `/feature` | Create feature branch + PR        |
| `/ship`    | Commit + push + PR                |
| `/turbo`   | Commit + merge + tag              |
| `/img`     | Image analysis (Qwen2.5-VL)       |

## Rules

- Docs: PT-BR | Code: EN
- No secrets in code
- Test before commit
- Keep modules independent

## Spec-Driven Flow

```
/spec <desc> → docs/PRDs/ → docs/specflow/SPEC-*.md → /pg → tasks/pipeline.json
```

## Secrets & Env Vars (Anti-Hardcoded)

> **Regra de ouro:** Zero hardcode — URLs, portas, tokens, model names, API keys. Tudo via `process.env`.

- **`.env` é a ÚNICA fonte canónica** — Infisical pruned. Ler via `process.env` apenas.
- Infisical SDK PROIBIDO em qualquer código
- Secret ausente → `openssl rand -hex 32` → `.env` + `.env.example`
- **URLs e portas também são env vars** — nunca `http://localhost:8202` hardcoded
- Comentar topo de cada ficheiro: `// Anti-hardcoded: all config via process.env`
- Run `/sec` audit antes de cada push
- Regras: `.claude/rules/anti-hardcoded-env.md`

## Related

- AGENTS.md: Full agent system
- apps/\*/CLAUDE.md: App specifics
- packages/\*/CLAUDE.md: Package specifics

## AI Gateway (SPEC-047/048)

`apps/ai-gateway/` — Porta `:4002`. Ponto único OpenAI-compat para toda a stack multimodal:

- **Texto** → `gpt-4o` → `Gemma4-12b-it` (via Ollama)
- **Visão** → `gpt-4o-vision` → `Qwen3-VL-8B-Instruct` via Ollama/LiteLLM
- **Voz (TTS)** → `tts-1`/`tts-1-hd` → TTS Bridge `:8013` → Kokoro (`pm_santa`/`pf_dora`)
- **STT** → `whisper-1` → whisper-medium-pt (`:8204`) via faster-whisper OpenAI-compat — WER 6.6% PT-BR
- **Hermes** usa ai-gateway para STT; TTS directo `:8013`; Vision directo Ollama
- `AI_GATEWAY_FACADE_KEY` — chave única em `.env`
- Smoke: `bash smoke-tests/smoke-multimodal-stack.sh` (13/13)
