---
version: 1.0
author: will-zappro
date: 2026-04-08
---

# Governança de Banco de Dados & Dados Semânticos

**Host:** will-zappro
**Criado:** 2026-03-17
**Atualizado:** 2026-04-08
**Autoridade:** Principal Engineer - Platform Governance

---

## 1. Visão Geral

Este documento define políticas de organização, nomenclatura e ciclo de vida para:

- **PostgreSQL** (Supabase, N8N containers, Coolify, Infisical)
- **Qdrant** (collections de vetores)
- **Catálogo Central** (schema `catalog` no Supabase)

---

## 2. Instâncias PostgreSQL

### 2.1 Inventário Completo (2026-04-08)

| #   | Instância              | Host                             | Porta | Base      | Password (vault)                           | Config             |
| --- | ---------------------- | -------------------------------- | ----- | --------- | ------------------------------------------ | ------------------ |
| 1   | **Supabase Postgres**  | PRUNED (discontinued 2026-04-14) | —     | —         | —                                          | —                  |
| 2   | **N8N Postgres-1**     | localhost (Coolify)              | 5432  | n8n       | `SERVICE_PASSWORD_POSTGRES` (Coolify .env) | ⚙️ Coolify-managed |
| 3   | **N8N Postgres-2**     | localhost (Coolify)              | 5432  | n8n       | `SERVICE_PASSWORD_POSTGRES` (Coolify .env) | ⚙️ Coolify-managed |
| 4   | **Coolify Postgres**   | localhost                        | 5432  | coolify   | `COOLIFY_DB_PASSWORD`                      | 🔑 vault           |
| 5   | **Infisical Postgres** | localhost                        | 5432  | infisical | `INFISICAL_DB_PASSWORD`                    | 🔑 vault           |

### 2.2 Regras de Conexão

| Para usar...        | Connection string                                                             | Auth env var                 |
| ------------------- | ----------------------------------------------------------------------------- | ---------------------------- |
| Supabase via MCP    | `postgresql://postgres:${SUPABASE_POSTGRES_PASSWORD}@localhost:5435/postgres` | `SUPABASE_POSTGRES_PASSWORD` |
| Supabase via pooler | `postgresql://postgres:${SUPABASE_POSTGRES_PASSWORD}@localhost:5433/postgres` | `SUPABASE_POSTGRES_PASSWORD` |
| N8N Postgres-1      | Não usar diretamente (N8N interno)                                            | —                            |
| N8N Postgres-2      | Não usar diretamente (N8N interno)                                            | —                            |

### 2.3 N8N Postgres (isolado — NÃO usar para aplicação)

Cada instância N8N no Coolify tem o seu Postgres containerizado. **Não usar directamente.**

- **N8N-1:** Coolify ID `ur0tcppyr7cdaifbnzumxtis`
- **N8N-2:** Coolify ID `jbu1zy377ies2zhc3qmd03gz`

Credentials no `.env` de cada serviço no Coolify — não estão no vault principal.

### 2.4 Banco Principal: `supabase-db`

Única instância para dados de aplicação e catálogo. Os outros bancos são isolados por propósito.

**Conexão via MCP:** `postgresql://postgres:${SUPABASE_POSTGRES_PASSWORD}@localhost:5435/postgres`

**⚠️ NUNCA hardcoded — usar sempre `${SUPABASE_POSTGRES_PASSWORD}` do vault**

### 2.2 Banco Principal: `supabase-db`

Única instância para dados de aplicação e catálogo. Os outros bancos são isolados por propósito.

**Conexão via MCP:** `postgresql://postgres:PASSWORD@localhost:5435/postgres`

---

## 3. Schemas no Supabase

### 3.1 Schemas Protegidos (NÃO TOCAR)

Criados e gerenciados pelo Supabase internamente. Nunca criar tabelas nesses schemas.

| Schema                | Dono     | Propósito                      |
| --------------------- | -------- | ------------------------------ |
| `public`              | Supabase | Tabelas públicas via PostgREST |
| `auth`                | Supabase | Autenticação (GoTrue)          |
| `storage`             | Supabase | Object storage                 |
| `realtime`            | Supabase | Websockets                     |
| `extensions`          | Supabase | PostgreSQL extensions          |
| `_supabase`           | Supabase | Dados internos                 |
| `_analytics`          | Supabase | Analytics (Logflare)           |
| `graphql_public`      | Supabase | GraphQL                        |
| `pgsodium`            | Supabase | Criptografia                   |
| `vault`               | Supabase | Segredos criptografados        |
| `pgbouncer`           | Supabase | Pooler metadata                |
| `pgmq_public`         | Supabase | Message queue                  |
| `supabase_migrations` | Supabase | Migrations                     |

### 3.2 Schemas de Aplicação (Gerenciados por nós)

| Prefixo   | Uso                               | Exemplo                         |
| --------- | --------------------------------- | ------------------------------- |
| `catalog` | Registro central (único)          | `catalog`                       |
| `app_`    | Dados de aplicação                | `app_hvac`, `app_controle`      |
| `shared_` | Tabelas compartilhadas entre apps | `shared_users`, `shared_config` |

### 3.3 Ciclo de Vida de Schemas

```
proposta → aprovação → criação → registro no catálogo → uso → deprecated → archived
```

1. **Proposta:** Usar template `templates/new-schema.md`
2. **Aprovação:** Principal Engineer aprova
3. **Criação:** `CREATE SCHEMA app_nome`
4. **Registro:** `INSERT INTO catalog.schema_registry`
5. **Uso:** Desenvolvimento normal
6. **Deprecação:** `UPDATE catalog.schema_registry SET status = 'deprecated'`
7. **Arquivamento:** `pg_dump` seletivo → `DROP SCHEMA` → status `archived`

---

## 4. Schema `catalog` — Catálogo Central

### 4.1 Propósito

Fonte de verdade estruturada para tudo que existe nos bancos e no Qdrant.

### 4.2 Tabelas

#### `catalog.schema_registry`

Registra todos os schemas do Supabase.

```sql
CREATE SCHEMA IF NOT EXISTS catalog;

CREATE TABLE catalog.schema_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schema_name TEXT NOT NULL UNIQUE,
    schema_type TEXT NOT NULL CHECK (schema_type IN ('app','rag','shared','system','catalog')),
    description TEXT NOT NULL,
    owner TEXT NOT NULL DEFAULT 'will',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','archived')),
    table_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);
```

#### `catalog.collection_registry`

Registra todas as collections do Qdrant.

```sql
CREATE TABLE catalog.collection_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_name TEXT NOT NULL UNIQUE,
    collection_type TEXT NOT NULL CHECK (collection_type IN ('rag','app','catalog','test')),
    description TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    distance_metric TEXT NOT NULL DEFAULT 'Cosine',
    point_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);
```

#### `catalog.table_registry`

Registra tabelas relevantes em schemas gerenciados.

```sql
CREATE TABLE catalog.table_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schema_name TEXT NOT NULL REFERENCES catalog.schema_registry(schema_name),
    table_name TEXT NOT NULL,
    description TEXT NOT NULL,
    row_count_approx BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(schema_name, table_name)
);
```

#### `catalog.embedding_registry`

Registra modelos de embedding disponíveis.

```sql
CREATE TABLE catalog.embedding_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_name TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT
);
```

---

## 5. Collections Qdrant

### 5.1 Collections Ativas

| Collection           | Tipo    | Dimensões | Modelo                | Status     | Propósito                    |
| -------------------- | ------- | --------- | --------------------- | ---------- | ---------------------------- |
| `catalog_embeddings` | catalog | 1024      | bge-m3                | ativo      | Busca semântica no catálogo  |
| `rag_governance`     | rag     | 1024      | bge-m3                | ativo      | Docs de governança indexadas |
| `main`               | test    | 384       | fast-all-minilm-l6-v2 | deprecated | Collection antiga (não usar) |
| `rag_docs`           | rag     | 1024      | bge-m3                | deprecated | Dados mistos (migrar)        |

### 5.2 Regras para Collections

1. **Uma collection por domínio semântico** — nunca misturar domínios
2. **Padrão bge-m3 (1024D)** para tudo novo
3. **fast-all-minilm (384D)** somente retrocompatibilidade
4. **Nomenclatura obrigatória** (ver seção 6)

### 5.3 Ciclo de Vida de Collections

```
proposta → aprovação → criação no Qdrant → registro em catalog.collection_registry
→ uso → deprecated → archived (backup + deleção)
```

Usar template `templates/new-collection.md` para proposta.

---

## 6. Convenções de Nomenclatura

### 6.1 Schemas

| Prefixo   | Uso                                            | Exemplo        |
| --------- | ---------------------------------------------- | -------------- |
| `app_`    | Dados de uma aplicação específica              | `app_hvac`     |
| `shared_` | Dados compartilhados entre apps                | `shared_users` |
| `catalog` | Registro central (único, sem prefixo numérico) | `catalog`      |

**Regras:**

- Minúsculas com underscore
- Nome descritivo e curto
- Sem números ou caracteres especiais (exceto underscore)

### 6.2 Collections Qdrant

| Prefixo              | Uso                        | Modelo obrigatório | Exemplo            |
| -------------------- | -------------------------- | ------------------ | ------------------ |
| `rag_`               | Docs/conhecimento para RAG | bge-m3 1024D       | `rag_hvac`         |
| `app_*_vectors`      | Vetores de aplicação       | bge-m3 1024D       | `app_hvac_vectors` |
| `catalog_embeddings` | Busca no catálogo (único)  | bge-m3 1024D       | (único)            |
| `test_`              | Experimentos               | qualquer           | `test_novo_modelo` |

### 6.3 Metadata Padrão (Qdrant)

Todo ponto armazenado no Qdrant **deve** ter esse metadata:

```json
{
  "source": "nome_do_documento_ou_url",
  "domain": "governance|hvac|app_nome",
  "type": "document|chunk|summary|qa_pair",
  "language": "pt-BR",
  "model": "bge-m3",
  "model_dims": 1024,
  "chunk_index": 0,
  "total_chunks": 12,
  "created_at": "2026-03-17T00:00:00Z",
  "tags": ["tag1", "tag2"]
}
```

---

## 7. Modelos de Embedding

| Modelo                  | Dimensões | Provider       | Endpoint               | Status                                    |
| ----------------------- | --------- | -------------- | ---------------------- | ----------------------------------------- |
| `bge-m3`                | 1024      | Ollama (local) | http://localhost:11434 | ativo — usar para tudo novo               |
| `fast-all-minilm-l6-v2` | 384       | Ollama (local) | http://localhost:11434 | deprecated — somente retrocompatibilidade |

**Regra:** Nunca misturar dimensões numa mesma collection.

---

## 8. Agent Bibliotecário

### 8.1 Via Claude Code (Interativo)

Consulta e registro manual usando MCPs:

```
CONSULTA:
  "Onde estão os dados de HVAC?"
  → mcp__postgres: SELECT * FROM catalog.schema_registry WHERE description ILIKE '%hvac%'
  → mcp__qdrant: busca semântica em catalog_embeddings
  → Resposta consolidada

REGISTRO:
  "Crie schema para app de controle HVAC"
  → mcp__postgres: CREATE SCHEMA app_hvac
  → mcp__postgres: INSERT INTO catalog.schema_registry
  → Ollama bge-m3: embedding da descrição
  → mcp__qdrant: store em catalog_embeddings
  → Atualiza DOC_CATALOG.md
```

### 8.2 Via Skill (Semi-automático)

```bash
# Varredura e sync do catálogo
# Ver skills/catalog-sync.md
```

### 8.3 Via n8n (Auditoria Automática Semanal)

Workflow n8n + qwen3.5:

1. Coleta schemas reais do PostgreSQL
2. Coleta collections reais do Qdrant
3. Compara com `catalog.schema_registry` e `catalog.collection_registry`
4. Gera relatório de divergências com qwen3.5
5. Log em `./logs/catalog-audit.log`

---

## 9. Proteções & Restrições

### 9.1 Schemas Protegidos (GUARDRAILS)

Nunca criar tabelas em schemas Supabase internos. Ver GUARDRAILS.md seção 9.

### 9.2 Regras de Operação no Banco

| Operação                            | Classificação | Requer Aprovação?    |
| ----------------------------------- | ------------- | -------------------- |
| SELECT em qualquer schema           | Segura        | Não                  |
| CREATE SCHEMA app*\* ou shared*\*   | Estrutural    | Sim (snapshot antes) |
| CREATE TABLE em schemas gerenciados | Estrutural    | Sim                  |
| DROP SCHEMA                         | Destrutivo    | Sim + backup         |
| DROP TABLE                          | Destrutivo    | Sim + backup         |
| DELETE em massa                     | Destrutivo    | Sim                  |
| TRUNCATE                            | Destrutivo    | Sim                  |
| ALTER TABLE                         | Estrutural    | Sim                  |

### 9.3 Backup Antes de DDL

Antes de qualquer `DROP` ou `ALTER` destrutivo:

```bash
# Backup do schema específico
docker exec supabase-db pg_dump -U postgres -n app_nome postgres > /srv/backups/postgres/app_nome-$(date +%Y%m%d).sql
```

---

## 10. Verificação Contínua

### 10.1 Consultas de Auditoria

```sql
-- Schemas registrados vs reais
SELECT schema_name FROM information_schema.schemata
WHERE schema_name NOT IN (SELECT schema_name FROM catalog.schema_registry);

-- Collections com poucos pontos (possível lixo)
SELECT collection_name, point_count FROM catalog.collection_registry
WHERE point_count < 5 AND status = 'active';

-- Tabelas não registradas em schemas gerenciados
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema LIKE 'app_%' OR table_schema LIKE 'shared_%'
AND (table_schema, table_name) NOT IN (
    SELECT schema_name, table_name FROM catalog.table_registry
);
```

### 10.2 Arquivo de Auditoria

`./logs/catalog-audit.log` — gerado pela skill `catalog-sync.md`

---

---

## 11. Estado Atual — Schemas e Collections (2026-03-18)

### Schemas Ativos

| Schema          | Tipo    | Tabelas | Propósito                                            |
| --------------- | ------- | ------- | ---------------------------------------------------- |
| `catalog`       | catalog | 4       | Registry central — fonte de verdade                  |
| `app_journal`   | app     | 4       | Journal pessoal (entries, prompts, tags, entry_tags) |
| `app_voice`     | app     | 2       | Histórico STT/TTS (transcriptions, syntheses)        |
| `app_n8n`       | app     | 1       | Logs de workflows n8n (workflow_logs)                |
| `shared_config` | shared  | 1       | Configurações globais (settings)                     |

### Collections Qdrant Ativas

| Collection           | Dims | Vinculada a              | Propósito                       |
| -------------------- | ---- | ------------------------ | ------------------------------- |
| `catalog_embeddings` | 1024 | catalog.\*               | Busca semântica no catálogo     |
| `rag_governance_v1`  | 1024 | ./                       | RAG sobre docs de governança    |
| `app_journal_v1`     | 1024 | app_journal.entries      | Busca semântica em entradas     |
| `app_voice_v1`       | 1024 | app_voice.transcriptions | Busca semântica em transcrições |

---

**Atualizado:** 2026-03-18
**Revisão:** Mensal ou ao adicionar novos schemas/collections
