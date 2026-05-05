# Docling e Extração Estruturada de Manuais Técnicos HVAC

> **Data:** 2026-05-05
> **Fonte:** Pesquisa em docling-project.github.io, arXiv:2408.09869, arXiv:2503.11576, LlamaIndex docs
> **Aplicação:** Pipeline de scraping HVAC (`/scraper` tool no monorepo)

---

## 1. Extração Estruturada de PDFs HVAC

### 1.1 Pipeline Básico com Docling

O Docling converte PDFs técnicos em um formato unificado (`DoclingDocument`) preservando layout, ordem de leitura, estrutura de tabelas e classificação de imagens.

```python
from docling.document_converter import DocumentConverter
from pathlib import Path

# Converter manual HVAC
converter = DocumentConverter()
result = converter.convert("manual_ar_condicionado.pdf")
doc = result.document

# Exportar para múltiplos formatos
markdown = doc.export_to_markdown()
html = doc.export_to_html()
json_doc = doc.export_to_dict()  # Lossless JSON
```

### 1.2 Extração de Elementos Específicos HVAC

Para manuais técnicos, os elementos críticos são:

| Elemento | Docling API | Uso HVAC |
|----------|-------------|----------|
| Tabelas de códigos de erro | `doc.tables` | Mapear `E1`, `F2` → descrição |
| Diagramas de fiação | `doc.pictures` | Identificar imagens técnicas |
| Especificações | `doc.texts` + `doc.tables` | Pressões, temperaturas, voltagens |
| Avisos/Warnings | `doc.texts` com labels | Segurança e precauções |

```python
# Iterar sobre todos os elementos do documento
for item in doc.iterate_items():
    print(f"Tipo: {item.label} | Página: {item.prov[0].page_no}")
    
# Filtrar apenas tabelas (onde estão os códigos de erro)
for i, table in enumerate(doc.tables):
    df = table.export_to_dataframe(doc=doc)
    print(f"Tabela {i}: {df.shape}")
    
# Filtrar imagens (diagramas de fiação)
for pic in doc.pictures:
    print(f"Imagem: {pic.self_ref} | Página: {pic.prov[0].page_no}")
```

### 1.3 Configurações Avançadas para PDFs Técnicos

Para PDFs escaneados ou com layout complexo:

```python
from docling.datamodel.document import ConversionStatus
from docling.datamodel.base_models import InputFormat
from docling.datamodel.document_conversion import PdfFormatOption
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions, 
    TesseractOcrOptions,
    TableFormerMode
)

# Pipeline com OCR forçado para manuais escaneados
pipeline_options = PdfPipelineOptions()
pipeline_options.do_ocr = True
pipeline_options.ocr_options = TesseractOcrOptions(lang=["por", "eng"])
pipeline_options.do_table_structure = True
pipeline_options.table_structure_options.mode = TableFormerMode.ACCURATE

converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
    }
)

result = converter.convert("manual_scan.pdf")
if result.status == ConversionStatus.SUCCESS:
    doc = result.document
```

---

## 2. Extração de Tabelas Técnicas com Docling

### 2.1 Exportação para DataFrames

O Docling extrai tabelas diretamente para `pandas.DataFrame`, ideal para tabelas de códigos de erro HVAC:

```python
import pandas as pd
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("manual_hvac.pdf")
doc = result.document

# Extrair todas as tabelas
for table_ix, table in enumerate(doc.tables):
    df: pd.DataFrame = table.export_to_dataframe(doc=doc)
    
    # Detectar se é tabela de códigos de erro
    if any(col.lower() in ['código', 'code', 'erro', 'error'] 
           for col in df.columns):
        df.to_csv(f"error_codes_table_{table_ix}.csv", index=False)
        print(f"Tabela de códigos de erro exportada: {table_ix}")
    
    # Detectar tabelas de especificações técnicas
    elif any(col.lower() in ['pressão', 'pressure', 'temperatura', 'temperature']
             for col in df.columns):
        df.to_json(f"specs_table_{table_ix}.json", orient='records')
```

### 2.2 Serialização de Tabelas para Markdown

Para RAG, tabelas em formato Markdown preservam estrutura semântica:

```python
from docling_core.transforms.chunker.hierarchical_chunker import (
    ChunkingDocSerializer,
    ChunkingSerializerProvider,
)
from docling_core.transforms.serializer.markdown import MarkdownTableSerializer

class MDTableSerializerProvider(ChunkingSerializerProvider):
    def get_serializer(self, doc):
        return ChunkingDocSerializer(
            doc=doc,
            table_serializer=MarkdownTableSerializer(),
        )

# Uso no chunker (ver seção 5)
chunker = HybridChunker(
    serializer_provider=MDTableSerializerProvider()
)
```

### 2.3 Exportação HTML para Preservação Visual

```python
for table_ix, table in enumerate(doc.tables):
    html_content = table.export_to_html(doc=doc)
    with open(f"table_{table_ix}.html", "w") as f:
        f.write(html_content)
```

---

## 3. Preservação da Estrutura do Documento

### 3.1 Hierarquia de Elementos no DoclingDocument

O Docling preserva a estrutura hierárquica do manual:

```
DoclingDocument
├── texts (parágrafos, headers, listas)
│   ├── label: DocItemLabel.SECTION_HEADER
│   ├── label: DocItemLabel.PARAGRAPH
│   └── label: DocItemLabel.LIST_ITEM
├── tables (tabelas técnicas)
│   ├── data (grid de células)
│   └── captions (legenda)
├── pictures (diagramas, fotos)
│   ├── prov (provenance: página, bbox)
│   └── annotations (classificação, descrição)
└── page_headers / page_footers
```

### 3.2 Acesso a Headers e Seções

```python
from docling_core.types.doc.labels import DocItemLabel

# Extrair todos os headers (para chunking por seção)
headers = []
for item in doc.texts:
    if item.label == DocItemLabel.SECTION_HEADER:
        headers.append({
            "text": item.text,
            "page": item.prov[0].page_no if item.prov else None,
            "level": item.level if hasattr(item, 'level') else 0
        })

# Mapear seções para páginas
sections = []
for i, header in enumerate(headers):
    section = {
        "title": header["text"],
        "start_page": header["page"],
        "end_page": headers[i+1]["start_page"] if i+1 < len(headers) else None
    }
    sections.append(section)
```

### 3.3 Preservação de Avisos e Warnings

```python
# Identificar avisos de segurança comuns em manuais HVAC
WARNING_KEYWORDS = ["aviso", "warning", "cuidado", "caution", 
                    "perigo", "danger", "importante", "important"]

warnings = []
for item in doc.texts:
    text_lower = item.text.lower()
    if any(kw in text_lower for kw in WARNING_KEYWORDS):
        warnings.append({
            "text": item.text,
            "page": item.prov[0].page_no if item.prov else None,
            "type": "warning"
        })
```

---

## 4. Pós-Processamento: Tabelas → JSON Estruturado

### 4.1 Schema para Códigos de Erro HVAC

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class ErrorCodeEntry(BaseModel):
    code: str = Field(description="Código de erro (ex: E1, F2, H3)")
    description: str = Field(description="Descrição do erro em português")
    possible_cause: Optional[str] = Field(None, description="Causa provável")
    solution: Optional[str] = Field(None, description="Procedimento de solução")
    severity: Optional[str] = Field(None, description="Gravidade: low/medium/high")

class ErrorCodeTable(BaseModel):
    manufacturer: str = Field(description="Fabricante do equipamento")
    model: Optional[str] = Field(None, description="Modelo específico")
    source_page: int = Field(description="Página do manual")
    errors: List[ErrorCodeEntry]
```

### 4.2 Pipeline de Extração Estruturada com Docling + Pydantic

O Docling possui um extrator de informações estruturadas (beta) baseado em VLM:

```python
from docling.datamodel.base_models import InputFormat
from docling.document_extractor import DocumentExtractor
from pydantic import BaseModel, Field

class HVACErrorCodes(BaseModel):
    code: str = Field(examples=["E1"])
    description: str = Field(examples=["Sensor de temperatura ambiente defeituoso"])
    action: str = Field(examples=["Substituir o sensor TH1"])

# Extrair de imagem ou PDF
extractor = DocumentExtractor(allowed_formats=[InputFormat.PDF, InputFormat.IMAGE])

result = extractor.extract(
    source="tabela_codigos_erro.pdf",
    template=HVACErrorCodes,
)

for page_data in result.pages:
    if page_data.extracted_data:
        error = HVACErrorCodes.model_validate(page_data.extracted_data)
        print(f"Código: {error.code} | Ação: {error.action}")
```

### 4.3 Conversão DataFrame → JSON Normalizado

```python
def parse_error_code_table(df: pd.DataFrame, manufacturer: str, page: int) -> dict:
    """Converte DataFrame de tabela de códigos de erro para JSON estruturado."""
    
    # Normalizar nomes de colunas
    df.columns = [col.lower().strip() for col in df.columns]
    
    # Mapear colunas comuns em manuais HVAC
    column_mapping = {
        'código': 'code',
        'code': 'code',
        'erro': 'code',
        'error': 'code',
        'descrição': 'description',
        'description': 'description',
        'causa': 'possible_cause',
        'cause': 'possible_cause',
        'solução': 'solution',
        'solution': 'solution',
        'ação': 'solution',
        'action': 'solution',
    }
    
    # Renomear colunas conhecidas
    rename_map = {k: v for k, v in column_mapping.items() if k in df.columns}
    df = df.rename(columns=rename_map)
    
    # Converter para lista de dicionários
    records = df.to_dict('records')
    
    return {
        "manufacturer": manufacturer,
        "source_page": page,
        "errors": records,
        "total_errors": len(records)
    }

# Uso
for table_ix, table in enumerate(doc.tables):
    df = table.export_to_dataframe(doc=doc)
    structured = parse_error_code_table(
        df, 
        manufacturer="Carrier",
        page=table.prov[0].page_no
    )
    
    with open(f"error_codes_table_{table_ix}.json", "w") as f:
        json.dump(structured, f, indent=2, ensure_ascii=False)
```

### 4.4 Validação e Limpeza de Dados Extraídos

```python
import re

def clean_error_code(code: str) -> str:
    """Normaliza códigos de erro: 'E1 ' → 'E1', 'F 2' → 'F2'."""
    code = re.sub(r'\s+', '', code.strip().upper())
    # Padrão HVAC típico: Letra + Número(s)
    if re.match(r'^[A-Z]\d+$', code):
        return code
    return code

def validate_temperature_range(value: str) -> Optional[float]:
    """Extrai valor numérico de temperatura de strings como '18-30°C'."""
    match = re.search(r'(\d+(?:\.\d+)?)\s*°?C', value)
    return float(match.group(1)) if match else None

def validate_pressure_range(value: str) -> Optional[float]:
    """Extrai valor de pressão de strings como '150-450 psi'."""
    match = re.search(r'(\d+(?:\.\d+)?)\s*psi', value.lower())
    return float(match.group(1)) if match else None
```

---

## 5. Estratégias de Chunking para Manuais Técnicos

### 5.1 Visão Geral dos Chunkers Nativos do Docling

| Chunker | Melhor Uso HVAC | Preserva Tabelas |
|---------|-----------------|------------------|
| `HierarchicalChunker` | Por elemento (tabela, parágrafo) | Sim, 1 tabela/chunk |
| `HybridChunker` | RAG com contexto de seção | Sim, com repetição de header |
| `LineBasedTokenChunker` | Código, logs, listas técnicas | Sim, por linha |

### 5.2 Chunking por Seção (Recomendado para HVAC)

Preserva o contexto do capítulo/tópico:

```python
from docling.chunking import HybridChunker
from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
from transformers import AutoTokenizer

# Tokenizer alinhado com modelo de embedding
EMBED_MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
tokenizer = HuggingFaceTokenizer(
    tokenizer=AutoTokenizer.from_pretrained(EMBED_MODEL_ID),
    max_tokens=512,
)

chunker = HybridChunker(
    tokenizer=tokenizer,
    merge_peers=True,  # Mesclar chunks pequenos do mesmo contexto
)

# Gerar chunks
chunks = list(chunker.chunk(dl_doc=doc))

for i, chunk in enumerate(chunks):
    # Texto enriquecido com contexto (headers)
    contextualized = chunker.contextualize(chunk=chunk)
    
    print(f"Chunk {i}:")
    print(f"  Tokens: {tokenizer.count_tokens(contextualized)}")
    print(f"  Itens: {[it.label for it in chunk.meta.doc_items]}")
    print(f"  Preview: {contextualized[:200]}...")
```

### 5.3 Chunking de Tabelas com Repetição de Headers

Crítico para tabelas de códigos de erro que excedem o limite de tokens:

```python
from docling_core.transforms.serializer.markdown import MarkdownParams, MarkdownTableSerializer

class HVACTableSerializerProvider(ChunkingSerializerProvider):
    def get_serializer(self, doc):
        return ChunkingDocSerializer(
            doc=doc,
            table_serializer=MarkdownTableSerializer(),
            params=MarkdownParams(compact_tables=True),
        )

# Chunker com repetição de header para tabelas largas
chunker = HybridChunker(
    tokenizer=tokenizer,
    repeat_table_header=True,        # Repetir headers em cada chunk
    omit_header_on_overflow=False,   # Manter header mesmo se estourar tokens
    serializer_provider=HVACTableSerializerProvider(),
)

# Resultado: cada chunk de tabela começa com o header
# | Código | Descrição | Causa | Solução |
# | E1 | Sensor defeituoso | ... | ... |
```

### 5.4 Chunking por Tópico Técnico

Estratégia customizada para manuais HVAC:

```python
def chunk_by_hvac_topic(doc):
    """Divide manual HVAC por tópicos técnicos identificados."""
    
    TOPIC_KEYWORDS = {
        "error_codes": ["código de erro", "error code", "diagnóstico", "troubleshooting"],
        "wiring": ["diagrama de fiação", "wiring diagram", "circuito elétrico"],
        "specs": ["especificações", "specifications", "dados técnicos", "technical data"],
        "pressure": ["pressão", "pressure", "psi", "bar"],
        "temperature": ["temperatura", "temperature", "°c", "°f"],
        "safety": ["segurança", "safety", "aviso", "warning", "perigo", "danger"],
    }
    
    topic_chunks = {k: [] for k in TOPIC_KEYWORDS}
    topic_chunks["general"] = []
    
    for chunk in chunker.chunk(dl_doc=doc):
        text = chunk.text.lower()
        assigned = False
        
        for topic, keywords in TOPIC_KEYWORDS.items():
            if any(kw in text for kw in keywords):
                topic_chunks[topic].append(chunk)
                assigned = True
                break
        
        if not assigned:
            topic_chunks["general"].append(chunk)
    
    return topic_chunks

# Uso
chunks_by_topic = chunk_by_hvac_topic(doc)
for topic, chunks in chunks_by_topic.items():
    print(f"{topic}: {len(chunks)} chunks")
```

### 5.5 Chunking por Código de Erro (Granularidade Máxima)

Para RAG especializado em diagnóstico:

```python
def chunk_by_error_code(doc, manufacturer: str, model: str):
    """Cria um chunk por código de erro com metadados enriquecidos."""
    
    error_chunks = []
    
    for table in doc.tables:
        df = table.export_to_dataframe(doc=doc)
        df.columns = [c.lower().strip() for c in df.columns]
        
        # Detectar coluna de código
        code_col = None
        for possible in ['código', 'code', 'erro', 'error']:
            if possible in df.columns:
                code_col = possible
                break
        
        if not code_col:
            continue
        
        for _, row in df.iterrows():
            code = str(row[code_col]).strip().upper()
            
            # Criar texto enriquecido para embedding
            chunk_text = f"""Código de Erro: {code}
Fabricante: {manufacturer}
Modelo: {model}
"""
            for col in df.columns:
                if col != code_col:
                    chunk_text += f"{col.capitalize()}: {row[col]}\n"
            
            error_chunks.append({
                "text": chunk_text,
                "metadata": {
                    "type": "error_code",
                    "code": code,
                    "manufacturer": manufacturer,
                    "model": model,
                    "page": table.prov[0].page_no if table.prov else None,
                }
            })
    
    return error_chunks
```

### 5.6 Integração com Qdrant para RAG

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import uuid

client = QdrantClient(host="localhost", port=6333)

# Criar coleção para manuais HVAC
client.create_collection(
    collection_name="hvac_manuals",
    vectors_config=VectorParams(size=384, distance=Distance.COSINE),
)

# Preparar pontos para upsert
points = []
for chunk in chunks:
    # Gerar embedding (usando modelo local via Ollama ou sentence-transformers)
    embedding = embed_model.encode(chunker.contextualize(chunk))
    
    # Extrair metadados dos doc_items
    doc_items = chunk.meta.doc_items
    page_no = doc_items[0].prov[0].page_no if doc_items and doc_items[0].prov else None
    
    points.append(PointStruct(
        id=str(uuid.uuid4()),
        vector=embedding.tolist(),
        payload={
            "text": chunk.text,
            "contextualized": chunker.contextualize(chunk),
            "page": page_no,
            "doc_items": [it.label for it in doc_items],
            "source": "manual_hvac.pdf"
        }
    ))

client.upsert(collection_name="hvac_manuals", points=points)
```

---

## 6. Pipeline Completo: PDF HVAC → Qdrant

```python
import json
import uuid
from pathlib import Path
from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker
from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
from transformers import AutoTokenizer
import pandas as pd
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

class HVACDocumentProcessor:
    def __init__(self, embed_model_id="sentence-transformers/all-MiniLM-L6-v2"):
        self.converter = DocumentConverter()
        self.tokenizer = HuggingFaceTokenizer(
            tokenizer=AutoTokenizer.from_pretrained(embed_model_id),
            max_tokens=512,
        )
        self.chunker = HybridChunker(
            tokenizer=self.tokenizer,
            repeat_table_header=True,
        )
        self.qdrant = QdrantClient(host="localhost", port=6333)
    
    def process_manual(self, pdf_path: str, manufacturer: str, model: str):
        """Pipeline completo: PDF → estruturado → chunked → Qdrant."""
        
        # 1. Converter PDF
        result = self.converter.convert(pdf_path)
        doc = result.document
        
        # 2. Extrair tabelas de códigos de erro para JSON
        error_tables = []
        for table in doc.tables:
            df = table.export_to_dataframe(doc=doc)
            if self._is_error_code_table(df):
                error_tables.append({
                    "page": table.prov[0].page_no if table.prov else None,
                    "data": df.to_dict('records')
                })
        
        # Salvar JSON estruturado
        output_dir = Path("extracted") / manufacturer / model
        output_dir.mkdir(parents=True, exist_ok=True)
        
        with open(output_dir / "error_codes.json", "w") as f:
            json.dump({
                "manufacturer": manufacturer,
                "model": model,
                "tables": error_tables
            }, f, indent=2, ensure_ascii=False)
        
        # 3. Chunking híbrido
        chunks = list(self.chunker.chunk(dl_doc=doc))
        
        # 4. Preparar pontos para Qdrant
        points = []
        for chunk in chunks:
            # Aqui você usaria seu modelo de embedding
            # embedding = self.embed_model.encode(...)
            
            points.append(PointStruct(
                id=str(uuid.uuid4()),
                vector=[0.0] * 384,  # Placeholder - substituir por embedding real
                payload={
                    "text": chunk.text,
                    "context": self.chunker.contextualize(chunk),
                    "manufacturer": manufacturer,
                    "model": model,
                    "page": chunk.meta.doc_items[0].prov[0].page_no if chunk.meta.doc_items else None,
                }
            ))
        
        # 5. Upsert no Qdrant
        self.qdrant.upsert(
            collection_name="hvac_service_manuals",
            points=points
        )
        
        return {
            "chunks": len(points),
            "error_tables": len(error_tables),
            "pages": len(doc.pages)
        }
    
    def _is_error_code_table(self, df: pd.DataFrame) -> bool:
        """Heurística para detectar tabelas de códigos de erro."""
        cols = [c.lower() for c in df.columns]
        return any(k in cols for k in ['código', 'code', 'erro', 'error'])

# Uso
processor = HVACDocumentProcessor()
result = processor.process_manual(
    pdf_path="manual_springer_12000.pdf",
    manufacturer="Springer",
    model="Maxiflex 12000 BTU"
)
print(f"Processado: {result}")
```

---

## 7. Referências e Recursos

### Documentação Oficial Docling
- [Docling GitHub](https://github.com/docling-project/docling) — 59.2k stars
- [Documentação](https://docling-project.github.io/docling/)
- [Exemplo: Export Tables](https://docling-project.github.io/docling/examples/export_tables/)
- [Exemplo: Hybrid Chunking](https://docling-project.github.io/docling/examples/hybrid_chunking/)
- [Conceito: Chunking](https://docling-project.github.io/docling/concepts/chunking/)
- [Exemplo: Advanced Chunking & Serialization](https://docling-project.github.io/docling/examples/advanced_chunking_and_serialization/)

### Papers Acadêmicos
- [arXiv:2408.09869](https://arxiv.org/abs/2408.09869) — Docling Technical Report
- [arXiv:2503.11576](https://arxiv.org/abs/2503.11576) — SmolDocling (VLM ultra-compacto)

### Integrações com RAG
- [Docling + Qdrant](https://docling-project.github.io/docling/examples/retrieval_qdrant/)
- [Docling + LlamaIndex](https://docling-project.github.io/docling/examples/rag_llamaindex/)
- [Docling + LangChain](https://docling-project.github.io/docling/examples/rag_langchain/)

---

## 8. Checklist de Implementação

- [ ] Instalar Docling: `pip install docling pandas`
- [ ] Configurar pipeline com OCR para manuais escaneados
- [ ] Implementar detecção heurística de tabelas de códigos de erro
- [ ] Definir schema Pydantic para `ErrorCodeEntry`
- [ ] Configurar `HybridChunker` com `repeat_table_header=True`
- [ ] Alinhar tokenizer do chunker com modelo de embedding
- [ ] Implementar pipeline de pós-processamento: DataFrame → JSON
- [ ] Criar coleção Qdrant com metadados de fabricante/modelo/página
- [ ] Validar chunks contextualizados antes de upsert
- [ ] Testar retrieval com queries em português: "ar condicionado código E1"
