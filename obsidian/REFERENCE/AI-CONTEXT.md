# AI-CONTEXT — Sincronização de Documentação

**Data:** 2026-04-07
**Stack:** ai-context MCP → memory-keeper → Qdrant

---

## O que é

O **ai-context MCP** sincroniza documentação entre sistemas, mantendo o contexto persistente dos agentes atualizado após cada feature.

```
/srv/monorepo/docs/          →  ~/.claude/projects/-srv-monorepo/memory/
     ↑                                           ↓
     └── source of truth                         └── contexto persistente
                                                   (lido por todos os agentes)
```

---

## Quando Rodar

| Situação | Trigger |
|----------|---------|
| Após implementar feature | `/ai-context` no Claude Code |
| Após mudança de infra | `/ai-context` no Claude Code |
| Antes de sessão longa | ai-context-sync manual |
| Weekly maintenance | Cron job automático |

---

## Comandos

```bash
# No Claude Code CLI
/ai-context

# Manual (shell)
/home/will/.claude/mcps/ai-context-sync/sync.sh

# Verificar status
cat /home/will/.claude/mcps/ai-context-sync/manifest.json
```

---

## O que é Sincronizado

| Source | Target | O que |
|--------|--------|-------|
| `docs/GOVERNANCE/SYSTEM_STATE.md` | `memory/system_state.md` | Estado atual do sistema |
| `/srv/monorepo/docs/` | Memory context | Docs incrementais |
| `.context/docs/` (monorepo) | Memory | Docs auto-gerados |

---

## Fluxo Completo — Feature

```
1. Claude Code implementa feature
       ↓
2. Git commit + PR merge
       ↓
3. /ai-context → sincroniza docs atualizados
       ↓
4. Memory context fica fresco para próxima sessão
       ↓
5. OpenClaw pode consultar via MCP monorepo (read-only)
```

---

## Estrutura do Memory

```
~/.claude/projects/-srv-monorepo/memory/
├── system_state.md          # Estado do homelab
├── user.md                  # Perfil do usuário
├── feedback.md             # Correções e confirmações
├── project.md              # Work in progress
└── reference.md            # Pointers para sistemas externos
```

---

## Integração com OpenClaw

O OpenClawconsulta o knowledge base via:
- **MCP monorepo** (`10.0.19.50:4006`) — acesso read-only aos docs
- **Qdrant collections** — memória vetorial (briefs, campaigns, knowledge)
- **doc-librarian skill** — auditoria de docs stale

```
OpenClaw → MCP monorepo (docs) + Qdrant (memória vetorial)
                     ↓
              docs/index.md
              docs/WORKFLOW.md
              docs/AI-CONTEXT.md
```

---

## Workflow de 3 Tools + AI-CONTEXT

```
┌──────────────────────────────────────────────────────────────┐
│  Claude Code CLI (host)                                      │
│  /feature → implementa → /ship → COMMIT + PR                 │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
                    /ai-context
                           ↓
┌──────────────────────────────────────────────────────────────┐
│  AI-CONTEXT (automatico)                                    │
│  Sincroniza: docs/ → memory/ + SYSTEM_STATE.md              │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│  OpenClaw Bot (Telegram)                                    │
│  doc-librarian: verifica frescor dos docs                   │
│  qdrant-rag: indexa nova documentação                        │
└──────────────────────────────────────────────────────────────┘
```

---

## Verificação

```bash
# Ver últimos syncs
cat /home/will/.claude/mcps/ai-context-sync/manifest.json | jq '.last_sync'

# Verificar se memory está fresco
ls -la ~/.claude/projects/-srv-monorepo/memory/

# Testar via OpenClaw
@CEO_REFRIMIX_bot /buscar "última sincronização ai-context"
```

---

### Claude Resolve Integration

Claude Resolve é o mecanismo de resolução de contexto do sistema:

```
Claude Code → /ai-context → memória fresca → OpenClaw consulta
                                              ↓
                                    claude-resolve.md (em docs/context/)
```

**Fluxo de Resolução:**
1. Claude Code sincroniza contexto após cada commit
2. OpenClaw consulta via MCP monorepo para contexto persistente
3. Claude Resolve indexa e resolve queries contra docs sincronizados

---

## Docs Relacionados

| Doc | O que |
|-----|-------|
| `docs/WORKFLOW.md` | Visão geral das 3 tools + AI-CONTEXT |
| `docs/MCPs/AI_CONTEXT_MCP.md` | Setup técnico do MCP |
| `docs/OPERATIONS/SKILLS/doc-librarian/SKILL.md` | Skill de auditoria de docs |
| `docs/context/claude-resolve.md` | Mecanismo de resolução de contexto |
| `docs/GOVERNANCE/CONTRACT.md` | Princípios non-negotiable |
