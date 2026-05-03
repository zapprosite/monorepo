# HVAC Field Expertise Memory — Runbook

## Visao Geral

Sistema de memoria de campo para o Zappro Clima Tutor.
Separa experiencia real de tecnicos (campo) de manuais oficiais (documentacao).

## Arquitetura

| Camada | Tecnologia | Role |
|--------|-----------|------|
| Structured Truth | Postgres hvac_field_cases | Auditoria, autoria, status |
| Semantic Search | Qdrant hvac_field_experience_v1 | Busca por similaridade |
| Short-term | Mem0 | Preferencias e contexto recente |

## Tabela hvac_field_cases

```sql
-- Ver todos os casos de campo
SELECT id, author, brand, alarm_codes, status, confidence, created_at
FROM hvac_field_cases
ORDER BY created_at DESC;

-- Casos pendentes de aprovacao
SELECT * FROM hvac_field_cases WHERE status = 'draft';

-- Casos por autor
SELECT * FROM hvac_field_cases WHERE author = 'willrefrimix' AND status = 'approved';

-- Buscar por marca
SELECT * FROM hvac_field_cases WHERE brand = 'Daikin' AND status = 'approved';
```

## Pipeline /ensinar

### Input Texto Livre

```bash
python scripts/hvac-rag/hvac_field_case_ingest.py --input "texto..."
```

O sistema extrai automaticamente:
- Marca (Daikin, Springer, Midea, etc.)
- Codigo de alarme (U4-01, L2, etc.)
- Componentes (VEE, compressor, etc.)
- Tipo de equipamento (VRV, split, etc.)

### Fluxo

1. Input texto livre
2. Extracao de case card (keyword/regex)
3. Salvamento em Postgres como draft
4. Revisao humana
5. Aprovacao: `python hvac_field_case_ingest.py --approve-case <id>`
6. Indexacao automatica no Qdrant

### Listar Pendentes

```bash
python scripts/hvac-rag/hvac_field_case_ingest.py --list-pending
```

## YouTube Ingest

```bash
python scripts/hvac-rag/hvac_youtube_experience_ingest.py --url "https://youtube.com/..."
python scripts/hvac-rag/hvac_youtube_experience_ingest.py --approve-case <id>
```

Nota: Transcricoes integrais nao sao armazenadas. Apenas metadata e resumo tecnico.

## Integracao no Universal Resolver

O resolver consulta field_experience depois de:
1. manual_exact
2. manual_family
3. technical_memory
4. graph_internal
5. web_fallback
6. llm_triage
7. field_experience (NOVO)

Se encontrar casos com score > 0.65, inclui no retrieval_package como `field_expertise_context`.

## Safety

Sempre que o caso envolve:
- VEE, IPM, compressor, alta tensao, fluido refrigerante

O tutor inclui alerta de seguranca:

```
[AVISO DE SEGURANCA] Esta tecnica envolve VEE.
Confirme com manual oficial antes de aplicar.
```

## Query Qdrant Direto

```python
from scripts.hvac_rag.hvac_field_memory import field_experience_lookup

cases = field_experience_lookup(
    brand="Daikin",
    family="VRV",
    alarm_code="U4-01",
    component="VEE",
    symptom="sucateado",
    top_k=3
)
```

## Manutencao

### Verificar casos orfaos no Qdrant
Casos deletados do Postgres devem ser removidos do Qdrant.

### Regenerar embeddings
Apos alteracao no schema de payload, recriar collection e reindexar.

### Backup
A tabela hvac_field_cases faz parte do backup Postgres padrao.
