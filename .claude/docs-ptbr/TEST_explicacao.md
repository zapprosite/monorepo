# /test — TDD Workflow

## O que é
O comando `/test` segue o padrão TDD: Write failing tests → Implement → Verify.

## Quando usar
- Quando você quer fazer TDD (Test-Driven Development)
- Quando precisa de testes para código novo
- Quando quer garantir que código funciona antes de commitar

## O que acontece
1. Escreve testes que falham (describe o comportamento esperado)
2. Implementa código para passar nos testes
3. Verifica que todos testes passam
4. Refatora se necessário

## Ciclo TDD
```
RED → GREEN → REFACTOR
( testes falham → código passa → melhora código )
```

## Não é
- Não faz planejamento (use /plan)
- Não faz review (use /review)
- Não faz debug (use /debug)
