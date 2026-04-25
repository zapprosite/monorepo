# /build — Implementação Incremental

## O que é
O comando `/build` implementa a próxima tarefa de forma incremental: build → test → verify → commit.

## Quando usar
- Quando você tem um plano (/plan) e quer executar
- Quando precisa implementar algo passo a passo
- Quando quer iterative feedback

## O que acontece
1. Pega próxima tarefa da lista
2. Implementa código
3. Roda testes
4. Verifica funcionamento
5. Faz commit automaticamente
6. Reporta resultado

## Ciclo
```
Implementar → Testar → Verificar → Commitar → Repetir
```

## Opções
- `/build` — próxima tarefa
- `/build [n]` — tarefa específica number n
- `/build --dry-run` — mostra o que faria sem fazer

## Não é
- Não cria plano (use /plan)
- Não faz deploy (use /ship)
- Não revisa código (use /review)
