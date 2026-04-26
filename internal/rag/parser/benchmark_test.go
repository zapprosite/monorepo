package parser

import (
	"bytes"
	"fmt"
	"runtime"
	"testing"
	"time"

	"github.com/ledongthuc/pdf"
)

// PDFBenchmarkResult holds performance metrics for a single benchmark run
type PDFBenchmarkResult struct {
	Pages      int
	Duration   time.Duration
	Bytes      int64
	MemPerPage int64
}

// generateMinimalPDF creates a minimal valid PDF with specified page count
// Each page contains approximately 1KB of text content
func generateMinimalPDF(pages int) ([]byte, error) {
	var buf bytes.Buffer

	// PDF header
	buf.WriteString("%PDF-1.4\n")
	buf.WriteString("%\xe2\xe3\xcf\xd3\n")

	// Track object offsets
	offsets := make(map[int]int)

	// Object 1: Catalog
	offsets[1] = buf.Len()
	buf.WriteString("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")

	// Build pages kids list
	kidsStr := ""
	for i := 0; i < pages; i++ {
		pageNum := 3 + i*2
		if i > 0 {
			kidsStr += " "
		}
		kidsStr += fmt.Sprintf("%d 0 R", pageNum)
	}

	// Object 2: Pages (parent)
	offsets[2] = buf.Len()
	buf.WriteString(fmt.Sprintf("2 0 obj\n<< /Type /Pages /Kids [%s] /Count %d >>\nendobj\n", kidsStr, pages))

	// Page objects and content streams
	pageObjNums := make([]int, pages)
	contentObjNums := make([]int, pages)

	for i := 0; i < pages; i++ {
		pageObjNums[i] = 3 + i*2
		contentObjNums[i] = 4 + i*2
	}

	for i := 0; i < pages; i++ {
		pageContent := buildTestPage(i+1, 1024)

		// Page object
		offsets[pageObjNums[i]] = buf.Len()
		buf.WriteString(fmt.Sprintf("%d 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents %d 0 R >>\nendobj\n",
			pageObjNums[i], contentObjNums[i]))

		// Content stream object
		offsets[contentObjNums[i]] = buf.Len()
		streamContent := fmt.Sprintf("BT\n/F1 12 Tf\n50 750 Td\n(%s) Tj\nET\n", pageContent)
		buf.WriteString(fmt.Sprintf("%d 0 obj\n<< /Length %d >>\nstream\n%s\nendstream\nendobj\n",
			contentObjNums[i], len(streamContent), streamContent))
	}

	// Font object
	fontObjNum := 3 + pages*2
	offsets[fontObjNum] = buf.Len()
	buf.WriteString(fmt.Sprintf("%d 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n", fontObjNum))

	// Cross-reference table
	xref := buf.Len()
	buf.WriteString("xref\n")
	buf.WriteString(fmt.Sprintf("0 %d\n", fontObjNum+1))
	buf.WriteString("0000000000 65535 f \n")
	for i := 1; i <= fontObjNum; i++ {
		if off, ok := offsets[i]; ok {
			buf.WriteString(fmt.Sprintf("%010d 00000 n \n", off))
		} else {
			buf.WriteString("0000000000 00000 f \n")
		}
	}

	// Trailer
	buf.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n",
		fontObjNum+1, xref))

	return buf.Bytes(), nil
}

// buildTestPage generates realistic HVAC error code page content
func buildTestPage(pageNum, targetBytes int) string {
	templates := []string{
		"Pagina %d - Tabela de Codigos de Erro Springer/Midea\n" +
			"E0 - Erro Motor Ventilador Interno\n" +
			"E1 - Erro Comunicacao Interno/Externo\n" +
			"E2 - Erro Motor Ventilador Externo\n" +
			"E5 - Protecao Sobrecarga\n" +
			"E6 - Falha Compressor\n" +
			"E8 - Protecao Alta Pressao\n\n" +
			"Causas Raiz: Motor enrolamento aberto/curto, Capacitor falhou, PCB falhou\n" +
			"Passos Diagnostico: Testar resistencia motor, Verificar capacitor, Medir tensao PCB\n",

		"Pagina %d - Procedimentos de Diagnostico LG\n" +
			"CH01 - Erro Motor Ventilador DC Interno\n" +
			"CH02 - Erro Motor Ventilador DC Externo\n" +
			"CH10 - Erro Compressor\n" +
			"CH19 - Erro Modulo Inverter Compressor\n\n" +
			"Pontos de Teste: Tensao motor 12V DC, Sensor hall 5V sinal\n" +
			"Procedimento Reset: Desligar energia, Aguardar 30 segundos, Ligar energia\n",

		"Pagina %d - Especificacoes Tecnicas Daikin\n" +
			"A1 - Erro PCB Interno\n" +
			"A5 - Erro Motor Ventilador Interno\n" +
			"A6 - Erro Motor Ventilador Externo\n" +
			"C4 - Erro Sensor Temperatura Succao\n" +
			"C9 - Erro Sensor Temperatura Bobina\n\n" +
			"Test Points: Tensao fonte 12V, 5V DC, Resistencia sensor 10kOhm a 25C\n",
	}

	content := fmt.Sprintf(templates[pageNum%len(templates)], pageNum)

	// Pad to target size
	for len(content) < targetBytes {
		content += " Informacao adicional de diagnostico... "
	}

	return content[:targetBytes]
}

// BenchmarkPDFParser1Page benchmarks extraction from 1-page PDF
func BenchmarkPDFParser1Page(b *testing.B) {
	pdfData, err := generateMinimalPDF(1)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		runtime.GC()

		reader := bytes.NewReader(pdfData)
		r, err := pdf.NewReader(reader, int64(len(pdfData)))
		if err != nil {
			b.Fatal(err)
		}

		numPages := r.NumPage()
		if numPages != 1 {
			b.Fatalf("expected 1 page, got %d", numPages)
		}

		p := r.Page(1)
		if p.V.IsNull() {
			b.Fatal("page 1 is null")
		}

		text, err := p.GetPlainText(nil)
		if err != nil {
			b.Fatal(err)
		}

		if len(text) == 0 {
			b.Fatal("no text extracted")
		}

		_ = text
	}
}

// BenchmarkPDFParser10Pages benchmarks extraction from 10-page PDF
func BenchmarkPDFParser10Pages(b *testing.B) {
	pdfData, err := generateMinimalPDF(10)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		runtime.GC()

		reader := bytes.NewReader(pdfData)
		r, err := pdf.NewReader(reader, int64(len(pdfData)))
		if err != nil {
			b.Fatal(err)
		}

		numPages := r.NumPage()
		if numPages != 10 {
			b.Fatalf("expected 10 pages, got %d", numPages)
		}

		var totalText string
		for pg := 1; pg <= numPages; pg++ {
			p := r.Page(pg)
			if p.V.IsNull() {
				continue
			}
			text, err := p.GetPlainText(nil)
			if err != nil {
				continue
			}
			totalText += text
		}

		if len(totalText) == 0 {
			b.Fatal("no text extracted")
		}
	}
}

// BenchmarkPDFParser50Pages benchmarks extraction from 50-page PDF
func BenchmarkPDFParser50Pages(b *testing.B) {
	pdfData, err := generateMinimalPDF(50)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		runtime.GC()

		reader := bytes.NewReader(pdfData)
		r, err := pdf.NewReader(reader, int64(len(pdfData)))
		if err != nil {
			b.Fatal(err)
		}

		numPages := r.NumPage()
		if numPages != 50 {
			b.Fatalf("expected 50 pages, got %d", numPages)
		}

		var totalText string
		for pg := 1; pg <= numPages; pg++ {
			p := r.Page(pg)
			if p.V.IsNull() {
				continue
			}
			text, err := p.GetPlainText(nil)
			if err != nil {
				continue
			}
			totalText += text
		}

		if len(totalText) == 0 {
			b.Fatal("no text extracted")
		}
	}
}

// BenchmarkPDFParserMemoryPerPage measures memory usage per page
func BenchmarkPDFParserMemoryPerPage(b *testing.B) {
	pdfData, err := generateMinimalPDF(10)
	if err != nil {
		b.Fatal(err)
	}

	var m1, m2 runtime.MemStats

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		runtime.GC()
		runtime.ReadMemStats(&m1)

		reader := bytes.NewReader(pdfData)
		r, err := pdf.NewReader(reader, int64(len(pdfData)))
		if err != nil {
			b.Fatal(err)
		}

		numPages := r.NumPage()
		var totalText string
		for pg := 1; pg <= numPages; pg++ {
			p := r.Page(pg)
			if p.V.IsNull() {
				continue
			}
			text, err := p.GetPlainText(nil)
			if err != nil {
				continue
			}
			totalText += text
		}

		runtime.ReadMemStats(&m2)
		_ = totalText

		// Calculate memory per page
		memUsed := int64(m2.Alloc) - int64(m1.Alloc)
		b.ReportMetric(float64(memUsed)/float64(numPages), "bytes/page")
	}
}

// BenchmarkPDFParserScalability tests scaling behavior across page counts
func BenchmarkPDFParserScalability(b *testing.B) {
	pageCounts := []int{1, 5, 10, 25, 50}
	results := make([]PDFBenchmarkResult, 0, len(pageCounts))

	for _, pages := range pageCounts {
		pdfData, err := generateMinimalPDF(pages)
		if err != nil {
			b.Fatal(err)
		}

		b.Run(fmt.Sprintf("%dPages", pages), func(b *testing.B) {
			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				runtime.GC()

				reader := bytes.NewReader(pdfData)
				r, err := pdf.NewReader(reader, int64(len(pdfData)))
				if err != nil {
					b.Fatal(err)
				}

				numPages := r.NumPage()
				var totalText string
				for pg := 1; pg <= numPages; pg++ {
					p := r.Page(pg)
					if p.V.IsNull() {
						continue
					}
					text, err := p.GetPlainText(nil)
					if err != nil {
						continue
					}
					totalText += text
				}
			}

			// Store result
			duration := b.Elapsed() / time.Duration(b.N)
			results = append(results, PDFBenchmarkResult{
				Pages:    pages,
				Duration: duration,
				Bytes:    int64(len(pdfData)),
			})
		})
	}

	// Print summary
	b.Log("\n=== Scalability Summary ===")
	for _, r := range results {
		b.Logf("Pages: %d | Duration: %v | Size: %d bytes | Time/Page: %v",
			r.Pages, r.Duration, r.Bytes, r.Duration/time.Duration(r.Pages))
	}
}

// TestPDFGeneration verifies PDF generation works correctly
func TestPDFGeneration(t *testing.T) {
	for _, pages := range []int{1, 10, 50} {
		pdfData, err := generateMinimalPDF(pages)
		if err != nil {
			t.Fatalf("generateMinimalPDF(%d): %v", pages, err)
		}

		if len(pdfData) == 0 {
			t.Fatalf("generated PDF is empty for %d pages", pages)
		}

		// Verify it's valid PDF by reading it back
		reader := bytes.NewReader(pdfData)
		r, err := pdf.NewReader(reader, int64(len(pdfData)))
		if err != nil {
			t.Fatalf("pdf.NewReader(%d pages): %v", pages, err)
		}

		numPages := r.NumPage()
		if numPages != pages {
			t.Errorf("expected %d pages, got %d", pages, numPages)
		}
	}
}
