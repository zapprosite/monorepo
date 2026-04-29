# SPEC-206 — HVAC Field Expertise Memory

## Objetivo

Criar uma camada de **memória técnica de campo** para o Zappro Clima Tutor, separada dos manuais de serviço. Armazenar experiência real do @willrefrimix, relatos técnicos, procedimentos de campo e técnicas de diagnóstico — recuperáveis apenas quando o caso bater por marca/família/código/alarme/componente/sintoma.

## Relação com SPECs Anteriores

- **SPEC-205** = Qdrant payload filtering para manuais (`hvac_manuals_v1`)
- **SPEC-206** = memória de campo e expertise profissional (`hvac_field_experience_v1`)
- **SPEC-207** = ingestão de vídeos/transcrições técnicas (futuro)

## Arquitetura

```
Postgres
  = verdade estruturada, autoria, versões, status approved/draft

Qdrant hvac_field_experience_v1
  = busca semântica dos casos de campo com payload filtering

Mem0
  = preferências e memória curta do usuário/agente

Hermes Second Brain
  = resumo humano canônico

OpenWebUI/Zappro Tutor
  = usa tudo na hora da resposta
```

## Cascata de Retrieval (estendida)

```
1. manual_exact
2. manual_family
3. technical_memory
4. graph_internal
5. web_fallback
6. llm_triage
7. field_experience  ← NOVO (só quando caso bate)
```

## Estrutura de Dados

### Postgres: `hvac_field_cases`

```sql
create table if not exists hvac_field_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  author text not null,
  source_type text not null, -- field_experience, youtube_summary, service_note
  source_url text,
  source_title text,

  brand text,
  model text,
  model_family text,
  equipment_type text,
  alarm_codes text[],
  components text[],
  symptoms text[],

  problem_summary text not null,
  field_technique text not null,
  safety_notes text,
  limitations text,

  evidence_level text not null, -- field_experience, video_summary, manual_exact
  confidence text not null default 'medium', -- high, medium, low
  status text not null default 'draft', -- draft, approved, deprecated
  metadata jsonb default '{}'::jsonb
);
```

### Qdrant: Collection `hvac_field_experience_v1`

- **Vector**: embedding da `field_technique` + `problem_summary`
- **Payload indexes**:
  - `source_type`
  - `author`
  - `brand`
  - `model_family`
  - `equipment_type`
  - `alarm_codes`
  - `components`
  - `symptoms`
  - `evidence_level`
  - `confidence`
  - `status`

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `scripts/hvac-rag/hvac_field_memory.py` | Core: Postgres + Qdrant operations para field cases |
| `scripts/hvac-rag/hvac_field_case_schema.sql` | DDL da tabela `hvac_field_cases` |
| `scripts/hvac-rag/hvac_field_case_ingest.py` | Pipeline: texto livre → case card → Postgres → Qdrant |
| `scripts/hvac-rag/hvac_youtube_experience_ingest.py` | YouTube URL → metadata → resumo técnico → case card |
| `config/hvac-copilot/field-expertise-policy.yaml` | Policy: safety alerts, confidence levels, retrieval rules |
| `docs/RUNBOOKS/HVAC-FIELD-EXPERTISE-MEMORY.md` | Runbook operacional |
| `tests/test_hvac_field_expertise_memory.py` | Testes unitários e de integração |

## Pipelines

### `/ensinar` — Input Texto Livre

```
1. Recebe texto livre (marca, família, alarme, técnica)
2. Extrai campos do case card via LLM
3. Salva em Postgres como status=draft
4. Pergunta confirmação antes de indexar
5. Se approved: gera embedding, indexa no Qdrant
6. Cria resumo no Hermes Second Brain
```

### YouTube Ingest

```
1. Recebe URL do vídeo
2. Salva metadata (título, canal, timestamp)
3. Selegenda/transcrição disponível e permitido → usa
4. Gera resumo técnico (não transcrição integral)
5. Extrai técnicas em case cards
6. Salva em Postgres como status=draft
7. Pending approval humana antes de indexar
```

## Integração no Universal Resolver

```python
def field_experience_lookup(brand, family, alarm_code, component, symptom, top_k=3):
    """After manual_exact/manual_family, check field experience."""
    filters = {
        "must": [
            {"key": "status", "match": {"value": "approved"}},
            {"key": "source_type", "match": {"value": "field_experience"}},
        ],
        "should": [
            {"key": "brand", "match": {"value": brand}} if brand else None,
            {"key": "model_family", "match": {"value": family}} if family else None,
            {"key": "alarm_codes", "match": {"any": [alarm_code]}} if alarm_code else None,
            {"key": "components", "match": {"any": [component]}} if component else None,
            {"key": "symptoms", "match": {"any": [symptom]}} if symptom else None,
        ]
    }
    return qdrant.search(
        collection="hvac_field_experience_v1",
        query_vector=embedding,
        query_filter=filters,
        top_k=top_k
    )
```

## Safety Rules

Para técnicas envolvendo **VEE, IPM, alta tensão, compressor, fluido refrigerante**:

- Sempre incluir alerta curto no output
- Não inventar valores de medição
- Não orientar medição energizada sem manual oficial
- Incluir `safety_notes` no case card

## Testes

| Teste | Descrição |
|-------|-----------|
| `test_daikin_vrv_u4_01_vee_retrieves_fieldcase` | Daikin VRV U4-01 + VEE recupera fieldcase do willrefrimix |
| `test_springer_l2_no_daikin_vee` | Springer L2 não recupera Daikin VEE (cross-brand isolation) |
| `test_youtube_summary_as_complement` | youtube_summary aparece como complemento, não como manual |
| `test_draft_not_in_final_response` | draft não aparece em resposta final |
| `test_provider_source_not_leaked` | provider/source não vaza como debug |
| `test_ptbr_clean` | PT-BR limpo sem CJK/Cirílico |

## Validações

```bash
python3 -m py_compile scripts/hvac-rag/hvac_field_memory.py
python3 -m py_compile scripts/hvac-rag/hvac_field_case_ingest.py
python3 -m py_compile scripts/hvac-rag/hvac_youtube_experience_ingest.py
pytest tests/test_hvac_field_expertise_memory.py -q
python3 scripts/hvac-rag/hvac-daily-smoke.py --once
python3 scripts/hvac-rag/hvac-healthcheck.py
```

## Output

- `manifests/hvac-field-expertise-memory-report.json`
- Campo `field_expertise_memory_ready: true/false`

## Exemplo de Case Card

```yaml
id: fieldcase-willrefrimix-daikin-vrv-u4-vee-001
author: willrefrimix
source_type: field_experience
brand: Daikin
family: VRV
alarm_codes: ["U4-01"]
equipment_type: VRF/VRV
components: [VEE, unidade_interna, linha_liquido, comunicacao]
symptoms: [sistema_sucateado, multiplas_internas, vee_suspeita, sem_service_check]
field_context:
  outdoor_display: sete segmentos
  indoor_units_total: 43
  suspected_bad_vee_count: 5
problem_summary: >
  Sistema VRV com 43 unidades internas, suspeita de 5 VEEs danificadas,
  display sete segmentos limitado, sem service check disponível.
field_technique: >
  Quando nao ha service check disponivel, usar comportamento termico
  e resposta das unidades apos carga forcada/desligamento para identificar
  VEE travada aberta ou unidade que continua permitindo passagem de fluido.
safety_notes: >
  Nao medir placa energizada sem procedimento oficial.
  Nao cravar troca de placa sem separar comunicacao, VEE e comportamento frigorifico.
evidence_level: field_experience
confidence: medium
status: approved
created_from: chat/openwebui
```
