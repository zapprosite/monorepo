# GUIA RÁPIDO — COMANDOS DO CLAUDE CODE

**Versão:** 1.0 | **Data:** 2026-04-25

---

## SITUAÇÃO → COMANDO

| Situação | Use | O que faz |
|----------|-----|-----------|
| "Preciso começar algo" | `/plan` | Cria lista de tarefas |
| "Tenho ideia maluca" | `/spec` | Cria especificação formal |
| "Vou implementar" | `/build` | Executa + testa + commita |
| "Quero fazer testes primeiro" | `/test` | TDD ciclo |
| "Algo está quebrado" | `/universal-debug` | 4 fases para achar causa |
| "Terminei, quero finalizar" | `/ship` | Commit + push + merge |
| "Preciso de ajuda no código" | `/review` | Analisa e sugere melhorias |
| "Quero executar automático" | `/autopilot` | Executa até completar |
| "Tenho SPEC pronta, quero ir" | `/execute` | 14 agentes em paralelo |

---

## FLUXO PADRÃO

```
IDEIA → /spec → /plan → /build → /test → /review → /ship
```

---

## NÃO CONFUNDA

| Você quer... | Use | Não use |
|--------------|-----|---------|
| Criar plano | `/plan` | `/spec` |
| Criar especificação | `/spec` | `/plan` |
| Implementar | `/build` | `/execute` |
| Paralelizar 14 workers | `/execute` | `/build` |
| Debugar | `/universal-debug` | `/review` |
| Ship final | `/ship` | `/turbo` |

---

## TIMES (timing)

| Você tem... | Use | Explain |
|-------------|-----|---------|
| 5 min para task | `/build` | implementação incremental |
| 30 min para feature | `/plan` + `/build` | planejamento + execução |
| 1+ hora para projeto | `/spec` + `/plan` + `/execute` | spec + plano + paralelismo |

---

*Guia rápido para consulta*