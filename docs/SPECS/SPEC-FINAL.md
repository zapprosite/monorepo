---
name: SPEC-FINAL
description: Consolidar Hermes e Mem0 no monorepo
status: draft
owner: SRE-Platform
created: 2026-04-25
---

# SPEC-FINAL — Consolidacao Final do Monorepo

## Problema

O objetivo original (SPEC-999v1) era consolidar Hermes e Mem0 dentro do monorepo,mas foi abandonado por ambicao. Remain: Hermes vive em ~/.hermes (287MB), Mem0 em ~/.hermes/mem0-data/.

## Solucao

Executar consolidacao final em 3 fases com Nexus.

## Tasks

### Task 1: Audit Hermes atual
Analisar ~/.hermes/ — o que e CORE vs DEPRECATED:
- Listar todos os dirs
- Identificar ocupado vs vazio
- Classificar: agent-core, integrations, cache, logs

Output: /tmp/hermes-audit.md

### Task 2: Map Mem0 to monorepo
Analisar mcps/mcp-memory/ vs ~/.hermes/mem0-data/:
- O que mcps/mcp-memory ja faz
- O que mem0-data tem que nao existe em mcps
- Gap analysis

Output: /tmp/mem0-gap.md

### Task 3: Create hermes-core symlink
Criar /srv/monorepo/hermes/ → ~/.hermes/ symlink:
- mantem files em ~/.hermes (dados reais)
- expõe interface no monorepo
- atualiza docs

### Task 4: Update SPEC-FLOW-001 status
Marcar SPEC-FLOW-001 como completed ja que Flow-Next installed

### Task 5: Git commit final
Commit all changes com mensagem clara

## Execution

```bash
cd /srv/monorepo
bash .claude/vibe-kit/nexus.sh --spec SPEC-FINAL --phase plan
bash .claude/vibe-kit/nexus.sh --spec SPEC-FINAL --phase execute --parallel 5 --force
```

## Acceptance Criteria

1. `ls -la /srv/monorepo/hermes` mostra ~/.hermes content
2. mcps/mcp-memory funcionando
3. Git commit feito
4. Nexus continua funcional