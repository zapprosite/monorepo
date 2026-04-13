package rag

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/will-zappro/hvacr-swarm/internal/rag/parser"
)

// ChunkConfig defines chunking parameters per content type
type ChunkConfig struct {
	MaxTokens    int
	OverlapTokens int
	ContentType  string // "error_code", "procedure", "spec", "wiring_diagram"
}

// ChunkResult represents a single chunk with metadata
type ChunkResult struct {
	ID          string            `json:"id"`
	Text        string            `json:"text"`
	TokenCount  int               `json:"token_count"`
	ContentType string            `json:"content_type"`
	Section     string            `json:"section"` // ERROR_CODES, SPECS, INSTALLATION, etc
	Metadata    map[string]string `json:"metadata"` // brand, model, btu, error_code, page_ref
}

// Chunker implements semantic chunking for HVAC manuals
type Chunker struct {
	configs map[string]ChunkConfig
}

// NewChunker creates a new Chunker with default HVAC configs
func NewChunker() *Chunker {
	return &Chunker{
		configs: map[string]ChunkConfig{
			"error_code": {
				MaxTokens:     512,
				OverlapTokens: 50,
				ContentType:   "error_code",
			},
			"procedure": {
				MaxTokens:     768,
				OverlapTokens: 100,
				ContentType:   "diagnostic_procedure",
			},
			"spec": {
				MaxTokens:     1024,
				OverlapTokens: 150,
				ContentType:   "specification",
			},
			"wiring_diagram": {
				MaxTokens:     512,
				OverlapTokens: 0,
				ContentType:   "wiring_diagram",
			},
		},
	}
}

// ChunkDocument chunks a document by section type
func (c *Chunker) ChunkDocument(text string, sectionType string, metadata map[string]string) []ChunkResult {
	config, ok := c.configs[sectionType]
	if !ok {
		config = c.configs["spec"] // default
	}

	var chunks []ChunkResult

	// Split by newlines while preserving structure
	lines := strings.Split(text, "\n")
	var currentChunk []string
	currentTokens := 0

	for _, line := range lines {
		lineTokens := countTokens(line)

		if currentTokens+lineTokens > config.MaxTokens && len(currentChunk) > 0 {
			// Emit current chunk
			chunkText := strings.Join(currentChunk, "\n")
			chunks = append(chunks, ChunkResult{
				ID:          generateChunkID(metadata, len(chunks)),
				Text:        chunkText,
				TokenCount:  currentTokens,
				ContentType: config.ContentType,
				Section:     sectionType,
				Metadata:    copyMetadata(metadata),
			})

			// Handle overlap
			overlap := handleOverlap(currentChunk, config.OverlapTokens)
			currentChunk = overlap
			currentTokens = countTokens(strings.Join(currentChunk, "\n"))
		}

		currentChunk = append(currentChunk, line)
		currentTokens += lineTokens
	}

	// Emit final chunk
	if len(currentChunk) > 0 {
		chunkText := strings.Join(currentChunk, "\n")
		chunks = append(chunks, ChunkResult{
			ID:          generateChunkID(metadata, len(chunks)),
			Text:        chunkText,
			TokenCount:  currentTokens,
			ContentType: config.ContentType,
			Section:     sectionType,
			Metadata:    copyMetadata(metadata),
		})
	}

	return chunks
}

// ChunkErrorCodeTable chunks error code tables ensuring code stays intact
func (c *Chunker) ChunkErrorCodeTable(text string, metadata map[string]string) []ChunkResult {
	chunks := c.ChunkDocument(text, "error_code", metadata)

	// Post-process: ensure no chunk splits middle of error code entry
	var merged []ChunkResult
	for i := 0; i < len(chunks); i++ {
		if i > 0 && isMiddleOfErrorCode(chunks[i].Text) {
			// Merge with previous
			merged[len(merged)-1].Text += "\n" + chunks[i].Text
			merged[len(merged)-1].TokenCount += chunks[i].TokenCount
		} else {
			merged = append(merged, chunks[i])
		}
	}

	return merged
}

// countTokens estimates token count (rough approximation)
// Using whitespace splitting as proxy for tokens
func countTokens(text string) int {
	count := 0
	inWord := false
	for _, r := range text {
		if unicode.IsSpace(r) {
			inWord = false
		} else if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if !inWord {
				count++
				inWord = true
			}
		} else {
			count++
		}
	}
	return count
}

// handleOverlap keeps last N tokens for overlap
func handleOverlap(lines []string, overlapTokens int) []string {
	if overlapTokens <= 0 || len(lines) == 0 {
		return nil
	}

	// Calculate how many lines to keep
	var overlapLines []string
	tokenCount := 0

	for i := len(lines) - 1; i >= 0; i-- {
		lineTokens := countTokens(lines[i])
		if tokenCount+lineTokens > overlapTokens {
			break
		}
		overlapLines = append([]string{lines[i]}, overlapLines...)
		tokenCount += lineTokens
	}

	return overlapLines
}

// isMiddleOfErrorCode checks if text starts mid-entry
func isMiddleOfErrorCode(text string) bool {
	// If starts with partial code pattern like "CH01" or "E8"
	lines := strings.Split(strings.TrimSpace(text), "\n")
	if len(lines) == 0 {
		return false
	}
	first := strings.TrimSpace(lines[0])
	return len(first) <= 5 && isErrorCodePattern(first)
}

// isErrorCodePattern checks if string looks like error code
func isErrorCodePattern(s string) bool {
	patterns := []string{"E", "F", "P", "CH", "A", "C"}
	for _, p := range patterns {
		if strings.HasPrefix(s, p) {
			return true
		}
	}
	return false
}

// generateChunkID creates unique chunk ID
func generateChunkID(metadata map[string]string, index int) string {
	brand := metadata["brand"]
	model := metadata["model"]
	code := metadata["error_code"]
	if code == "" {
		code = metadata["section"]
	}
	return strings.ToLower(brand + "_" + model + "_" + code + "_" + formatIndex(index))
}

// formatIndex formats index as 3-digit string
func formatIndex(i int) string {
	if i < 10 {
		return "00" + string(rune('0'+i))
	} else if i < 100 {
		return string(rune('0'+i/10)) + string(rune('0'+i%10))
	}
	return string(rune('0'+i/100)) + string(rune('0'+(i/10)%10)) + string(rune('0'+i%10))
}

// copyMetadata creates a copy of metadata map
func copyMetadata(m map[string]string) map[string]string {
	if m == nil {
		return nil
	}
	copy := make(map[string]string, len(m))
	for k, v := range m {
		copy[k] = v
	}
	return copy
}

// DetectSection detects section type from text content
func (c *Chunker) DetectSection(text string) string {
	upper := strings.ToUpper(text)

	sections := map[string]string{
		"ERROR CODE":    "ERROR_CODES",
		"TROUBLESHOOT":  "TROUBLESHOOTING",
		"INSTALLATION":  "INSTALLATION",
		"SPECIFICATION": "SPECS",
		"DIAGNOSTIC":    "DIAGNOSTIC",
		"WIRING":        "WIRING",
		"MAINTENANCE":   "MAINTENANCE",
	}

	for pattern, section := range sections {
		if strings.Contains(upper, pattern) {
			return section
		}
	}

	return "GENERAL"
}

// GetConfig returns chunk config for content type
func (c *Chunker) GetConfig(contentType string) ChunkConfig {
	if cfg, ok := c.configs[contentType]; ok {
		return cfg
	}
	return c.configs["spec"]
}

// ChunkFromPDF parses a PDF and returns structured chunks.
// Flow: PDF -> ExtractAllText() -> DetectSection() -> ChunkDocument() -> []ChunkResult
func (c *Chunker) ChunkFromPDF(pdfPath string, metadata map[string]string) ([]ChunkResult, error) {
	pdfParser, err := parser.NewPDFParser(pdfPath)
	if err != nil {
		return nil, fmt.Errorf("open PDF: %w", err)
	}
	defer pdfParser.Close()

	// Step 1: Validate PDF
	if !pdfParser.IsValidPDF() {
		return nil, fmt.Errorf("invalid PDF file: %s", pdfPath)
	}

	// Step 2: Extract all text from PDF
	pages := pdfParser.ExtractAllText()
	if len(pages) == 0 {
		return nil, fmt.Errorf("no text extracted from PDF")
	}
	fullText := strings.Join(pages, "\n\n")

	// Step 3: Extract metadata from PDF content (merge with provided metadata)
	pdfMeta := pdfParser.ExtractMetadata(fullText)
	mergedMeta := mergeMetadata(metadata, pdfMeta)

	// Step 4: Detect sections
	sections := pdfParser.DetectTextSections(fullText)

	// If no sections detected, treat entire document as one GENERAL section
	if len(sections) == 0 {
		sectionType := c.DetectSection(fullText)
		chunks := c.ChunkDocument(fullText, sectionType, mergedMeta)
		return chunks, nil
	}

	// Step 5: Chunk each section
	var allChunks []ChunkResult
	for _, section := range sections {
		// Use existing DetectSection for subsection detection within section
		sectionType := c.DetectSection(section.Content)
		if sectionType == "GENERAL" {
			// Use the detected section boundary type
			sectionType = section.Type
		}

		// Add section boundary info to metadata
		sectionMeta := mergeMetadata(mergedMeta, map[string]string{
			"section": section.Type,
		})

		chunks := c.ChunkDocument(section.Content, sectionType, sectionMeta)
		allChunks = append(allChunks, chunks...)
	}

	return allChunks, nil
}

// mergeMetadata merges source metadata into target, with source taking precedence.
func mergeMetadata(target, source map[string]string) map[string]string {
	if target == nil {
		target = make(map[string]string)
	}
	for k, v := range source {
		if v != "" {
			target[k] = v
		}
	}
	return target
}