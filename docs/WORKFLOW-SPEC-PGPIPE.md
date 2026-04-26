# WORKFLOW-SPEC-PGPIPE — Pipeline de 3 Fases (SPEC-090)

> **Data:** 2026-04-22
> **Authority:** Claude Code CLI + Gitea Actions
> **Stack:** pnpm workspaces + Turbo pipeline + Biome lint

---

## Visao Geral

Pipeline de desenvolvimento de 3 fases com gates entre fases. Cada fase executa agentes especializados em paralelo real (nao fake parallelism).

```
Tarefa → /spec → /pg → run-pipeline.sh → 3 fases → SHIPPER → PR no Gitea
```

---

## Fases do Pipeline

### FASE 1 — SPEC-ANALYZER + ARCHITECT

**Proposito:** Analisar a especificacao e desenhar a arquitetura.

**Agentes:**
- `SPEC-ANALYZER` — Extrai acceptance criteria e file deltas do SPEC
- `ARCHITECT` — Revisa arquitetura e flags issues

**Gate:** Ambos os agentes devem completar com exit 0.

**Se Falhar:** BLOCK → rollback + exit 1

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1                                                          │
│  ┌──────────────────┐     ┌──────────────────┐                │
│  │  SPEC-ANALYZER    │ ←→  │    ARCHITECT      │                │
│  │  (parallel)      │     │   (parallel)     │                │
│  └────────┬─────────┘     └────────┬─────────┘                │
│           └──────┬──────────────────┘                          │
│                  ▼                                              │
│         Gate: Ambos completam → FASE 2                          │
└─────────────────────────────────────────────────────────────────┘
```

### FASE 2 — CODER-1 + CODER-2

**Proposito:** Implementar backend e frontend em paralelo.

**Agentes:**
- `CODER-1` — Backend (Fastify/tRPC)
- `CODER-2` — Frontend (React/MUI)

**Gate:** Ambos os agentes devem completar com exit 0.

**Se Falhar:** BLOCK → rollback + issue no Gitea

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 2                                                          │
│  ┌──────────────────┐     ┌──────────────────┐                │
│  │    CODER-1       │ ←→  │     CODER-2       │                │
│  │  (Backend)       │     │  (Frontend)      │                │
│  └──────────────────┘     └──────────────────┘                │
│           └──────┬──────────────────┘                          │
│                  ▼                                              │
│         Gate: Ambos completam → FASE 3                          │
└─────────────────────────────────────────────────────────────────┘
```

### FASE 3 — TESTER + DOCS + SMOKE + REVIEWER

**Proposito:** Testar, documentar e fazer code review final.

**Agentes (sequencial comWarning):**
- `TESTER` — Escreve testes (WARN + proceed se falhar)
- `DOCS` — Atualiza documentacao (WARN + proceed se falhar)
- `SMOKE` — Gera smoke tests (WARN + proceed se falhar)
- `REVIEWER` — Code review final (WARN + proceed se falhar)

**Gate:** REVIEWER completa.

**Se Falhar:** WARN + proceed → SHIPPER cria PR ou ISSUE

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 3                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ TESTER  │→│  DOCS   │→│  SMOKE  │→│REVIEWER │             │
│  │  (↓)   │  │  (↓)   │  │  (↓)   │  │  (↓)   │             │
│  └─────────┘  └─────────┘  └─────────┘  └────┬────┘             │
│       └──────────┴──────────┴───────────────┘                    │
│                         ▼                                       │
│              Gate: REVIEWER completa → SHIPPER                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fluxo Completo

```
/execute "descricao da tarefa"
    │
    ▼
/spec "descricao"          ← Cria SPEC.md em docs/SPECS/
    │
    ▼
/pg                        ← Gera pipeline.json em tasks/
    │
    ▼
run-pipeline.sh <SPEC-NNN> ← Executa 3 fases com gates
    │
    ▼
3 FASES
    │
    ├── FASE 1: SPEC-ANALYZER + ARCHITECT (parallel)
    │
    ├── FASE 2: CODER-1 + CODER-2 (parallel)
    │
    └── FASE 3: TESTER → DOCS → SMOKE → REVIEWER (sequential)
    │
    ▼
SHIPPER                  ← Cria PR ou ISSUE no Gitea
```

---

## Comandos

### Executar Pipeline Completo

```bash
# Via Claude Code CLI
/execute "descricao da tarefa"
```

### Executar Pipeline Manualmente

```bash
# 1. Criar SPEC
/spec Descricao da tarefa

# 2. Gerar pipeline.json
/pg

# 3. Executar pipeline
./orchestrator/scripts/run-pipeline.sh <SPEC-NNN>
```

### Verificar Estado

```bash
# Ver estado do pipeline
cat tasks/pipeline.json

# Ver logs dos agentes
cat .claude/skills/orchestrator/logs/<AGENTE>.log

# Ver estado individual do agente
cat tasks/agent-states/<AGENTE>.json
```

---

## Estado do Pipeline (pipeline.json)

```json
{
  "pipeline": "pipeline-20260422-143000",
  "spec": "SPEC-042",
  "phase": 2,
  "agents": {
    "SPEC-ANALYZER": { "status": "completed", "exit_code": 0 },
    "ARCHITECT": { "status": "completed", "exit_code": 0 },
    "CODER-1": { "status": "running" },
    "CODER-2": { "status": "pending" }
  },
  "started": "2026-04-22T14:30:00Z"
}
```

---

## Estado dos Agentes (agent-state)

```json
{
  "agent": "CODER-1",
  "spec": "SPEC-042",
  "status": "completed",
  "started": "2026-04-22T14:30:00Z",
  "finished": "2026-04-22T14:35:00Z",
  "exit_code": 0,
  "log": ".claude/skills/orchestrator/logs/CODER-1.log"
}
```

---

## Scripts de Coordenacao

### run-pipeline.sh

Script principal que executa as 3 fases sequencialmente.

**Localizacao:** `.claude/skills/orchestrator/scripts/run-pipeline.sh`

**Uso:**
```bash
./.claude/skills/orchestrator/scripts/run-pipeline.sh <SPEC-NNN>
```

### wait-for-phase.sh

Poll ate que a fase atual complete.

**Localizacao:** `.claude/skills/orchestrator/scripts/wait-for-phase.sh`

**Uso:**
```bash
./.claude/skills/orchestrator/scripts/wait-for-phase.sh <FASE>
```

### check-gate.sh

Verifica se o gate da fase foi satisfeito.

**Localizacao:** `.claude/skills/orchestrator/scripts/check-gate.sh`

**Uso:**
```bash
./.claude/skills/orchestrator/scripts/check-gate.sh <FASE>
```

### snapshot.sh

Cria ZFS snapshot antes de cada fase.

**Localizacao:** `.claude/skills/orchestrator/scripts/snapshot.sh`

**Uso:**
```bash
./.claude/skills/orchestrator/scripts/snapshot.sh <descricao>
```

### rollback.sh

Restore from ZFS snapshot em caso de falha.

**Localizacao:** `.claude/skills/orchestrator/scripts/rollback.sh`

**Uso:**
```bash
./.claude/skills/orchestrator/scripts/rollback.sh
```

### ship.sh

Cria PR ou ISSUE no Gitea.

**Localizacao:** `.claude/skills/orchestrator/scripts/ship.sh`

**Uso:**
```bash
./.claude/skills/orchestrator/scripts/ship.sh --pr   # Cria PR
./.claude/skills/orchestrator/scripts/ship.sh --issue # Cria ISSUE
```

---

## Error Handling

| Cenario | Acao |
|---------|------|
| SPEC-ANALYZER falha | BLOCK — rollback + exit 1 |
| ARCHITECT falha | BLOCK — rollback + exit 1 |
| CODER-1 OU CODER-2 falha | BLOCK — rollback + issue Gitea |
| TESTER falha | WARN + proceed |
| DOCS falha | WARN + proceed |
| SMOKE falha | WARN + proceed |
| REVIEWER falha | WARN + proceed |
| SHIPPER falha | ISSUE manual |

---

## Diretrizes de Desenvolvimento

### Anti-Hardcoded Pattern (OBRIGATORIO)

**Nunca hardcodar URLs, portas, tokens ou API keys no codigo.**

```python
# ✅ CORRETO — carregar de ~/.hermes/secrets.env
from pathlib import Path
_secrets = Path.home() / '.hermes' / 'secrets.env'
if _secrets.exists():
    with open(_secrets) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, _, v = line.partition('=')
                os.environ[k.strip()] = v.strip()
MY_KEY = os.environ.get('MY_KEY', '')

# ❌ ERRADO — hardcoded
MY_KEY = ${MY_API_KEY}
```

**Fonte canonica:** `.env` (ver `.claude/rules/anti-hardcoded-env.md`)

### Regras de Seguranca

1. **Secrets** → `.env` como fonte canonica
2. **Immutable/Pinned Services** → NUNCA tocar Coolify proxy, Prometheus, cloudflared
3. **Voice Pipeline (Hermes)** → gateway `:3001` | mcp `:8092` | Telegram polling
4. **Anti-patterns (AP-1/2/3)** → Docker TCP bridge, host-as-backend, localhost testing

---

## Custo por Pipeline

| Versao | Agentes | Custo estimado |
|--------|---------|---------------|
| v1 (14 agentes) | 14 simultaneos | ~$2-3 |
| v3 (3 fases) | 2-4 simultaneos | ~$0.50 |

---

## Projetos Relacionados

| Projeto | Path | Tipo |
|---------|------|------|
| **Monorepo** | `/srv/monorepo` | pnpm workspaces + Fastify/tRPC |
| **Second Brain** | `~/Desktop/hermes-second-brain` | Obsidian-style vault |
| **Hermes Agent** | `~/.hermes/hermes-agent` | Python asyncio |
| **OPS Scripts** | `/srv/ops/scripts` | Bash + Terraform |

---

## Referencias

- [AGENTS.md](../../AGENTS.md) — Documentacao completa dos agentes
- [docs/GOVERNANCE/README.md](../GOVERNANCE/README.md) — Governanca e regras
- [docs/GOVERNANCE/GUARDRAILS.md](../GOVERNANCE/GUARDRAILS.md) — Guardrails operacionais
- [docs/GOVERNANCE/APPROVAL_MATRIX.md](../GOVERNANCE/APPROVAL_MATRIX.md) — Matrix de aprovacoes
