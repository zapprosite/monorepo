# Home Lab Knowledge Base

**Host:** will-zappro | **Repo:** github.com/zapprosite/monelab | **MCP:** 10.0.19.50:4006

---

## Guias

| Guia | Descrição |
|------|-----------|
| [Gitea + Coolify](./guides/gitea-coolify.md) | CLI tools para Gitea e Coolify |
| [Manutenção Contínua](./guides/manutencao-continua.md) | Procedimentos de manutenção |
| [Memória Claude](./guides/memoria-claude.md) | Configuração e uso do Claude Code |
| [OpenCode](./guides/opencode.md) | Guide OpenCode |
| [Security Hardening](./guides/security-hardening.md) | Fortalecimento de segurança |
| [Infisical](./guides/infisical.md) | Vault Infisical self-hosted |
| [Whisper Auto Local](./guides/whisper-auto-local.md) | Transcrição automática local |

## Logs

| Log | Descrição |
|-----|-----------|
| [Homelab](./logs/homelab.md) | Registro de operações do homelab |
| [OpenClaw](./logs/openclaw.md) | Log do bot OpenClaw |

## Planos

| Plano | Descrição |
|-------|-----------|
| [OpenClaw Agency Hub](./plans/open-claw-agency.md) | Plano de transformação em hub de agência |

## Skills

| Skill | Descrição |
|-------|-----------|
| [OpenClaw Agents Kit](./OPERATIONS/SKILLS/openclaw-agents-kit/SKILL.md) | Kit universal: transforma OpenClaw em orquestrador de agents (leader + sub-agents). Inclui: Coolify API, Infisical SDK, identity-patch, governance template, sub-agent patterns |
| [TTS Bridge](./OPERATIONS/SKILLS/tts-bridge.md) | Filtro de vozes Kokoro (pm_santa/pf_dora only) |
| [Container Health Check](./OPERATIONS/SKILLS/container-health-check.md) | Health + recursos de containers |

## ADRs

Ver [docs/ADRs/README.md](./ADRs/README.md) — consolidado de `docs/adr/`, `docs/ADR/` e `docs/adrs/`

## Context

| Contexto | Descrição |
|----------|-----------|
| [Claude Resolve](./context/claude-resolve.md) | Resolução de problemas Claude |

---

## Estrutura

```
docs/
├── guides/      # Guias de manutenção (7 arquivos)
├── logs/        # Logs de operação (2 arquivos)
├── adrs/        # ADRs do projeto (18 arquivos)
├── plans/       # Planos (1 arquivo)
└── context/     # Contexto AI (1 arquivo)

obsidian/        # Espelho Obsidian (mesma estrutura)
```

## Para Agentes

Este knowledge base é lido pelo **OpenClaw Bot** via MCP server em `10.0.19.50:4006`.
Todas as ferramentas do MCP estão disponíveis em `/mcp-monorepo/server.py`.

---

*Última atualização: 2026-04-10*
