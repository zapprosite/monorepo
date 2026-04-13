package parser

import (
	"bytes"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/ledongthuc/pdf"
)

// PDFParser extracts text content from PDF documents using pure Go.
// Uses ledongthuc/pdf for native Go PDF text extraction.
type PDFParser struct {
	filePath string
	reader   *pdf.Reader
	file     *os.File
}

// NewPDFParser creates a new PDFParser for the given file path.
// Returns error if file cannot be opened.
func NewPDFParser(filePath string) (*PDFParser, error) {
	parser := &PDFParser{
		filePath: filePath,
	}

	if err := parser.Open(); err != nil {
		return nil, err
	}

	return parser, nil
}

// Open opens the PDF file. Called by NewPDFParser, can be called again after Close.
func (p *PDFParser) Open() error {
	if p.filePath == "" {
		return fmt.Errorf("pdf: file path is empty")
	}

	// Verify file exists
	if _, err := os.Stat(p.filePath); err != nil {
		return fmt.Errorf("pdf: cannot stat file %s: %w", p.filePath, err)
	}

	// Open PDF using ledongthuc/pdf
	f, r, err := pdf.Open(p.filePath)
	if err != nil {
		return fmt.Errorf("pdf: failed to open document: %w", err)
	}

	p.file = f
	p.reader = r
	return nil
}

// Close releases resources held by the parser.
func (p *PDFParser) Close() error {
	if p.file != nil {
		p.file.Close()
		p.file = nil
		p.reader = nil
	}
	return nil
}

// PageCount returns the total number of pages in the PDF.
func (p *PDFParser) PageCount() int {
	if p.reader == nil {
		return 0
	}
	return p.reader.NumPage()
}

// ExtractText extracts text from a specific page (0-indexed).
// Returns empty string if page number is out of range.
func (p *PDFParser) ExtractText(pageNum int) string {
	if p.reader == nil {
		return ""
	}

	totalPages := p.reader.NumPage()
	if pageNum < 0 || pageNum >= totalPages {
		return ""
	}

	// Get plain text from the page
	b, err := p.reader.GetPlainText()
	if err != nil {
		return ""
	}

	var buf bytes.Buffer
	buf.ReadFrom(b)
	fullText := buf.String()

	// The GetPlainText returns full document text
	// We need to split by pages - leongthuc/pdf returns all text
	// So we do our best to extract per-page text
	pages := p.SplitTextByPages(fullText)
	if pageNum < len(pages) {
		return pages[pageNum]
	}

	return ""
}

// SplitTextByPages attempts to split full text into pages.
// This is a heuristic since ledongthuc/pdf returns all text together.
func (p *PDFParser) SplitTextByPages(fullText string) []string {
	totalPages := p.reader.NumPage()
	if totalPages <= 1 {
		return []string{fullText}
	}

	// Simple approximation: split by "Page X of Y" patterns or equal division
	pages := make([]string, totalPages)

	// Try to find page markers in the text
	pagePattern := regexp.MustCompile(`(?i)page\s*\d+\s*of\s*\d+`)
	matches := pagePattern.FindAllStringIndex(fullText, -1)

	if len(matches) >= totalPages-1 {
		// Found page markers, use them to split
		for i := 0; i < len(matches); i++ {
			start := matches[i][1]
			end := len(fullText)
			if i+1 < len(matches) {
				end = matches[i+1][0]
			}
			pages[i] = strings.TrimSpace(fullText[start:end])
		}
		// Last page (or single page case)
		if totalPages > 0 && pages[totalPages-1] == "" {
			lastMatchEnd := 0
			if len(matches) > 0 {
				lastMatchEnd = matches[len(matches)-1][1]
			}
			pages[totalPages-1] = strings.TrimSpace(fullText[lastMatchEnd:])
		}
	} else {
		// Fallback: divide text roughly equally
		lines := strings.Split(fullText, "\n")
		linesPerPage := len(lines) / totalPages
		if linesPerPage == 0 {
			linesPerPage = 1
		}

		for i := 0; i < totalPages; i++ {
			start := i * linesPerPage
			end := (i + 1) * linesPerPage
			if i == totalPages-1 {
				end = len(lines)
			}
			if start >= len(lines) {
				start = len(lines) - 1
			}
			if end > len(lines) {
				end = len(lines)
			}
			pages[i] = strings.TrimSpace(strings.Join(lines[start:end], "\n"))
		}
	}

	// Clean up empty pages
	var result []string
	for _, page := range pages {
		if strings.TrimSpace(page) != "" {
			result = append(result, strings.TrimSpace(page))
		}
	}

	if len(result) == 0 && strings.TrimSpace(fullText) != "" {
		return []string{strings.TrimSpace(fullText)}
	}

	return result
}

// ExtractAllText extracts text from all pages and returns a slice of strings.
// Each element corresponds to one page (0-indexed).
func (p *PDFParser) ExtractAllText() []string {
	if p.reader == nil {
		return nil
	}

	totalPages := p.reader.NumPage()
	if totalPages == 0 {
		return nil
	}

	// Get full text first
	b, err := p.reader.GetPlainText()
	if err != nil {
		return nil
	}

	var buf bytes.Buffer
	buf.ReadFrom(b)
	fullText := buf.String()

	// Split into pages
	return p.SplitTextByPages(fullText)
}

// ExtractTextConcat extracts all text and concatenates into a single string.
// Useful when page boundaries are not meaningful.
func (p *PDFParser) ExtractTextConcat() string {
	pages := p.ExtractAllText()
	if pages == nil {
		return ""
	}

	var result strings.Builder
	for i, pageText := range pages {
		if pageText != "" {
			if i > 0 {
				result.WriteString("\n\n--- Page ")
				result.WriteString(fmt.Sprintf("%d", i+1))
				result.WriteString(" ---\n\n")
			}
			result.WriteString(pageText)
		}
	}

	return result.String()
}

// ExtractMetadata extracts metadata (brand, model) from PDF content or filename.
func (p *PDFParser) ExtractMetadata(content string) map[string]string {
	metadata := make(map[string]string)

	// Extract from filename
	filenameMeta := extractMetadataFromFilename(p.filePath)
	for k, v := range filenameMeta {
		metadata[k] = v
	}

	// Extract from content (first 500 chars for header detection)
	header := content
	if len(header) > 500 {
		header = content[:500]
	}
	contentMeta := extractMetadataFromContent(header)
	for k, v := range contentMeta {
		metadata[k] = v
	}

	return metadata
}

// extractMetadataFromFilename parses brand/model from PDF filename.
// Expected patterns: "Springer_42EZVCA12M5_manual.pdf", "LG_DualInverter_12000BTU.pdf"
func extractMetadataFromFilename(pdfPath string) map[string]string {
	metadata := make(map[string]string)

	// Get filename without path
	parts := strings.Split(pdfPath, "/")
	filename := parts[len(parts)-1]

	// Remove extension
	filename = strings.TrimSuffix(filename, ".pdf")
	filename = strings.TrimSuffix(filename, ".PDF")

	// Try to extract brand (first word, capitalized)
	words := strings.Split(filename, "_")
	if len(words) > 0 {
		metadata["brand"] = strings.TrimSpace(words[0])
	}

	// Try to extract model (second word, alphanumeric pattern)
	if len(words) > 1 {
		modelPattern := regexp.MustCompile(`[A-Za-z0-9]+`)
		matches := modelPattern.FindAllString(words[1], -1)
		if len(matches) > 0 {
			metadata["model"] = matches[0]
		}
	}

	return metadata
}

// extractMetadataFromContent parses brand/model from PDF header content.
func extractMetadataFromContent(content string) map[string]string {
	metadata := make(map[string]string)
	upper := strings.ToUpper(content)

	// Known brand patterns
	brands := []string{
		"SPRINGER", "MIDEA", "LG", "SAMSUNG", "DAIKIN", "CONSUL",
		"ELECTROLUX", "PHILCO", "GREE", "FUJITSU", "ELGIN",
		"CARRIER", "HISENSE", "TCL", "AGRATTO", "HITACHI", "HQ",
	}

	for _, brand := range brands {
		if strings.Contains(upper, brand) {
			metadata["brand"] = strings.Title(strings.ToLower(brand))
			break
		}
	}

	// Model number patterns (alphanumeric sequences like 42EZVCA12M5, S3-Q12JAQAL)
	modelPattern := regexp.MustCompile(`[A-Z]{2,3}[0-9A-Z]{5,}`)
	if matches := modelPattern.FindString(upper); matches != "" {
		metadata["model"] = matches
	}

	// BTU capacity patterns
	btuPattern := regexp.MustCompile(`(\d{4,5})\s*BTU`)
	if matches := btuPattern.FindStringSubmatch(upper); len(matches) > 1 {
		metadata["btu"] = matches[1]
	}

	return metadata
}

// TextSection represents a detected section boundary with character positions.
type TextSection struct {
	Type    string // ERROR_CODES, TROUBLESHOOTING, INSTALLATION, etc.
	Start   int    // Character position start
	End     int    // Character position end
	Content string // Section text content
}

// DetectTextSections finds all section boundaries in the text.
// Returns a list of sections with their positions.
func (p *PDFParser) DetectTextSections(text string) []TextSection {
	sections := []TextSection{}
	upper := strings.ToUpper(text)

	sectionPatterns := map[string]string{
		"ERROR_CODES":      `ERROR\s*CODE`,
		"TROUBLESHOOTING":  `TROUBLESHOOT`,
		"INSTALLATION":     `INSTALLATION`,
		"SPECS":            `SPECIFICATION`,
		"DIAGNOSTIC":       `DIAGNOSTIC`,
		"WIRING":           `WIRING`,
		"MAINTENANCE":      `MAINTENANCE`,
		"OPERATION":        `OPERATION`,
	}

	// Find all section positions
	type match struct {
		pos   int
		etype string
	}
	var matches []match

	for stype, pattern := range sectionPatterns {
		re := regexp.MustCompile(`(?i)` + pattern)
		for _, m := range re.FindAllStringIndex(upper, -1) {
			matches = append(matches, match{pos: m[0], etype: stype})
		}
	}

	// Sort by position
	for i := 0; i < len(matches)-1; i++ {
		for j := i + 1; j < len(matches); j++ {
			if matches[j].pos < matches[i].pos {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}

	// Build sections with boundaries
	for i, m := range matches {
		start := m.pos
		end := len(upper)
		if i+1 < len(matches) {
			end = matches[i+1].pos
		}
		sections = append(sections, TextSection{
			Type:    m.etype,
			Start:   start,
			End:     end,
			Content: text[start:end],
		})
	}

	return sections
}

// IsValidPDF checks if file exists and has PDF magic bytes.
func (p *PDFParser) IsValidPDF() bool {
	if p.filePath == "" {
		return false
	}
	data, err := os.ReadFile(p.filePath)
	if err != nil {
		return false
	}
	// PDF files start with %PDF-
	return len(data) > 4 && string(data[:4]) == "%PDF"
}