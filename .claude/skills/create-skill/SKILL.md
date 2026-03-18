---
name: Create Skill
description: Guia para criação de novas skills padronizadas para agentes.
version: 1.0.0
---

# Create Skill

## Objetivo
Criar novas skills para o Claude Code que sejam úteis, bem documentadas e funcionem de forma consistente.

## Quando usar
- Você precisa de um comportamento especializado que o Claude não tem nativamente
- Quer padronizar como uma tarefa recorrente é executada
- Precisa dar contexto de domínio específico ao Claude (stack, convenções, regras do projeto)

## Estrutura obrigatória de uma skill

```
nome-da-skill/
├── SKILL.md          # Instruções principais (este arquivo é lido primeiro)
└── *.md              # Arquivos de referência e contexto adicionais
```

## Como escrever um SKILL.md eficaz

### Seções essenciais
1. **Objetivo**: uma frase clara do que a skill faz
2. **Quando usar**: casos de uso específicos (ajuda o Claude a decidir quando carregar)
3. **Como executar**: passo a passo do processo
4. **Output esperado**: formato e conteúdo do que deve ser entregue

### Boas práticas de escrita
- Seja específico: "use bcrypt com custo 12" em vez de "hash senhas com segurança"
- Inclua exemplos de bom e mau output quando possível
- Documente exceções e casos extremos
- Referencie outros arquivos da skill quando o conteúdo for longo

## Testando a skill
1. Abra o Claude Code em um projeto real
2. Acione a skill via /nome-da-skill
3. Verifique se o output bate com o esperado
4. Ajuste o SKILL.md e repita até ficar consistente

## Leia também
- examples.md: exemplos de skills bem construídas
- reference.md: referência técnica de todas as opções de configuração
