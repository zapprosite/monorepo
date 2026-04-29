# SPEC-091 — Canonical Docs Template + Holistic Prune

**Data:** 2026-04-20
**Estado:** DONE ✅ (2026-04-20)
**Supersedes:** SPEC-074 (partial)
**Contexto:** Ubuntu Desktop LTS 24.04 (homelab), Coolify PaaS, Monorepo, Hermes Agent (Jarvis)

---

## Problema

Sistema de documentação sem padrão: 52 MDs no monorepo docs/, 40 SPECs no hvacr-swarm, governança distribuída entre `/srv/ops/ai-governance/` e docs/GOVERNANCE/ do monorepo, e skills globais em `~/.claude/skills/` sem categorização clara. Entrar num contexto novo é impossível sem ler centenas de MDs, a maioria placeholder ou obsoleta.

**Sintomas identificados:**
- Monorepo: 52 MDs, nenhum com marcação de estado (activo vs. archivado)
- hvacr-swarm: 40 SPECs, nenhum marcado como activo
- Governança: duas localizações (monorepo docs/GOVERNANCE/ e /srv/ops/ai-governance/) — diverge
- Skills: duplicação funcional (workflow-performatico vs. auto-orchestrate)
- `.context/`: vestígio de dotcontext com snapshot de debug perdido
- Dotcontext CLI não instalado, mas a convenção `.context/` é boa

---

## Research: O que o mercado faz (Apr 2026)

### dotcontext (.context/ convention) — vinilana/dotcontext

Estrutura e problemas com frontmatter estendido:

```yaml
---
type: skill|doc
name: Bug Investigation
description: Systematic bug investigation
skillSlug: bug-investigation
phases: [E, V]
generated: 2026-03-18
status: filled|empty
scaffoldVersion: "2.0.0"
---
```

**Mecanismo anti-placeholder:**
- `status: filled` → conteúdo real, preencheu
- `status: empty` → template puro, não usar em produção
- `generated: date` → quando foi gerado
- Skills têm secção "When to Use" específica, não genérica

Estrutura:
```
.context/
├── docs/
│   ├── README.md          # índice do docs
│   ├── project-overview.md
│   ├── development-workflow.md
│   ├── testing-strategy.md
│   ├── codebase-map.json  # machine-readable structure
│   ├── qa/
│   └── tooling.md
├── skills/
│   ├── bug-investigation/
│   ├── code-review/
│   ├── test-generation/
│   └── [cada skill = pasta com SKILL.md + refs]
├── agents/
└── plans/
```

### Enterprise patterns comuns (2026)

| Pattern | Quando usar |
|---------|-------------|
| **ADRs** (Architecture Decision Records) | Decisões de design, uma decisão por doc, numerado |
| **SPECs** | Feature specs com acceptance criteria, lifecycle |
| **Runbooks** | Procedimentos operacionais, executáveis |
| **codebase-map.json** | Metadata machine-readable, evita parsing de MD |
| **status: filled/empty** | Frontmatter marker, não criar skills sem conteúdo |

---

## Decisões de Arquitectura

### 1. Canonical Docs Structure (todos os repos)

Adoptar a estrutura do hvacr-swarm como padrão:

```
docs/
├── SPECS/          # Feature specs activos — SPEC-NNN-title.md
├── ADRs/           # Architecture Decision Records — ADR-NNN-title.md
├── GUIDES/         # How-to guides — kebab-case.md
├── REFERENCE/      # Technical references — kebab-case.md
└── archive/        # SPECs/ADRs/GUIDEs antigos — READ-ONLY
```

**Regras:**
- Nunca criar docs na raiz de docs/
- Nunca misturar SPECs com GUIDEs
- archive/ é READ-ONLY — nunca editar
- Synced para obsidian/ via rsync (hvacr-swarm pattern)

### 2. Anti-Placeholder Frontmatter (todos os MDs)

Todos os documentos de contexto (`.context/`) e specs devem ter frontmatter:

```yaml
---
type: skill|doc|spec|adr|guide|runbook
name: Nome do documento
status: filled|empty|draft|archived
generated: 2026-04-20
supersedes: SPEC-XXX  # se aplicável
---
```

- `status: filled` → conteúdo real, produção-ready
- `status: empty` → template, não usar em produção
- `status: draft` → em desenvolvimento
- `status: archived` → substituído, histórico

**Regra:** Nunca commitar um `.context/` doc com `status: empty`.

### 3. Governança Canonical — /srv/ops/ai-governance/

**Decisão:** /srv/ops/ai-governance/ é a fonte da verdade para governança do host Ubuntu. docs/GOVERNANCE/ do monorepo é redundante e vai ser archived.

Fusão proposta:

```
/srv/ops/ai-governance/
├── CONTRACT.md              ← unchanged
├── GUARDRAILS.md           ← unchanged
├── APPROVAL_MATRIX.md      ← already here (from hvacr-swarm)
├── CHANGE_POLICY.md         ← already here
├── SECRETS_POLICY.md        ← already here
├── SERVICE_MAP.md           ← already here
├── PARTITIONS.md            ← already here
├── RECOVERY.md              ← already here
├── PORTS.md                 ← already here (source: /srv/ops)
└── mcps/                    ← MCP documentation
```

**docs/GOVERNANCE/ do monorepo → archive/GOVERNANCE-migrated/**

### 4. Dotcontext — Convencão sim, CLI não

O `.context/` é uma convenção boa para organizar contexto de agentes. CLI dotcontext (`@dotcontext/cli`) **não instalar** — agrega complexidade sem valor ao sistema actual de skills.

O `.context/` existente em `/home/will/.context`, `/srv/monorepo/.context`, `/srv/hvacr-swarm/.context` permanece como vestígio histórico. Não mexer — too much a lot work para pouco retorno.

### 5. Two-Tier Second Brain (inalterado do SPEC-074)

**Tier 1 — Índice global (`sb-context.md`):**
- 200 linhas máximo
- Lido por qualquer LLM ao iniciar
- Mapa de repos + caminho para TREE.md de cada um

**Tier 2 — TREE.md por repositório:**
- Gerado por script, < 500 linhas
- Lido só pelo LLM que trabalha nesse repositório

**O Second Brain recebe TREE.md, não MDs individuais.**

---

## Inventário e Acções

### Monorepo (`/srv/monorepo`)

#### docs/ — 52 MDs

| Ficheiro/Pasta | Acção |
|----------------|-------|
| ARCHITECTURE-OVERVIEW.md | **Manter** — visão geral do sistema |
| index.md | **Archivar** — índice antigo, substituído por ACTIVE.md |
| README.md | **Manter** — entrada do repo |
| GOVERNANCE/ (8 ficheiros) | **Archivar para /srv/ops/ai-governance/** — redundante |
| INFRASTRUCTURE/VERSION-LOCK.md | **Manter** — pinning de versões |
| INFRASTRUCTURE/NETWORK_MAP.md | **Archivar** — informação em PORTS.md + SUBDOMAINS.md |
| INFRASTRUCTURE/PORTS.md | **Mover para /srv/ops/ai-governance/** |
| INFRASTRUCTURE/SUBDOMAINS.md | **Mover para /srv/ops/ai-governance/** |
| INFRASTRUCTURE/SERVICE_MAP.md | **Archivar** — já existe em /srv/ops/ai-governance/ |
| OPS/CAPACITY.md | **Archivar** — nunca lido |
| OPS/COST-CONTROL.md | **Archivar** — nunca lido |
| OPS/RUNBOOKS/ORCHESTRATOR-FAILURE.md | **Manter** — runbook real |
| OPS/RUNBOOKS/P1-SERVICE-DOWN.md | **Archivar** — nunca executado |
| OPS/RUNBOOKS/P2-SERVICE-DEGRADED.md | **Archivar** — nunca executado |
| OPS/RUNBOOKS/P3-NON-CRITICAL.md | **Archivar** — nunca executado |
| OPS/RUNBOOKS/P4-INFORMATIONAL.md | **Archivar** — nunca executado |
| OPS/RUNBOOKS/PIPELINE-ROLLBACK.md | **Archivar** — superseded por ORCHESTRATOR-FAILURE |
| OPS/RUNBOOKS/README.md | **Archivar** |
| incidents/INC-005-hermes-telegram-voice-stt-tts-fix.md | **Archivar** — incidente fechado |
| GUIDES/backup-runbook.md | **Archivar** — informação em scripts/ |
| GUIDES/discovery.md | **APAGAR** — placeholder puro, 0 conteúdo real |
| GUIDES/LANGUAGE-STANDARDS.md | **Manter** — regras de idioma |
| ADRs/ADR-001-denv-as-canonical-secrets-source.md | **Manter** — decisão real |
| SPECS/ (24 ficheiros) | **Ver tabela abaixo** |

#### SPECs — 24 ficheiros

**Activos (3):**
- SPEC-074 — hermes-second-brain
- SPEC-090 — orchestrator v3
- SPEC-068 — circuit breaker (MEM0 wins, codificado)

**Arquitectura (1):**
- SPEC-050 — network/ports (codificado em PORTS.md)

**Archivar (20):**
```
SPEC-053, SPEC-058, SPEC-059, SPEC-060, SPEC-063, SPEC-064,
SPEC-065, SPEC-066, SPEC-067, SPEC-069, SPEC-070, SPEC-071,
SPEC-072, SPEC-073, SPEC-075, SPEC-076, SPEC-077, SPEC-088,
SPEC-089, SPEC-091 (este)
```

Critério: sem commits no código, contradizem SPECs activos, ou ultrapassados.

**Nota:** SPEC-091 não é archivado — é a spec que define o template. Fica como Draft até aprovada.

#### SPECs activos — criar docs/SPECS/ACTIVE.md

Índice dos SPECs activos com:
```yaml
---
type: spec-index
status: filled
generated: 2026-04-20
---
```

Formato:
```markdown
# Active Specifications

Updated: 2026-04-20

| # | Title | Status | Supersedes |
|---|-------|--------|------------|
| 050 | Network & Port Governance | codified → PORTS.md | — |
| 068 | Circuit Breaker (MEM0 wins) | codified | SPEC-073 |
| 074 | Hermes Second Brain | active | — |
| 090 | Orchestrator v3 | active | SPEC-070 |
```

#### Ficheiros na raiz

| Ficheiro | Acção |
|----------|-------|
| AGENTS.md | **Manter** — fonte da verdade para agents |
| CLAUDE.md | **Archivar** — duplica AGENTS.md, diverge |
| VERSION-LOCK.md | **Manter** — pinning de versões |
| SPEC-076-voice-eval.md | **Archivar** — superseded por SPEC-076 |
| SPEC-076-voice-eval-worksheet.md | **Archivar** |
| .context/SLICE_9_SNAPSHOT.md | **APAGAR** — debug snapshot |
| .context/ (pasta) | **Manter** — vestígio histórico, não mexer |

### hvacr-swarm (`/srv/hvacr-swarm`)

#### docs/SPECS/ — 40 ficheiros

Muitos são SPECs do OpenClaw que nunca foram implementados.

**Confirmar via git log antes de archivar:**
```bash
for spec in /srv/hvacr-swarm/docs/SPECS/SPEC-*.md; do
  name=$(basename "$spec" .md)
  commits=$(git log --oneline --all -- "$spec" 2>/dev/null | wc -l)
  echo "$commits $name"
done | sort -rn | head -20
```

**Critério:** Se < 2 commits e não está no código → archivar.

**Espera-se archivar (22+):** SPEC-007, SPEC-009, SPEC-010, SPEC-011, SPEC-012, SPEC-013 (exceto CLAUDE-CODE-CLI-INTEGRATION), SPEC-014 (exceto CURSOR), SPEC-016, SPEC-017, SPEC-018, SPEC-019, SPEC-020, SPEC-021, SPEC-022, SPEC-064, SPEC-065, SPEC-066, SPEC-CURSOR-LOOP, SPEC-PERPLEXITY-GITOPS, SPEC-PLANNING-PIPELINE, SPEC-README, SPEC-TEMPLATE, SPEC-TROCAR-ROUPA, SPEC-TRANSFORM-MONOREPO

**Manter (< 10):** Confirmar via git log
- SPEC-001-core-swarm
- SPEC-002-redis-queues
- SPEC-003-memory-layers
- SPEC-004-whatsapp-integration
- SPEC-006-billing-stripe
- SPEC-008-agent-agents
- SPEC-100-PIPELINE-BOOTSTRAP

#### obsidian/ — espelho read-only

docs/ é fonte da verdade. obsidian/ é espelho. Se obsidian/ tem docs exclusivas → mover para docs/archive/ e archivar originals.

### Skills globais (`~/.claude/skills/`)

| Skill | Estado | Acção |
|-------|--------|-------|
| img | filled | **Manter** |
| researcher | filled | **Manter** |
| universal-debug | filled | **Manter** |
| universal-ship | filled | **Manter** |
| universal-turbo | filled | **Manter** |
| universal-code-review | filled | **Manter** |
| spec | filled | **Manter** |
| auto-orchestrate | filled | **Manter** |
| coolify-auto-healer | filled | **Manter** |
| coolify-deploy-trigger | filled | **Manter** |
| coolify-health-check | filled | **Manter** |
| coolify-incident-diagnostics | filled | **Manter** |
| coolify-resource-monitor | filled | **Manter** |
| coolify-rollback | filled | **Manter** |
| deploy-validate | filled | **Manter** |
| security | filled | **Manter** |
| escrever | unknown | **Verificar** — sem SKILL.md visível |
| workflow-performatico | empty | **Archivar** — sem executável, overlap total com auto-orchestrate |
| context7-mcp | filled | **Manter** |

### /srv/ops/ai-governance/

**Manter tudo.** Adicionar:
- PORTS.md (migrado do monorepo)
- SUBDOMAINS.md (migrado do monorepo)
- index.md (índice dos docs de governança)

---

## Canonical Docs Template (para novos docs)

### Para SPECs

```yaml
---
type: spec
name: SPEC-NNN-title
status: draft|active|archived
supersedes: SPEC-XXX  # se aplicável
generated: 2026-04-20
author: Author Name
---

# SPEC-NNN — Title

## Problema
[O problema que este spec resolve]

## Decisões
[Decisões arquitecturais tomadas]

## Acceptance Criteria
- [ ] Critério 1
- [ ] Critério 2
```

### Para Skills

```yaml
---
type: skill
name: Skill Name
description: One-line description
skillSlug: skill-name
phases: [P,R,E,V]
status: filled|empty|draft
generated: 2026-04-20
trigger: slash-skill-name  # ou: hook-after-task, cron-*
allowed-tools: [Bash, Read, Glob, Grep]
user-invocable: true|false
---

# Skill Name

## When to Use
[Quando invocar esta skill — específico, não genérico]

## Instructions

### Phase 1: [Name]
[Passos específicos com comandos concretos]
```

### Para Runbooks

```yaml
---
type: runbook
name: runbook-name
severity: p1|p2|p3|p4
status: filled|archived
generated: 2026-04-20
trigger: cron-*|manual|incident
---

# Runbook: [Nome]

## Severity
[P1/P2/P3/P4]

## Trigger
[Quando este runbook deve ser executado]

## Procedure
[Passos numerados, comandos concretos]
```

---

## Plano de Execução

### Fase 1 — Auditoria (script)

Executar auditoria completa antes de mexer:

```bash
#!/bin/bash
# audit-docs.sh — auditoria completa

echo "=== MONOREPO ==="
echo "docs/ MDs: $(find /srv/monorepo/docs -name '*.md' | wc -l)"
echo "SPECs: $(ls /srv/monorepo/docs/SPECS/SPEC-*.md 2>/dev/null | wc -l)"
echo "GOVERNANCE: $(ls /srv/monorepo/docs/GOVERNANCE/*.md 2>/dev/null | wc -l)"
echo "OPS/RUNBOOKS: $(ls /srv/monorepo/docs/OPS/RUNBOOKS/*.md 2>/dev/null | wc -l)"

echo ""
echo "=== HVAACR-SWARM ==="
echo "docs/SPECS: $(ls /srv/hvacr-swarm/docs/SPECS/SPEC-*.md 2>/dev/null | wc -l)"

echo ""
echo "=== SKILLS ==="
for skill in ~/.claude/skills/*/; do
  name=$(basename "$skill")
  has_skill=$(test -f "$skill/SKILL.md" && echo "yes" || echo "no")
  has_exec=$(find "$skill" -type f \( -name "*.sh" -o -name "*.py" -o -name "*.js" \) | wc -l)
  echo "$name | SKILL.md:$has_skill | exec:$has_exec"
done

echo ""
echo "=== GOV CANDIDATES FOR ARCHIVE ==="
echo "Monorepo docs/GOVERNANCE/ vs /srv/ops/ai-governance/"
diff <(ls /srv/monorepo/docs/GOVERNANCE/ | sort) <(ls /srv/ops/ai-governance/ | grep "\.md$" | sort) 2>/dev/null || true
```

### Fase 2 — Aprovação do William

Apresentar:
1. Lista completa de ficheiros a archivar
2. Lista de ficheiros a apagar
3. Lista de conflicts de skills
4. Proposta de governance fundida

### Fase 3 — Execução (primeira parte)

**Criação de estrutura canonical no monorepo:**
1. Criar `docs/archive/` e `docs/archive/GOVERNANCE-migrated/`
2. Criar `docs/SPECS/ACTIVE.md`
3. Criar `scripts/generate-tree.sh`
4. Criar `scripts/prune-docs.sh`

**Archivar:**
1. Mover SPECs mortos para `docs/archive/SPECS-dead/`
2. Mover GOVERNANCE para `docs/archive/GOVERNANCE-migrated/`
3. Archivar GUIDES/discovery.md, incidents/INC-005, OPS/RUNBOOKS (excepto ORCHESTRATOR-FAILURE)
4. Archivar CLAUDE.md da raiz
5. Apagar .context/SLICE_9_SNAPSHOT.md, SPEC-076-voice-eval*.md

**Migrar para /srv/ops/:**
1. Mover INFRASTRUCTURE/PORTS.md → /srv/ops/ai-governance/
2. Mover INFRASTRUCTURE/SUBDOMAINS.md → /srv/ops/ai-governance/
3. Archivar INFRASTRUCTURE/NETWORK_MAP.md, INFRASTRUCTURE/SERVICE_MAP.md

**Skills:**
1. Archivar `workflow-performatico/`
2. Verificar `escrever/` — se sem SKILL.md e sem executável, archivar

### Fase 4 — Second Brain Link

1. Correr `scripts/generate-tree.sh` → gerar monorepo-TREE.md
2. Push para hermes-second-brain via API Gitea
3. Correr `scripts/sync-second-brain.sh` (já existe)
4. Confirmar TREE.md < 500 linhas

---

## Critérios de Sucesso

- [ ] Monorepo docs/ com ≤ 15 MDs (de 52)
- [ ] Monorepo sem duplicação GOVERNANCE vs /srv/ops/
- [ ] hvacr-swarm docs/SPECS/ ≤ 10 MDs (de 40)
- [ ] Skills globais sem duplicação funcional
- [ ] AGENTS.md consolidada, CLAUDE.md da raiz archivado
- [ ] workflow-performatico archivado
- [ ] GUIDES/discovery.md apagado
- [ ] .context/SLICE_9_SNAPSHOT.md apagado
- [ ] monorepo-TREE.md < 500 linhas no second-brain
- [ ] /srv/ops/ai-governance/ com PORTS.md e SUBDOMAINS.md
- [ ] docs/SPECS/ACTIVE.md criado com índice dos SPECs activos
- [ ] Nenhum doc novo commitado com `status: empty`

---

## Riscos e Mitigações

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Archivar SPEC que ainda é necessário | Média | Alto | Fase 2 é aprovação do usuário |
| Gerador TREE.md perder informação relevante | Baixa | Médio | Revisão do output antes de push |
| Skills archivadas serem necessárias | Baixa | Baixo | Ficam em archive/, não apagadas |
| Duas localizações de governança divergir | Alta | Alto | Monorepo docs/GOVERNANCE/ vai para archive, /srv/ops/ é a fonte |

---

## Notas

- Dotcontext CLI: **não instalar**
- OpenClaw SPECs no hvacr-swarm: confirmar via git log antes de archivar
- O Second Brain recebe TREE.md gerado, não MDs individuais — janela de contexto pequena
- Todos os novos SPECs/ADRs/GUIDEs devem ter frontmatter com `status: filled`
- O monorepo AGENTS.md é a fonte da verdade para agents — CLAUDE.md da raiz é redundante
