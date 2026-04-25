---
name: SPEC-FLOW-001
description: Integrar Flow-Next no monorepo como workflow engine
status: draft
owner: SRE-Platform
created: 2026-04-25
---

# SPEC-FLOW-001 — Flow-Next Integration

## Problema

Nexus é competente para paralelismo massivo mas falta:
- **Re-anchoring** (re-lê specs antes de cada task)
- **Plan-first** approach
- **Cross-model review** (Claude + Codex/GPT)
- **Zero external deps** — tudo no repo

Flow-Next resolve estes gaps com 16 agent-native skills.

## Solucao

Integrar Flow-Next como plugin Claude Code + substituir workflow pattern do Nexus.

## Tasks

### Task 1: Setup Flow-Next Plugin
- Clone flow-next repo
- Install via `/plugin marketplace add`
- Run `/flow-next:setup`
- Verify commands available

### Task 2: Import Nexus Skills to Flow-Next
- Map existing nexus.sh commands to flow-next skills
- Create `/flow-next:nexus-init` custom skill
- Document mapping: Nexus → Flow-Next

### Task 3: Create monorepo-specific skills
- `/flow-next:monorepo-audit` — audit current state
- `/flow-next:spec-from-chat` — generate SPEC from conversation
- `/flow-next:deploy-check` — deployment validation

### Task 4: Test Flow-Next workflow
- Run `/flow-next:prospect` for new feature
- Run `/flow-next:plan` to create tasks
- Run `/flow-next:work` with 5 parallel workers

### Task 5: Document integration
- Update SRE-DASHBOARD.md com Flow-Next section
- Create FLOW-NEXT_GUIDE.md
- Update monorepo-TREE.md

## Acceptance Criteria

1. `/flow-next:setup` completes without errors
2. `/flow-next:plan` creates valid task queue
3. At least 3 flow-next commands working
4. Documentation created
5. Nexus still functional alongside Flow-Next