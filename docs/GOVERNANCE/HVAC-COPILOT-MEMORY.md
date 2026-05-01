# HVAC Copilot Memory — Runbook

## Visão Geral

O `zappro-clima-tutor` nunca mais deve nascer "bebê" em novo chat.
O fluxo obrigatório é:

```
Chat novo → context_fetch → MiniMax → memory_writeback → resposta
```

## Arquitetura de Memória

| Camada | Tecnologia | Role |
|--------|-----------|------|
| Hot | Mem0 (Qdrant) | Preferências, decisões, fatos reutilizáveis |
| Warm | Postgres (jsonb) | Ledger de eventos, estado de conversa |
| Semantic | Qdrant hvac_manuals_v1 | Busca semântica em manuais e second-brain |
| Canonical | Hermes Second Brain | Checkpoints de produto |

## Fluxo de Dados

### Antes de Responder (context_fetch)

1. Extrair `user_id` e `conversation_id` dos headers OpenAI
2. Buscar Mem0: `user_id + domain=hvac` → máx 6 resultados
3. Buscar Postgres: `conversation_id` → máx 4 eventos recentes
4. Buscar Qdrant: `query + filters` → máx 3 chunks
5. Agregar em context_pack (máx 12 itens, 2500 tokens)
6. Injetar no prompt MiniMax como seção "## Memória Relevante"

### Depois de Responder (memory_writeback)

1. Resumir query + answer em 1-3 frases curtas
2. Se contém decisão/preferência → salvar em Mem0
3. INSERT evento em Postgres (hvac_memory.agent_memory_events)
4. NUNCA: secrets, respostas completas, logs grandes

## Tabelas Postgres

### hvac_memory.agent_memory_events
```sql
-- Query útil: ver todas as memórias de uma conversa
SELECT content, event_type, confidence, created_at
FROM hvac_memory.agent_memory_events
WHERE conversation_id = 'conv-xxx'
ORDER BY created_at DESC;

-- Query útil: ver preferências de um usuário
SELECT content, created_at
FROM hvac_memory.agent_memory_events
WHERE user_id = 'user-xxx' AND event_type = 'preference'
ORDER BY created_at DESC LIMIT 10;
```

### hvac_memory.conversation_state
```sql
-- Ver estado atual de uma conversa
SELECT state, updated_at
FROM hvac_memory.conversation_state
WHERE conversation_id = 'conv-xxx';
```

## Como Apagar Memória Ruim

### Apagar memória específica do Mem0
(Sempre via API Mem0 — não direto no Qdrant)

### Apagar eventos do Postgres
```sql
-- Apagar por conversation_id
DELETE FROM hvac_memory.agent_memory_events
WHERE conversation_id = 'conv-xxx';

-- Apagar por user_id + tipo
DELETE FROM hvac_memory.agent_memory_events
WHERE user_id = 'user-xxx' AND event_type = 'preference'
AND content LIKE '%texto ruim%';
```

### Apagar estado de conversa
```sql
DELETE FROM hvac_memory.conversation_state
WHERE conversation_id = 'conv-xxx';
```

## Como Resetar uma Conversa

```sql
-- Remove estado, mantém preferências do usuário
DELETE FROM hvac_memory.conversation_state WHERE conversation_id = 'conv-xxx';
DELETE FROM hvac_memory.agent_memory_events WHERE conversation_id = 'conv-xxx';
DELETE FROM hvac_memory.memory_writebacks WHERE conversation_id = 'conv-xxx';
-- Manter: memórias com user_id (não conversation_id)
```

## Como Auditar memory_writeback

```sql
-- Ver todos os writebacks de um dia
SELECT user_id, conversation_id, query_summary, answer_summary, created_at
FROM hvac_memory.memory_writebacks
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC;

-- Ver fatos extraídos de um writeback
SELECT facts_extracted, metadata
FROM hvac_memory.memory_writebacks
WHERE conversation_id = 'conv-xxx';
```

## Health Check

```bash
python3 scripts/hvac-rag/hvac_memory_context.py --health
# ou via healthcheck existente:
python3 scripts/hvac-rag/hvac_healthcheck.py
```

Verifica: Postgres (porta 5432), Mem0/Qdrant (porta 6333).

## Como Evitar Prompt Gigante

Regra: máx 12 memórias, máx 2500 tokens.

O `build_context_pack()` corta do final se exceder.
Prioridade: `active` > `high_confidence` > `recent`.

## Resolver "Bebê sem Memória"

Se novo chat nascer zerado, verificar:
1. Postgres: `SELECT count(*) FROM hvac_memory.agent_memory_events WHERE user_id = 'xxx'`
2. Mem0: `memory_search(user_id)` retorna resultados?
3. Qdrant: collection `hvac_manuals_v1` tem pontos?
4. Schema: tabela `hvac_memory.agent_memory_events` existe?
5. Credenciais: `POSTGRES_PASSWORD`, `QDRANT_API_KEY` setados no .env?

## Limites de Custo

- Mem0: busca em ~1973 vetores (collection `will`)
- Qdrant: busca em 442 pontos (`hvac_manuals_v1`)
- Postgres: INSERT por resposta (~10-50ms)
- Nenhum custo adicional de API externa

## Comandos Úteis

```bash
# Criar schema (primeira vez)
psql -h localhost -U postgres -d postgres -f scripts/hvac-rag/hvac_memory_schema.sql

# Smoke test
python3 scripts/hvac-rag/hvac_memory_context.py --smoke

# Ver tamanho da tabela
SELECT pg_size_pretty(pg_total_relation_size('hvac_memory.agent_memory_events'));

# Ver conexões ativas
SELECT count(*) FROM pg_stat_activity WHERE datname = 'postgres';
```
