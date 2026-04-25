# /execute — Workflow Completo

## O que é
O comando `/execute` faz o workflow completo: SPEC → 14 agentes paralelos → PR.

## Quando usar
- Quando você tem SPEC completa e quer executar
- Quando precisa de paralelismo massivo
- Quando quer automatizar implementação inteira

## O que acontece
1. Lê SPEC completa
2. Quebra em ~14 tarefas independentes
3. Executa 14 workers em paralelo
4. Cada worker processa suas tarefas
5. Agrega resultados
6. Cria PR com todas mudanças

## Requisitos
- SPEC deve ter acceptance criteria claros
- Tarefas devem ser independentes
- Contexto não pode depender de resultado de outra task

## Velocidade
- Típico: 10-20x mais rápido que execução serial
- Limitação: tasks que dependem de outras não podem ser paralelizadas
