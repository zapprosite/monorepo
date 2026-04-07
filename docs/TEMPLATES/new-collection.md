# Template: Proposta de Nova Collection Qdrant

**Instruções:** Copiar este arquivo, preencher todos os campos, e aguardar aprovação.

---

## Identificação

| Campo | Valor |
|-------|-------|
| **Nome da collection** | `rag_dominio` |
| **Tipo** | `rag` / `app` / `catalog` / `test` |
| **Solicitante** | will |
| **Data da proposta** | YYYY-MM-DD |

## Descrição

<!-- O que esta collection armazena? -->

**Propósito:** Esta collection armazena vetores de...

## Especificação Técnica

| Parâmetro | Valor |
|-----------|-------|
| **Modelo de embedding** | `bge-m3` (padrão) |
| **Dimensões** | `1024` |
| **Métrica de distância** | `Cosine` |
| **Estimativa de pontos** | ~N pontos |

## Domínio

**Domínio semântico:** (um único domínio — ex: `governance`, `hvac`, `app_controle`)

> ⚠️ **Regra:** Uma collection por domínio. Nunca misturar domínios diferentes.

## Metadata Planejado

```json
{
  "source": "nome_do_documento",
  "domain": "dominio_aqui",
  "type": "document|chunk|summary",
  "language": "pt-BR",
  "model": "bge-m3",
  "model_dims": 1024,
  "tags": []
}
```

## Aprovação

- [ ] Não há collection existente para este domínio (verificar `catalog.collection_registry`)
- [ ] Modelo bge-m3 confirmado (ou justificativa para outro modelo)
- [ ] Principal Engineer aprovou
- [ ] Collection criada no Qdrant
- [ ] Registrada em `catalog.collection_registry`
- [ ] DOC_CATALOG.md atualizado

---

## Comandos de Criação

### Via API REST
```bash
curl -X PUT http://localhost:6333/collections/rag_dominio \
  -H "Content-Type: application/json" \
  -H "api-key: QDRANT_API_KEY" \
  -d '{
    "vectors": {
      "size": 1024,
      "distance": "Cosine"
    }
  }'
```

### Registro no Catálogo
```sql
INSERT INTO catalog.collection_registry
    (collection_name, collection_type, description, embedding_model, dimensions, distance_metric)
VALUES (
    'rag_dominio',
    'rag',
    'Descrição clara do conteúdo',
    'bge-m3',
    1024,
    'Cosine'
);
```
