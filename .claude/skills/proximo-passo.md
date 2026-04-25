---
name: proximo-passo
description: Sugere o próximo passo lógico
trigger: /proximo-passo
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /proximo-passo — Qual é o Próximo?

## Quando Usar
- Terminou uma tarefa e quer saber o que fazer
- Não sabe o próximo comando
- Workflow parado

## Lógica de Sugestão

| Situação | Próximo Passo |
|----------|---------------|
| Sem SPEC | `/spec` → criar especificação |
| SPEC pronta | `/plan` → criar tarefas |
| Tarefas criadas | `/execute` → executar |
| Em execução | `/status` → monitorar |
| Execução concluída | `/review` → revisar |
| Revisão aprovada | `/ship` → finalizar |

## Como Usar

```
/proximo-passo
```

## Exemplo de Saída

```
🎯 PRÓXIMO PASSO RECOMENDADO

Situação atual: SPEC criada, sem tasks

Recomendação: /plan

Por quê: Você tem SPEC mas ainda não criou tarefas

Alternativas:
  /build     - se quiser implementar direto
  /spec      - se precisar criar SPEC primeiro
```