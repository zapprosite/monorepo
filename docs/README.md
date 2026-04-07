# Docs — Source of Truth

> **Autoridade:** Este diretório é o source of truth para TODA a documentação do homelab.
> O `/srv/ops/ai-governance/` é um espelho fino pointing para cá.
> O OpenClaw (@CEO_REFRIMIX_bot) mantém este docs via skill `doc-librarian`.

## Quick Answers

| Pergunta | Resposta |
|---|---|
| "Posso fazer X?" | → [GOVERNANCE/APPROVAL_MATRIX.md](./GOVERNANCE/APPROVAL_MATRIX.md) |
| "O que é proibido?" | → [GOVERNANCE/GUARDRAILS.md](./GOVERNANCE/GUARDRAILS.md) |
| "Como recupero de um incidente?" | → [GOVERNANCE/RECOVERY.md](./GOVERNANCE/RECOVERY.md) |
| "Qual porta está livre?" | → [INFRASTRUCTURE/PORTS.md](./INFRASTRUCTURE/PORTS.md) |
| "Subdomain existe?" | → [INFRASTRUCTURE/SUBDOMAINS.md](./INFRASTRUCTURE/SUBDOMAINS.md) |
| "Como fazer mudança segura?" | → [GOVERNANCE/CHANGE_POLICY.md](./GOVERNANCE/CHANGE_POLICY.md) |

---

## Browse by Layer

### Layer 0 — Governance (Imutable, approval required para editar)
```
GOVERNANCE/
├── CONTRACT.md              ← Princípios não-negociáveis
├── GUARDRAILS.md            ← Proibido / Approval / Safe
├── APPROVAL_MATRIX.md       ← Matriz de decisões
├── CHANGE_POLICY.md         ← Processo de mudança segura
├── INCIDENTS.md            ← Log de incidentes
├── SECRETS_POLICY.md       ← Política de credenciais
├── DATABASE_GOVERNANCE.md   ← Governance de dados
├── RECOVERY.md             ← Procedimentos de recuperação
├── QUICK_START.md           ← Onboarding 5-min
├── OPENCLAW_DEBUG.md         ← Debug do OpenClaw bot
└── DOCUMENTATION_MAP.md     ← Mapa de documentação
```

### Layer 1 — Operations
```
OPERATIONS/
├── guide.md                ← Guia operacional completo
├── RUNBOOK.md               ← Comandos oficiais
├── DATABASE_GOVERNANCE.md   ← DB governance
├── DB_HISTORY.md           ← Histórico de schemas
└── SKILLS/                 ← 16 skills operacionais
    ├── zfs-snapshot-and-rollback.md
    ├── zfs-smart-scrub.md
    ├── docker-health-watcher.md
    ├── container-self-healer.md
    ├── oom-killer.md
    ├── monitoring-health-check.md
    ├── monitoring-diagnostic.md
    ├── monitoring-zfs-snapshot.md
    ├── ollama-health-check.md
    ├── litellm-health-check.md
    ├── kokoro-health-check.md
    ├── resource-monitor.md
    ├── ai-stress-test.md
    ├── catalog-sync.md
    ├── alert-deduplicator.md
    ├── backup-rotate-verify.md
    └── maintain-system-documentation.md
```

### Layer 2 — Infrastructure
```
INFRASTRUCTURE/
├── NETWORK_MAP.md           ← Topologia de rede completa
├── PORTS.md                 ← Alocação de portas
├── SUBDOMAINS.md            ← Registro de subdomínios
├── PARTITIONS.md            ← Alocação ZFS
├── SERVICE_MAP.md            ← Serviços e dependências
└── SYSTEM_STATE.md           ← Snapshot de estado atual
```

### Layer 3 — Integration
```
MCPs/
├── AI_CONTEXT_MCP.md         ← AiContext MCP setup
├── MCP_BLUEPRINT.md          ← Como criar MCP servers
└── MCP_TOKENS_GUIDE.md      ← Guia de tokens MCP
```

### Layer 4 — AI Tools Workflow
```
WORKFLOW.md                   ← 3 tools + AI-CONTEXT (host + desktop + bot)
AI-CONTEXT.md                 ← Sincronização de docs após feature
```

### Layer 5 — Templates
```
TEMPLATES/
├── incident-report.md        ← Template de incidente
├── change-proposal.md        ← Template de mudança
├── new-schema.md            ← Template de novo schema
└── new-collection.md        ← Template de nova collection
```

---

## Para Agentes

### Claude Code (host terminal)
- Lê: `/srv/monorepo/docs/GOVERNANCE/`, `/srv/monorepo/docs/INFRASTRUCTURE/`
- Edita: todos os docs (com approval quando necessário)
- Scripts: `/srv/ops/scripts/`

### OpenClaw (@CEO_REFRIMIX_bot)
- Lê: via MCP monorepo em `10.0.19.50:4006`
- Skills: `doc-librarian`, `qdrant-rag`, `infra-guide`
- Workspace: `/data/workspace/` (dentro do container)

### Auditoria de Docs (doc-librarian skill)
- Last full audit: 2026-04-07
- Frescor: arquivos >30 dias sem review = stale
- Logs: `/srv/ops/ai-governance/logs/`

---

## Comandos

```bash
# Ver frescor dos docs
find docs -name "*.md" -mtime +30 | head -10

# Ver stale governance docs
ls -la GOVERNANCE/ | grep -E "^-.*[3-9][0-9] days|months"

# Verificar immutable flags
lsattr GOVERNANCE/*.md | grep -v "----" 
```
