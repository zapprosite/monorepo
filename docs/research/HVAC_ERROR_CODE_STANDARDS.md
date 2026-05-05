# HVAC Error Code Standards & Classification — Research Report

> **Data:** 2026-05-05
> **Fontes:** AirNexus, HVAC Toolkit, Mountain Mechanical NY, Daikin Global, LG HVAC, Samsung, ASHRAE

---

## 1. Are There Standardized Error Code Formats Across Brands?

**Resposta curta: NÃO.**

Não existe um padrão industrial unificado para códigos de erro HVAC. Cada fabricante utiliza um sistema **proprietário e independente**, mesmo quando os componentes subjacentes (compressores inversores, válvulas de expansão eletrônica, sensores de temperatura) são funcionalmente idênticos.

**Evidências:**
- ASHRAE, ISO e AHRI **não publicam** normas para codificação de falhas em equipamentos de ar condicionado residencial/comercial
- A BACnet (ASHRAE 135) padroniza comunicação BMS, mas **não** o vocabulário de diagnóstico
- Cada marca mantém bases de dados proprietárias: Daikin Service Checker, Mitsubishi AE-200, LG LGMV, Samsung DMS2

**Consequência prática:** Um técnico que conhece códigos Daikin (U4, E3, L5) não consegue diagnosticar um equipamento LG (CH 05, CH 21) sem consultar a documentação específica da marca.

---

## 2. How Major Brands Structure Their Error Codes

### Comparison Table: Error Code Formats by Brand

| Brand | System Name | Code Format | Examples | Typical Prefixes | Display Location |
|-------|-------------|-------------|----------|------------------|------------------|
| **Daikin** | VRV / SkyAir / Split | Letter + Number (2 chars) | U4, E3, L5, A0, C4, F3, H6 | A=Indoor, C=Sensor, E=Outdoor/Pressure, F=Discharge, H=Position/CT, J=Pipe, L=Temp/Current, U=Refrigerant/Comm/Power | Wired remote, outdoor LED, BMS |
| **Mitsubishi Electric** | City Multi / M-NET | Letter + Number (2 chars) | P6, P9, E6, E1, L3, U1, F1, A1 | P=Protection/Comm, E=Compressor/Comm, L=Refrigerant, U=Pressure, F=Sensor, A=Indoor PCB | Controller, AE-200 tool |
| **LG** | Multi V / LMAP | "CH " + Number (2 digits) | CH 05, CH 21, CH 02, CH 10, CH 23, CH 26 | CH = Check (universal prefix) | AC Smart, LGMV tool |
| **Samsung** | DVM / S-NET | "E" + Number (3 digits) or E1/xx | E416, E201, E202, E440, E108, E1/21, E1/54 | E=Error (universal), E1/=sensor subcategory | DMS2, Web Tool, remote |
| **Fujitsu** | Airstage / V-II | Letter:Number or E:xx | E:E1, E:E2, E:E5, U:01, U:11, U:30, U:48 | E:=Communication/Indoor, U:=Compressor/Pressure | Airstage Service Tool |
| **Carrier** | XCT / VRF / Toshiba | Letter + Number | E1, E2, E3, P1-P4, F1-F4 | E=Error, P=Pressure, F=Fan/Sensor | Controller, service tool |
| **Toshiba** | SMMS / SHRMe | Similar to Carrier | E01-E99, P01-P99 | E=Electrical/Comm, P=Protection | Service tool |
| **Midea** | MDV / V6 Series | "E" + Number or Letter+Number | E0-E9, P0-P9, F1-F5 | E=Error, P=Protection, F=Sensor | Controller, BMS |
| **Gree** | GMV Series | "E" + Number or Letter+Number | E1, E2, E3, E6, H1-H6, F1-F3 | E=Comm/Sensor, H=Defrost/Protection, F=Sensor | Remote, LED display |
| **Springer (Carrier BR)** | Split / VRF | Similar to Carrier/Midea | E1, E2, E3, E4, E5, E6 | E=Error universal | Wired remote |
| **Panasonic** | ECOi / FSMulti | Letter + Number or Hxx | H11, H12, H14, H15, F11, F90, F91, F96 | H=Indoor/Communication, F=Outdoor/Compressor | Controller, service tool |
| **Hitachi** | Set Free / Sigma | Number + Letter or 3-digit | 01, 02, 03, P01, E01 | P=Protection, E=Error | Remote, tool |
| **York** | YV2V Series | Similar to Johnson Controls | E1-E9, various | E=Error | Service panel |
| **Trane** | TVR Series | Similar to Ingersoll Rand | E01, E02, various | E=Error | Controller |

### Brand-Specific Deep Dives

#### Daikin (Japan)
- **Format:** Alfabético hierárquico
  - Axx = Falhas na unidade interna (A1=PCB, A3=dreno, A5=gelo, A6=ventilador)
  - Cxx = Falhas de sensor interno (C4=serpentina, C9=ambiente)
  - Exx = Falhas na unidade externa/proteção (E1=PCB externo, E3=alta pressão, E4=baixa pressão, E5=sobrecarga inversor)
  - Fxx = Temperatura de descarga (F3=superaquecimento)
  - Hxx = Sensores externos/posição (H6=sensor posição, H8=CT)
  - Jxx = Sensores de tubulação (J3=descarga, J6=serpentina externa)
  - Lxx = Temperatura/corrente (L3=caixa elétrica, L4=dissipador, L5=sobrecarga)
  - Pxx = Sensor dissipador (P4)
  - Uxx = Refrigerante/comunicação/tensão (U0=carga baixa, U2=tensão anormal, U4=erro comunicação)

#### LG (Korea)
- **Format:** "CH " + 2 dígitos
  - CH 01 = Erro na unidade interna
  - CH 02 = Falha unidade interna
  - CH 05 = Erro de comunicação entre unidades (equivalente ao U4 Daikin)
  - CH 10 = Motor ventilador interno
  - CH 21 = Sobrecarga compressor
  - CH 22 = Sensor corrente compressor
  - CH 23 = Baixa tensão DC link
  - CH 26 = Superaquecimento compressor externo
  - CH 27 = Temperatura descarga anormal
  - CH 34 = Erro de endereço

#### Samsung (Korea)
- **Format:** "E" + 3 dígitos (VRF) ou "E1/" + 2 dígitos (splits)
  - E101 = Comunicação interna falhou
  - E102 = Comunicação externa falhou
  - E201 = Comunicação interna/externa falhou
  - E416 = Temperatura descarga alta
  - E440 = Proteção ciclagem compressor
  - E441 = Proteção compressor sustentada
  - E458 = Motor ventilador externo anormal
  - E461 = Falha partida compressor

#### Carrier / Toshiba (USA/Japan)
- Carrier adquiriu Toshiba HVAC, compartilhando muitos códigos
- Formatos típicos: E1-E9 para erros elétricos/eletrônicos, P1-P4 para pressão

#### Springer (Brasil — joint venture Carrier)
- Utiliza códigos derivados da Carrier, adaptados ao mercado brasileiro
- Formatos: E1 a E6 para erros comuns (sensor, comunicação, ventilador, degelo)

#### Midea / Gree (China)
- Midea MDV/V6: E0-E9 (erros gerais), P0-P9 (proteção)
- Gree GMV: E1-E9 (comunicação/sensor), H1-H6 (degelo/proteção), F1-F3 (sensor)

---

## 3. Is There Any Industry Standard for HVAC Diagnostic Codes?

### Standards That Exist (But Don't Cover Error Codes)

| Standard | Organization | Scope | Relevance to Error Codes |
|----------|--------------|-------|--------------------------|
| **ISO 16813:2006** | ISO | Building environment design | ❌ No diagnostic codes |
| **ASHRAE Standard 34** | ASHRAE | Refrigerant designations | ❌ Names refrigerants only |
| **ASHRAE Standard 135 (BACnet)** | ASHRAE | BMS communication protocol | ⚠️ Standardizes data exchange, not fault vocabularies |
| **IEC 60335-2-40** | IEC | Safety of electrical heat pumps | ⚠️ Requires fault indication, but not standard codes |
| **AHRI 340/360** | AHRI | Performance rating of VRF | ❌ Performance only, no diagnostics |
| **UL 1995** | UL | Safety of heating and cooling equipment | ⚠️ Requires failure indication, not code format |

### What IS Standardized

1. **Refrigerant Designations** (ASHRAE 34): R-410A, R-32, R-454B — todos usam a mesma nomenclatura
2. **Communication Protocols**: BACnet, Modbus, LonWorks — padronizam como falar, não o que dizer
3. **Safety Classifications**: A1, A2L, B1 — padronizam inflamabilidade/toxicidade
4. **Electrical Specifications**: Tensões, frequências, classes de isolamento

### The Gap

> **Não existe ISO, IEC, ASHRAE ou AHRI que defina:**
> - "Código 05 sempre significa erro de comunicação"
> - "Código E3 sempre significa alta pressão"
> - Formato alfanumérico obrigatório
> - Taxonomia de falhas hierárquica

**Implicação:** Cada fabricante é livre para inventar seu próprio esquema. Daikin usa U4 para comunicação; LG usa CH 05; Samsung usa E201 — todos significam a mesma coisa (falha de comunicação entre unidade interna e externa).

---

## 4. How to Build an "Error Code Resolver" (Symptoms → Codes → Solutions)

### Recommended Architecture: Multi-Layer Taxonomy

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  Input: Brand + Model + Error Code OR Symptom Description   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BRAND ADAPTER LAYER                             │
│  Normaliza códigos proprietários para taxonomia canônica    │
│  Daikin U4 ──→ COMM_BUS_INDOOR_OUTDOOR                     │
│  LG CH 05 ──→ COMM_BUS_INDOOR_OUTDOOR                      │
│  Samsung E201 ──→ COMM_BUS_INDOOR_OUTDOOR                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            CANONICAL FAULT TAXONOMY                          │
│  10 categorias universais independentes de marca:           │
│  1. COMMUNICATION (bus, PCB, addressing)                   │
│  2. SENSOR (thermistor, pressure, position, CT)            │
│  3. COMPRESSOR (overload, overcurrent, start failure)      │
│  4. PRESSURE (high, low, switch)                           │
│  5. TEMPERATURE (discharge, heat sink, coil, ambient)      │
│  6. REFRIGERANT (undercharge, leak, overcharge)            │
│  7. FAN_MOTOR (indoor, outdoor, overcurrent, lock)         │
│  8. ELECTRICAL (voltage, current, phase, DC link)          │
│  9. EXPANSION_VALVE (EEV, driver, stuck)                   │
│  10. PROTECTION (freeze, overheat, cycling, external)      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           SYMPTOM → CAUSE → ACTION ENGINE                    │
│  Mapeamento semântico:                                      │
│  - Probable Causes (ranked by likelihood)                   │
│  - Severity Classification (High/Medium/Low)                │
│  - Recommended Actions (step-by-step)                       │
│  - Required Tools (multimeter, pressure gauge, etc.)        │
│  - Safety Warnings (do not power-cycle high-severity)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           MANUAL / DOCUMENT RETRIEVER                        │
│  Busca contextual no manual PDF original da marca/modelo    │
│  usando embeddings + RAG (Qdrant/Ollama)                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Model for Error Code Resolver

```typescript
// Canonical Error Record
interface HVACErrorCode {
  // Brand-specific
  brand: string;           // "daikin", "lg", "samsung", ...
  systemType: string;      // "vrf", "split", "chiller"
  rawCode: string;         // "U4", "CH 05", "E416"
  
  // Canonical taxonomy
  canonicalCategory:       // "COMMUNICATION" | "SENSOR" | ...
  canonicalSubcategory:    // "INDOOR_OUTDOOR_BUS" | "THERMISTOR_OPEN"
  severity: "HIGH" | "MEDIUM" | "LOW";
  
  // Diagnostic info
  description: string;     // user-facing
  probableCauses: Array<{
    cause: string;
    likelihood: number;    // 0.0-1.0
    quickCheck: string;    // what to check first
  }>;
  
  // Actions
  actions: Array<{
    step: number;
    instruction: string;
    requiresTool?: string;
    safetyWarning?: string;
  }>;
  
  // Cross-reference
  equivalentCodes: Array<{  // same fault on other brands
    brand: string;
    code: string;
  }>;
  
  // Metadata
  refrigerantsAffected?: string[];  // ["R410A", "R32"]
  voltageClasses?: string[];        // ["220V", "380V"]
  modelSeries?: string[];           // ["VRV-IV", "VRV-V"]
}
```

### Severity Classification

| Severity | Meaning | Response Time | Examples |
|----------|---------|---------------|----------|
| **HIGH** | Sistema falhou ou vai falhar. Compressor, refrigerante, comunicação. | Mesmo dia. Não religar. | Daikin U4, LG CH 21, Samsung E416 |
| **MEDIUM** | Sistema opera com performance reduzida. Sensor ou componente único. | 3-5 dias. | Daikin A3, LG CH 10, Samsung E458 |
| **LOW** | Alerta registrado. Impacto operacional limitado. | Próxima manutenção. | Daikin C9, Samsung CF (filtro) |

### Key Design Principles

1. **Brand Adapter Pattern:** Cada marca tem um parser que normaliza seu código para a taxonomia canônica
2. **Semantic Equivalence:** U4 (Daikin) = CH 05 (LG) = E201 (Samsung) = COMM_BUS_INDOOR_OUTDOOR
3. **Contextual Retrieval:** Mesmo código pode ter causas diferentes dependendo do modelo — buscar no manual específico
4. **Safety-First UI:** Códigos HIGH severity devem exibir warnings proeminentes contra power-cycle

---

## 5. Metadata to Extract from HVAC Manuals

### Tier 1: Essential (always extract)

| Field | Description | Example |
|-------|-------------|---------|
| `brand` | Fabricante | "Daikin" |
| `modelNumber` | Número do modelo completo | "RXYSQ8TY1" |
| `modelSeries` | Família/geração | "VRV-IV", "Multi V 5" |
| `systemType` | Tipo de sistema | "VRF", "Split", "SkyAir", "Chiller" |
| `capacity_kW` | Capacidade nominal | "22.4 kW" |
| `capacity_BTU` | Capacidade em BTU/h | "76,000 BTU/h" |
| `refrigerant` | Tipo de fluido refrigerante | "R-410A", "R-32", "R-454B" |
| `voltage` | Tensão de alimentação | "220V/1ph/50Hz", "380V/3ph/60Hz" |
| `manualType` | Tipo do documento | "Service Manual", "Installation Manual", "Error Code List" |
| `manualRevision` | Revisão do manual | "Rev. A", "2024-03" |
| `language` | Idioma do manual | "en", "pt-BR", "ja" |

### Tier 2: Diagnostic (extract for fault resolution)

| Field | Description | Example |
|-------|-------------|---------|
| `errorCodes` | Tabela completa de códigos | Array de {code, description, cause, action} |
| `sensorSpecs` | Especificações de sensores | Resistência a 25°C, tolerância |
| `pressureRanges` | Faixas de pressão operacional | "High: 2.8-3.2 MPa", "Low: 0.5-0.8 MPa" |
| `temperatureRanges` | Faixas de temperatura | "Discharge max: 120°C" |
| `electricalSpecs` | Dados elétricos | Corrente nominal, consumo, proteção |
| `dipSwitchConfig` | Configurações DIP switch | Endereçamento, modo, capacidade |
| `communicationProtocol` | Protocolo de comunicação | "M-NET", "LMAP", "S-NET", "BACnet" |
| `expansionValveType` | Tipo de VEE | "EEV", "capilar", "TXV" |
| `compressorType` | Tipo de compressor | "Inverter scroll", "Digital scroll" |
| `oilType` | Tipo de óleo | "POE", "PVE", "mineral" |

### Tier 3: Maintenance (extract for PM schedules)

| Field | Description | Example |
|-------|-------------|---------|
| `filterType` | Tipo de filtro | "Washable mesh", "Pleated" |
| `filterReplacementInterval` | Intervalo troca filtro | "3 months" |
| `recommendedMaintenance` | Manutenção preventiva | Array de {task, interval, description} |
| `warrantyPeriod` | Período de garantia | "3 years parts, 5 years compressor" |
| `sparePartsList` | Lista de peças de reposição | Códigos de peças e descrições |
| `specialTools` | Ferramentas especiais necessárias | "Service Checker", "LGMV" |

### Tier 4: Regulatory (extract for compliance)

| Field | Description | Example |
|-------|-------------|---------|
| `certifications` | Certificações | "AHRI 340/360", "INMETRO", "CE" |
| `seerRating` | Eficiência SEER/EER | "SEER 20", "EER 12.5" |
| `safetyClass` | Classificação de segurança | "A1", "A2L" |
| `environmentalRegs` | Regulamentações ambientais | "EPA 608", "F-Gas" |
| `countryOfOrigin` | País de fabricação | "Japan", "China", "Thailand" |

---

## 6. Recommended Metadata Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "HVACManualMetadata",
  "type": "object",
  "required": ["brand", "modelNumber", "systemType", "refrigerant", "voltage"],
  "properties": {
    "document": {
      "type": "object",
      "properties": {
        "fileName": { "type": "string" },
        "fileHash": { "type": "string" },
        "pageCount": { "type": "integer" },
        "language": { "type": "string", "enum": ["en", "pt-BR", "es", "ja", "ko", "zh"] },
        "manualType": { "type": "string", "enum": ["service", "installation", "user", "error_code_list", "parts_catalog"] },
        "revisionDate": { "type": "string", "format": "date" }
      }
    },
    "equipment": {
      "type": "object",
      "properties": {
        "brand": { "type": "string" },
        "modelNumber": { "type": "string" },
        "modelSeries": { "type": "string" },
        "systemType": { "type": "string", "enum": ["vrf", "vrv", "split", "multi_split", "skyair", "chiller", "packaged", "heat_pump"] },
        "indoorUnitModel": { "type": "string" },
        "outdoorUnitModel": { "type": "string" },
        "capacity": {
          "type": "object",
          "properties": {
            "cooling_kW": { "type": "number" },
            "heating_kW": { "type": "number" },
            "cooling_BTU": { "type": "number" },
            "tonnage": { "type": "number" }
          }
        },
        "refrigerant": { "type": "string", "pattern": "^R-[0-9]{3}[A-Z]?$" },
        "refrigerantCharge_kg": { "type": "number" },
        "voltage": { "type": "string", "pattern": "^[0-9]+V/[13]ph/[0-9]{2}Hz$" },
        "phase": { "type": "integer", "enum": [1, 3] },
        "frequency_Hz": { "type": "integer", "enum": [50, 60] },
        "maxCurrent_A": { "type": "number" },
        "compressor": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["inverter_scroll", "digital_scroll", "fixed_scroll", "rotary"] },
            "manufacturer": { "type": "string" },
            "model": { "type": "string" }
          }
        },
        "oilType": { "type": "string", "enum": ["POE", "PVE", "AB", "mineral"] },
        "communicationProtocol": { "type": "string", "enum": ["M-NET", "LMAP", "S-NET", "BACnet", "Modbus", "LonWorks", "proprietary"] },
        "expansionValve": { "type": "string", "enum": ["EEV", "capillary", "TXV", "short_tube"] }
      }
    },
    "errorCodes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["code", "description"],
        "properties": {
          "code": { "type": "string" },
          "displayFormat": { "type": "string" },
          "description": { "type": "string" },
          "description_pt": { "type": "string" },
          "category": { "type": "string", "enum": ["COMMUNICATION", "SENSOR", "COMPRESSOR", "PRESSURE", "TEMPERATURE", "REFRIGERANT", "FAN_MOTOR", "ELECTRICAL", "EXPANSION_VALVE", "PROTECTION", "DRAIN", "OTHER"] },
          "subcategory": { "type": "string" },
          "severity": { "type": "string", "enum": ["HIGH", "MEDIUM", "LOW"] },
          "probableCauses": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "cause": { "type": "string" },
                "cause_pt": { "type": "string" },
                "likelihood": { "type": "number", "minimum": 0, "maximum": 1 },
                "quickCheck": { "type": "string" }
              }
            }
          },
          "actions": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "step": { "type": "integer" },
                "instruction": { "type": "string" },
                "instruction_pt": { "type": "string" },
                "requiresTool": { "type": "string" },
                "safetyWarning": { "type": "string" }
              }
            }
          },
          "pageReference": { "type": "string" },
          "applicableModels": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "sensors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "location": { "type": "string", "enum": ["indoor_coil", "outdoor_coil", "discharge_pipe", "suction_pipe", "ambient", "return_air", "supply_air", "heat_sink"] },
          "type": { "type": "string", "enum": ["NTC_thermistor", "PTC_thermistor", "pressure_transducer", "current_transformer", "hall_sensor"] },
          "resistanceAt25C_ohm": { "type": "number" },
          "tolerance_percent": { "type": "number" },
          "bValue": { "type": "number" }
        }
      }
    },
    "maintenance": {
      "type": "object",
      "properties": {
        "filterCleaningInterval_months": { "type": "integer" },
        "professionalServiceInterval_months": { "type": "integer" },
        "tasks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "task": { "type": "string" },
              "interval": { "type": "string" },
              "description": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

---

## 7. Key Insights & Recommendations

### For Building an Error Code Database

1. **Start with the 15 brands that cover 90% of the market:** Daikin, Mitsubishi Electric, Mitsubishi Heavy, LG, Samsung, Carrier, Toshiba, Panasonic, Fujitsu, Hitachi, Midea, Gree, York, Trane, Haier
2. **Focus on VRF/VRV first:** Splits residenciais têm códigos mais simples; VRF é onde o diagnóstico é mais crítico e valioso
3. **Prioritize HIGH-severity codes:** Compressor, comunicação, refrigerante — são os que geram chamadas de serviço urgentes
4. **Cross-reference by symptom:** Permite que o usuário busque "não gela" e chegue aos códigos relevantes
5. **Link to manual pages:** Sempre referenciar página do manual original para validação

### For Manual Scraping/Extraction Pipeline

1. **Step 1: Document Classification** — Determinar se o PDF é manual de serviço, instalação, lista de códigos ou catálogo de peças
2. **Step 2: Model Number Extraction** — Extrair todos os model numbers mencionados (cobertura do manual)
3. **Step 3: Error Table Detection** — Identificar tabelas com colunas: Code | Description | Cause | Action
4. **Step 4: Specification Extraction** — Extrair specs técnicas das seções "Specifications" ou "Technical Data"
5. **Step 5: Normalization** — Mapear códigos para taxonomia canônica
6. **Step 6: Validation** — Verificar se códigos extraídos são consistentes com outros manuais da mesma série
7. **Step 7: Embedding + Vector Store** — Armazenar chunks do manual no Qdrant para RAG

### Recommended Tech Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| PDF Parsing | `docling`, `pymupdf`, `camelot-py` | Extrair tabelas e texto |
| Table Extraction | `docling` (table extraction) | Extrair tabelas de códigos de erro |
| OCR | `tesseract` | PDFs escaneados |
| NER/Extraction | `spaCy` + regex | Extrair model numbers, specs |
| Schema Validation | `Zod` / `jsonschema` | Validar metadata extraída |
| Vector Store | `Qdrant` | RAG sobre manuais |
| Embeddings | `nomic-embed-text` (768D) | Vetorização de chunks |
| Canonical DB | `PostgreSQL` + `OrchidORM` | Banco canônico de códigos |
| API | `tRPC` + `Fastify` | Interface do resolver |
| Frontend | `React` + `MUI` | UI de busca de códigos |

---

## 8. Summary Table: Brand Error Code Format Comparison

| Brand | Format Example | Pattern Regex | Len | Hierarchy | Unique Trait |
|-------|---------------|---------------|-----|-----------|--------------|
| Daikin | U4, E3, L5 | `^[A-Z][0-9]{1,2}$` | 2-3 | Letter = category, Number = specific | Most systematic; A=indoor, E=outdoor, U=refrigerant/comm |
| Mitsubishi Electric | P6, E6, L3 | `^[A-Z][0-9]{1,2}$` | 2-3 | Letter = category | P-series for protection/comm common |
| LG | CH 05, CH 21 | `^CH\s[0-9]{2}$` | 5 | "CH" prefix + number | "CH" = Check; single prefix for all codes |
| Samsung | E416, E201 | `^E[0-9]{3}$` or `^E1/[0-9]{2}$` | 3-5 | E prefix + 3 digits (VRF) or E1/ + 2 digits (split) | VRF uses 3-digit; splits use E1/subcategory |
| Fujitsu | E:E1, U:01 | `^[A-Z]:[A-Z0-9]{2}$` | 4 | Letter prefix = category, after colon = specific | Colon separator unique |
| Carrier | E1, P1, F1 | `^[A-Z][0-9]$` or `^[A-Z][0-9]{2}$` | 2-3 | Letter = category | Shared with Toshiba |
| Toshiba | E01, P01 | `^[A-Z][0-9]{2}$` | 3 | Letter = category, 2 digits | Carrier-Toshiba joint venture |
| Midea | E0, P0, F1 | `^[A-Z][0-9]$` or `^[A-Z][0-9]{2}$` | 2-3 | Letter = category | Similar to Carrier/Gree |
| Gree | E1, H1, F1 | `^[A-Z][0-9]$` | 2 | Letter = category | H-series common for defrost/protection |
| Springer | E1, E2, E3 | `^E[0-9]$` | 2 | E prefix + single digit | Simplified Carrier format for BR market |
| Panasonic | H11, F11 | `^[A-Z][0-9]{2}$` | 3 | H=indoor, F=outdoor | H/F split by unit location |
| Hitachi | 01, 02, P01 | `^[0-9]{2}$` or `^[A-Z][0-9]{2}$` | 2-3 | Minimal prefix; numeric dominant | Older systems use 2-digit numeric only |
| York | E1-E9 | `^E[0-9]$` | 2 | E prefix | Johnson Controls family |
| Trane | E01, E02 | `^E[0-9]{2}$` | 3 | E prefix + 2 digits | Ingersoll Rand family |

---

## 9. Sources & References

1. **AirNexus Fault Code Lookup** — https://www.airnexus.io/fault-codes (750+ codes, 15 brands)
2. **HVAC Toolkit Error Database** — https://hvactoolkit.org/resources/inverter-error-codes (502 codes)
3. **Mountain Mechanical VRF Guide** — https://mountainmechanicalny.com/vrf-systems/vrf-error-codes-guide/
4. **Daikin Global Error Codes** — https://www.daikin.com/products/ac/services/error_codes
5. **LG HVAC Technical Paper** — legacy.lghvac.com (Error Codes DFS-TP-AH-001-US)
6. **Samsung Error Codes** — https://appliancesissue.com/samsung-air-conditioner-error-codes/
7. **LG & Daikin Troubleshooting** — https://superiorhvacservice.ca/blog/air-conditioner/how-to-troubleshoot-common-lg-and-daikin-ac-error-codes/
8. **ASHRAE Standards** — https://www.ashrae.org/technical-resources/standards-and-guidelines
9. **HVAC VRF Lookup Tool** — https://srhvac.info/vrf-error-code-tool.html
10. **Wikipedia HVAC** — https://en.wikipedia.org/wiki/HVAC

---

*Relatório gerado para o projeto HVAC RAG do monorepo. Usar como referência para o schema `packages/zod-schemas` e o pipeline de extração de manuais.*
