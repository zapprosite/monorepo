# AI Tools Workflow — homelab

**Data:** 2026-04-08
**Stack:** Claude Code CLI + OpenCode CLI + Hermes Agent Bot + ai-context MCP

---

## Visão Geral — 3 Tools, 3 Papéis

| Tool                | Quando Usar                                                    | Acesso                       |
| ------------------- | -------------------------------------------------------------- | ---------------------------- |
| **Claude Code CLI** | Dev, código, debug, refactor                                   | Host terminal (`c` alias)    |
| **OpenCode CLI**    | Quick tasks, modelos diferentes, desktop                       | Desktop (`opencode`)         |
| **Hermes Agent Bot**    | CEO MIX — assistente e dev senior que orquestra time de agents | Telegram (@CEO_REFRIMIX_bot) |
| **ai-context MCP**  | Sincronizar docs → memory após feature                         | Auto ou manual               |

---

## Fluxo Principal — Feature

```
┌─────────────────────────────────────────────────────────────────┐
│  1. INPUT                                                         │
│     Mestre pede: "criar feature X para cliente Y"                  │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Claude Code CLI (host)                                        │
│     /feature → implementa → /ship → COMMIT + PR                    │
│                                                                 │
│     Ferramentas:                                                  │
│     • Lê/escreve código em /srv/monorepo                          │
│     • MCP monorepo (10.0.19.50:4006) — acesso read-only          │
│     • git, docker, zfs (com approval quando necessário)             │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. AI-CONTEXT (automatico)                                     │
│     Ao fim da feature, sincroniza docs atualizados:                  │
│                                                                 │
│     Source: docs/                                                 │
│       ↓                                                           │
│       ├→ docs/GOVERNANCE/SYSTEM_STATE.md                   │
│       └→ ~/.claude/projects/-home-will/memory/system_state.md      │
│                                                                 │
│     Trigger: /ai-context ou automatico via skill                  │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Hermes Agent Bot (se feature é para cliente)                       │
│     Se cliente Y:                                                   │
│     • qdrant-rag: indexa documentação do cliente no Qdrant        │
│     • multi-client isolation: dados não vazam entre clientes        │
│                                                                 │
│     Se infra/dev:                                                  │
│     • "Rode 'c' no terminal para acionar Claude Code"            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quando Usar Cada Tool

### Claude Code CLI (`c`)

**Use para:**

- Desenvolvimento de features no monorepo
- Refactor, debug, testes
- Explorar código
- ZFS snapshots, docker, terraform (com approval)
- Operações de infraestrutura (com approval quando necessário)

**Não use para:**

- Tarefas administrativas simples (use OpenCode)
- Operações destrutivas (NUNCA sozinho)

**Comandos:**

```bash
c                              # Alias para claude-code
c --agent executive-ceo        # Para decisões estratégicas
c --agent deploy-check          # Antes de deploy
```

---

### OpenCode CLI

**Use para:**

- Quick tasks no desktop
- Quando quer usar modelo diferente (MiniMax direto)
- Tarefas que não precisam de todo contexto do monorepo
- Skim through código sem peso

**Não use para:**

- Desenvolvimento pesado (use Claude Code CLI)
- Operações com estado persistente (sessions são efêmeras)

**Comandos:**

```bash
opencode "pergunta rápida"
opencode --model minimax/MiniMax-M2.7 "task"
```

---

### Hermes Agent Bot (@CEO_REFRIMIX_bot)

**Use para:**

- **CEO MIX — assistente e dev senior que orquestra time de agents** para qualquer nicho (design, marketing, dev, etc)
- Criar e coordenar sub-agents especializados via [Hermes Agent Agents Kit](../OPERATIONS/SKILLS/Hermes Agent-agents-kit/SKILL.md)
- Multi-client work (cada cliente isolado)
- TTS voice responses (Kokoro — pm_santa ou pf_dora)
- Escalation: infra → Claude Code CLI

**Ele sabe (via kit):**

- Skills: `qdrant-rag`, `monorepo-explorer`, `Hermes Agent-repo-hunter`
- MCP: `mcp-monorepo` (read-only /srv/monorepo)
- Qdrant collections: clients-briefs, clients-brand-guides, clients-campaigns, clients-knowledge
- Coolify API + Infisical SDK (acesso seguro a config e secrets)
- Sub-agent patterns: leader designation, bindings, heartbeat, SOUL.md por agente

**Ele NÃO sabe:**

- Edição de código pesado (use Claude Code CLI)

**Escalation:**

```
Infra/Docker/ZFS → "Rode 'c' no terminal"
Dev/Código pesado → Claude Code CLI
```

---

## AI-CONTEXT — Sincronizar Docs

### O que é

ai-context MCP sincroniza documentação entre:

- `docs/` (source of truth)
- `~/.claude/projects/-home-will/memory/` (persistent context)

### Quando Rodar

| Situação                 | Trigger                      |
| ------------------------ | ---------------------------- |
| Após implementar feature | `/ai-context` no Claude Code |
| Após mudança de infra    | `/ai-context` no Claude Code |
| Antes de sessão longa    | ai-context-sync manual       |
| Weekly maintenance       | Cron job                     |

### Comandos

```bash
# Manual
~/.claude/mcps/ai-context-sync/sync.sh

# No Claude Code
/ai-context

# Verificar status
cat ~/.claude/mcps/ai-context-sync/manifest.json
```

### O que é sincronizado

| Source                            | Target                                          |
| --------------------------------- | ----------------------------------------------- |
| `docs/GOVERNANCE/SYSTEM_STATE.md` | `~/.claude/projects/.../memory/system_state.md` |
| `/srv/monorepo/docs/`             | Memory context (incremental)                    |

---

## Workflow Detalhado — Feature para Cliente

### 1. Mestre pede

```
"Preciso criar uma campanha para o cliente ACME"
```

### 2. Hermes Agent — Briefing

Hermes Agent recebe o pedido. Ele:

- Consulta Qdrant: `clients-campaigns` filtrado por `client_id=acme`
- Verifica se BRIEF.md existe em `clients/acme/`
- Se não existe: "Não tenho dados do ACME. Quer que eu crie?"

### 3. Claude Code — Implementação

Se é feature de dev:

```
c /feature criar-campanha-acme
→ implementa no monorepo
→ git commit
→ /ship
```

Se é纯粹 briefing/copy:

- Hermes Agent faz sozinho com Qdrant context

### 4. AI-CONTEXT — Sincronizar

Após qualquer mudança em `docs/`:

```bash
/ai-context
# ou
~/.claude/mcps/ai-context-sync/sync.sh
```

### 5. Hermes Agent — Indexar Resultado

Se a feature produziu documentação relevante para o cliente:

```
"Indexo os docs da campanha no Qdrant?"
→ qdrant-rag upsert (chunk ~500 tokens, metadata rich)
```

---

## Quick Reference — Comandos

### Claude Code CLI

```bash
c                              # Iniciar
c --agent executive-ceo        # Decisões estratégicas
c --agent deploy-check         # Snapshot + health
c --agent security-audit       # OWASP scan
c /ship                        # Commit + PR
c /ai-context                  # Sincronizar docs
```

### OpenCode CLI

```bash
opencode "task"               # Quick task
opencode --model X "task"     # Modelo específico
```

### Hermes Agent Bot (Telegram)

```
@CEO_REFRIMIX_bot

/campanha ACME                # Buscar campanha
/cliente novo [slug]          # Onboard cliente
/buscar [query]               # Qdrant search
/status                       # Health check
```

### AI-CONTEXT

```bash
~/.claude/mcps/ai-context-sync/sync.sh   # Sincronizar
```

---

## Anti-Patterns

| Errado                      | Correto                              |
| --------------------------- | ------------------------------------ |
| Hermes Agent edita código       | Claude Code CLI edita código         |
| OpenCode para dev pesado    | Claude Code CLI para dev             |
| Fazer deploy sem ai-context | Sempre sincronizar docs após mudança |
| Ignorar Qdrant para cliente | Indexar tudo relevante               |

---

## Docs Relacionados

| Doc                                                   | O que                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `docs/GOVERNANCE/CONTRACT.md`                         | Princípios non-negotiable                                      |
| `docs/GOVERNANCE/GUARDRAILS.md`                       | O que pode e não pode                                          |
| `docs/OPERATIONS/SKILLS/Hermes Agent-agents-kit/SKILL.md` | Kit universal — transformar Hermes Agent em orquestrador de agents |
| `docs/guides/Hermes Agent-*.md`                           | Hermes Agent completo                                              |
| `docs/MCPs/AI_CONTEXT_MCP.md`                         | ai-context setup                                               |
| `docs/MCPs/MCP_BLUEPRINT.md`                          | Criar MCP servers                                              |
