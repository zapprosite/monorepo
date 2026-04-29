---
name: PDF Parser Usage Guide
description: Como usar o PDFParser para extrair texto de manuais de serviço HVAC
type: guide
---

# PDF Parser

Guia de uso do `PDFParser` para extrair texto de manuais de serviço HVAC.

## Visao Geral

O `PDFParser` usa [MuPDF](https://www.artifex.com/mupdf/) (`github.com/ArtifexSoftware/mupdf-go/mupdf`) para extrair texto de PDFs. Suppriado por `internal/rag/parser/pdf.go`.

**Contexto:** Faz parte do pipeline RAG para manuais HVAC (SPEC-026, SPEC-031). Usa `DetectSectionsFromText` em `internal/rag/parser/sections.go` para identificar secoes (ERROR_CODES, SPECS, TROUBLESHOOTING, etc).

## Estrutura do Parser

```go
// internal/rag/parser/pdf.go

type PDFParser struct {
    document *mupdf.Document  // documento MuPDF interno
    filePath string          // caminho do arquivo PDF
}
```

### Metodos Principais

| Metodo | Descricao |
|--------|-----------|
| `NewPDFParser(filePath string)` | Cria novo parser, abre arquivo |
| `Open()` | Abre o PDF (pode ser chamado novamente apos Close) |
| `Close()` | Libera recursos |
| `PageCount() int` | Retorna numero total de paginas |
| `ExtractText(pageNum int) string` | Extrai texto de pagina especifica (0-indexed) |
| `ExtractAllText() []string` | Extrai texto de todas as paginas |
| `ExtractTextConcat() string` | Extrai e concatena todo texto em uma string |

## Uso Basico

### 1. Criar Parser e Extrair Texto

```go
// Abrir PDF e extrair todas as paginas
parser, err := parser.NewPDFParser("/path/to/manual.pdf")
if err != nil {
    log.Fatalf("falha ao abrir PDF: %v", err)
}
defer parser.Close()

// Extrair texto de uma pagina especifica
text := parser.ExtractText(0) // primeira pagina
fmt.Println(text)

// Extrair todas as paginas
allPages := parser.ExtractAllText()
for i, pageText := range allPages {
    fmt.Printf("Pagina %d: %s\n", i, pageText)
}

// Extrair todo texto concatenado
fullText := parser.ExtractTextConcat()
```

### 2. Extrair Secoes do Manual

```go
// Detectar secoes do manual
pages := parser.ExtractAllText()
sections := parser.DetectSectionsFromText(pages)

fmt.Printf("Total de paginas: %d\n", sections.TotalPages)
for _, s := range sections.Sections {
    fmt.Printf("Secao: %s (paginas %d-%d, confianca: %.2f)\n",
        s.Type, s.StartPage, s.EndPage, s.Confidence)
}
```

### 3. Chunking de Conteudo

```go
// Configurar chunking por tipo de conteudo
chunker := rag.NewChunker()

// Chunking de tabela de erros (512 tokens, overlap 50)
errorCodeChunks := chunker.ChunkErrorCodeTable(errorCodeText, map[string]string{
    "brand":      "springer",
    "model":      "xtreme_save_connect",
    "btu":        "12000",
    "error_code": "E8",
})

// Chunking de especificacoes (1024 tokens, overlap 150)
specChunks := chunker.ChunkDocument(specText, "spec", map[string]string{
    "brand": "midea",
    "model": "airvolution",
})
```

## Casos de Uso Comuns

### Caso 1: Indexar Manual Completo

```go
func IndexManual(filePath string) ([]rag.ChunkResult, error) {
    parser, err := parser.NewPDFParser(filePath)
    if err != nil {
        return nil, fmt.Errorf("abrir PDF: %w", err)
    }
    defer parser.Close()

    pages := parser.ExtractAllText()
    sections := parser.DetectSectionsFromText(pages)

    chunks := make([]rag.ChunkResult, 0)
    for _, section := range sections.Sections {
        // Extrair texto da secao
        var sectionText string
        for i := section.StartPage; i <= section.EndPage; i++ {
            if i < len(pages) {
                sectionText += pages[i] + "\n"
            }
        }

        // Chunking baseado no tipo de secao
        config := chunker.GetConfig(section.Type)
        sectionChunks := chunker.ChunkDocument(sectionText, section.Type, map[string]string{
            "brand":  extractBrand(filePath),
            "model":  extractModel(filePath),
            "btu":    extractBTU(filePath),
            "section": section.Type,
        })
        chunks = append(chunks, sectionChunks...)
    }

    return chunks, nil
}
```

### Caso 2: Buscar Codigos de Erro

```go
func ExtractErrorCodesFromPDF(filePath string) ([]string, error) {
    parser, err := parser.NewPDFParser(filePath)
    if err != nil {
        return nil, err
    }
    defer parser.Close()

    text := parser.ExtractTextConcat()
    codes := rag.ExtractErrorCodes(text) // usa regex patterns
    return codes, nil
}
```

### Caso 3: Verificacao Visual com qwen2.5-vl

```go
func VerifyManualVisual(filePath string) (*rag.ValidationResult, error) {
    verifier := rag.NewVerifier()

    // Converter primeira pagina para imagem
    result, err := verifier.VerifyFromFile(context.Background(), filePath)
    if err != nil {
        return nil, fmt.Errorf("verificacao: %w", err)
    }

    if result.DocumentType != "service_manual" {
        return nil, fmt.Errorf("documento nao e manual de servico: %s", result.DocumentType)
    }

    return result, nil
}
```

## Tratamento de Erros

### Padroes de Erro

| Erro | Causa | Solucao |
|------|-------|---------|
| `pdf: file path is empty` | Caminho vazio | Verificar path passado |
| `pdf: cannot open file %s: %w` | Arquivo nao existe ou sem permissao | Verificar arquivo |
| `pdf: failed to open document: %w` | PDF corrompido ou nao suportado | Tentar outro conversor |
| pagina fora de range | PageNum invalido | Validar antes de extrair |

### Exemplo de Tratamento

```go
parser, err := parser.NewPDFParser("/path/to/manual.pdf")
if err != nil {
    switch {
    case strings.Contains(err.Error(), "file path is empty"):
        // Log: caminho vazio
        return fmt.Errorf("caminho do arquivo e obrigatorio")
    case strings.Contains(err.Error(), "cannot open file"):
        // Log: arquivo nao encontrado
        return fmt.Errorf("arquivo nao encontrado: %s", filePath)
    case strings.Contains(err.Error(), "failed to open document"):
        // Tentar conversao via pdftoppm
        return tryPdftoppmFallback(filePath)
    default:
        return fmt.Errorf("erro inesperado: %w", err)
    }
}
defer parser.Close()
```

### Verificacao de Seguranca

```go
// Verificar antes de abrir
func safeOpenPDF(filePath string) (*parser.PDFParser, error) {
    // Validar extensao
    if filepath.Ext(filePath) != ".pdf" {
        return nil, fmt.Errorf("arquivo deve ser PDF")
    }

    // Verificar existencia
    if _, err := os.Stat(filePath); err != nil {
        return nil, fmt.Errorf("arquivo nao existe: %w", err)
    }

    // Verificar tamanho (max 100MB)
    info, _ := os.Stat(filePath)
    if info.Size() > 100*1024*1024 {
        return nil, fmt.Errorf("arquivo muito grande (>100MB)")
    }

    return parser.NewPDFParser(filePath)
}
```

## Secoes Detectaveis

| Secao | Keywords | Padrao Regex |
|-------|----------|-------------|
| `ERROR_CODES` | ERROR, CODIGO DE ERRO, FAULT CODE | `error.*code?` |
| `SPECS` | ESPECIFICACAO, CAPACIDADE, BTU | `specif\|caracter\|btu` |
| `INSTALLATION` | INSTALACAO, MONTAGEM, WARNING | `instal\|preca\|warning` |
| `TROUBLESHOOTING` | TROUBLESHOOT, PROBLEMA, SOLUCAO | `troubleshoot\|proble\|defeit` |
| `DIAGNOSTIC` | DIAGNOSTICO, TESTE, MEDICAO | `diagnost\|teste\|medi` |
| `WIRING` | FIACAO, CIRCUITO, ESQUEMA | `wiring\|fiao\|circuit\|diagrama` |
| `MAINTENANCE` | MANUTENCAO, LIMPEZA, FILTRO | `mainten\|manut\|filtro` |

## Performance

### Benchmarks Estimados

| Operacao | Tempo | Memoria |
|---------|-------|---------|
| Abrir PDF | 50-200ms | ~1MB por documento |
| Extrair pagina | 5-20ms | depends  size |
| Extrair todas | 100-500ms por pagina | ~10MB para 100 paginas |
| Detectar secoes | 20-50ms | O(n) no texto |

### Dicas de Performance

1. **Reuse Parser**: Nao recriar parser para cada pagina
2. **Close quando nao usado**: Libera recursos MuPDF
3. **Parallelize/pages**: Para multiplos PDFs, usar goroutines
4. **Cache sections**: Detectar secoes uma vez, reutilizar

```go
// Paralelo: processar multiplos PDFs
func processPDFs(paths []string) <-chan Result {
    results := make(chan Result, len(paths))

    var wg sync.WaitGroup
    for _, path := range paths {
        wg.Add(1)
        go func(p string) {
            defer wg.Done()
            parser, err := parser.NewPDFParser(p)
            if err != nil {
                results <- Result{Error: err}
                return
            }
            // processar...
            parser.Close()
            results <- Result{Chunks: chunks}
        }(path)
    }

    go func() {
        wg.Wait()
        close(results)
    }()

    return results
}
```

## Comparacao: mupdf vs pdftoppm

| Aspecto | mupdf | pdftoppm |
|---------|-------|----------|
| **Biblioteca Go** | Sim (`mupdf-go`) | Nao (CLI externa) |
| **Dependencias externas** | Nenhuma | poppler-utils |
| **Velocidade** | Mais rapido (~50-200ms) | Mais lento (~200-500ms) |
| **Qualidade do texto** | Excelente (preserva estrutura) | Bom (imagem) |
| **Extraction de tabelas** | Sim | Nao (precisa OCR) |
| **Memoria** | ~1MB por PDF | ~10MB por conversao |
| **Instalacao** | `go get` | `apt install poppler-utils` |
| **Windows** | Compativel | Nao (native) |
| **Uso em RAG** | **Recomendado** (texto direto) | So para visualização |

### Quando Usar Cada Um

**mupdf (RECOMENDADO para extracao de texto):**
- Indexacao de manuais para RAG
- Extracao de codigos de erro
- Chunking semantico
- Pipeline de busca

**pdftoppm (para visualizacao):**
- Geracao de previews
- Verificacao visual via qwen2.5-vl
- Renderizacao de diagramas
- Quando mupdf falha

### Fallback no Verifier

O `rag/verifier.go` implementa fallback automatico:

```go
// pdfPageToImage tenta pdftoppm primeiro, depois mupdf, depois ghostscript
func (v *Verifier) pdfPageToImage(pdfPath string) (string, error) {
    if _, err := exec.LookPath("pdftoppm"); err == nil {
        // Usa pdftoppm
        return v.pdfToImagePdftoppm(pdfPath)
    }
    if _, err := exec.LookPath("mutool"); err == nil {
        // Usa mupdf/mutool
        return v.pdfToImageMuPDF(pdfPath)
    }
    if _, err := exec.LookPath("gs"); err == nil {
        // Usa ghostscript
        return v.pdfToImageGhostscript(pdfPath)
    }
    return "", fmt.Errorf("nenhum conversor disponivel")
}
```

## Estrutura de Arquivos

```
internal/rag/parser/
├── pdf.go           # PDFParser (mupdf)
├── pdf_test.go      # Testes unitarios
├── sections.go      # DetectSectionsFromText + Section types
└── errorcode.go     # ErrorCode + BrandErrorCodes database

internal/rag/
├── chunker.go       # Semantic chunking
├── verifier.go      # qwen2.5-vl visual verification
├── refiner.go       # Response refinement (SPEC-031)
└── whitelist.go     # Model whitelist/blacklist

docs/guides/
└── pdf-parser-usage.md  # Este guia
```

## Dependencies

```bash
go get github.com/ArtifexSoftware/mupdf-go/mupdf
```

**Versao:** `github.com/ArtifexSoftware/mupdf-go v0.0.0-xxx`

## Troubleshooting

### "failed to open document" com PDF valido
- PDF pode estar corrompido ou criptografado
- Tentar: `mutool clean input.pdf output.pdf`
- Verificar: PDF nao e scanned image (precisa OCR)

### Texto extraido vazio ou com caracteres estranhos
- PDF pode ser imagem escaneada (nao texto)
- Solucao: usar OCR (Tesseract) ou verificacao via qwen2.5-vl
- Verificar se PDF tem texto embedado (nao outlines)

### Memory leak em PDFs grandes
- Sempre chamar `parser.Close()` com defer
- Para PDFs muito grandes (>100 paginas): processar em batches
- MuPDF libera memoria no Close()

---

**Authority:** will
**Created:** 2026-04-12
