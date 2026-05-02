# ADR-012: Hermes Multi-Agent LangGraph Architecture

**Date:** 2026-05-02
**Status:** Active
**Authors:** Nexus SRE

## Context

SPEC-106 documenta dois codebases Hermes com arquiteturas multi-agent distintas:
- **hermes-agent** (Python): loop síncrono com `delegate_task` nativo
- **Hermes Gateway** (TypeScript): CEO routing com LangGraph

Análise crítica identificou gaps críticos que precisam ser endereçados.

## Decisions

### 1. LangGraph como padrão para workflows

**Decision:** LangGraph StateGraph é o padrão oficial para workflows do Hermes Gateway.

**Rationale:** Permite interrupt para approval humano, conditional branching, e checkpoint/resume.

**Implementation:**
```typescript
import { StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';

// State com human approval
interface WorkflowState {
  brief: string;
  outputs: Record<string, unknown>;
  humanApproved?: boolean;
}

// Node com interrupt real
async function humanGateNode(state: WorkflowState) {
  if (state.outputs.brandScore < 0.8) {
    return await interrupt<boolean>('awaiting_human_approval', {
      brandScore: state.outputs.brandScore,
    });
  }
  return { ...state, humanApproved: true };
}

// Conditional edges
.addConditionalEdges('BRAND_GUARDIAN', (s) => {
  if (s.outputs.brandScore < 0.8) return 'HUMAN_GATE';
  return 'SOCIAL';
});
```

### 2. Session state persistence via Qdrant

**Decision:** Session state deve persistir em Qdrant, não em memória.

**Rationale:** Estado em memória morre com restart do serviço.

**Implementation:**
```typescript
// Substituir
const _sessionStates = new Map<string, AgencySupervisorState>();

// Por
const sessionCollection = 'agency_working_memory';
// Salvar em Qdrant após cada node
// Resumir via thread_id
```

### 3. Skills com frontmatter YAML válido

**Decision:** Todas as skills devem ter frontmatter YAML com `name`, `description`, `version`.

**Rationale:** 6 skills sem frontmatter causam parsing failures.

```yaml
---
name: brain-analytics
description: Analytics skill for Hermes
version: 1.0.0
---
```

## Gaps Identificados (P0)

| ID | Gap | Severity |
|----|-----|----------|
| P0-1 | 4/5 workflows são fake (sequencial async, não StateGraph) | CRITICAL |
| P0-2 | content_pipeline com edges fixos (sem conditional) | HIGH |
| P0-3 | humanGateNode auto-aprova (interrupt não funciona) | CRITICAL |
| P0-4 | 6 skills sem frontmatter YAML | MEDIUM |
| P0-5 | 3 skills com refs deprecated (gemma4, whisper-server-v2) | MEDIUM |

## Gaps Identificados (P1)

| ID | Gap | Severity |
|----|-----|----------|
| P1-1 | approveContentPipeline não funciona (graph já terminou) | HIGH |
| P1-2 | Session state in-memory | HIGH |
| P1-3 | MemorySaver não persiste (deveria ser QdrantSaver) | HIGH |
| P1-4 | 10 RL tools órfãs (sem toolset) | MEDIUM |
| P1-5 | 20 skills sem category | MEDIUM |

## Consequences

### Positive
- Workflows com interrupt real para approval humano
- Session state sobrevive a restarts
- LangGraph checkpoints para resume de long-running jobs

### Negative
- Refactoring de 4 workflows fake para StateGraph real
- Migration de MemorySaver para QdrantSaver

## References

- SPEC-106: Hermes Multi-Agent Architecture Standard
- LangGraph StateGraph documentation
- hermes-gateway/langgraph/content_pipeline.ts