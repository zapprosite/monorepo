# Template: Proposta de Novo Schema

**Instruções:** Copiar este arquivo, preencher todos os campos, e aguardar aprovação antes de criar o schema.

---

## Identificação

| Campo | Valor |
|-------|-------|
| **Nome do schema** | `app_nome` |
| **Tipo** | `app` / `shared` |
| **Solicitante** | will |
| **Data da proposta** | YYYY-MM-DD |

## Descrição

<!-- Uma frase clara sobre o propósito deste schema -->

**Propósito:** Este schema armazena dados para...

## Justificativa

<!-- Por que um novo schema e não usar um existente? -->

## Tabelas Previstas

| Tabela | Propósito |
|--------|-----------|
| `nome_tabela` | O que esta tabela armazena |

## Dependências

- **Depende de:** (outros schemas, serviços)
- **Usado por:** (apps, workflows, MCPs)

## Plano de Migração

Se há dados existentes a migrar:
- [ ] Origem dos dados
- [ ] Script de migração
- [ ] Validação pós-migração

## Aprovação

- [ ] Principal Engineer aprovou
- [ ] Snapshot ZFS tomado: `tank@pre-YYYYMMDD-schema-nome`
- [ ] Schema criado: `CREATE SCHEMA app_nome;`
- [ ] Registrado em `catalog.schema_registry`
- [ ] DOC_CATALOG.md atualizado
- [ ] CHANGE_LOG.txt atualizado

---

## SQL de Criação

```sql
-- Schema
CREATE SCHEMA IF NOT EXISTS app_nome;

-- Registro no catálogo
INSERT INTO catalog.schema_registry (schema_name, schema_type, description, owner)
VALUES (
    'app_nome',
    'app',  -- ou 'shared'
    'Descrição clara do propósito',
    'will'
);
```
