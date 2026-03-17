# Regras de Pesquisa e Contexto

## Diretórios de Contexto Prioritário

Sempre que realizar pesquisas no código ou buscar por definições de agentes, workflows ou habilidades, considere os seguintes diretórios como fontes de verdade:

1. **.agent/**: Contém a definição SOTA de agentes, workflows e habilidades do Antigravity Kit.
   - Sempre inclua `@.agent/` em pesquisas globais.
   - Trate arquivos em `.agent/agents/` e `.agent/workflows/` como diretrizes de comportamento.

2. **.context/**: Contém o mapeamento semântico e documentação gerada pelo MCP ai-context.

## Comportamento de Pesquisa

- Ao pesquisar por lógica de negócio ou arquitetura, se os resultados na pasta `apps/` ou `packages/` forem inconclusivos, realize uma busca secundária automática em `.agent/` para verificar se existe um workflow ou guia específico para a tarefa.
- Priorize o contexto definido em `.agent/ARCHITECTURE.md` para entender a hierarquia de capacidades do sistema.
