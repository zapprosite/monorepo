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

## Secrets

- **`.env` é a ÚNICA fonte canónica** — Infisical foi pruned (legacy). Ler via `process.env` apenas.
- Infisical SDK PROIBIDO em qualquer código (apps, packages, scripts)
- Secret ausente → gerar (`openssl rand -hex 32`) e adicionar a `.env` + `.env.example` (placeholder)
- Never hardcode secrets — regra de ouro anti-hardcoded
- Run `/sec` audit antes de cada push

## Related

- AGENTS.md: Full agent system
- apps/\*/CLAUDE.md: App specifics
- packages/\*/CLAUDE.md: Package specifics
