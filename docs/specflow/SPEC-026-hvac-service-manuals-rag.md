# SPEC-026: HVAC Service Manuals Semantic RAG

## 1. Objective

Construir um **RAG semântico** que indexa manuais de serviço HVAC por:
- Número de série
- Tag/modelo de equipamento
- Marca (Springer, Midea, LG, Carrier, Daikin, Samsung, Consul, Electrolux, etc.)
- Tipo (split, multi-split, piso-teto, cassette, chiller)
- Tecnologia (inverter, convencional, VRF)
- Subtipo de compressor (rotativo, scroll, linear)
- Refrigerante (R-410A, R-32, R-290)

Fontes de dados:
- Manuais técnicos (PDF, HTML, Markdown)
- Videos YouTube (tutoriais de serviço, diagnóstico, reparo)
- Notas técnicas de fabricantes
- Base de conhecimento de técnicos experientes

## 2. Tech Stack

| Componente | Tecnologia |
|------------|------------|
| Embeddings | **Google Vertex AI Text Embedding** (gemini-embedding-004) ou **MiniMax-M2** (nós já temos) |
| Vector Store | Qdrant (já existe no projeto) |
| Transcrição YT | Whisper API / wav2vec2 (já existe no homelab) |
| LLM Response | MiniMax M2.7 (já temos) |
| Pipeline | Go swarm agents (já existe) |
| Parsing PDF | marca texto /上讲 |

### Google Embedding vs MiniMax

| Modelo | Dimensão | Context | Custo | Status |
|--------|----------|---------|-------|--------|
| gemini-embedding-004 | 3072 | 8K tokens | $0.10/1M | Novo (2026) |
| MiniMax embed | 1024 | 8K tokens | ~$0.05/1M | Já temos |
| OpenAI ada-002 | 1536 | 8K | $0.10/1M | Alternativa |

**Recomendação:** Usar **MiniMax embed** (já integrado) ou **gemini-embedding-004** se precisar de maior qualidade.

## 3. Data Sources

### 3.1 Manuais Técnicos (Prioridade Alta)

Fontes:
- Site Carrier/Brazil (manuais Springer, Midea) — **NÃO PUBLICA MANUAIS DE SERVIÇO**
- Site LG Brasil
- Site Samsung Brasil
- Site Daikin Brasil
- Site Consul/Electrolux
- Site Midea Brasil
- ManualsLib.com (freemium - 500k+ manuais)
- Scribd (paywall)
- HVAC-Talk.com (paid $99/ano)
- Grupos WhatsApp/Facebook de técnicos
- **GitHub: Coolfix** (errorCodes.json), **hvac-troubleshoot-pro** (18-table schema)

**IMPORTANTE:** Fabricantes NÃO publicam manuais de serviço. Apenas manuais do usuário.
Service manuals disponíveis em forums especializados e bases de dados de técnicos.

Dados a extrair:
```json
{
  "model": "Springer Xtreme Save Connect 12000 BTU",
  "brand": "Springer",
  "series": "Xtreme Save Connect",
  "btu": 12000,
  "type": "split",
  "technology": "inverter",
  "compressor": "rotativo",
  "refrigerant": "R-32",
  "error_codes": ["E1", "E2", "E5", "E6", "E8"],
  "replacement_parts": [...],
  "service_procedures": [...],
  "pdf_url": "...",
  "pages": [...]
}
```

### 3.1.1 Modelos Inverter Brasil (Dados Reais - Buscapé Abril 2026)

#### Springer/Midea
| Modelo | Código | BTU | Tipo | Refrigerante |
|--------|--------|-----|------|--------------|
| AI Ecomaster | 42EZVCA12M5/38EZVCA12M5 | 12k | Split | R-32 |
| AI Ecomaster | 42EZVCA09M5/38EZVCA09M5 | 9k | Split | R-32 |
| AI Ecomaster | 42EZVCA24M5/38EZVCA24M5 | 24k | Split | R-32 |
| AirVolution Connect | 42AFVCI12M8/38AFVCI12M8 | 12k | Split | R-32 |
| Xtreme Save Connect | 42AGVCI12M5/38AGVCI12M5 | 12k | Split | R-32 |
| Xtreme Save Connect Black | 42MGVQI12M5/38MGVQI12M5 | 12k | Split | R-32 |
| Xtreme Save Connect | 42AGVQI18M5/38AGVQI18M5 | 18k | Split | R-32 |

#### LG
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| Dual Inverter Compact | S3-Q12JAQAL | 12k | Split |
| Dual Inverter Compact | S3-Q09AAQAK | 9k | Split |
| Dual Inverter Voice | S3-W12JA31A | 12k | Split |
| Dual Inverter Voice | S3-Q24K231B | 24k | Split |
| AI Dual Inverter Voice | S3-Q12JA31L | 12k | Split |
| Dual Inverter Voice Artcool | S3-W12JAR7A | 12k | Split |
| LP1419IVSI (Portátil) | - | 14k | Portátil |

#### Samsung
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| Wind-Free | AR12DYFAAWKNAZ | 12k | Split |
| Wind-Free Connect | AR09DYFAAWKNAZ | 9k | Split |
| Wind-Free | AR18CVFAAWKNAZ | 18k | Split |
| Digital Inverter | AR12CVHZAWK | 12k | Split |
| Split Piso/Teto | F-CAC-024DN4DK | 24k | Piso/Teto |
| Split Cassete | F-CAC-036DN4DK | 36k | Cassette |

#### Daikin
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| FTKC12T5VL/RKC12T5VL | - | 12k | Split |
| FTKP09Q5VL/RKP09Q5VL | - | 9k | Split EcoSwing |
| FCQ48AVL/RZQ48AVL | - | 48k | Cassette |
| FBQ36AVL/RZQ36AVL | - | 36k | Duto |

#### Consul
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| CCK07BB | - | 7k | Janela |
| CBK09D/CBL09D | - | 9k | Split |
| CBR12C/SBS12C | - | 12k | Split |
| CBK18CB | - | 18k | Split |

#### Electrolux
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| YI12F/YE12F | - | 12k | Split |
| YI18R/YE18R | - | 18k | Split |
| JI24F/JE24F | - | 24k | Split |
| KI36F/KE36F | - | 36k | Cassette |
| DI36F/DE36F | - | 36k | Piso/Teto |

#### Philco
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| PAC9FC | - | 9k | Split |
| PAC12FC | - | 12k | Split |
| PAC18FC | - | 18k | Split |
| PAC24FC | - | 24k | Split |
| PAC36000ICFM16 | - | 36k | Cassette |
| PAC60000IPFM5 | - | 55k | Piso/Teto |

#### Gree
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| G-Top Auto | GWC12ATC-D6DNA1A | 12k | Split |
| G-Top Auto | GWC09ATA-D6DNA1A | 9k | Split |

#### Elgin
| Modelo | Código | BTU | Tipo |
|--------|--------|-----|------|
| Eco II | HJFI12C2WB/HJFE12C2CB | 12k | Split |
| Eco Star | HSFE18C2N | 18k | Split |
| Eco II | HJFE30C2CB/HJFI30C2WB | 30k | Split |

### 3.2 YouTube Videos (Prioridade Alta)

Canais a pesquisar:
- **Deslocar**: Técnico Hoffmann ( Brasil)
- **Clube do Ar Condicionado**
- **Mega Ar Condicionado**
- **Serviço e Manutenção HVAC**
- **AC Technical Services**
- **Refrigeration and AC**
- **The HVACR Helper**

Transcrição:
- YouTube Transcript API → Whisper → embeddings
- Filtrar: só tutorial de diagnóstico/serviço/reparo
- Descartar: reviews, unboxing, installation

### 3.3 Base de Códigos de Erro (Prioridade Alta)

**Repositorios GitHub encontrados:**
- **Coolfix** (hysenmuhamad-commits) - Next.js app com `errorCodes.json`
- **hvac-troubleshoot-pro** (Huskyauto) - 18-table schema (MySQL/TiDB)
  - Tabelas: device_models, error_codes, diagnostics, parts, suppliers
  - Equipamentos: Furnaces, AC, Heat Pumps, Geothermal, Mini-Split, Tankless WH
- **faultCode** (zhanglu312) - C++ image recognition para códigos de erro

**Schema de Error Code Database:**
```json
{
  "error_codes": [
    {
      "brand": "springer|midea",
      "code": "E0",
      "meaning": "Sem erro / Normal",
      "cause": "Operação normal",
      "diagnostic_steps": ["Verificar display", "Testar funcionamento"],
      "likely_replacement": null,
      "severity": "info"
    },
    {
      "brand": "springer|midea",
      "code": "E1",
      "meaning": "Erro de comunicação",
      "cause": "Falha na comunicação entre unidades interna/externa",
      "diagnostic_steps": [
        "Verificar cabling entre unidades",
        "Medir tensão no conector",
        "Verificar PCB da unidade interna"
      ],
      "likely_replacement": "PCB interna ou cabo flat",
      "severity": "high"
    },
    {
      "brand": "springer|midea",
      "code": "E2",
      "meaning": "Erro de temperatura",
      "cause": "Sensor de temperatura com defeito ou desconectado",
      "diagnostic_steps": [
        "Verificar conexão do sensor T1/T2/T3",
        "Medir resistência do sensor",
        "Comparar com valores da tabela"
      ],
      "likely_replacement": "Sensor de temperatura",
      "severity": "medium"
    },
    {
      "brand": "springer|midea",
      "code": "E5",
      "meaning": "Superheating excessivo",
      "cause": "Falta de gás refrigerante ou problema no compressor",
      "diagnostic_steps": [
        "Medir superheat (deve ser 5-8°C)",
        "Verificar vazamento",
        "Testar compressor"
      ],
      "likely_replacement": "Compressor ou carga de gás",
      "severity": "critical"
    },
    {
      "brand": "springer|midea",
      "code": "E6",
      "meaning": "Erro no motor do ventilador",
      "cause": "Motor do ventilador não funciona ou bloqueado",
      "diagnostic_steps": [
        "Verificar tensão no motor",
        "Medir resistência do motor",
        "Testar capacitor do motor"
      ],
      "likely_replacement": "Motor do ventilador ou capacitor",
      "severity": "high"
    },
    {
      "brand": "springer|midea",
      "code": "E8",
      "meaning": "Erro IPM / Proteção do compressor",
      "cause": "Problema no módulo IPM, compressor travado ou superaquecimento",
      "diagnostic_steps": [
        "Verificar temperatura do compressor",
        "Medir resistência dos bobinados do compressor",
        "Testar módulo IPM",
        "Verificar ventilação da unidade externa"
      ],
      "likely_replacement": "Placa PCB externa ou compressor",
      "severity": "critical"
    },
    {
      "brand": "lg",
      "code": "E1",
      "meaning": "Communication error",
      "cause": "Indoor-Outdoor communication failure",
      "diagnostic_steps": [
        "Check interconnecting wires",
        "Verify PCB connections",
        "Check for loose connectors"
      ],
      "likely_replacement": "PCB board",
      "severity": "high"
    },
    {
      "brand": "lg",
      "code": "CH10",
      "meaning": "Dual inverter compressor issues",
      "cause": "Compressor lock or overcurrent",
      "diagnostic_steps": [
        "Check compressor resistance",
        "Verify power supply",
        "Test IPM module"
      ],
      "likely_replacement": "Compressor or inverter board",
      "severity": "critical"
    },
    {
      "brand": "samsung",
      "code": "E1",
      "meaning": "Room temperature sensor error",
      "cause": "Open or shorted temp sensor",
      "diagnostic_steps": [
        "Check sensor connections",
        "Measure sensor resistance"
      ],
      "likely_replacement": "Temperature sensor",
      "severity": "medium"
    },
    {
      "brand": "samsung",
      "code": "E4",
      "meaning": "Communication error (indoor to outdoor)",
      "cause": "Signal transmission problem",
      "diagnostic_steps": [
        "Check wiring",
        "Verify PCB"
      ],
      "likely_replacement": "PCB",
      "severity": "high"
    },
    {
      "brand": "daikin",
      "code": "A5",
      "meaning": "Cooling/Heating overload",
      "cause": "Abnormal temperature in refrigerant circuit",
      "diagnostic_steps": [
        "Check refrigerant charge",
        "Verify heat exchanger cleanliness",
        "Check fan operation"
      ],
      "likely_replacement": "Sensor or refrigerant",
      "severity": "medium"
    },
    {
      "brand": "consul|electrolux",
      "code": "E0",
      "meaning": "No error",
      "cause": "Normal operation",
      "diagnostic_steps": [],
      "likely_replacement": null,
      "severity": "info"
    },
    {
      "brand": "consul|electrolux",
      "code": "E1",
      "meaning": "Temperature sensor failure",
      "cause": "Sensor disconnected or damaged",
      "diagnostic_steps": [
        "Check sensor connection",
        "Measure resistance"
      ],
      "likely_replacement": "Temperature sensor",
      "severity": "medium"
    }
  ]
}
```

### 3.4 Base de Conhecimento Técnico (Prioridade Média)

- Notas técnicas de fabricantes (ANVISA)
- Publicações ABRAVA
- Fóruns: Grupo HVAC Brasil, Refrigeração Brasil
- Artigos técnicos em PT-BR

## 4. Schema do Vector Store

### Collection: `hvac_service_manuals`

```json
{
  "id": "springer_xtreme_save_connect_12000_e8",
  "model": "Springer Xtreme Save Connect 12000 BTU Inverter R-32",
  "brand": "springer",
  "series": "xtreme_save_connect",
  "btu_range": "12000",
  "btu_value": 12000,
  "type": "split",
  "technology": "inverter",
  "compressor_type": "rotativo",
  "refrigerant": ["R-32"],
  "error_code": ["E1", "E2", "E5", "E6", "E8"],
  "content": "...",
  "content_type": "manual|video_transcript|technical_note|forum_post",
  "source_url": "...",
  "source_name": "YouTube|Manufacturer|Forum|Coolfix|hvac-troubleshoot-pro",
  "language": "pt-BR",
  "created_at": "2026-04-11",
  "embedding_model": "minimax-embed",
  "chunk_size": 512,
  "metadata": {
    "model_code": "42AGVCI12M5",
    "internal_code": "38AGVCI12M5",
    "year": 2024,
    "difficulty": "intermediate|advanced|expert",
    "price_range": "R$ 2000-3000",
    "warranty_years": 1
  }
}
```

### Filtros por Metadata

```
- brand: springer|midea|lg|carrier|daikin|samsung|consul|electrolux
- btu_range: 9000|12000|18000|24000|36000|48000|60000
- type: split|multi_split|piso_teto|cassette|chiller|portatil
- technology: inverter|conventional|dc_inverter|ac_inverter|vrf
- compressor_type: rotativo|scroll|linear|hermetic
- refrigerant: R-410A|R-32|R-290|R-22
- error_code: E0-E9|F0-F9|P0-P9
- content_type: manual|video|technical_note|forum
- difficulty: beginner|intermediate|advanced|expert
```

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RAG PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     │
│  │  PDF/HTML    │     │  YouTube     │     │  Forums/     │     │
│  │  Manuals     │     │  Videos      │     │  Notes        │     │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘     │
│         │                    │                    │                │
│         ▼                    ▼                    ▼                │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐      │
│  │  Parser      │     │  Whisper     │     │  Web         │      │
│  │  (mupdf)    │     │  Transcript  │     │  Scraper     │      │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘      │
│         │                    │                    │                │
│         └────────────────────┼────────────────────┘                │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │  Chunking       │                              │
│                    │  (512 tokens)   │                              │
│                    └────────┬────────┘                              │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │  Embedding      │                              │
│                    │  (MiniMax/Gemini)                             │
│                    └────────┬────────┘                              │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │  Qdrant        │                              │
│                    │  Collection     │                              │
│                    │  hvac_manuals   │                              │
│                    └─────────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         QUERY PIPELINE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input: "Springer Sprint 12k giving E8 error, compressor not        │
│          starting, what could it be?"                               │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │  Intent        │                              │
│                    │  Classification │                              │
│                    └────────┬────────┘                              │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                │
│         │                    │                    │                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐         │
│  │ Brand Filter│     │ Error Code  │     │ Tech Filter │         │
│  │ springer    │     │ e8         │     │ inverter     │         │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘         │
│         │                    │                    │                 │
│         └────────────────────┼────────────────────┘                │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │  Semantic      │                              │
│                    │  Search        │                              │
│                    │  (Qdrant)      │                              │
│                    └────────┬────────┘                              │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │  MiniMax M2.7  │                              │
│                    │  Response Gen  │                              │
│                    └────────┬────────┘                              │
│                              │                                       │
│                              ▼                                       │
│  Output: "Based on Springer Sprint 12000 BTU Inverter service      │
│           manual, E8 error indicates IPM/fan motor issue..."       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 6. Indexing Strategy

### 6.1 Manual Parsing

```go
type ManualParser struct {
    // Supported formats
    supportedFormats []string // ".pdf", ".html", ".md"

    // Extractors
    extractors map[string]Extractor // by format
}

type ExtractedPage struct {
    PageNumber    int
    Model        string
    Brand        string
    Content      string
    Tables       []Table
    Images       []Image
    Diagrams     []Diagram
    ErrorCodes   []ErrorCode
    Procedures   []Procedure
}
```

### 6.2 YouTube Pipeline

```go
type YouTubeIndexer struct {
    channels []string
    apiKey  string

    // Pipeline
    fetcher     *VideoFetcher
    transcriber *WhisperTranscriber
    filter      *ContentFilter
    embedder    *EmbeddingClient
    uploader    *QdrantUploader
}

type VideoMetadata struct {
    VideoID      string
    Title        string
    Channel      string
    Duration     time.Duration
    Views        int
    Transcript   string
    ContentType  string // "diagnostic", "repair", "tutorial", "review"
    Models       []string
    Brands       []string
    Difficulty   string
    Validated    bool
}
```

### 6.3 Content Validation

```go
type ContentValidator struct {
    rules []ValidationRule
}

type ValidationRule struct {
    Name        string
    Validate    func(content) bool
    Weight      float64
    Description string
}

// Rules
- has_model_reference: 2.0 // Must mention specific model
- has_procedure: 1.5 // Has step-by-step
- not_review: 1.0 // Is not a review/unboxing
- has_error_codes: 1.5 // Mentions error codes
- has_safety_warning: 1.0 // Has safety instructions
```

## 7. Query Interface

### 7.1 Query Types

```go
type QueryType int

const (
    DiagnosticQuery QueryType = iota // "compressor not starting, E8"
    ErrorCodeQuery                   // "E8 Springer Sprint"
    ProcedureQuery                    // "how to test IPM module"
    PartsQuery                        // "replacement for compressor board"
    ComparisonQuery                   // "Springer vs Midea inverter"
    GeneralQuery                      // "inverter compressor原理"
)
```

### 7.2 Example Queries

| Query | Filters | Expected Output |
|-------|---------|-----------------|
| "Springer Sprint 12k E8 compressor not starting" | brand=springer, btu=12000, error=e8 | Diagnose IPM, test procedures, replacement |
| "how to test capacitor with ESR meter" | content_type=procedure | Step-by-step with values |
| "R-32 inverter compressor replacement cost" | refrigerant=R-32, type=procedure | Cost estimate + procedure |
| "multi-split installation manual Midea 36k" | brand=midea, btu=36000, type=multi_split | Installation guide |
| "compressor scrap ie3 18k BTU valor" | content_type=forum, model=*, btu=18000 | Forum discussion, prices |

## 8. Go Implementation

### 8.1 Project Structure

```
internal/
├── rag/
│   ├── indexer.go              # Main indexing pipeline
│   ├── parser/
│   │   ├── pdf.go              # PDF parsing (mupdf)
│   │   ├── html.go             # HTML/web scraping
│   │   ├── youtube.go          # YouTube pipeline (Whisper)
│   │   └── errorcode.go        # Error code parser
│   ├── embedder/
│   │   ├── minimax.go         # MiniMax embeddings (1024d)
│   │   └── vertex.go           # Google Vertex embeddings (3072d)
│   ├── chunker/
│   │   └── text.go             # Text chunking (512 tokens)
│   ├── filter/
│   │   └── content.go          # Content validation
│   ├── qdrant/
│   │   └── client.go           # Qdrant operations
│   ├── query/
│   │   ├── router.go           # Query routing
│   │   └── responder.go        # Response generation
│   └── models/
│       └── hvac_models.go      # HVAC model data (from Buscapé)
├── agents/
│   ├── rag_indexer_agent.go    # Swarm agent for indexing
│   ├── rag_query_agent.go      # Swarm agent for queries
│   └── error_code_agent.go     # Swarm agent for error code lookup
└── whatsapp/
    └── webhook.go              # WhatsApp integration (already exists)
```

### 8.2 Key Interfaces

```go
type Embedder interface {
    Embed(ctx context.Context, texts []string) ([]Vector, error)
    EmbedQuery(ctx context.Context, query string) (Vector, error)
}

type VectorStore interface {
    Upsert(ctx context.Context, collection string, points []Point) error
    Search(ctx context.Context, collection string, query Vector, filters Filters, limit int) ([]Result, error)
    Delete(ctx context.Context, collection string, ids []string) error
}

type ContentParser interface {
    Parse(ctx context.Context, source string) ([]Chunk, error)
    SupportedFormats() []string
}
```

## 9. Success Criteria

- [ ] Indexar 500+ manuais de serviço HVAC (split, multi-split, cassette, piso-teto)
  - **Fonte:** ManualsLib, Scribd, grupos WhatsApp técnicos, Coolfix GitHub
  - **Prioridade:** Springer/Midea, LG, Samsung, Daikin, Consul, Electrolux
- [ ] Indexar 500+ videos YouTube transcritos e filtrados
- [ ] Criar base de dados de 100+ códigos de erro por marca
  - **Fonte:** Coolfix errorCodes.json, hvac-troubleshoot-pro, manufacturer docs
- [ ] Suportar busca por: modelo, marca, código de erro, tipo de equipamento, refrigerante
- [ ] Tempo de resposta <2 segundos para queries semânticas
- [ ] Precisão >85% em testes de recuperação (precision@5)
- [ ] Cobertura: 90% dos modelos inverter no mercado brasileiro

**Dados de Mercado:**
- 416+ resultados Inverter no Buscapé
- 12+ marcas principais (LG, Samsung, Midea, Springer, Daikin, Consul, Electrolux, Philco, Gree, Elgin, Hisense, TCL, HQ)
- Faixa de preço: R$ 1.529,90 (HQ 9k) a R$ 12.299,40 (Samsung 54k)
- Capacidades: 7k, 9k, 12k, 18k, 22k, 24k, 30k, 36k, 48k, 54k, 55k BTUs

## 10. Roadmap

### Fase 1: MVP (1 semana)
- Parser de PDFs básico (mupdf)
- MiniMax embeddings (já temos)
- Qdrant collection setup
- 50 manuais piloto (Midea, LG, Samsung - via ManualsLib)
- Error code database estruturado (50+ códigos)
- Query agent básico

**Fontes MVP:**
- Coolfix GitHub (errorCodes.json)
- hvac-troubleshoot-pro schema
- ManualsLib (manuais de usuário)

### Fase 2: YouTube + Modelos (1 semana)
- Pipeline de transcrição (Whisper/wav2vec2)
- Filtro de conteúdo (diagnóstico, reparo, tutorial)
- Indexar modelos reais do Buscapé (416+ SKUs)
- 100 videos indexados

### Fase 3: Multi-brand + Manuais (2 semanas)
- Todos os fabricantes brasileiros (12+ marcas)
- Cobertura completa de códigos de erro (100+ por marca)
- Scraping de fóruns HVAC-Talk, grupos WhatsApp
- ManualsLib premium (se necessário)

### Fase 4: Production (1 semana)
- Performance tuning (<2s query)
- Validação com técnicos
- Deploy no swarm

**Nota:** Fabricantes NÃO publicam manuais de serviço. Service manuals vêm de:
1. ManualsLib.com (freemium)
2. Grupos WhatsApp/Facebook de técnicos
3. HVAC-Talk.com ($99/ano)
4. Bases de dados internas de assistências técnicas
