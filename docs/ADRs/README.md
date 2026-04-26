# Architecture Decision Records (ADRs)

**Location:** Consolidated from `docs/adr/`, `docs/ADR/`, and `docs/adrs/`
**Total ADRs:** 22 (18 from `docs/adr/` + 4 from `docs/ADR/`)

---

## Overview

This folder contains all Architecture Decision Records (ADRs) for the will-zappro project, consolidated from three separate locations into a single canonical location.

## Migration Note

This folder was created as part of a docs reorganization effort. ADRs were previously split across:
- `docs/adr/` — 18 ADRs
- `docs/ADR/` — 4 ADRs  
- `docs/adrs/` — empty (contained only README)

The original folders are preserved for git history. Do NOT edit files in the old locations.

## Format

We use the [MADR](https://adr.github.io/madr/) format (Markdown Any Decision Records).

## How to Create a New ADR

1. Copy `TEMPLATE.md` to `NNN-titulo-descritivo.md`
2. Fill in all sections
3. Number sequentially (001, 002, ...)
4. Status: `proposto`, `aceito`, `depreciado`, `substituído`

## Task Slicing from SPECs (09/04/2026)

Cada SPEC gera slices (Must/Should/Could) que se tornam ADRs:

```
SPEC-*.md (Goals section)
    │
    ├── Must Have → ADR-001-NNN-mvp.md
    ├── Should Have → ADR-002-NNN-should.md
    └── Could Have → ADR-003-NNN-could.md
```

**Fluxo:**
1. `/spec <descrição>` gera SPEC com slices
2. Cada slice gera ADR em `docs/ADRs/`
3. `/pg` gera `tasks/pipeline.json` a partir dos ADRs

**ADR Naming:**
```
ADR-001-<spec-id>-<slice-name>.md
ADR-002-openclaw-oauth-mvp.md
ADR-002-openclaw-oauth-should.md
```

**Exemplo de ADR slice:**

```markdown
# ADR-NNN: [Feature] Slice — Must Have

**Data:** 2026-04-09
**Status:** proposto
**SPEC ref:** SPEC-007-openclaw-oauth-profiles.md

## Contexto
Slice MVP do SPEC-007: OAuth profiles persistentes.

## Decisão
Implementar OAuth com tokens persistentes em cookie.

## Consequências
### Positivas
- Login automático após primeiro acesso
### Negativas
- Requer renew token no background

## Task Reference
P002-T01 em tasks/pipeline.json
```

## Index

### Legacy Numbering (0000-series)

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0000](./0000-template.md) | Template | Template | — |
| [0001](./0001-crm-leads-clientes.md) | CRM Leads e Clientes | Accepted | 2024-04-01 |
| [0002](./0002-crm-equipamentos.md) | CRM Equipamentos | Accepted | 2024-04-01 |
| [0003](./0003-crm-agenda.md) | CRM Agenda | Accepted | 2024-04-01 |
| [0004](./0004-crm-kanban.md) | CRM Kanban | Accepted | 2024-04-01 |
| [0005](./0005-crm-ordens-servico.md) | CRM Ordens de Serviço | Accepted | 2024-04-01 |
| [0006](./0006-crm-contratos-pmoc.md) | CRM Contratos PMOC | Accepted | 2024-04-01 |
| [0007](./0007-crm-lembretes-fidelizacao.md) | CRM Lembretes Fidelização | Accepted | 2024-04-01 |
| [0008](./0008-marketing-editorial.md) | Marketing Editorial | Accepted | 2024-04-01 |
| [0009](./0009-integrations-webhooks.md) | Integration Webhooks | Accepted | 2024-04-01 |
| [0010](./0010-integrations-mcp.md) | Integration MCP | Accepted | 2024-04-01 |

### Date-based Numbering (2024-series)

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [20240401](./20240401-governanca-homelab.md) | Governança Homelab | Accepted | 2024-04-01 |
| [20240401](./20240401-otimizacao-sistema.md) | Otimização Sistema | Accepted | 2024-04-01 |
| [20240402](./20240402-governanca-armazenamento.md) | Governança Armazenamento | Accepted | 2024-04-02 |
| [20240403](./20240403-terraform-cloudflare.md) | Terraform Cloudflare | Accepted | 2024-04-03 |

### Date-based Numbering (2026-series)

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [20260317](./20260317-crm-refrimix.md) | CRM Refrimix | Accepted | 2026-03-17 |
| [20260404](./20260404-voice-dev-pipeline.md) | Voice Dev Pipeline | Accepted | 2026-04-04 |

### New Numbering (001-series)

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-governance-centralizada.md) | Governança Centralizada | Aceito | 2026-03-16 |
| [002](./002-dev-environment-vrv-bot.md) | Ambiente Dev VRV Bot | Aceito | 2026-03-16 |

---

## Source Files

Original locations preserved for git history:
- `docs/adr/` — legacy ADRs (0000-0010, 2024-series, 2026-series)
- `docs/ADR/` — new ADRs (001, 002, TEMPLATE, README)

**Note:** The old folders should NOT be edited. They are kept temporarily to preserve git history until Phase 6 of the reorganization plan is complete.
