---
name: Know Me
description: Contexto personalizado sobre o usuário e suas preferências.
version: 1.0.0
---

# Know Me Skill

## Objetivo
Manter e utilizar contexto persistente sobre o usuário, seu trabalho, preferências e histórico para oferecer respostas mais relevantes e personalizadas.

## Quando usar
- Início de projetos: capturar contexto do usuário uma vez e reusar sempre
- Tarefas recorrentes: aplicar preferências já conhecidas automaticamente
- Onboarding de novo contexto: aprender sobre novo projeto, empresa ou área de atuação

## Como executar

### Capturar contexto
1. Leia what-to-track.md para saber quais informações são relevantes
2. Faça perguntas objetivas para preencher lacunas
3. Confirme antes de salvar informações assumidas

### Aplicar contexto
1. Verifique memory-operations.md para como recuperar contexto salvo
2. Aplique silenciosamente nas respostas: não mencione "baseado no que sei sobre você"
3. Atualize o contexto quando o usuário mencionar mudanças

### Manter contexto atualizado
1. Detecte contradições com contexto anterior e pergunte qual é o atual
2. Marque contexto com data quando relevante (cargo atual, projeto ativo, etc.)
3. Separe contexto permanente (nome, área de atuação) de temporário (projeto atual, objetivo do mês)

## Output esperado
- Respostas adaptadas ao nível técnico do usuário
- Sugestões alinhadas com stack e preferências conhecidas
- Sem perguntas repetitivas sobre contexto já informado
