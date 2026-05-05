# SPEC-401 — HVAC Inverter RAG: Arquitetura Técnica Canônica

**Versão:** 1.0  
**Data:** 2026-05-05  
**Status:** 🟢 Ativo  
**Autor:** Zappro Architecture Team  
**Tags:** `hvac-rag`, `inverter-only`, `docling`, `qdrant`, `redis`, `postgresql`, `open-webui`

---

## 1. Visão Geral e Objetivo

O **HVAC-RAG** é um sistema de assistência técnica baseado em Retrieval-Augmented Generation (RAG) que atua como um **Tutor Mestre de Refrigeração Inverter**. Ele lê manuais de serviço oficiais, extrai conhecimento estruturado, e responde perguntas de técnicos em campo com diagnósticos passo a passo — sem jamais recorrer ao ruído da web aberta.

### Diferencial Competitivo (vs. Mercado BR 05/2026)

| Concorrente | O que faz | Onde falha |
|---|---|---|
| Apps de "Códigos de Erro" (ex: Refriplay) | Mapeia código → descrição estática | Não ensina o técnico a consertar |
| ChatGPT / web pura | Responde com dados da internet | Confunde marcas, alucinações frequentes |
| Grupos WhatsApp de técnicos | Experiência empírica ("achismo") | Alta incidência de diagnósticos perigosos |
| Bots oficiais das fabricantes | Foco no consumidor final | Escondem os Service Manuals reais |
| **HVAC-RAG (Zappro)** | **Lê o manual oficial e guia o diagnóstico** | **— (nosso diferencial)** |

---

## 2. Escopo: Inverter Only (Lei Suprema)

**Esta base de dados é exclusivamente de climatização a tecnologia Inverter.** Qualquer manual, PDF ou documento que não se enquadre nessa categoria deve ser **rejeitado automaticamente**.

### 2.1 Whitelist de Tecnologia (aceitar)

Padrões aceitos no título, modelo ou conteúdo do PDF:

```python
INVERTER_WHITELIST = [
    r"(?i)\binverter\b",
    r"(?i)\bdual.?inverter\b",
    r"(?i)\bwindfree\b",
    r"(?i)\bvrf\b",
    r"(?i)\bvrv\b",
    r"(?i)\bmulti.?split\b",
    r"(?i)\bcassete\b",
    r"(?i)\bcassette\b",
    r"(?i)\bpiso.?teto\b",
    r"(?i)\bfloor.?ceiling\b",
    r"(?i)\bducted\b",
    r"(?i)\bcondensadora\b",  # VRF systems
    r"(?i)\bSiLA\b",          # Daikin VRV series IDs
    r"(?i)\bR-32\b",
    r"(?i)\bR-410A\b",
]
```

### 2.2 Blacklist de Tecnologia (rejeitar)

Padrões que indicam tecnologia convencional/obsoleta — **rejeitar sem processamento**:

```python
INVERTER_BLACKLIST = [
    r"(?i)\bconvencional\b",
    r"(?i)\bon.?off\b",
    r"(?i)\bjanela\b",
    r"(?i)\bacj\b",           # Ar Condicionado de Janela
    r"(?i)\bportátil\b",
    r"(?i)\bportatil\b",
    r"(?i)\bportable\b",
    r"(?i)\bR-22\b",          # Gás obsoleto
    r"(?i)\bfreon\b",
]
```

**Implementação:** O script `hvac_intake.py` já possui a função `extract_equipment_type()`. A Whitelist/Blacklist deve ser aplicada como **primeira camada de classificação**, antes de qualquer chamada ao Docling.

---

## 3. Ferramenta "Missing Manuals" (Gap Finder)

### 3.1 Objetivo

Identificar modelos Inverter homologados no Brasil (via INMETRO/PBE) que **ainda não possuem manual de serviço indexado** no Qdrant, gerando uma lista priorizada para download.

### 3.2 Fluxo

```
hvac_normalize_inmetro_catalog.py
  → inmetro_ac_br_models.jsonl (todos os modelos BR)
       ↓ filtro: technology == "inverter"
  → Lista de {brand, model, capacity}
       ↓ cruzar com
  hvac_qdrant_query.py --list-indexed
  → Modelos com manuais no Qdrant
       ↓ diff
  → missing_manuals_report.md (lista de gaps por marca)
```

### 3.3 Output Esperado

```markdown
# Relatório de Manuais Faltantes — 2026-05

## LG (23 modelos sem manual)
- DUAL INVERTER COMPACT 9000 BTU (S4-W09JA3)
- DUAL INVERTER COMPACT 12000 BTU (S4-W12JA3)
...

## Samsung (41 modelos sem manual)
- WindFree ESSENTIAL 9000 BTU (AR09BVHQABT/AZ)
...
```

**Script alvo:** Criar `hvac_missing_manuals.py` em `scripts/hvac-rag/`.

---

## 4. Pipeline de Extração e Enriquecimento (Docling)

### 4.1 Fluxo Completo

```
[PDF do Manual de Serviço]
        ↓
[hvac_intake.py] ← WHITELIST/BLACKLIST check (V1)
        ↓ aceito
[Docling: PDF → Markdown Raw]
  - Tabelas de códigos de erro preservadas
  - Fluxogramas elétricos identificados
  - Imagens de PCB indexadas
        ↓
[LLM Estruturador (local: qwen2.5-coder:14b)]
  - Gera Top50 Q&A (FAQ Técnico)
  - Extrai metadados: brand, model, error_codes[], doc_type
        ↓
[Chunking via hvac_chunk.py]
  - Chunk por seção (Erro, Componente, Procedimento)
  - Preserva contexto do fluxograma
        ↓
[Embedding: nomic-embed-text:latest via Ollama]
  - 768 dimensões
  - Cada chunk + FAQ item = vetor independente
        ↓
[Qdrant] ← Upsert com filtro de tenant (brand)
[PostgreSQL] ← Registro de ingestão + metadados
[Redis] ← Invalidação de cache se modelo já existia
```

### 4.2 Estrutura do FAQ (Top 50)

Cada documento deve gerar pares Q&A estruturados:

```json
{
  "question": "Como diagnosticar o erro CH05 em um LG Dual Inverter ARTCOOL?",
  "answer": "O CH05 indica falha de comunicação entre placa interna e externa. **Passo 1:** Meça a tensão DC entre os bornes N(1) e 3 do conector. Esperado: 45V~55V oscilante. Se estiver em 0V: substitua o cabo de comunicação (3 vias). Se estiver em 12V constante: defeito na placa da unidade interna.",
  "metadata": {
    "brand": "LG",
    "model": "ARTCOOL",
    "error_code": "CH05",
    "doc_section": "Troubleshooting",
    "confidence": "high"
  }
}
```

---

## 5. Infraestrutura de Dados (Tríade RAG)

### 5.1 Qdrant — Vector Database (Busca Semântica)

**Collection:** `hvac_manuals_v2` (nova versão com tenant isolation)

```python
# Configuração do índice por tenant (isolamento físico por marca)
client.create_payload_index(
    collection_name="hvac_manuals_v2",
    field_name="brand",
    field_schema=models.KeywordIndexParams(
        type=models.KeywordIndexType.KEYWORD,
        is_tenant=True,  # Isolamento físico no disco
    ),
)
```

**Campos obrigatórios no payload:**
```json
{
  "brand": "LG",
  "model": "ARTCOOL S4-W09JA3AA",
  "model_family": "ARTCOOL",
  "technology": "inverter",
  "error_codes": ["CH05", "CH21", "CH38"],
  "doc_type": "service_manual",
  "doc_section": "Troubleshooting",
  "language": "pt-BR",
  "refrigerant": "R-32",
  "equipment_type": "split",
  "source_pdf": "/srv/hvac-pipeline/DATA/PDF/LG-ARTCOOL-SM.pdf",
  "sha256": "abc123...",
  "qa_pair": true,
  "processed_at": "2026-05-05T09:00:00Z"
}
```

**Query obrigatória (NUNCA buscar sem filtro de marca):**
```python
filter = models.Filter(
    must=[
        models.FieldCondition(key="brand", match=models.MatchValue(value="LG")),
        models.FieldCondition(key="technology", match=models.MatchValue(value="inverter")),
    ]
)
```

---

### 5.2 PostgreSQL — Metadata & Auditoria

**Banco:** `hvac_rag` (via OrchidORM + apps/api)

```sql
-- Registro de todos os PDFs processados
CREATE TABLE hvac_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sha256          TEXT UNIQUE NOT NULL,
    brand           TEXT NOT NULL,
    model           TEXT NOT NULL,
    model_family    TEXT,
    technology      TEXT NOT NULL CHECK (technology = 'inverter'),
    doc_type        TEXT NOT NULL,
    source_pdf_path TEXT NOT NULL,
    md_path         TEXT,
    faq_count       INT DEFAULT 0,
    qdrant_indexed  BOOLEAN DEFAULT FALSE,
    rejected        BOOLEAN DEFAULT FALSE,
    rejected_reason TEXT,
    processed_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índice de modelos do INMETRO (missing manuals)
CREATE TABLE hvac_inmetro_models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand           TEXT NOT NULL,
    model           TEXT NOT NULL,
    capacity_btu    INT,
    technology      TEXT,
    refrigerant     TEXT,
    has_manual      BOOLEAN DEFAULT FALSE,
    inmetro_id      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Log de sessões de diagnóstico (para melhorar o sistema)
CREATE TABLE hvac_diagnostic_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  TEXT NOT NULL,
    brand       TEXT,
    model       TEXT,
    error_code  TEXT,
    query       TEXT,
    sources     JSONB,  -- chunks usados do Qdrant
    feedback    TEXT,   -- "correto" | "incorreto" | null
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 5.3 Redis — Cache de Sessão e Respostas Rápidas

**Instância:** Redis em `localhost:6379` (namespace `hvac:`)

#### Estratégia de Cache

| Chave Redis | TTL | Conteúdo |
|---|---|---|
| `hvac:query:{brand}:{sha256_query}` | 1h | Resposta completa cacheada (bypass LLM) |
| `hvac:session:{session_id}` | 30min | Estado do troubleshooting guiado (etapa atual, respostas) |
| `hvac:error:{brand}:{error_code}` | 24h | Resposta canônica para erro específico |
| `hvac:models:{brand}` | 6h | Lista de modelos indexados (para filtros no UI) |

#### Implementação (Python)
```python
import redis
import hashlib
import json

r = redis.Redis(host="127.0.0.1", port=6379, db=2, decode_responses=True)

CACHE_PREFIX = "hvac"

def get_cached_response(brand: str, query: str) -> dict | None:
    key = f"{CACHE_PREFIX}:query:{brand.lower()}:{hashlib.sha256(query.encode()).hexdigest()[:16]}"
    raw = r.get(key)
    return json.loads(raw) if raw else None

def set_cached_response(brand: str, query: str, response: dict, ttl: int = 3600):
    key = f"{CACHE_PREFIX}:query:{brand.lower()}:{hashlib.sha256(query.encode()).hexdigest()[:16]}"
    r.setex(key, ttl, json.dumps(response, ensure_ascii=False))

def save_session_state(session_id: str, state: dict, ttl: int = 1800):
    key = f"{CACHE_PREFIX}:session:{session_id}"
    r.setex(key, ttl, json.dumps(state, ensure_ascii=False))

def get_session_state(session_id: str) -> dict | None:
    key = f"{CACHE_PREFIX}:session:{session_id}"
    raw = r.get(key)
    return json.loads(raw) if raw else None
```

---

## 6. Integração com Open WebUI

### 6.1 Tool: `pesquisar_manual_de_servico`

Exposta via endpoint Fastify em `apps/api` (rota `/api/hvac/query`):

```python
# Definição da Tool no Open WebUI
class Tools:
    def pesquisar_manual_de_servico(
        self,
        brand: str,
        error_code: str = "",
        symptom: str = "",
        model: str = ""
    ) -> str:
        """
        Busca informações EXCLUSIVAMENTE no manual de serviço oficial.
        Retorna o procedimento de diagnóstico e reparo do fabricante.
        SEMPRE chame esta tool antes de responder sobre qualquer defeito.
        """
        ...
```

### 6.2 System Prompt Blindado (Modelfile)

```
Você é um INSTRUTOR MESTRE DE REFRIGERAÇÃO INVERTER — Nível 5.

IDENTIDADE:
- Você guia técnicos em campo para o diagnóstico correto de falhas em ar-condicionado Inverter.
- Sua base de conhecimento é 100% baseada nos manuais de serviço oficiais das fabricantes.

REGRAS ABSOLUTAS (violação = resposta inválida):
1. NUNCA use conhecimento da internet, fóruns ou suposições.
2. SEMPRE chame a tool `pesquisar_manual_de_servico` antes de responder.
3. Se a tool não retornar resultados para o modelo específico, responda: "Não possuo o manual de serviço deste modelo na base. Informe a marca e modelo exatos."
4. Traduza os fluxogramas de troubleshooting em PERGUNTAS passo a passo.
5. Ao citar tensões, resistências ou procedimentos, inclua os valores exatos do manual.
6. Se o técnico não informar a marca, SEMPRE pergunte antes de buscar.

FORMATO DE RESPOSTA:
- Resposta breve com contexto do erro.
- Em seguida, o tutorial passo a passo numerado.
- Ao final, cite a fonte: "[Manual de Serviço - {Marca} {Modelo} - Pág. XX]"
```

### 6.3 Ações Dinâmicas (Open WebUI Actions)

O chat pode injetar botões de decisão durante o troubleshooting guiado:

```json
{
  "actions": [
    {"label": "✅ Tensão OK (45~55V)", "value": "tensao_ok"},
    {"label": "❌ Tensão Zero ou Constante", "value": "tensao_zero"},
    {"label": "🔁 Repetir medição", "value": "repetir"}
  ]
}
```

---

## 7. Marcas Suportadas (Mercado BR Inverter)

Baseado em `hvac_intake.py` (`_BRAND_CANONICAL`), acrescido de validação contra INMETRO:

| Marca | Foco Principal | Modelos Inverter Prioritários |
|---|---|---|
| LG | Dual Inverter, ARTCOOL, VRF | S4-W*JA3, ARTCOOL Mirror |
| Samsung | WindFree, Digital Inverter | AR*BVHQ*, Wind-Free ELITE |
| Daikin | VRV, Fit, Sky | SiLA*, FTXM*, RXM* |
| Carrier | X-Power, Inverter | 42LVCA*, 38LVCA* |
| Springer (Midea) | Inverter Hi-Wall, Piso-Teto | 42MBBA*, ZACA* |
| Midea | Ultra Inverter | MGA*, MSZ* |
| Gree | Eco Garden, Inverter | GWC*, GMV* (VRF) |
| Fujitsu | Inverter, VRF | ASBA*, AOBA* |
| Hitachi | Inverter, VRF | RAS*, RAC* |
| Komeco | Inverter | KOF* |
| Elgin | Inverter | HJFI*, THFI* |
| Agratto | Inverter | ACO*, ACS* |

---

## 8. Estrutura de Arquivos

```
scripts/hvac-rag/
├── hvac_intake.py              ← Extração de marca/modelo/código
├── hvac_chunk.py               ← Chunking semântico por seção
├── hvac_qdrant_query.py        ← Busca com hard filter por marca
├── hvac_index_qdrant.py        ← Upsert no Qdrant com tenant
├── hvac_normalize_inmetro_catalog.py ← Normaliza base INMETRO
├── hvac_sync_inmetro_catalog.py      ← Sincroniza com Qdrant
├── hvac_missing_manuals.py     ← [TODO] Gap finder
├── hvac_rag_pipe.py            ← Pipeline orquestrador principal
├── hvac_classify_domain.py     ← Whitelist/Blacklist Inverter
├── hvac_memory_context.py      ← Redis session state
└── hvac_field_tutor.py         ← Lógica do diagnóstico guiado
```

---

## 9. Referências

- `AGENTS.md` — Governança do Monorepo (Tool `/scraper` canônica)
- `ADR-001-hermes-tree-only.md` — Isolamento de estado
- `scripts/hvac-rag/hvac_intake.py` — Implementação atual do parser
- `scripts/hvac-rag/hvac_normalize_inmetro_catalog.py` — Base INMETRO
- INMETRO/PBE Tabela de Eficiência Energética (https://www.inmetro.gov.br)
