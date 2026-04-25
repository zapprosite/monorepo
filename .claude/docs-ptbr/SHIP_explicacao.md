# /ship — Finalizar e Sincronizar

## O que é
O comando `/ship` é o padrão end-of-session: docs → memory → commit → push → merge → nova branch.

## Quando usar
- No final de uma sessão de trabalho
- Quando você terminou uma tarefa grande
- Antes de trocar de contexto

## O que acontece
1. Atualiza documentação se mudou algo
2. Salva estado na memória do projeto
3. Commita todas mudanças
4. Push para remote
5. Merge com main (se configurado)
6. Cria nova branch para próximo trabalho

## Variantes
- `/ship` — padrão completo
- `/turbo` — versão rápida sem PR
- `/universal-turbo` — funciona com qualquer VCS

## Não é
- Não é deploy (veja /deploy-check)
- Não é planning (veja /plan)