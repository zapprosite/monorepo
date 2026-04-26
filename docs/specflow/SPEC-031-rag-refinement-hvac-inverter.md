---
name: SPEC-031 RAG Refinement + User Response for HVAC Inverter
description: Sistema de RAG refinado para responder dúvidas de usuários sobre ar-condicionado inverter via WhatsApp DEV simulado no terminal
type: specification
---

# SPEC-031: RAG Refinement + User Response for HVAC Inverter

**Status:** IN_PROGRESS
**Created:** 2026-04-12
**Updated:** 2026-04-12
**Author:** will
**Related:** SPEC-026, SPEC-029, SPEC-030
**Priority:** HIGH

---

## Objective

Criar pipeline de RAG refinado para responder dúvidas de usuários sobre ar-condicionado **inverter** via WhatsApp (DEV mode simulado no terminal). O sistema deve:

1. **Indexar** manuais de serviço de forma inteligente (chunking semântico, validação visual)
2. **Aprender** de conteúdo de qualidade (YouTube, manuais approved)
3. **Verificar** autenticidade de manuais via qwen2.5-vl
4. **Responder** com confiança calibrada no WhatsApp
5. **Simular** fluxo completo no terminal (DEV mode)

**Foco único:** Ar-condicionado inverter (split, multi-split, piso-teto). Não abordar convencionais.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     INBOUND (WhatsApp DEV)                       │
│  Terminal → Redis Queue → intake_agent → classifier               │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RAG RETRIEVAL LAYER                           │
│  query → embedding → Qdrant → chunks → confidence scoring          │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                   RESPONSE REFINEMENT LAYER                      │
│  chunks → confidence → format → PT-BR → WhatsApp                 │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    OUTBOUND (WhatsApp DEV)                       │
│  response → terminal log (SIMULATE_WHATSAPP=true)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Tasks (Parallel Research + Implementation)

### Task 1: Chunking Strategy Implementation
**Owner:** agent-1
**Goal:** Implementar chunking semântico para manuais HVAC
**Details:**
- Chunk size: 512 tokens ( error codes ), 1024 tokens ( specs )
- Overlap: 15% (75 tokens)
- Split por seção (ERROR_CODES, SPECS, INSTALLATION, TROUBLESHOOTING)
- Metadata: brand, model, btu, error_code, page_ref
**Criteria:** Chunks mantêm contexto de erro codes intactos

### Task 2: Whitelist/Blacklist Database
**Owner:** agent-2
**Goal:** Criar schema PostgreSQL para whitelist/blacklist de manuais
**Details:**
- Table `hvac_model_whitelist`: brand, model, btu, codes aceitos
- Table `hvac_manual_blacklist`: hash, reason, rejected_at
- existing BrandModels in hvac_models.go como source
**Criteria:** 416+ modelos do Brasil + novos

### Task 3: qwen2.5-vl Visual Verification
**Owner:** agent-3
**Goal:** Implementar verificação visual de manuais
**Details:**
- Render PDF → base64 PNG
- Call qwen2.5-vl via LiteLLM (litellm/qwen2.5-vl)
- JSON response: document_type, has_diagnostic_content, confidence
- Compare against known-good reference
**Prompt:**
```
Analyse this document and respond with JSON:
{
  "document_type": "service_manual | product_listing | marketing | unknown",
  "has_diagnostic_content": true/false,
  "indicators": ["list"],
  "error_codes_found": ["list"],
  "procedures_found": ["list"],
  "confidence": 0.0-1.0,
  "is_duplicate_likely": true/false
}
```

### Task 4: YouTube Learning Pipeline
**Owner:** agent-4
**Goal:** Implementar pipeline de aprendizado de vídeos HVAC
**Details:**
- YouTube API: buscar "HVAC diagnostic tutorial inverter"
- Filter: canal técnico, não promocional
- Extract captions via youtube-transcript-api
- Whisper transcription (opcional, se accuracy < 90%)
- Semantic chunking: 512 tokens, error code timestamp preservation
**Criteria:** only diagnostic/repair content indexed

### Task 5: WhatsApp DEV Simulation
**Owner:** agent-5
**Goal:** Implementar simulação completa no terminal
**Details:**
- Env var: `SIMULATE_WHATSAPP=true` + `DEV_MODE=true`
- CLI tool: `./bin/whatsapp-simulator` para injectar mensagens
- Redis LPUSH para queue intake
- Log all messages to terminal
**Commands:**
```bash
./bin/whatsapp-simulator --phone +5511999999999 --text "ar inverter Springer erro E8"
```

### Task 6: Error Codes Database
**Owner:** agent-6
**Goal:** Criar database completo de códigos de erro inverter
**Details:**
- Universal: E1-E9, F0-F9, P0-P9
- LG: CH01-CH99
- Samsung: E101-E502
- Daikin: A1-C99
- Midea/Springer/Consul: E01-F45
- Fields: code, description, user_fixable, diagnostic_steps
**Criteria:** Inverter only (no conventional codes)

### Task 7: Response Refinement Engine
**Owner:** agent-7
**Goal:** Implementar refinement de resposta com confiança
**Details:**
- Confidence thresholds: high(>=0.85), medium(0.60-0.84), low(0.40-0.59), none(<0.40)
- PT-BR phrases per confidence band
- Compact format (max 4096 chars, 3 bullets)
- Source citation: "Manual (p.47)"
**Format:**
```
[high] → resposta direta + fonte
[medium] → "Com base no que encontrei..." + resposta
[low] → "Encontrei algumas informações, mas..." + resposta
[none] → "Não encontrei informação relevante na documentação"
```

### Task 8: MiniMax Embedding Quality Upgrade
**Owner:** agent-8
**Goal:** Verificar se embedding-256 é suficiente ou migrar para 1024d
**Details:**
- Test: query error code "E8 Springer" vs "CH10 LG" - separar corretamente?
- Compare: embedding-256 vs bge-m3 (local, 1024d, free)
- Decision: usar MiniMax ou local Ollama (bge-m3)
**Criteria:** Recall@5 >= 85% para error codes

### Task 9: PDF Parser Integration
**Owner:** agent-9
**Goal:** Integrar mupdf para extração de manuais
**Details:**
- Use `github.com/ArtifexSoftware/mupdf-go`
- Extract text + tables
- Section detection via heuristics
- Model/brand extraction from filename + headers
**Schema output:**
```json
{
  "pages": [...],
  "sections": ["ERROR_CODES", "SPECS", ...],
  "metadata": {"brand": "...", "model": "...", "btu": 12000}
}
```

### Task 10: RAG Quality Evaluation
**Owner:** agent-10
**Goal:** Implementar métricas de qualidade
**Details:**
- Test set: 50 perguntas de diagnóstico
- Metrics: MRR (primary), HitRate@5, Faithfulness
- LLM-as-judge (DeepEval or Ragas)
- Continuous improvement loop with user feedback
**Criteria:** MRR >= 0.85

---

## Error Codes Database (Inverter Only)

### Universal Codes (All Brands)

| Code | Description | User Fixable? | Brand agnostic |
|-------|-------------|---------------|----------------|
| E1 | Indoor temp sensor error | Possible | Yes |
| E2 | Evaporator coil sensor error | No | Yes |
| E3 | Condenser sensor error | No | Yes |
| E4 | Refrigerant/pressure error | No | Yes |
| E5 | Compressor overheating | Possible | Yes |
| E6 | Communication error | Possible | Yes |
| E7 | Current overload | No | Yes |
| E8 | Voltage abnormality | Possible | Yes |
| F0 | Low refrigerant | No | Yes |
| F1 | Indoor fan motor | Possible | Yes |
| F3 | Outdoor fan motor | Possible | Yes |
| F6 | Coil sensor error | No | Yes |
| P0 | Compressor drive fault | No | Yes |

### Brand-Specific Codes

**LG Inverter:** CH01, CH02, CH06, CH08, CH10, CH11, CH29, CH57, CH59, CH99
**Samsung Inverter:** E101, E121, E126, E128, E129, E154, E201, E261, E306, E401
**Daikin Inverter:** A1, A5, A6, C1, C4, C28, C30, C35, C36, C59
**Midea/Springer/Consul:** E01-E16, F01-F45

---

## Chunking Strategy

### Semantic Chunking Rules

| Content Type | Chunk Size | Overlap | Reason |
|--------------|------------|---------|--------|
| Error code tables | 512 tokens | 50 tokens | Self-contained units |
| Diagnostic procedures | 768 tokens | 100 tokens | Step sequences |
| Specifications | 1024 tokens | 150 tokens | Rich context |
| Wiring diagrams | 512 tokens + image ref | 0 | Standalone |

### Metadata Schema (Qdrant)

```json
{
  "id": "springer_xtreme_e8_001",
  "vector": [0.123, ...],
  "payload": {
    "brand": "springer",
    "model": "Xtreme Save Connect",
    "model_code": "42AGVCI12M5",
    "btu": 12000,
    "type": "split_inverter",
    "technology": "inverter",
    "compressor_type": "rotativo",
    "refrigerant": "R-32",
    "error_code": "E8",
    "section": "error_codes",
    "page_ref": 47,
    "content_type": "manual",
    "language": "pt-BR",
    "source": "manufacturer_pdf",
    "is_verified": true,
    "qwen_score": 0.92
  }
}
```

---

## Confidence-Based Response

### Response Templates (PT-BR)

**High Confidence (>= 0.85)**
```
De acordo com o manual do fabricante:

[Resposta direta em 1-2 frases]

Fonte: Springer Xtreme Save Connect (p.47)
```

**Medium Confidence (0.60 - 0.84)**
```
Com base no que encontrei:

[Resposta + disclaimer]

Se o problema persistir, recomendo chamar um técnico.
```

**Low Confidence (0.40 - 0.59)**
```
Encontrei algumas informações, mas não tenho certeza se respondem completamente sua dúvida.

[Informação parcial]

Consulte o manual do seu modelo específico ou ligue para o suporte.
```

**No Confidence (< 0.40)**
```
Não encontrei informação relevante nos manuais de serviço.

Dica: Verifique se o modelo do seu aparelho está listado no painel interno.
```

---

## WhatsApp DEV Simulation

### Environment Variables

```bash
DEV_MODE=true                    # Enable DEV mode
SIMULATE_WHATSAPP=true           # Simulate outbound messages
WHATSAPP_PHONE=+5511999999999    # Test phone number
```

### CLI Tool Usage

```bash
# Enviar mensagem simulada
./bin/whatsapp-simulator \
  --phone +5511999999999 \
  --text "ar inverter Springer erro E8"

# Output no terminal:
# [WHATSAPP SIMULATED] To: +5511999999999
# Message: De acordo com o manual... (response)
```

### Message Flow (DEV)

```
Terminal Input
    ↓
whatsapp-simulator → Redis LPUSH swarm:queue:intake
    ↓
swarm processes → RAG → confidence scoring
    ↓
Response logged to terminal
[WHATSAPP SIMULATED] To: +5511999999999 | Message: ...
```

---

## Whitelist/Blacklist Schema

### PostgreSQL Tables

```sql
-- Approved models (whitelist)
CREATE TABLE hvac_model_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nome_completo VARCHAR(200) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    serie VARCHAR(100),
    capacidade_btu INT NOT NULL,
    tipo VARCHAR(30) NOT NULL,  -- split, multi_split, piso_teto, cassette
    tecnologia VARCHAR(30) NOT NULL,  -- inverter
    tipo_compressor VARCHAR(30),
    refrigerante VARCHAR(10),
    codigos_erro TEXT[],  -- ARRAY['E1', 'E2', 'E8']
    is_approved BOOLEAN DEFAULT true,
    approved_at TIMESTAMP DEFAULT NOW(),
    source VARCHAR(100),
    INDEX idx_marca (marca),
    INDEX idx_btu (capacidade_btu),
    INDEX idx_tipo (tipo)
);

-- Blacklist for fake/unverified manuals
CREATE TABLE hvac_manual_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manual_hash VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256
    source_url TEXT,
    title VARCHAR(200),
    rejection_reason VARCHAR(200),
    rejected_at TIMESTAMP DEFAULT NOW(),
    rejected_by VARCHAR(50),  -- 'auto', 'admin', 'qwen2.5-vl'
    qwen_confidence FLOAT,
    INDEX idx_hash (manual_hash)
);

-- Manual content (indexed chunks)
CREATE TABLE hvac_manual_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES hvac_model_whitelist(id),
    chunk_text TEXT NOT NULL,
    chunk_index INT,
    section VARCHAR(50),
    page_ref INT,
    qdrant_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT false,
    INDEX idx_model (model_id),
    INDEX idx_section (section)
);
```

---

## qwen2.5-vl Verification Flow

### Verification Pipeline

```
Manual PDF received
    ↓
Render pages to PNG (pdftoppm or mupdf)
    ↓
First page → qwen2.5-vl visual analysis
    ↓
JSON response parsed
    ↓
If document_type != "service_manual" → BLACKLIST
If has_diagnostic_content == false → BLACKLIST
If is_duplicate_likely == true → compare with existing
    ↓
If passed → proceed to chunking + indexing
```

### qwen2.5-vl Prompt (Full)

```
You are an HVAC service manual expert. Analyse this document and respond with ONLY valid JSON:

{
  "document_type": "service_manual | product_listing | marketing | unknown",
  "confidence": 0.0-1.0,
  "has_diagnostic_content": true/false,
  "indicators": ["list of found elements - error code tables, wiring diagrams, troubleshooting steps, parts lists"],
  "error_codes_found": ["list of any error/fault codes like E1, E2, CH10, F0"],
  "procedures_found": ["list of diagnostic or repair procedures"],
  "safety_warnings_found": true/false,
  "is_duplicate_likely": true/false,
  "duplicate_of_model": "if duplicate, specify known model",
  "reasoning": "brief explanation of classification"
}

Look specifically for:
- Error code tables with diagnostic steps
- Wiring diagrams with connector pinouts
- Safety warnings in structured format
- Revision/date blocks with part numbers
- Troubleshooting flowcharts
- Parts lists with numbers

Reject if:
- Only product photos without specs
- Marketing language ("best-in-class", "premium")
- No error codes or diagnostic content
- Generic content that could fit any brand
```

---

## YouTube Content Pipeline

### Channel Vetting Criteria

**Include:**
- NATE/ASHRAE certified technicians
- Diagnostic procedures shown step-by-step
- Error code explanations
- Multi-brand coverage
- "Troubleshooting" in title

**Exclude:**
- Product reviews (promotional)
- Installation-only content
- Manufacturer sales channels
- < 5 min duration

### Video Processing Flow

```
YouTube Search: "HVAC diagnostic inverter split troubleshooting"
    ↓
Filter by channel criteria (NATE cert, multi-brand)
    ↓
Fetch captions via youtube-transcript-api
    ↓
Extract error code mentions with timestamps
    ↓
Chunk 512 tokens + context preservation
    ↓
Tag: video_id, timestamp, channel, error_codes
    ↓
Qdrant index with content_type="video_transcript"
```

---

## Validation Rules (SPEC-026 Content Validation)

| Rule | Weight | Must Pass |
|------|--------|-----------|
| has_model_reference | 2.0 | Yes |
| has_procedure | 1.5 | Yes |
| not_review | 1.0 | Yes |
| has_error_codes | 1.5 | Yes |
| has_safety_warning | 1.0 | No |
| min_pages | - | 5+ pages |

**Score >= 7.0 → APPROVED for indexing**
**Score < 7.0 → REJECTED → qwen2.5-vl check for second opinion**

---

## Success Criteria

| # | Criterion | Target | Measurement |
|---|-----------|--------|-------------|
| SC-1 | RAG retrieval accuracy | MRR >= 0.85 | Test set 50 questions |
| SC-2 | qwen2.5-vl rejection rate | < 5% false negative | Manual review sample |
| SC-3 | Response confidence calibrated | 85% threshold correct | User feedback survey |
| SC-4 | DEV simulation functional | All flows testable | CLI smoke test |
| SC-5 | Error code coverage | 95% common codes | Database count |
| SC-6 | YouTube pipeline | 100 videos indexed | Qdrant count |
| SC-7 | Chunk quality | context preserved | Error code chunks intact |
| SC-8 | WhatsApp format | < 4096 chars | Automated check |

---

## Open Questions

| # | Question | Impact | Owner |
|---|----------|--------|-------|
| OQ-1 | Usar embedding-256 MiniMax ou bge-m3 local (1024d)? | MEDIUM | agent-8 |
| OQ-2 | Fine-tune Whisper para HVAC terms? | LOW | agent-4 |
| OQ-3 | Quantos vídeos YouTube indexar inicialmente? | LOW | agent-4 |

---

## Dependencies

| Dependency | Status |
|------------|--------|
| Qdrant collection hvac_service_manuals | SPEC-026 (pending) |
| BrandModels hvac_models.go | ✅ Existing |
| mupdf for PDF | ⬜ |
| qwen2.5-vl via LiteLLM | ✅ Configured |
| SIMULATE_WHATSAPP env var | ✅ Existing |

---

## Files to Create

| File | Purpose |
|------|---------|
| `internal/rag/chunker.go` | Semantic chunking logic |
| `internal/rag/whitelist.go` | Whitelist/blacklist management |
| `internal/rag/verifier.go` | qwen2.5-vl visual verification |
| `internal/youtube/pipeline.go` | YouTube learning pipeline |
| `internal/billing/error_codes.go` | Error codes database |
| `cmd/whatsapp-simulator/main.go` | DEV simulation CLI |
| `internal/rag/refiner.go` | Response refinement engine |
| `docs/guides/whatsapp-dev-simulation.md` | DEV mode guide |

---

## Next Steps

1. Create SPEC-031 → /pg → tasks/pipeline.json
2. Task 1-10 executados em paralelo
3. Validate with 50 test questions
4. Deploy DEV mode
5. Iterate based on user feedback