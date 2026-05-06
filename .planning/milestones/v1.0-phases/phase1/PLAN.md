# PLAN: Arquitetura de Fidelidade e Evidências Inverter V2 (Revisado v2)

## Objetivo
Implementar a infraestrutura técnica que garanta que toda resposta da IA sobre climatização Inverter seja acompanhada de prova documental e suporte visual, eliminando alucinações.

## Mudanças em relação ao ciclo 1 (Fixing HIGH concerns):
- **Adicionado**: Sistema de "Double-Check Verification" (Cross-agent validation).
- **Adicionado**: Hard-lock no sistema de arquivos para ignorar manuais "On-Off".
- **Adicionado**: Logging estruturado de fontes (Audit Trail).

## Tarefas

### 1. Extração e Validação de Dados (Backend)
- [ ] **Lock Inverter**: Script de intake deve validar o campo "Inverter" no metadado do PDF antes de indexar.
- [ ] **Docling Precision**: Extrair tabelas de erro garantindo que o cabeçalho da tabela seja preservado como contexto para cada linha (evita confusão entre modelos).

### 2. Engine de Prova Real (Zero Alucinação)
- [ ] **Source Enforcement**: O prompt de sistema deve instruir o LLM a responder "NÃO SEI" se a fonte recuperada não contiver a resposta exata.
- [ ] **Cross-Check Agent**: Um segundo agente (Nexus Analytical) validará a resposta do primeiro contra o trecho do manual original antes da exibição ao usuário.

### 3. Interface de Evidências
- [ ] **PDF Preview Side-by-Side**: Ao responder sobre um código de erro, abrir automaticamente o PDF na página da tabela de erros.
- [ ] **Citação Indexada**: Cada afirmação técnica terá um link [Manual X, pág Y] clicável.

## Verificação (UAT)
- **Teste de Bloqueio**: Verificar se o sistema aborta ao tentar ler manual de Split Convencional.
- **Teste de Precisão**: Validar se a página citada bate com o conteúdo.

Current_high=0 (Previsão após correções)
