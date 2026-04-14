# DB History — Decisões e Mudanças

**Host:** homelab
**Criado:** 2026-03-18
**Propósito:** Registro cronológico de decisões de estrutura de dados. Não substitui DATABASE_GOVERNANCE.md (regras) nem DOC_CATALOG.md (estado atual).

---

## Supabase — Histórico de Schemas

| Data       | Schema          | Ação   | Quem | Motivo                                                       |
| ---------- | --------------- | ------ | ---- | ------------------------------------------------------------ |
| 2026-03-17 | `catalog`       | Criado | will | Registry central — fonte de verdade de schemas e collections |
| 2026-03-18 | `app_journal`   | Criado | will | MVP journal: entries, prompts, tags, entry_tags              |
| 2026-03-18 | `app_voice`     | Criado | will | Histórico de uso do voice stack (STT + TTS)                  |
| 2026-03-18 | `app_n8n`       | Criado | will | Logs de execução de workflows n8n                            |
| 2026-03-18 | `shared_config` | Criado | will | Configurações chave-valor compartilhadas entre apps          |

---

## Supabase — Histórico de Tabelas

| Data       | Schema          | Tabela                | Ação   | Motivo                                       |
| ---------- | --------------- | --------------------- | ------ | -------------------------------------------- |
| 2026-03-17 | `catalog`       | `schema_registry`     | Criada | Registro de todos os schemas gerenciados     |
| 2026-03-17 | `catalog`       | `collection_registry` | Criada | Registro de todas as collections Qdrant      |
| 2026-03-17 | `catalog`       | `table_registry`      | Criada | Registro de tabelas em schemas gerenciados   |
| 2026-03-17 | `catalog`       | `embedding_registry`  | Criada | Registro de modelos de embedding disponíveis |
| 2026-03-18 | `app_journal`   | `entries`             | Criada | Entradas do journal (conteúdo, mood, título) |
| 2026-03-18 | `app_journal`   | `prompts`             | Criada | Prompts para inspirar novas entradas         |
| 2026-03-18 | `app_journal`   | `tags`                | Criada | Tags para categorizar entradas               |
| 2026-03-18 | `app_journal`   | `entry_tags`          | Criada | Relação N:N entrada ↔ tag                    |
| 2026-03-18 | `app_voice`     | `transcriptions`      | Criada | Histórico STT (áudio → texto)                |
| 2026-03-18 | `app_voice`     | `syntheses`           | Criada | Histórico TTS (texto → áudio)                |
| 2026-03-18 | `app_n8n`       | `workflow_logs`       | Criada | Logs de execuções de workflows               |
| 2026-03-18 | `shared_config` | `settings`            | Criada | Configurações key-value globais              |

---

## Qdrant — Histórico de Collections

| Data           | Collection                    | Ação                   | Modelo                | Dims | Motivo                                                |
| -------------- | ----------------------------- | ---------------------- | --------------------- | ---- | ----------------------------------------------------- |
| pre-2026-03-17 | `main`                        | Criada                 | fast-all-minilm-l6-v2 | 384  | Testes iniciais — antes da governança                 |
| pre-2026-03-17 | `rag_docs`                    | Criada                 | bge-m3                | 1024 | RAG misto — antes da governança                       |
| 2026-03-17     | `catalog_embeddings`          | Criada                 | bge-m3                | 1024 | Busca semântica no catálogo de dados                  |
| 2026-03-17     | `main`                        | Deprecated             | —                     | —    | Modelo antigo 384D, substituído por bge-m3            |
| 2026-03-17     | `rag_docs`                    | Deprecated             | —                     | —    | Dados mistos sem domínio definido                     |
| 2026-03-17     | `rag_governance` (sem versão) | Planejada → Deprecated | —                     | —    | Substituída por rag_governance_v1 antes de ser criada |
| 2026-03-18     | `rag_governance_v1`           | Criada                 | bge-m3                | 1024 | Docs de governança indexados para RAG                 |
| 2026-03-18     | `app_journal_v1`              | Criada                 | bge-m3                | 1024 | Embeddings de entradas do journal                     |
| 2026-03-18     | `app_voice_v1`                | Criada                 | bge-m3                | 1024 | Embeddings de transcrições de voz                     |

---

## Decisões de Arquitetura

### 2026-03-17 — Schema `catalog` como fonte de verdade

**Decisão:** Criar schema `catalog` com 4 tabelas de registro (schema, collection, table, embedding).
**Motivo:** Evitar drift entre o que existe no banco e o que está documentado. Facilita auditoria automática via n8n.
**Impacto:** Todo schema/collection novo deve ser registrado no catalog ao criar.

### 2026-03-18 — Schemas por app, não por feature

**Decisão:** Cada app tem schema próprio (`app_journal`, `app_voice`, etc.) em vez de tabelas em `public`.
**Motivo:** Isolamento de permissões, backup granular por schema, sem colisão de nomes entre apps.
**Regra derivada:** Nunca criar tabelas em `public`. Usar `app_*` ou `shared_*`.

### 2026-03-18 — Versionar collections Qdrant com sufixo `_v{N}`

**Decisão:** Collections com sufixo de versão: `app_journal_v1`, `rag_governance_v1`, etc.
**Motivo:** Troca de modelo de embedding (ex: bge-m3 → outro) exige dimensions diferentes. Com versão, cria-se `_v2` em paralelo, migra, deleta `_v1` — sem downtime.
**Regra derivada:** Nunca criar collection sem sufixo de versão (exceto `catalog_embeddings` que é singleton).

### 2026-03-18 — `embedding_id` nas tabelas de app

**Decisão:** Tabelas com semântica (ex: `entries`, `transcriptions`) têm coluna `embedding_id UUID` apontando para o ponto Qdrant correspondente.
**Motivo:** Permite recuperar o registro Postgres a partir de um resultado de busca semântica sem JOIN extra.

---

## Como Atualizar Este Arquivo

Ao fazer qualquer mudança estrutural:

1. Adicionar linha na tabela correspondente (Schemas, Tabelas ou Collections)
2. Se for decisão arquitetural, adicionar seção em "Decisões de Arquitetura"
3. Commit: `docs(db): registrar criação de app_X`

**NÃO** registrar:

- Dados (INSERTs)
- Queries de leitura
- Mudanças de conteúdo de tabelas

---

**Ver também:** DATABASE_GOVERNANCE.md (regras) | DOC_CATALOG.md (estado atual)
