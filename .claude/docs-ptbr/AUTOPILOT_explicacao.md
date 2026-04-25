# /autopilot — Execução Autônoma

## O que é
O comando `/autopilot` executa de forma autônoma até a task ser verificada completa.

## Quando usar
- Quando você confiou no plano e quer executar sem supervisión
- Quando precisa fazer trabalho pesado em background
- Quando você vai estar offline por um tempo

## O que acontece
1. Lê o plano (de /plan ou SPEC)
2. Executa tarefas uma por uma
3. Verifica cada resultado
4. Se algo falha, tenta abordagem alternativa
5. Para quando tudo está completo ou não pode continuar

## Precauções
- Pastikan plano está correto antes de usar
- Monitore ocasionalmente
- Tenha rollback plan se algo sair errado

## Não é
- Não é para debugging (use /universal-debug)
- Não substitui review humano
- Não faz decisões complexas sozinho
