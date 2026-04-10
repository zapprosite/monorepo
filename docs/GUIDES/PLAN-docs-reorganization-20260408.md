# PLAN: Documentação Pinned — Reorganização AI-First

**Status:** DRAFT
**Created:** 2026-04-08
**Type:** Documentation Reorganization Plan
**Scope:** `/srv/monorepo/docs/`, `.claude/`, `/srv/ops/ai-governance/`

---

## 1. Problemas Identificados

| # | Problema | Evidência |
|---|----------|------------|
| P1 | ADRs em 3 pastas | `docs/adr/` (18) + `docs/ADR/` (4) + `docs/adrs/` (vazio) |
| P2 | AI-CONTEXT duplicado | `docs/AI-CONTEXT.md` + `docs/context/` = mesma info |
| P3 | GOVERNANCE vs OPERATIONS sobrepostos | `DATABASE_GOVERNANCE.md` e `RECOVERY.md` existem em ambos |
| P4 | docs/ demasiado profundo | 17 subdiretorias, muitos níveis |
| P5 | obsidian/ e .context/ roles confusos | obsidian/ = espelho passivo, .context/ = auto-gerado |
| P6 | Fronteiras `.claude/` vs `docs/` vs `/srv/ops/ai-governance/` confusas | fronteiras bluradas |
| P7 | sync.sh hardcoded e incompleto | Only 7 files, não usa glob/wildcard |

---

## 2. Princípios de Design

### 2.1 Modelo de 3 Camadas de Propriedade

```
/srv/ops/ai-governance/     → SYSTEM GOVERNANCE (homelab-level, immutable)
    - Contratos, Guardrails, Approval Matrix
    - Hosts, Network, Storage (ZFS)
    - NOT coupled to monorepo

/srv/monorepo/docs/          → MONOREPO GOVERNANCE (what Claude can do here)
    - GOVERNANCE/   → Rules for THIS repo
    - OPERATIONS/   → Runbooks, skills, recovery
    - INFRASTRUCTURE/ → Repo-specific infra docs
    - MCPs/         → MCP integrations
    - SPECFLOW/     → Spec-driven development

/srv/monorepo/.claude/       → AGENT CONFIGURATION (tools, skills, cron)
    - skills/       → Operational skills (symlinks to docs/OPERATIONS/SKILLS/)
    - agents/       → Agent definitions
    - commands/     → Slash commands
    - rules/        → Per-repo rules
    - hooks/        → Git hooks
    - workflows/    → Workflow definitions
    - scheduled_tasks.json
```

### 2.2 Regras de Fronteira

| Fronteira | Regra |
|-----------|-------|
| `.claude/` vs `docs/` | `.claude/` = config for agents. `docs/` = source of truth for tudo |
| `docs/` vs `/srv/ops/ai-governance/` | `docs/` é a fonte. `/srv/ops/ai-governance/` é um thin mirror para ferramentas de sistema |
| `obsidian/` | Espelho passivo apenas - NUNCA editar diretamente |
| `.context/docs/` | Auto-gerado por agents - NÃO é fonte, NÃO editar manualmente |

### 2.3 Seed Rule

> **Seed Rule:** Seeds só PODEM `add` ou `update`. NUNCA `move`, `rename`, ou `delete` elementos estruturais existentes.

```
PERMITIDO:
  - Adicionar novos *.md em pastas existentes
  - Atualizar conteúdo de *.md existentes
  - Adicionar novas subpastas (com aprovação)
  - Atualizar sync.sh manifest

PROIBIDO (sem plano de migração):
  - Mover *.md entre pastas
  - Renomear pastas
  - Deletar *.md
  - Mudar as fronteiras de camada
```

---

## 3. Estrutura Final docs/

```
docs/                                    # SOURCE OF TRUTH
├── GOVERNANCE/                         # Layer 0: Regras imutáveis
│   ├── CONTRACT.md                     # Princípios não negociáveis
│   ├── GUARDRAILS.md                  # Proibido/Aprovação/Ações seguras
│   ├── APPROVAL_MATRIX.md             # Matriz de decisão
│   ├── CHANGE_POLICY.md              # Processo de mudança segura
│   ├── INCIDENTS.md                   # Log de incidentes
│   ├── SECRETS_POLICY.md              # Política de credenciais
│   ├── DATABASE_GOVERNANCE.md         # (CONSOLIDADO)
│   ├── RECOVERY.md                    # (CONSOLIDADO)
│   ├── QUICK_START.md                 # Onboarding 5-min
│   └── README.md
│
├── OPERATIONS/                         # Layer 1: Runbooks operacionais
│   ├── RUNBOOK.md
│   ├── DB_HISTORY.md
│   ├── guide.md
│   ├── SKILLS/                         # 16 skills operacionais
│   │   ├── zfs-snapshot-and-rollback.md
│   │   ├── zfs-smart-scrub.md
│   │   ├── docker-health-watcher.md
│   │   ├── container-self-healer.md
│   │   ├── oom-killer.md
│   │   ├── monitoring-health-check.md
│   │   ├── monitoring-diagnostic.md
│   │   ├── monitoring-zfs-snapshot.md
│   │   ├── ollama-health-check.md
│   │   ├── litellm-health-check.md
│   │   ├── kokoro-health-check.md
│   │   ├── resource-monitor.md
│   │   ├── ai-stress-test.md
│   │   ├── catalog-sync.md
│   │   ├── alert-deduplicator.md
│   │   ├── backup-rotate-verify.md
│   │   └── maintain-system-documentation.md
│   └── README.md
│
├── INFRASTRUCTURE/                     # Layer 2: Docs infra homelab
│   ├── NETWORK_MAP.md
│   ├── PORTS.md
│   ├── SUBDOMAINS.md
│   ├── PARTITIONS.md
│   ├── SERVICE_MAP.md
│   ├── SYSTEM_STATE.md
│   ├── MONITORING.md                   # Stack Grafana+Prometheus (incident report)
│   └── README.md
│
├── MCPs/                               # Layer 3: Integrações MCP
│   ├── AI_CONTEXT_MCP.md
│   ├── MCP_BLUEPRINT.md
│   ├── MCP_TOKENS_GUIDE.md
│   └── README.md
│
├── WORKFLOW.md                         # Layer 4: Workflow docs (flat)
├── AI-CONTEXT.md                       # (CONSOLIDADO - merge de context/)
│
├── SPECFLOW/                           # Spec-driven development
│   ├── SPEC-README.md
│   ├── SPEC-TEMPLATE.md
│   ├── SPEC-001-*.md                   # SPECs
│   ├── discovery.md
│   ├── tasks.md
│   └── reviews/
│       └── REVIEW-*.md
│
├── TEMPLATES/                          # Layer 5: Templates
│   ├── incident-report.md
│   ├── change-proposal.md
│   ├── new-schema.md
│   ├── new-collection.md
│   └── README.md
│
├── ADRs/                               # (CONSOLIDADO - uma só pasta)
│   ├── 0000-template.md
│   ├── 0001-crm-leads-clientes.md
│   ├── 0002-crm-equipamentos.md
│   ├── ... (todos os 22 ADRs)
│   ├── 20260401-governanca-homelab.md
│   ├── 20260404-voice-dev-pipeline.md
│   └── README.md
│
├── ARCHIVE/                             # Docs arquivados
│
├── guides/                             # Guias misc (estável)
│   ├── gitea-coolify.md
│   ├── infisical.md
│   ├── manutencao-continua.md
│   ├── memoria-claude.md
│   ├── openclaw-*.md
│   ├── opencode.md
│   ├── security-hardening.md
│   ├── whisper-auto-local.md
│   └── README.md
│
├── logs/                               # Logs operacionais
├── plans/                              # Planos estratégicos
├── index.md                            # Entry point (flat, root)
└── README.md
```

---

## 4. Fronteiras Definidas

### 4.1 System Governance: `/srv/ops/ai-governance/`

**Propósito:** Governança de sistema para o homelab (não ligado ao monorepo)

**Conteúdo:**
- `CONTRACT.md` - Princípios não negociáveis de sistema
- `GUARDRAILS.md` - Sistema-wide proibido/aprovação/safe
- `SYSTEM_STATE.md` - Estado atual do homelab

**NÃO é escopo:** Regras específicas do monorepo (essas ficam em `docs/GOVERNANCE/`)

### 4.2 Monorepo Governance: `docs/GOVERNANCE/`

**Propósito:** Regras que governam o que o Claude Code pode fazer dentro de `/srv/monorepo`

**Conteúdo:** (imutável sem aprovação)
- `CONTRACT.md`, `GUARDRAILS.md`, `APPROVAL_MATRIX.md`
- `CHANGE_POLICY.md`, `SECRETS_POLICY.md`
- `INCIDENTS.md`, `DATABASE_GOVERNANCE.md`, `RECOVERY.md`, `QUICK_START.md`

### 4.3 Infrastructure: `docs/INFRASTRUCTURE/`

**Propósito:** Documentação de infraestrutura específica deste homelab

### 4.4 Agent Configuration: `.claude/`

**Propósito:** Configuração e estado para o agente Claude Code

**Conteúdo (NUNCA editar manualmente):**
- `skills/` — Symlinks para `docs/OPERATIONS/SKILLS/*.md`
- `agents/` — Agent definitions (symlinks para `.context/agents/`)
- `commands/`, `rules/`, `hooks/`, `workflows/`
- `scheduled_tasks.json` — Cron jobs
- `CLAUDE.md` — Instruções do agente

---

## 5. ai-context MCP Sync Redesign

### 5.1 sync.sh v2 (Proposto)

```bash
#!/bin/bash
set -e

MEMORY_DIR="/home/will/.claude/projects/-srv-monorepo/memory"
SOURCE_ROOT="/srv/monorepo/docs"
MANIFEST="/home/will/.claude/mcps/ai-context-sync/manifest.json"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

mkdir -p "$MEMORY_DIR"

# CORE GOVERNANCE (sempre sync - immutable)
for doc in CONTRACT.md GUARDRAILS.md APPROVAL_MATRIX.md CHANGE_POLICY.md SECRETS_POLICY.md; do
  src="$SOURCE_ROOT/GOVERNANCE/$doc"
  [ -f "$src" ] && cp "$src" "$MEMORY_DIR/${doc,,}" && log "GOVERNANCE/$doc"
done

# INFRASTRUCTURE (sempre sync)
for doc in SYSTEM_STATE.md NETWORK_MAP.md PORTS.md SUBDOMAINS.md SERVICE_MAP.md; do
  src="$SOURCE_ROOT/INFRASTRUCTURE/$doc"
  [ -f "$src" ] && cp "$src" "$MEMORY_DIR/infra-${doc,,}" && log "INFRASTRUCTURE/$doc"
done

# WORKFLOW & AI-CONTEXT
for doc in WORKFLOW.md AI-CONTEXT.md index.md; do
  src="$SOURCE_ROOT/$doc"
  [ -f "$src" ] && cp "$src" "$MEMORY_DIR/${doc,,}" && log "$doc"
done

# OPERATIONS SKILLS (wildcard)
if [ -d "$SOURCE_ROOT/OPERATIONS/SKILLS" ]; then
  mkdir -p "$MEMORY_DIR/skills"
  for skill in "$SOURCE_ROOT/OPERATIONS/SKILLS/"*.md; do
    [ -f "$skill" ] || continue
    fname=$(basename "$skill")
    cp "$skill" "$MEMORY_DIR/skills/$fname" && log "SKILLS/$fname"
  done
fi

# MCPs
if [ -d "$SOURCE_ROOT/MCPs" ]; then
  mkdir -p "$MEMORY_DIR/mcps"
  for mcp in "$SOURCE_ROOT/MCPs/"*.md; do
    [ -f "$mcp" ] || continue
    fname=$(basename "$mcp")
    cp "$mcp" "$MEMORY_DIR/mcps/$fname" && log "MCPs/$fname"
  done
fi

# SPECFLOW (últimos 5 SPECs)
if [ -d "$SOURCE_ROOT/SPECFLOW" ]; then
  mkdir -p "$MEMORY_DIR/specflow"
  ls -t "$SOURCE_ROOT/SPECFLOW"/SPEC-*.md 2>/dev/null | head -5 | while read spec; do
    fname=$(basename "$spec")
    cp "$spec" "$MEMORY_DIR/specflow/$fname" && log "SPECFLOW/$fname"
  done
  for doc in discovery.md tasks.md; do
    src="$SOURCE_ROOT/SPECFLOW/$doc"
    [ -f "$src" ] && cp "$src" "$MEMORY_DIR/specflow/$doc" && log "SPECFLOW/$doc"
  done
fi

# .context/docs auto-generated
SOURCE_CONTEXT="/srv/monorepo/.context/docs"
if [ -d "$SOURCE_CONTEXT" ]; then
  for doc in architecture.md glossary.md development-workflow.md project-overview.md; do
    src="$SOURCE_CONTEXT/$doc"
    [ -f "$src" ] && cp "$src" "$MEMORY_DIR/${doc%.md}.md" && log ".context/$doc"
  done
fi

# Update manifest
if command -v jq &> /dev/null; then
  jq ".last_sync = \"$(date '+%Y-%m-%d %H:%M:%S')\"" "$MANIFEST" > "${MANIFEST}.tmp" && mv "${MANIFEST}.tmp" "$MANIFEST"
fi

log "Full sync complete"
```

### 5.2 Manifest v2

```json
{
  "name": "ai-context-sync",
  "version": "2.0.0",
  "description": "Full docs → memory sync with wildcard expansion",
  "source": "/srv/monorepo/docs/",
  "targets": ["/home/will/.claude/projects/-srv-monorepo/memory/"],
  "sync_paths": [
    { "path": "GOVERNANCE/*.md", "priority": "high" },
    { "path": "INFRASTRUCTURE/*.md", "priority": "high" },
    { "path": "OPERATIONS/SKILLS/*.md", "priority": "high" },
    { "path": "MCPs/*.md", "priority": "high" },
    { "path": "SPECFLOW/SPEC-*.md", "priority": "medium", "limit": 5 },
    { "path": "WORKFLOW.md", "priority": "high" },
    { "path": "AI-CONTEXT.md", "priority": "high" }
  ],
  "last_sync": "2026-04-08 00:00:00",
  "sync_interval": "30min"
}
```

---

## 6. Plano de Migração

### Phase 0: Snapshot ZFS + Git

```bash
sudo zfs snapshot tank@pre-20260408-docs-reorganization
git -C /srv/monorepo add -A
git -C /srv/monorepo commit -m "chore(docs): pre-reorganization checkpoint"
```

### Phase 1: Consolidação ADRs

1. Criar `docs/ADRs/` (nova pasta)
2. Copiar todos de `docs/adr/` + `docs/ADR/`
3. NÃO deletar folders antigos ainda (preserva git history)
4. Atualizar `sync.sh` para apontar para `docs/ADRs/`
5. Verificar: `find docs/ADRs/ -name "*.md" | wc -l` (deve = 22)

### Phase 2: Eliminar Duplicados

- `docs/GOVERNANCE/DATABASE_GOVERNANCE.md` → KEEP
- `docs/OPERATIONS/DATABASE_GOVERNANCE.md` → DELETE (identico)
- `docs/GOVERNANCE/RECOVERY.md` → KEEP
- `docs/OPERATIONS/RECOVERY.md` → DELETE (identico)

### Phase 3: Consolidar AI-CONTEXT

1. Mergiar `docs/AI-CONTEXT.md` + `docs/context/claude-resolve.md`
2. Deletar `docs/context/claude-resolve.md`
3. Manter estrutura: Overview → Sync → Workflow → Verification → Related Docs

### Phase 4: Documentar obsidian/ como espelho passivo

Criar `obsidian/README.md`:
```markdown
# Obsidian Vault — Passive Mirror

This vault is a **passive mirror** of `/srv/monorepo/docs/`.

Do NOT edit files directly here. All changes must be made in `docs/` first.
```

### Phase 5: sync.sh v2

1. Backup: `cp sync.sh sync.sh.bak`
2. Escrever nova versão (Section 5.1)
3. Atualizar manifest.json para v2.0.0
4. Testar: `~/.claude/mcps/ai-context-sync/sync.sh`
5. Verificar: `find memory/ -name "*.md" | wc -l` (>30)

### Phase 6: Cleanup Final

Após verificação, remover:
```bash
rmdir docs/adr docs/ADR docs/adrs
rmdir docs/context
```

---

## 7. Diagrama da Estrutura Final

```
/srv/monorepo/
├── apps/                          # Aplicações
├── packages/                     # Workspace packages
├── .claude/                       # Agent Configuration (NUNCA fonte de docs)
│   ├── skills/                   # Symlinks → docs/OPERATIONS/SKILLS/
│   ├── agents/                   # Symlinks → .context/agents/
│   ├── commands/                 # Slash commands
│   ├── rules/                    # Per-repo rules
│   ├── hooks/                    # Git hooks
│   ├── workflows/               # Workflow definitions
│   ├── scheduled_tasks.json     # Cron jobs
│   └── CLAUDE.md
│
├── docs/                         # SOURCE OF TRUTH
│   ├── GOVERNANCE/               # Layer 0: Regras imutáveis do repo
│   ├── OPERATIONS/               # Layer 1: Runbooks & Skills
│   ├── INFRASTRUCTURE/           # Layer 2: Infraestrutura homelab
│   ├── MCPs/                     # Layer 3: MCP integrations
│   ├── WORKFLOW.md               # Layer 4: Workflow (flat)
│   ├── AI-CONTEXT.md             # Layer 4: AI Context (consolidado)
│   ├── SPECFLOW/                 # Spec-driven development
│   ├── TEMPLATES/                # Layer 5: Templates
│   ├── ADRs/                     # CONSOLIDADO (era adr/ + ADR/ + adrs/)
│   ├── ARCHIVE/                  # Docs arquivados
│   ├── guides/                   # Miscellaneous guides
│   ├── logs/                     # Logs operacionais
│   ├── plans/                    # Planos estratégicos
│   ├── index.md                  # Entry point
│   └── README.md
│
├── .context/                    # Auto-generated context (NÃO é fonte)
│   └── docs/                   # Auto-gerado, não editar
│
├── obsidian/                   # PASSIVE MIRROR of docs/
│   └── README.md              # "Do not edit directly"
│
└── /srv/ops/ai-governance/   # THIN MIRROR de system-level docs
    ├── SYSTEM_STATE.md
    └── logs/
```

---

## 8. Critérios de Aceitação

| # | Critério | Verificação |
|---|----------|-------------|
| AC-1 | Só UMA pasta ADR existe | `find docs -name "ADR*" -type d` retorna 1 |
| AC-2 | Sem duplicados DATABASE_GOVERNANCE ou RECOVERY | cada um aparece 1x |
| AC-3 | AI-CONTEXT.md contém toda a info de context | `wc -l docs/AI-CONTEXT.md` mostra line count aumentada |
| AC-4 | sync.sh v2 syncs >30 files | After sync, `find memory/ -name "*.md" \| wc -l` > 30 |
| AC-5 | .claude/skills são symlinks para docs/OPERATIONS/SKILLS/ | `ls -la .claude/skills/` mostra symlinks |
| AC-6 | obsidian/ está documentado como passivo | `cat obsidian/README.md` contém "passive mirror" |
| AC-7 | .context/docs/ está documentado como auto-gerado | README contém "DO NOT EDIT" |

---

## 9. Rollback

```bash
sudo zfs rollback -r tank@pre-20260408-docs-reorganization
git -C /srv/monorepo reset --hard HEAD~1
```

---

## 10. Perguntas em Aberto

| # | Pergunta | Decisão |
|---|----------|---------|
| Q1 | `docs/OPERATIONS/RUNBOOK.md` fica em GOVERNANCE ou OPERATIONS? | OPERATIONS (é operacional, não governança) |
| Q2 | `docs/INFRASTRUCTURE/SYSTEM_STATE.md` vai para `/srv/ops/ai-governance/` ou `docs/`? | `docs/INFRASTRUCTURE/` - é específico do repo |
| Q3 | O que acontece com `docs/guides/openclaw-*.md`? | Ficam em `guides/` - são guides não governança |
| Q4 | `docs/logs/` fica ou vai para `/srv/ops/ai-governance/logs/`? | Fica em `docs/logs/` - logs operacionais deste repo |
| Q5 | O que fazer com `docs/APPLICATION/`? | Manter como está - docs específicos da aplicação |
