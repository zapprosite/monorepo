---
name: Decide
description: Registo de decisões arquitecturais com racional e alternativas consideradas
trigger: /decide, architectural decision, adr, make decision, trade-offs
version: 1.0.0
deprecated: false
---

# Decide Skill

Regista decisões arquitecturais com rationale e alternativas consideradas. Cria ADRs (Architecture Decision Records).

## Quando Usar

- Decisões de design que afetam múltiplos módulos
- Escolha entre múltiplas abordagens técnicas
- After `/survey` ou `/spec` para registrar escolhas
- Antes de implementar quando há múltiplas opções

## Como Executar

```bash
/decide "JWT vs Session Cookies for auth"
/decide --list     # Listar decisões recentes
/decide DEC-001    # Ver decisão específica
```

## Formato ADR

```json
{
  "id": "DEC-20260417-001",
  "decision": "JWT for authentication",
  "status": "accepted|rejected|deprecated",
  "rationale": "Stateless, scales horizontally, mobile-friendly",
  "alternatives_considered": [
    {
      "name": "Session Cookies",
      "pros": ["Server-side control", "Easy revocation"],
      "cons": ["Stateful", "Cookie size", "CSRF vulnerability"]
    }
  ],
  "agents_consented": ["ARCHITECT", "CODER-1", "REVIEWER"],
  "created": "2026-04-17",
  "updated": "2026-04-17"
}
```

## Registo Automático

Cada decisão é guardada em:

```
.claude/decisions/
├── DEC-20260417-001.json
├── DEC-20260417-002.json
└── index.json              # Índice de todas as decisões
```

## Consulta de Decisões

```bash
# Listar todas as decisões
ls -la .claude/decisions/

# Ver decisão específica
cat .claude/decisions/DEC-20260417-001.json

# Decisões por domínio
grep -l "auth" .claude/decisions/*.json
```

## Integração com Agentes

O **researcher** regista descobertas em `.decisions/`
O **architect** revê e aprova decisões
O **planner** consulta `.decisions/` antes de planear

## Template

```markdown
# ADR-{NNN}: {Título}

## Status
{accepted|rejected|deprecated}

## Context
[O problema ou decisão que precisamos tomar]

## Decision
[A decisão tomada]

## Rationale
[Porquê desta decisão]

## Alternatives Considered
1. **{Alternative}**: [Descrição]
   - Pros: [Vantagens]
   - Cons: [Desvantagens]

## Consequences
[O que muda como resultado desta decisão]

## Agents Consented
- [ ] ARCHITECT
- [ ] CODER-1
- [ ] REVIEWER
```

## Bounded Context

**Faz:**
- Regista decisões com rationale completo
- Mantém índice de decisões
- Proporciona lookup por domínio/topic

**Não faz:**
- Implementação de features
- Auto-aprovação de decisões (requer consentimento)
- Modificação de código (só regista a decisão)
