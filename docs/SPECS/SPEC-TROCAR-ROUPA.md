# SPEC-TROCAR-ROUPA: Monorepo + ~/.claude Template Clothing Swap

**Status:** READY
**Date:** 2026-04-09
**Author:** will
**Type:** SPEC

---

## OBJETIVO

Trocar a "roupa" externa (estrutura de apps/packages/tooling) do monorepo e do template global ~/.claude, preservando o "corpo" (documentação, agentes, workflows, skills, Obsidian).

---

## METÁFORA OPERACIONAL

**CORPO** = tudo que é conhecimento, memória, inteligência do sistema
**ROUPA** = estrutura de pastas, configs, packages, tooling externo

---

## ESCOPO 1 — MONOREPO (/srv/monorepo)

### CORPO (NUNCA TOCAR)

| Área | Conteúdo |
|------|----------|
| *.md | Todos os markdown |
| obsidian/ | Vault completo |
| .agent/ | agents, skills, workflows |
| docs/ | Todos os subdiretórios |
| .context/ | AI-context layer |
| .claude/skills/ | Skills reais |
| .claude/agents/ | Agents reais |
| .claude/commands/ | Commands reais |
| .claude/rules/ | Rules reais |
| .claude/hooks/ | Hooks reais |
| .github/workflows/ | CI/CD GitHub |
| .gitea/workflows/ | CI/CD Gitea |
| tasks/ | pipeline.json, plans |
| scripts/ | Operacionais |
| docker-compose.yml | Services |
| .env.example | Template env |
| .gitignore | Git ignore |

### ROUPA (SUBSTITUIR)

| Item | Status | Ação |
|------|--------|------|
| apps/backend/ | **REAL** | RENOMEAR → apps/api/ |
| apps/frontend/ | **REAL** | RENOMEAR → apps/web/ |
| apps/perplexity-agent/ | **REAL** | MANTER |
| apps/orchestrator/ | **REAL** | MANTER (se tiver src/) |
| packages/typescript-config/ | **REAL** | RENOMEAR → packages/config/ |
| packages/ui-mui/ | **REAL** | RENOMEAR → packages/ui/ |
| packages/zod-schemas/ | **REAL** | MANTER |
| turbo.json | **GENÉRICO** | REESCREVER com pipeline novo |
| pnpm-workspace.yaml | **GENÉRICO** | REESCREVER |
| package.json raiz | **GENÉRICO** | REESCREVER |
| tests/ | **MISSING** | CRIAR estrutura |

### NOVA ESTRUTURA

```
/srv/monorepo/
├── apps/
│   ├── api/            # tRPC + Fastify + Zod (renamed from backend)
│   ├── web/            # Next.js/React (renamed from frontend)
│   ├── workers/        # Background jobs (NEW)
│   └── perplexity-agent/ # Python + Streamlit (MANTER)
│
├── packages/
│   ├── config/         # eslint, tsconfig (renamed from typescript-config)
│   ├── db/             # Drizzle ORM (NEW)
│   ├── ui/             # shadcn/ui components (renamed from ui-mui)
│   ├── trpc/           # tRPC routers (NEW)
│   ├── env/            # Zod validation (NEW)
│   ├── email/          # React Email (NEW)
│   └── zod-schemas/    # MANTER existente
│
├── scripts/             # MANTER + adicionar db-migrate.sh, db-seed.sh, validate-env.sh
├── tests/              # NOVO: unit/, integration/, e2e/, smoke/
├── docs/               # CORPO
├── obsidian/           # CORPO
├── tasks/              # CORPO
├── .claude/            # CORPO
├── .agent/             # CORPO
├── .context/           # CORPO
├── .github/            # CORPO
├── .gitea/             # CORPO
├── turbo.json          # NOVO
├── pnpm-workspace.yaml # NOVO
├── package.json        # NOVO
└── .gitignore          # MANTER
```

---

## ESCOPO 2 — ~/.claude GLOBAL

### CORPO ~/.claude (PRESERVAR)

| Item | Ação |
|------|------|
| mcp-servers.json | **NUNCA TOCAR** |
| env vars existentes | **NUNCA REESCREVER** |
| keys/tokens | **NUNCA MOVER/HARDCODAR** |
| settings.json env | **PRESERVAR INTACTA** |
| skills reais | **PRESERVAR** |
| agents reais | **PRESERVAR** |

### ROUPA ~/.claude (WIRE/ADICIONAR)

**1. settings.json — WIRE HOOKS:**
```json
{
  "permissions": {
    "bypassPermissions": false
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{"type": "command", "command": "~/.claude/hooks/PreToolUse-Bash-validate.bash"}]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{"type": "command", "command": "~/.claude/hooks/PreToolUse-Edit-validate.bash"}]
      }
    ]
  }
}
```

**2. ALIASES ~/.bashrc:**
```bash
# cm = Claude Code via MiniMax (mclaude)
alias cm='ANTHROPIC_BASE_URL="https://api.minimax.io/anthropic" \
  ANTHROPIC_AUTH_TOKEN="${MINIMAX_API_KEY}" \
  ANTHROPIC_MODEL="MiniMax-M2.7" \
  API_TIMEOUT_MS="3000000" \
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1" \
  claude'

# c = Claude Code OAuth Anthropic original
alias c='claude'

# cd = Claude Code sem bypass
alias cd='claude --dangerously-skip-permissions=false'
```

### DELETAR ~/.claude

| Tipo | Critério |
|------|----------|
| skills | 0 bytes ou só frontmatter |
| agents | demo sem conteúdo real |
| commands | duplicados |
| configs | vazaram de outros projetos |

---

## REGRAS ABSOLUTAS DE SEGURANÇA

1. **NUNCA** reescrever mcp-servers.json
2. **NUNCA** hardcodar ANTHROPIC_AUTH_TOKEN ou MINIMAX_API_KEY
3. **SEMPRE** usar ${ENV_VAR} nos aliases
4. bypassPermissions **DEVE** ser false
5. Se secret em plaintext → CRITICAL_SECRET_EXPOSED (não apagar)

---

## EXECUÇÃO (10 AGENTS)

### Agent 1-2: MONOREPO — Inventory & Rename
- Listar apps/packages atuais
- Determinar o que é REAL vs TEMPLATE
- Renomear: backend→api, frontend→web, typescript-config→config, ui-mui→ui
- Criar packages/db/, packages/trpc/, packages/env/, packages/email/
- Criar apps/workers/

### Agent 3-4: MONOREPO — Turbo/Pnpm/Package
- Criar turbo.json com pipeline: build → test → lint → typecheck, dev em paralelo
- Criar pnpm-workspace.yaml apontando apps/* e packages/*
- Criar package.json raiz com scripts: db:migrate, db:seed, format, syncpack

### Agent 5-6: MONOREPO — Tests & Scripts
- Criar tests/unit/, tests/integration/, tests/e2e/, tests/smoke/
- Adicionar scripts/db-migrate.sh, db-seed.sh, validate-env.sh

### Agent 7-8: ~/.claude — Settings & Aliases
- Ler settings.json atual
- Adicionar seção hooks sem substituir
- Garantir bypassPermissions: false
- Criar snippet aliases para ~/.bashrc

### Agent 9: ~/.claude — Audit & Cleanup
- Listar skills vazias, agents demo, commands duplicados
- Marcar para deletion
- NÃO tocar mcp-servers.json

### Agent 10: VALIDATION
- Verificar: 0 template genérico, body intacto, aliases prontos, hooks wired

---

## SUCCESS CRITERIA

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | apps/api/ existe (renamed) | ls apps/ |
| SC-2 | apps/web/ existe (renamed) | ls apps/ |
| SC-3 | packages/config/ existe | ls packages/ |
| SC-4 | turbo.json válido | cat turbo.json \| jq |
| SC-5 | pnpm-workspace.yaml válido | cat pnpm-workspace.yaml |
| SC-6 | tests/ criado | ls tests/ |
| SC-7 | ~/.claude/settings.json tem hooks | grep hooks settings.json |
| SC-8 | bypassPermissions=false | grep bypassPermissions settings.json |
| SC-9 | Aliases prontos | grep -E "^alias (cm|c|cd)" ~/.bashrc |
| SC-10 | Body intacto | git status docs/ .agent/ obsidian/ |

---

## OPEN QUESTIONS

| # | Question | Blocks |
|---|----------|--------|
| OQ-1 | orchestrator é real ou stub? | Agent 1 |
| OQ-2 | packages/zod-schemas/ renomear ou manter? | Agent 1 |
| OQ-3 | workers/ usa qual tech stack? | Agent 2 |

---

**Última atualização:** 2026-04-09
