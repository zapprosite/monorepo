# ADR 0000: Template Padrão de ADR

## Contexto
Documentar decisões arquiteturais de forma concisa, rastreável e auditável. ADRs devem ser curtos (20-35 linhas), navegáveis e escritos em português.

## Decisão

### Formato

```
# ADR NNNN: Título
## Contexto
[Problema ou necessidade]
## Decisão
[O que foi decidido e por quê]
## Consequências
- **Positivo:**
- **Negativo:**
- **Riscos:**
---
**Status**: [proposed|accepted|implemented|deprecated]
**Autor**: [nome]
**Data**: YYYY-MM-DD
```

### Regras de nomenclatura
- Prefixo: `NNNN-` (0001, 0002, ...)
- Formato: `NNNN-CATEGORIA-DESCRICAO-CURTA.md`
- Categorias: `auth`, `backend`, `frontend`, `infra`, `db`, `crm`, `integrations`
- Máximo: **60 linhas** por ADR

### Relacionamentos
- `related`: lista de ADRs relacionados
- `superseded_by`: quando substituído por ADR mais novo

### Status lifecycle
```
proposed → accepted → implemented → deprecated
```

---
**Status**: accepted
**Autor**: will
**Data**: 2026-04-04