package parser

import (
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/ledongthuc/pdf"
)

// PDFMetadata holds extracted model/brand information from PDF sources
type PDFMetadata struct {
	Brand   string // Springer, LG, Samsung, etc.
	Model   string // Xtreme Save Connect, Dual Inverter, etc.
	BTU     int    // 12000, 18000, 24000
	Codigo  string // Product code (e.g., 42EZVCA12M5)
}

// ExtractionResult holds the result of extraction with confidence scores
type ExtractionResult struct {
	Metadata   PDFMetadata
	Confidence float64 // 0.0-1.0
	Sources    []string // Which sources contributed (filename, metadata, content)
}

// KnownBrands returns all brand names from BrandModels
func KnownBrands() []string {
	return []string{
		"Springer", "Midea", "LG", "Samsung", "Daikin", "Consul",
		"Electrolux", "Philco", "Gree", "Fujitsu", "Elgin", "Carrier",
		"Hisense", "TCL", "Agratto", "Hitachi", "HQ",
	}
}

// brandPatterns maps brand names to their possible filename/metadata variations
var brandPatterns = map[string][]string{
	"Springer":  {"Springer", "Midea"},
	"LG":        {"LG"},
	"Samsung":   {"Samsung"},
	"Daikin":    {"Daikin"},
	"Consul":    {"Consul"},
	"Electrolux": {"Electrolux"},
	"Philco":    {"Philco"},
	"Gree":      {"Gree"},
	"Fujitsu":   {"Fujitsu"},
	"Elgin":     {"Elgin"},
	"Carrier":   {"Carrier"},
	"Hisense":   {"Hisense"},
	"TCL":       {"TCL"},
	"Agratto":   {"Agratto"},
	"Hitachi":   {"Hitachi"},
	"HQ":        {"HQ"},
}

// seriesPatterns maps known series names to their canonical form
var seriesPatterns = map[string]string{
	"xtreme save connect":  "Xtreme Save Connect",
	"airvolution connect":  "AirVolution Connect",
	"airvolution":          "AirVolution",
	"ai ecomaster":         "AI Ecomaster",
	"ai ecomaster connect": "AI Ecomaster",
	"ecomaster":            "AI Ecomaster",
	"dual inverter":        "Dual Inverter",
	"dual inverter voice":  "Dual Inverter Voice",
	"ai dual inverter voice": "AI Dual Inverter Voice",
	"artcool":              "Artcool",
	"free cool":            "Free Cool",
	"wind-free":            "Wind-Free",
	"wind free":            "Wind-Free",
	"digital inverter":      "Digital Inverter",
	"smart air":            "Smart Air",
	"ar9500":               "AR9500",
	"air performer":        "Air Performer",
	"smart inverter":        "Smart Inverter",
	"floor standing":        "Floor Standing",
	"floor/ceiling":         "Floor/Ceiling",
	"ururu sarara":         "Ururu Sarara",
	"multi split":           "Multi Split",
	"facilita":             "Facilita",
	"bem estar":            "Bem Estar",
	"clarear":              "Clarear",
	"maxi":                 "Maxi",
	"air system":           "Air System",
	"inverter":             "Inverter",
	"portable":             "Portable",
	"valore":               "Valore",
	"eco":                  "Eco",
	"neo inverter":         "Neo Inverter",
	"super inverter":       "Super Inverter",
	"elite":                "Elite",
	"sprint":               "Sprint",
	"newio":                "Newio",
}

// BTU extraction patterns
var btuPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(\d{4,5})\s*BTU`),
	regexp.MustCompile(`BTU\s*(\d{4,5})`),
	regexp.MustCompile(`(\d{4,5})\s*btu`),
	regexp.MustCompile(`Capacidade.*?(\d{4,5})`),
	regexp.MustCompile(`(\d{4,5})\s*(?:TR|tons?)`),
}

// Model code patterns (product codes like 42EZVCA12M5)
var codigoPatterns = []*regexp.Regexp{
	regexp.MustCompile(`[A-Z]{2}[A-Z0-9]{6,12}`),
	regexp.MustCompile(`Código[:\s]+([A-Z0-9/]+)`),
	regexp.MustCompile(`Código do produto[:\s]+([A-Z0-9/]+)`),
	regexp.MustCompile(`Part.?Number[:\s]+([A-Z0-9-]+)`),
	regexp.MustCompile(`Model[:\s]+([A-Z0-9/]+)`),
	regexp.MustCompile(`Ref[:\s]+([A-Z0-9-]+)`),
}

// Model name patterns
var modelNamePatterns = []*regexp.Regexp{
	regexp.MustCompile(`Modelo[:\s]+([A-Za-z\s]+?)(?:\d|\n|$)`),
	regexp.MustCompile(`Model[:\s]+([A-Za-z\s]+?)(?:\d|\n|$)`),
	regexp.MustCompile(`Serie[:\s]+([A-Za-z\s]+?)(?:\d|\n|$)`),
}

// ExtractFromFilename extracts metadata from PDF filename
func ExtractFromFilename(filename string) PDFMetadata {
	meta := PDFMetadata{}
	lower := strings.ToLower(filename)
	noExt := strings.TrimSuffix(filename, filepath.Ext(filename))

	// Extract brand
	for brand, variations := range brandPatterns {
		for _, v := range variations {
			if strings.Contains(strings.ToLower(noExt), strings.ToLower(v)) {
				meta.Brand = brand
				break
			}
		}
		if meta.Brand != "" {
			break
		}
	}

	// Extract series/model name
	for pattern, canonical := range seriesPatterns {
		if strings.Contains(lower, pattern) {
			meta.Model = canonical
			break
		}
	}

	// Extract BTU
	for _, re := range btuPatterns {
		if match := re.FindStringSubmatch(noExt); len(match) > 1 {
			if btu, err := strconv.Atoi(match[1]); err == nil && btu >= 5000 && btu <= 100000 {
				meta.BTU = btu
				break
			}
		}
	}

	// Extract codigo (product code)
	for _, re := range codigoPatterns {
		if matches := re.FindAllStringSubmatch(noExt, -1); len(matches) > 0 {
			for _, match := range matches {
				if len(match) > 1 && len(match[1]) >= 6 {
					meta.Codigo = match[1]
					break
				}
			}
			if meta.Codigo != "" {
				break
			}
		}
	}

	return meta
}

// ExtractFromPDFText extracts metadata from PDF text content
func ExtractFromPDFText(text string) PDFMetadata {
	meta := PDFMetadata{}
	upper := strings.ToUpper(text)
	lower := strings.ToLower(text)

	// Extract brand from text
	for brand, variations := range brandPatterns {
		for _, v := range variations {
			if strings.Contains(upper, strings.ToUpper(v)) {
				meta.Brand = brand
				break
			}
		}
		if meta.Brand != "" {
			break
		}
	}

	// Extract series/model
	for pattern, canonical := range seriesPatterns {
		if strings.Contains(lower, pattern) {
			meta.Model = canonical
			break
		}
	}

	// Extract BTU from text
	for _, re := range btuPatterns {
		if matches := re.FindAllStringSubmatch(text, -1); len(matches) > 0 {
			for _, match := range matches {
				if len(match) > 1 {
					if btu, err := strconv.Atoi(match[1]); err == nil && btu >= 5000 && btu <= 100000 {
						meta.BTU = btu
						break
					}
				}
			}
			if meta.BTU > 0 {
				break
			}
		}
	}

	// Extract codigo from text patterns
	for _, re := range codigoPatterns {
		if matches := re.FindAllStringSubmatch(text, -1); len(matches) > 0 {
			for _, match := range matches {
				if len(match) > 1 && len(match[1]) >= 6 {
					meta.Codigo = match[1]
					break
				}
			}
			if meta.Codigo != "" {
				break
			}
		}
	}

	// Extract model name
	for _, re := range modelNamePatterns {
		if match := re.FindStringSubmatch(text); len(match) > 1 {
			name := strings.TrimSpace(match[1])
			if len(name) > 2 && len(name) < 50 {
				meta.Model = name
				break
			}
		}
	}

	return meta
}

// ExtractFromPDFMetadata extracts metadata from PDF info dictionary
func ExtractFromPDFMetadata(info map[string]string) PDFMetadata {
	meta := PDFMetadata{}

	// Check title
	if title, ok := info["Title"]; ok {
		meta = ExtractFromFilename(title)
		if meta.Brand == "" {
			meta = ExtractFromPDFText(title)
		}
	}

	// Check author for brand info
	if author, ok := info["Author"]; ok {
		if meta.Brand == "" {
			for brand, variations := range brandPatterns {
				for _, v := range variations {
					if strings.Contains(strings.ToLower(author), strings.ToLower(v)) {
						meta.Brand = brand
						break
					}
				}
				if meta.Brand != "" {
					break
				}
			}
		}
	}

	return meta
}

// readPDFText extracts text content from PDF file using command-line tools
func readPDFText(pdfPath string) (string, error) {
	// Try pdftotext first (most reliable)
	if path, err := exec.LookPath("pdftotext"); err == nil {
		cmd := exec.Command(path, "-layout", pdfPath, "-")
		output, err := cmd.Output()
		if err == nil {
			return string(output), nil
		}
	}

	// Try mutool
	if path, err := exec.LookPath("mutool"); err == nil {
		cmd := exec.Command(path, "draw", "-F", "txt", "-e", pdfPath)
		output, err := cmd.Output()
		if err == nil {
			return string(output), nil
		}
	}

	// Fallback: use pdf package for basic extraction
	return readPDFTextGo(pdfPath)
}

// readPDFTextGo uses the pdf package for basic text extraction
func readPDFTextGo(pdfPath string) (string, error) {
	f, r, err := pdf.Open(pdfPath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	var sb strings.Builder
	totalPages := r.NumPage()

	// Extract from first 3 pages (title, headers, model info usually in first pages)
	maxPages := 3
	if totalPages < maxPages {
		maxPages = totalPages
	}

	for i := 1; i <= maxPages; i++ {
		page := r.Page(i)
		if page.V.IsNull() {
			continue
		}
		text, err := page.GetPlainText(nil)
		if err != nil {
			continue
		}
		sb.WriteString(text)
		sb.WriteString("\n")
	}

	return sb.String(), nil
}

// ExtractPDFMetadata extracts metadata from a PDF file using multiple strategies
func ExtractPDFMetadata(pdfPath string) (*ExtractionResult, error) {
	result := &ExtractionResult{
		Metadata:   PDFMetadata{},
		Confidence: 0.0,
		Sources:    []string{},
	}

	// Strategy 1: Filename parsing (high confidence)
	filename := filepath.Base(pdfPath)
	filenameMeta := ExtractFromFilename(filename)
	result.Metadata = mergeMetadata(result.Metadata, filenameMeta)
	if filenameMeta.Brand != "" || filenameMeta.BTU > 0 {
		result.Confidence = 0.7
		result.Sources = append(result.Sources, "filename")
	}

	// Strategy 2: PDF metadata dictionary
	if info, err := getPDFInfoDict(pdfPath); err == nil && info != nil {
		meta := ExtractFromPDFMetadata(info)
		if meta.Brand != "" || meta.Codigo != "" {
			result.Metadata = mergeMetadata(result.Metadata, meta)
			result.Confidence = max(result.Confidence, 0.8)
			result.Sources = append(result.Sources, "pdf_metadata")
		}
	}

	// Strategy 3: PDF text content (first pages)
	if text, err := readPDFText(pdfPath); err == nil && text != "" {
		// First page for headers
		firstPage := extractFirstPage(text, 500) // ~500 chars for headers
		meta := ExtractFromPDFText(firstPage)
		if meta.Brand != "" || meta.Model != "" {
			result.Metadata = mergeMetadata(result.Metadata, meta)
			result.Confidence = max(result.Confidence, 0.75)
			result.Sources = append(result.Sources, "first_page")
		}

		// Full content for codigo and additional info
		fullMeta := ExtractFromPDFText(text)
		if fullMeta.Codigo != "" && result.Metadata.Codigo == "" {
			result.Metadata.Codigo = fullMeta.Codigo
			result.Confidence = max(result.Confidence, 0.85)
			result.Sources = append(result.Sources, "full_content")
		}
		if fullMeta.BTU > 0 && result.Metadata.BTU == 0 {
			result.Metadata.BTU = fullMeta.BTU
		}
	}

	// Strategy 4: Pattern search in full text (codigo, model patterns)
	if text, err := readPDFText(pdfPath); err == nil && text != "" {
		// Search for explicit patterns
		codigoRe := regexp.MustCompile(`(?i)cod(?:igo)?[:\s]+([A-Z0-9/]+)`)
		if match := codigoRe.FindStringSubmatch(text); len(match) > 1 {
			result.Metadata.Codigo = match[1]
			result.Sources = append(result.Sources, "codigo_pattern")
		}

		modelRe := regexp.MustCompile(`(?i)model(?:o| name)?[:\s]+([A-Za-z\s]+?)(?:\d|$)`)
		if match := modelRe.FindStringSubmatch(text); len(match) > 1 {
			result.Metadata.Model = strings.TrimSpace(match[1])
			result.Sources = append(result.Sources, "model_pattern")
		}
	}

	// Normalize brand name
	if result.Metadata.Brand == "Springer/Midea" {
		result.Metadata.Brand = "Springer"
	}

	return result, nil
}

// getPDFInfoDict reads PDF info dictionary using command-line tools
func getPDFInfoDict(pdfPath string) (map[string]string, error) {
	info := make(map[string]string)

	// Try pdfinfo
	if path, err := exec.LookPath("pdfinfo"); err == nil {
		cmd := exec.Command(path, pdfPath)
		output, err := cmd.Output()
		if err == nil {
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					key := strings.TrimSpace(parts[0])
					val := strings.TrimSpace(parts[1])
					switch key {
					case "Title", "Author", "Subject", "Creator", "Producer":
						info[key] = val
					}
				}
			}
			if len(info) > 0 {
				return info, nil
			}
		}
	}

	return nil, nil
}

// extractFirstPage extracts the first N characters from text (simulating first page)
func extractFirstPage(text string, maxChars int) string {
	if len(text) <= maxChars {
		return text
	}
	return text[:maxChars]
}

// mergeMetadata merges non-empty fields from src into dst
func mergeMetadata(dst, src PDFMetadata) PDFMetadata {
	if src.Brand != "" {
		dst.Brand = src.Brand
	}
	if src.Model != "" {
		dst.Model = src.Model
	}
	if src.BTU > 0 {
		dst.BTU = src.BTU
	}
	if src.Codigo != "" {
		dst.Codigo = src.Codigo
	}
	return dst
}

// max returns the larger of two floats
func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
