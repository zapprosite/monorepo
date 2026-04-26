# Skill: catalog-sync

**Tipo:** Varredura e Sincronização do Catálogo de Dados
**Criado:** 2026-03-17
**Dependências:** mcp__postgres, mcp__qdrant, Ollama bge-m3

---

## Propósito

Sincronizar o catálogo central (`catalog.*` no Supabase) com a realidade atual:
- Schemas reais no PostgreSQL
- Collections reais no Qdrant
- Detectar divergências e registrar novos recursos

---

## Quando Usar

- Após criar novos schemas ou collections
- Antes de operações de limpeza ou arquivamento
- Auditoria semanal automática
- Quando o DOC_CATALOG.md precisar ser regenerado

---

## Procedimento

### PASSO 1 — Coletar Estado Real do PostgreSQL

```sql
-- Todos os schemas existentes
SELECT schema_name, schema_owner
FROM information_schema.schemata
ORDER BY schema_name;

-- Contagem de tabelas por schema
SELECT table_schema, count(*) as table_count
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
GROUP BY table_schema
ORDER BY table_schema;
```

### PASSO 2 — Coletar Estado Real do Qdrant

Via `mcp__qdrant__qdrant-find` ou API REST:
```bash
curl -s http://localhost:6333/collections | python3 -m json.tool
```

### PASSO 3 — Comparar com Catálogo

```sql
-- Schemas REAIS que não estão no catálogo
SELECT s.schema_name
FROM information_schema.schemata s
LEFT JOIN catalog.schema_registry r ON s.schema_name = r.schema_name
WHERE r.schema_name IS NULL
  AND s.schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast',
                             'pg_temp_1', 'pg_toast_temp_1');

-- Schemas no catálogo que não existem mais
SELECT schema_name FROM catalog.schema_registry
WHERE schema_name NOT IN (
    SELECT schema_name FROM information_schema.schemata
);
```

### PASSO 4 — Atualizar Contadores

```sql
-- Atualizar table_count para cada schema gerenciado
UPDATE catalog.schema_registry r
SET table_count = (
    SELECT count(*)
    FROM information_schema.tables t
    WHERE t.table_schema = r.schema_name
    AND t.table_type = 'BASE TABLE'
),
updated_at = now()
WHERE r.schema_type IN ('app', 'shared', 'catalog');
```

### PASSO 5 — Registrar Novos Recursos Descobertos

Para schemas novos descobertos no PASSO 3:
```sql
INSERT INTO catalog.schema_registry (schema_name, schema_type, description, status, notes)
VALUES (
    'app_novo',
    'app',
    'Schema descoberto em auditoria — preencher descrição',
    'active',
    'Registrado automaticamente em auditoria ' || now()::date
);
```

Para collections novas no Qdrant:
```sql
INSERT INTO catalog.collection_registry
    (collection_name, collection_type, description, embedding_model, dimensions, point_count)
VALUES (
    'nome_collection',
    'test',
    'Collection descoberta em auditoria',
    'desconhecido',
    0,
    0
);
```

### PASSO 6 — Gerar Embeddings para Novos Registros

Para cada novo registro, gerar embedding da descrição via bge-m3:
```bash
curl -s http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bge-m3",
    "prompt": "Schema: app_novo — descrição do schema"
  }'
```

Armazenar via `mcp__qdrant__qdrant-store` na collection `catalog_embeddings` com metadata:
```json
{
  "source": "catalog.schema_registry",
  "domain": "catalog",
  "type": "catalog_entry",
  "schema_name": "app_novo",
  "language": "pt-BR",
  "model": "bge-m3",
  "model_dims": 1024
}
```

### PASSO 7 — Regenerar DOC_CATALOG.md

Após sincronização, atualizar `/srv/ops/ai-governance/DOC_CATALOG.md` com:

```sql
-- Query para gerar seção de schemas
SELECT schema_name, schema_type, description, status, table_count, created_at
FROM catalog.schema_registry
ORDER BY schema_type, schema_name;

-- Query para gerar seção de collections
SELECT collection_name, collection_type, description, embedding_model,
       dimensions, point_count, status
FROM catalog.collection_registry
ORDER BY collection_type, collection_name;
```

### PASSO 8 — Log de Auditoria

Registrar em `/srv/ops/ai-governance/logs/catalog-audit.log`:
```
YYYY-MM-DD HH:MM:SS | SYNC | schemas_novos=N, collections_novas=N, divergencias=N | OK/ERRO
```

---

## Consultas Úteis do Bibliotecário

### "Onde estão dados de X?"
```sql
SELECT * FROM catalog.schema_registry
WHERE description ILIKE '%X%' OR schema_name ILIKE '%X%';

SELECT * FROM catalog.collection_registry
WHERE description ILIKE '%X%' OR collection_name ILIKE '%X%';
```

### "O que existe no Supabase?"
```sql
SELECT schema_name, schema_type, description, table_count, status
FROM catalog.schema_registry
WHERE status = 'active'
ORDER BY schema_type, schema_name;
```

### "Quais collections usar para RAG?"
```sql
SELECT collection_name, description, embedding_model, dimensions, point_count
FROM catalog.collection_registry
WHERE collection_type = 'rag' AND status = 'active';
```

### "Há dados sem governança?"
```sql
-- Schemas fora do padrão
SELECT schema_name FROM catalog.schema_registry
WHERE schema_type = 'system' AND schema_name NOT IN (
    'auth', 'storage', 'realtime', 'extensions', '_supabase',
    '_analytics', 'graphql_public', 'pgsodium', 'vault',
    'pgbouncer', 'pgmq_public', 'supabase_migrations', 'public'
);
```

---

## Notas

- Executar semanalmente via n8n (workflow automático)
- Claude Code pode executar interativamente via MCPs postgres + qdrant
- Sempre atualizar DOC_CATALOG.md após sync
- Registrar no CHANGE_LOG.txt se houver alterações estruturais
