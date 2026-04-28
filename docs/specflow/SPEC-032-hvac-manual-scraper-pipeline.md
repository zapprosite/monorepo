---
name: SPEC-032 HVAC Manual Scraper + Qdrant Indexing Pipeline
description: CLI tool para baixar, processar e indexar manuais de serviço HVAC no Qdrant via scraper com browser automation (Rod + Playwright), CAPTCHA/robots.txt restrições, usando fontes legais (fabricantes + GitHub)
type: specification
---

# SPEC-032: HVAC Manual Scraper + Qdrant Indexing Pipeline

**Status:** DRAFT
**Created:** 2026-04-12
**Author:** will
**Related:** SPEC-026, SPEC-031
**Priority:** HIGH

---

## 1. Objective

Criar pipeline CLI que:
1. **Baixa** manuais PDF de fontes legais (fabricantes + GitHub público)
2. **Processa** texto + tables (híbrido Go + Python OpenDataLoader)
3. **Indexa** chunks no Qdrant (nomic-embed-text 768D)

**FONTES LEGAIS:**
- GitHub: coolfix/errorCodes.json, hvac-troubleshoot-pro
- Fabricantes diretos: LG, Samsung, Daikin, Springer, Midea (sem CAPTCHA)
- NÃO ManualsLib (reCAPTCHA v3 + robots.txt bloqueia)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCRAPER LAYER (Go + Playwright)              │
│  sources.yaml → CLI scrape → Rod browser → PDF download       │
│  └──: ManualsLib (bloqueado)                               │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EXTRACTION LAYER (Hybrid Go + Python)       │
│  Go: ledongthuc/pdf (text)                                     │
│  Python: OpenDataLoader docling-fast (tables)                  │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CHUNKING LAYER (Go)                          │
│  internal/rag/chunker.go → ChunkFromPDF() → []ChunkResult     │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    INDEXING LAYER (Go)                          │
│  nomic-embed-text (Ollama 768D) → Qdrant upsert                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Stack Selection

### Research Results (12 agents executed)

| Library | Benchmark | Decision |
|---------|-----------|----------|
| Rod (go-rod/rod) | **94.45** | ✅ PRIMARY — MustPDF, auto-wait, cookie management |
| chromedp | 85.2 | ✅ FALLBACK — PrintToPDF, fine-grained CDP |
| Playwright Node.js | CLI tool | ✅ AUXILIAR — PDF download events |
| Scrapy Playwright | HIGH | ✅ PYTHON — batch scraping with proxy rotation |
| ledongthuc/pdf | 83.6 | ✅ TEXT — current hvacr-swarm implementation |
| OpenDataLoader | Best table | ⚠️ HYBRID — Python docling-fast for tables |

### ManualsLib BLOCKED

```
robots.txt: Disallow: /download/
reCAPTCHA v3 on download modal
ClaudeBot: Disallow: /
```

**VERDICT:** Não usar ManualsLib. Usar fontes legais.

---

## 4. CLI Tool: `cmd/manual-scraper/main.go`

### Usage

```bash
# Download single manual
./manual-scraper scrape --url "https://lg.com/br/suporte/manual/abc123"

# Batch from sources.yaml
./manual-scraper batch --config sources.yaml

# Process local PDFs
./manual-scraper process --input ./pdfs/ --output ./indexed/

# Full pipeline
./manual-scraper pipeline --sources lg,samsung,springer --limit 10
```

### flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--url` | string | "" | Single URL to scrape |
| `--config` | string | "" | YAML with source definitions |
| `--output` | string | "./data/manuals" | Download directory |
| `--headless` | bool | true | Run browser headless |
| `--rate-limit` | duration | 2s | Delay between requests |
| `--max` | int | 0 | Max downloads (0 = unlimited) |

---

## 5. Sources Configuration (sources.yaml)

```yaml
sources:
  - name: "lg_brazil"
    url: "https://www.lg.com/br/suporte/manuais"
    brand: "lg"
    type: "split"
    selectors:
      model_list: ".model-list a"
      manual_link: "a[href$='.pdf']"
      login_required: false

  - name: "samsung_brazil"
    url: "https://www.samsung.com/br/support/manuals/"
    brand: "samsung"
    type: "split"
    selectors:
      model_list: ".product-list a"
      manual_link: "a[href$='.pdf']"
      login_required: false

  - name: "springer_midea"
    url: "https://www.springer.com.br/suporte/"
    brand: "springer"
    type: "split"
    selectors:
      model_list: ".produtos a"
      manual_link: "a[href$='.pdf']"
      login_required: false

  - name: "github_coolfix"
    type: "github"
    repo: "hysenmuhamad/coolfix"
    path: "errorCodes.json"
    brand: "universal"

  - name: "github_hvac_pro"
    type: "github"
    repo: "Huskyauto/hvac-troubleshoot-pro"
    path: "database/"
    brand: "universal"
```

---

## 6. Scraping Flow (Rod)

### Phase 1: Browser Setup

```go
browser := rod.New().
    MustConnect().
    NoSlowPage().
    Slow(100 * time.Millisecond)

browser.MustSetCookiesCookies(
    &proto.NetworkCookieParam{Name: "session", Value: "xxx", Domain: ".lg.com"},
)
```

### Phase 2: Navigation + PDF Download

```go
page := browser.MustPage(sourceURL)

// Wait for model list to render
page.MustWaitLoad().MustWaitSelector(".model-list", nil)

// Iterate model links
page.MustElements(".model-list a").MustEach(func(e *rod.Element) {
    href, _ := e.Attribute("href")
    if strings.HasSuffix(href, ".pdf") {
        downloadPDF(href, brand, model)
    }
})

// OR use download event for JS-rendered links
const [download] := await Promise.all([
    page.WaitForEvent("download"),
    page.Click("a.download-btn"),
])
await download.SaveAs(filepath)
```

### Phase 3: Rate Limiting

```go
// Respect rate limits to avoid being blocked
page.Route("*", func(r *rod.Route) {
    lastRequest.Lock()
    defer lastRequest.Unlock()
    
    elapsed := time.Since(lastRequest.Time)
    if elapsed < rateLimit {
        time.Sleep(rateLimit - elapsed)
    }
    lastRequest.Time = time.Now()
    r.Continue()
})
```

---

## 7. PDF Extraction (Hybrid Go + Python)

### Text Extraction (Go — existing)

```go
// internal/rag/parser/pdf.go — already uses ledongthuc/pdf
pdfParser, _ := parser.NewPDFParser(pdfPath)
pages := pdfParser.ExtractAllText()
fullText := strings.Join(pages, "\n\n")
```

### Table Extraction (Python — OpenDataLoader)

```bash
# Install docling
pip install docling[fast]

# Extract tables to JSON
docling.convert(
    source=pdf_path,
    format_options={"format": "json", "tables": {"mode": "fast"}}
)
```

**Output:**
```json
{
  "tables": [
    {
      "content": "| Code | Description | Cause | Solution |",
      "bbox": [x1, y1, x2, y2],
      "page": 3
    }
  ]
}
```

### Integration with hvacr-swarm

```
Go orchestrator (cmd/manual-scraper)
    ↓ calls Python subprocess
Python docling-fast → JSON tables
    ↓ reads JSON
Go chunker → []ChunkResult with table metadata
    ↓ embeds
Ollama nomic-embed-text (768D)
    ↓ upserts
Qdrant hvacr_knowledge
```

---

## 8. Indexing Pipeline

### Flow

```
PDF → ExtractText (Go) → ChunkDocument() → Embed (Ollama 768D) → Qdrant upsert
    ↓
ExtractTables (Python) → JSON → ChunkResult → Embed → Qdrant upsert
```

### Qdrant Collection Schema

```json
{
  "id": "springer_xtreme_e8_001",
  "vector": [0.123...],  // 768D from nomic-embed-text
  "payload": {
    "brand": "springer",
    "model": "Xtreme Save Connect",
    "type": "split_inverter",
    "error_code": "E8",
    "section": "ERROR_CODES",
    "source": "lg_brazil",
    "is_verified": true,
    "content_type": "manual|table",
    "page_ref": 47,
    "language": "pt-BR"
  }
}
```

---

## 9. Sources Legal Analysis

### ✅ ALLOWED (Legal Sources)

| Source | Type | Access | Notes |
|--------|------|--------|-------|
| LG Brazil | Manufacturer | Public (no CAPTCHA on manuals) | https://www.lg.com/br/suporte/manuais |
| Samsung Brazil | Manufacturer | Public (no CAPTCHA) | https://www.samsung.com/br/support/manuals/ |
| Daikin Brazil | Manufacturer | Public | https://www.daikin.com.br/suporte/ |
| Springer/Midea | Manufacturer | Public | https://www.springer.com.br/suporte/ |
| GitHub: coolfix | Open source | Public | errorCodes.json + manuals |
| GitHub: hvac-troubleshoot-pro | Open source | Public | database schema + content |

### ❌ BLOCKED (Do Not Use)

| Source | Blocked By | Reason |
|--------|------------|--------|
| ManualsLib | robots.txt + reCAPTCHA | `/download/` disallowed, ClaudeBot blocked |
| Scribd | Paywall | Requires subscription |
| HVAC-Talk | Login required | $99/ano subscription |

---

## 10. Error Handling

| Error | Handling |
|-------|----------|
| CAPTCHA detected | Skip, log URL, continue |
| Login required | Skip, mark as `login_required: true` in config |
| Rate limited (429) | Exponential backoff: 1s → 2s → 4s → 8s |
| PDF corrupt | Log error, skip file, continue batch |
| Network timeout | Retry 3x with 5s delay |
| Chrome crash | Restart browser, resume from last URL |

---

## 11. Files to Create

| File | Purpose |
|------|---------|
| `cmd/manual-scraper/main.go` | CLI entry point |
| `cmd/manual-scraper/sources.go` | Source config loading |
| `cmd/manual-scraper/scraper/rod.go` | Rod browser automation |
| `cmd/manual-scraper/scraper/download.go` | PDF download logic |
| `cmd/manual-scraper/extractor/python.go` | Python OpenDataLoader wrapper |
| `cmd/manual-scraper/indexer/qdrant.go` | Qdrant upsert logic |
| `sources.yaml` | Source definitions |
| `scripts/install-deps.sh` | Install chromium, python deps |

---

## 12. Dependencies

### Go modules

```go
require (
    github.com/go-rod/rod v0.114.0
    github.com/qdrant/go-client/v2 v2.1.0
    github.com/will-zappro/hvacr-swarm/internal/rag v0.0.0
)
```

### System dependencies

```bash
# Chrome/Chromium for Rod
apt-get install -y chromium-browser

# Python for docling
pip install docling[fast]

# Playwright for auxiliary scraping (optional)
npx playwright install --with-deps
```

---

## 13. Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Download 10 PDFs from LG Brazil sem CAPTCHA | Manual test |
| AC-2 | Extract text from PDF (500+ pages) sem erro | `go test ./cmd/manual-scraper/...` |
| AC-3 | Extract table structure (error codes) preserved | Compare table output vs source |
| AC-4 | Index to Qdrant with 768D vectors (nomic) | `curl qdrant:6333/collections/hvac_service_manuals/points?limit=5` |
| AC-5 | RAG query returns indexed content | Query "Springer E8" → relevant chunks |
| AC-6 | ManualsLib correctly skipped | Log shows "SKIP: blocked by robots.txt" |

---

## 14. Roadmap

### Phase 1: Core Scraper (1 dia)
- [ ] cmd/manual-scraper with Rod browser
- [ ] sources.yaml for LG, Samsung, Springer
- [ ] PDF download without CAPTCHA

### Phase 2: Processing (1 dia)
- [ ] Text extraction (ledongthuc/pdf)
- [ ] Table extraction (Python docling)
- [ ] Go + Python integration

### Phase 3: Indexing (1 dia)
- [ ] Ollama nomic-embed-text integration
- [ ] Qdrant upsert pipeline
- [ ] ChunkFromPDF() enhancement

### Phase 4: Validation (1 dia)
- [ ] Index 10 manuals (seed data)
- [ ] Test RAG query flow
- [ ] Verify response quality

---

## 15. Open Questions

| # | Question | Priority |
|---|----------|----------|
| OQ-1 | LG/Samsung manuales precisam login? | HIGH — testar |
| OQ-2 | Quantos manuals indexar para MVP? | MEDIUM — 10-20 |
| OQ-3 | rod vs chromedp — qual prefere? | LOW — ambos funcionam |