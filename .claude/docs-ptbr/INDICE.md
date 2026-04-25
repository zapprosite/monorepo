# Documentação PT-BR — Guia de Comandos

**Objetivo:** Explicar comandos em inglês para equipe brasileira
**Data:** 2026-04-25 | **Versão:** 1.0

---

## Introdução

Os comandos do Claude Code são em inglês, mas a explicação é em PT-BR.
Isto facilita para a equipe que lê português mas usa ferramentas em inglês.

---

## Comandos por categoria

### PLANEJAMENTO

| Comando | Explicação |
|---------|------------|
| `/plan` | [explicação] → `PLANNING_explicacao.md` |
| `/spec` | [explicação] → `SPEC_explicacao.md` |
| `/feature-breakdown` | Divide feature grande em tarefas |

### EXECUÇÃO

| Comando | Explicação |
|---------|------------|
| `/build` | Implementação incremental → `BUILD_explicacao.md` |
| `/execute` | Workflow completo com 14 agentes → `EXECUTE_explicacao.md` |
| `/test` | TDD Workflow → `TEST_explicacao.md` |
| `/autopilot` | Execução autônoma → `AUTOPILOT_explicacao.md` |

### REVISÃO

| Comando | Explicação |
|---------|------------|
| `/review` | Code review geral → `REVIEW_explicacao.md` |
| `/code-review` | Análise profunda |
| `/security-review` | Foco em segurança |

### DEBUG

| Comando | Explicação |
|---------|------------|
| `/universal-debug` | 4 fases sistemáticas → `DEBUG_explicacao.md` |

### SHIP & RELEASE

| Comando | Explicação |
|---------|------------|
| `/ship` | End-of-session completo → `SHIP_explicacao.md` |
| `/turbo` | Ship rápido sem PR |

---

## Como usar

1. Escolha o comando baseado na situação
2. Leia a explicação em PT-BR
3. Use o comando em inglês conforme documentado

---

## Fluxo recomendado

```
/spec → /plan → /build → /test → /review → /ship
```

Para debugging:

```
/universal-debug → /build → /review
```