---
name: Discovery Log
description: Architecture decisions and discovery notes
type: architecture
---

# Discovery Log

Decisões de arquitetura e contexto de descobertas durante o desenvolvimento.

## Como Usar

Quando uma decisão arquitectural é tomada durante o desenvolvimento:
1. Documenta aqui com contexto completo
2. Cria ADR em `/docs/ADR/` para decisões permanentes
3. Referencia de qualquer SPEC-*.md

---

## Decisões Recentes

### YYYY-MM-DD — [Título da Decisão]

**Contexto:** [Problema ou oportunidade que motivou a decisão]

**Decisão:** [O que foi decidido]

**Alternativas Consideradas:**
- Alternativa A — [rationale rejeição]
- Alternativa B — [rationale rejeição]

**Consequências:**
- **Positive:** [benefício]
- **Negative:** [custo/risco]

---

## Pending Decisions

| ID | Questão | Impacto | Prioridade |
|----|---------|---------|------------|
| PD-001 | [Questão aberta] | [Alto/Médio/Baixo] | [Crítica/High/Med/Low] |

---

## Architecture Overview

```
[Diagrama ou descrição da arquitectura actual]

Layers:
  - Presentation: React + Vite
  - API: Fastify + tRPC + REST/OpenAPI
  - Data: PostgreSQL + Orchid ORM
  - AI: Ollama (local) + LiteLLM (proxy)
  - Infra: Docker + Coolify + ZFS
```

## Integration Points

| Service | Protocol | Purpose |
|---------|----------|---------|
| Ollama | HTTP | Local LLM inference |
| LiteLLM | HTTP | LLM proxy |
| Qdrant | gRPC/HTTP | Vector storage |
| Infisical | REST | Secrets management |
| Coolify | Docker | PaaS |
