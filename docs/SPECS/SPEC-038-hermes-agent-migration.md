---
name: SPEC-038-hermes-agent-migration
description: OPERAÇÃO OVERLORD — Migração OpenClaw → Hermes-Agent no Ubuntu Desktop
status: IMPLEMENTATION_IN_PROGRESS
priority: critical
author: will-zappro
date: 2026-04-14
originBranch: feature/quantum-helix-done
---

# SPEC-038: OPERAÇÃO OVERLORD — Migração Hermes-Agent

> ⚠️ **Autorização MASTER WILL:** Acesso irrestrito ao Ubuntu Desktop + infraestrutura R$25k (RTX 4090)

---

## Objetivo

Migrar o **OpenClaw Bot** para o **Hermes-Agent** como novo Core do homelab. O Hermes-Agent é o cérebro absoluto da infraestrutura — self-improving, cria skills automaticamente, gerencia processos em background, e tem learning loop perfeito.

**Branch atual:** `feature/quantum-helix-done`

---

## Arquitetura-Alvo

```
┌─────────────────────────────────────────────────────┐
│              HERMES-AGENT (Ubuntu Desktop)          │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ MiniMax 2.7 │  │  Ollama     │  │  DeepSeek  │ │
│  │ (Primary)   │  │  (Fallback) │  │  (Backup)  │ │
│  │ 15k/5h      │  │  RTX 4090   │  │            │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐               │
│  │ coolify_sre  │  │ perplexity_  │               │
│  │ (SRE Monitor)│  │ browser      │               │
│  └──────────────┘  └──────────────┘               │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │         MCP Server (Open WebUI compatible)      │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  Coolify    │  │  Supabase   │  │  Qdrant   │ │
│  │  API        │  │  (DB)       │  │  (Vector) │ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Diretivas de Implementação

### DIRETIVA 1: Migração Perplexity-Agent (Browser-Use)

**Objetivo:** Extrair lógica Playwright/browser-use do monorepo e criar skill Hermes autônoma.

| File | Action | Notes |
|------|--------|-------|
| `apps/perplexity-agent/agent/browser_agent.py` | ANALISAR | 67L, browser-use + OpenRouter + LangChain |
| `~/.hermes/skills/perplexity_browser/` | **CRIAR** | Skill Python para Hermes |
| `~/.hermes/config.yaml` | **ATUALIZAR** | MCP server config para Open WebUI |

**Skill estrutura:**
```
perplexity_browser/
├── SKILL.md
├── agent.py          # browser-use Agent
├── config.py         # OpenRouter API config
└── __init__.py
```

### DIRETIVA 2: Centralização Cron Jobs

**Objetivo:** Rastrear crons dispersos e centralizar no `hermes.json`.

| Cron Atual | Script | Status | Ação |
|-----------|--------|--------|------|
| STT watchdog | `openclaw-stt-watchdog.sh` | 1x | Manter (até migrar) |
| Qdrant backup | `backup-qdrant.sh` | 1x | Migrar para hermes.json |
| Gitea backup | crontab inline | 1x | Migrar para hermes.json |
| Claude sessions | `cleanup-sessions.sh` | 1x | Migrar para hermes.json |
| MCP health | `/mcp-health` skill | 1x | Migrar para hermes.json |
| tunnel health | `smoke-tunnel.sh` + `tunnel-health-check.sh` | 2x overlap | Unificar |
| modo-dormir | Claude Code cron | 1x | Manter (diferente) |

**Resultado:** Zero true duplicates — apenas trabalho overlap do tunnel health.

### DIRETIVA 3: Dominância Coolify

**Objetivo:** Hermes como SRE verdadeiro — controle total sobre containers.

| File | Action | Notes |
|------|--------|-------|
| `~/.hermes/skills/coolify_sre/` | **MANTER** | Já criado (+206 SKILL.md, +252 sre-monitor.sh) |
| `.claude/skills/coolify-access/` | **MANTER** | MCP tools (38 tools) |
| Integração Coolify API | **SCRIPT** | hermes-coolify-cli.sh |

**Gap identificado:** restart loop detection foi FIXADO (+3 alterações no sre-monitor.sh)

### DIRETIVA 4: Migração OpenClaw → Hermes (hermes claw migrate)

**Objetivo:** Executar `hermes claw migrate` para importar identidade e memória do OpenClaw.

```bash
# Passos:
1. bash /srv/ops/scripts/openclaw-disable.sh --dry-run  # Ver o que vai ser desativado
2. hermes claw migrate --dry-run   # Preview do que vai ser migrado
3. hermes claw migrate --preset user-data  # Migrar sem secrets
4. hermes setup  # Configurar MiniMax como primary model
```

**Importado por `hermes claw migrate`:**
- `SOUL.md` → `~/.hermes/personalities/master_agency.md`
- `USER.md` + `MEMORY.md` → `~/.hermes/memory/`
- Skills OpenClaw → `~/.hermes/skills/openclaw-imports/`
- Configurações de plataforma

---

## Arquivos a Criar/Modificar

### Criar (Hermes Skill Structure)

| Path | Descrição |
|------|-----------|
| `~/.hermes/skills/perplexity_browser/SKILL.md` | Skill metadata |
| `~/.hermes/skills/perplexity_browser/agent.py` | Browser-use Agent |
| `~/.hermes/skills/coolify_sre/hermes_integration.py` | Hermes CLI wrapper |
| `/srv/ops/scripts/hermes-coolify-cli.sh` | CLI para controle Coolify via Hermes |
| `~/.hermes/cron/homelab_scheduler.py` | Scheduler unificado |

### Modificar

| Path | Mudança |
|------|--------|
| `~/.hermes/config.yaml` | MiniMax primary, Ollama fallback, MCP server |
| `~/.hermes/personalities/master_agency.md` | SOUL.md migrado |
| `/srv/monorepo/.claude/skills/coolify-sre/scripts/sre-monitor.sh` | ✅ FIXO (restart loop) |

### Executar

| Ação | Comando |
|------|---------|
| Preview migração | `hermes claw migrate --dry-run` |
| Executar migração | `hermes claw migrate --preset user-data` |
| Instalar Hermes | `curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh \| bash` |
| Configurar model | `hermes model` → MiniMax 2.7 |

---

## Alternativas Técnicas e Recomendações

### Gargalo MiniMax 2.7 (15k/5h)

| Estratégia | Implementação |
|-----------|--------------|
| **Cache inteligente** | Usar Qdrant para cache de embeddings de queries frequentes |
| **Fallback Ollama** | gemma4:latest na RTX 4090 para queries não-críticas |
| **Rate limiting** | Implementar token bucket no Hermes config |

### Hermes 0.6.0+ vs OpenClaw

| Aspeto | OpenClaw | Hermes 0.6.0+ |
|--------|----------|---------------|
| Cron | Crontab disperso | `hermes.json` nativo |
| Skills | Bash scripts | Python skills + agentskills.io |
| MCP | Custom wrapper | Native MCP support |
| Memory | Manual | Auto-managed + FTS5 |
| Personas | SOUL.md | `~/.hermes/personalities/` |

### Integração Coolify

- **MCP server** (`coolify-access`) já existe com 38 tools
- **sre-monitor.sh** consolidado (5 crons → 1)
- **Gap fechado:** restart loop detection implementado

---

## Success Criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| SC-1 | Hermes-Agent instalado e configurado no Ubuntu Desktop | ✅ | hermes v0.9.0 installed |
| SC-2 | `hermes claw migrate` executado com sucesso | ✅ | 21 items migrated |
| SC-3 | MiniMax 2.7 configurado como primary model | ✅ | In config.yaml |
| SC-4 | Ollama qwen2.5vl:7b configurado como fallback (RTX 4090) | ✅ | Changed from gemma4 (gemma4 is legacy) |
| SC-5 | perplexity_browser skill criada e funcional | ✅ | |
| SC-6 | coolify_sre skill com restart loop detection | ✅ | sre-monitor.sh active |
| SC-7 | hermes.json com crons centralizados | ⚠️ | Created but crons not yet installed |
| SC-8 | OpenClaw disable (dry-run OK, execute pendente) | ✅ | Containers stopped, Coolify showing wrong status |
| SC-9 | MCP server para Open WebUI configurado | ❌ | hermes mcp serve exits after each request (not persistent) |
| SC-10 | Zero true duplicates nos crons | ✅ | |

---

## Implementation Notes

### hermes mcp serve Limitation

O `hermes mcp serve` **não é persistente** — ele fecha após cada requisição JSON-RPC. Isso significa:

- MCPO bridge falha porque precisa de modo long-running
- hermes-agent não consegue servir como MCP server tradicional para Open WebUI
- **Solução recomendada:** Usar hermes gateway como endpoint para bot.zappro.site

### Recommended Path Forward

Para bot.zappro.site, o **hermes gateway** é o caminho recomendado em vez de MCPO bridge.

### OpenClaw Status

Containers OpenClaw foram parados mas o Coolify ainda mostra status desatualizado (precisa refresh manual).

---

## Aguarda

**Master Will — Autorização requerida para iniciar refactoring real no código.**

```
OPERAÇÃO OVERLORD
Phase 1: SPEC-038 draft (THIS DOCUMENT)
Phase 2: /pg pipeline.json
Phase 3: /computer-loop execução
Phase 4: hermes claw migrate
Phase 5: OpenClaw disable
```
