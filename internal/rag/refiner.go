package rag

import (
	"strings"
)

// ConfidenceLevel represents the confidence band
type ConfidenceLevel int

const (
	ConfidenceNone ConfidenceLevel = iota
	ConfidenceLow
	ConfidenceMedium
	ConfidenceHigh
)

// String returns the string representation of ConfidenceLevel
func (c ConfidenceLevel) String() string {
	switch c {
	case ConfidenceNone:
		return "none"
	case ConfidenceLow:
		return "low"
	case ConfidenceMedium:
		return "medium"
	case ConfidenceHigh:
		return "high"
	default:
		return "unknown"
	}
}

// Refiner handles response refinement with calibrated confidence
type Refiner struct {
	// Thresholds
	HighThreshold    float64
	MediumThreshold  float64
	LowThreshold     float64
	MaxResponseChars int
	MaxBullets       int
}

// RefineResult contains the refined response and metadata
type RefineResult struct {
	Response      string            `json:"response"`
	Confidence    ConfidenceLevel   `json:"confidence"`
	ConfidencePct float64           `json:"confidence_pct"`
	Source        string            `json:"source"`
	Brand         string            `json:"brand,omitempty"`
	ErrorCode     string            `json:"error_code,omitempty"`
	BulletPoints  []string          `json:"bullet_points,omitempty"`
	NeedsTech     bool              `json:"needs_technician"` // true if low/none confidence
}

// NewRefiner creates a new Refiner with default thresholds
func NewRefiner() *Refiner {
	return &Refiner{
		HighThreshold:    0.85,
		MediumThreshold:  0.60,
		LowThreshold:      0.40,
		MaxResponseChars: 4096,
		MaxBullets:        3,
	}
}

// RefineFromChunks refines response from retrieved chunks
func (r *Refiner) RefineFromChunks(chunks []ChunkResult, query string) RefineResult {
	if len(chunks) == 0 {
		return r.noConfidenceResponse(query)
	}

	// Calculate aggregate confidence from chunk scores
	var totalScore float64
	var bestChunk *ChunkResult

	for i := range chunks {
		chunk := &chunks[i]
		// Score based on position (first chunks are more relevant)
		posWeight := 1.0 - (float64(i) * 0.1) // 1.0, 0.9, 0.8...
		if posWeight < 0.5 {
			posWeight = 0.5
		}

		// Estimate chunk quality score from metadata
		chunkScore := estimateChunkScore(chunk)
		totalScore += chunkScore * posWeight

		if bestChunk == nil || chunkScore > estimateChunkScore(bestChunk) {
			bestChunk = chunk
		}
	}

	avgScore := totalScore / float64(len(chunks))
	confidencePct := min(avgScore*1.2, 1.0) // Boost slightly if multiple chunks match

	// Determine confidence level
	var level ConfidenceLevel
	switch {
	case confidencePct >= r.HighThreshold:
		level = ConfidenceHigh
	case confidencePct >= r.MediumThreshold:
		level = ConfidenceMedium
	case confidencePct >= r.LowThreshold:
		level = ConfidenceLow
	default:
		level = ConfidenceNone
	}

	// Generate response based on confidence level
	return r.generateResponse(level, confidencePct, bestChunk, chunks, query)
}

// RefineDirect refines a direct text match with confidence score
func (r *Refiner) RefineDirect(text string, confidencePct float64, metadata map[string]string) RefineResult {
	var level ConfidenceLevel
	switch {
	case confidencePct >= r.HighThreshold:
		level = ConfidenceHigh
	case confidencePct >= r.MediumThreshold:
		level = ConfidenceMedium
	case confidencePct >= r.LowThreshold:
		level = ConfidenceLow
	default:
		level = ConfidenceNone
	}

	return r.generateResponseFromText(level, confidencePct, text, metadata)
}

// estimateChunkScore estimates quality score from chunk metadata
func estimateChunkScore(chunk *ChunkResult) float64 {
	score := 0.5 // base

	// Boost for verified content
	if chunk.Metadata["is_verified"] == "true" {
		score += 0.15
	}

	// Boost for qwen score if available
	if qwenScore := chunk.Metadata["qwen_score"]; qwenScore != "" {
		score += parseFloat(qwenScore) * 0.2
	}

	// Boost based on content type relevance
	switch chunk.ContentType {
	case "error_code":
		score += 0.15
	case "diagnostic_procedure":
		score += 0.1
	}

	return min(score, 1.0)
}

// generateResponse creates response based on confidence level
func (r *Refiner) generateResponse(level ConfidenceLevel, confidencePct float64, bestChunk *ChunkResult, allChunks []ChunkResult, query string) RefineResult {
	switch level {
	case ConfidenceHigh:
		return r.highConfidenceResponse(bestChunk, allChunks, query)
	case ConfidenceMedium:
		return r.mediumConfidenceResponse(bestChunk, allChunks, query)
	case ConfidenceLow:
		return r.lowConfidenceResponse(bestChunk, allChunks, query)
	default:
		return r.noConfidenceResponse(query)
	}
}

// generateResponseFromText creates response from direct text (no chunk structure)
func (r *Refiner) generateResponseFromText(level ConfidenceLevel, confidencePct float64, text string, metadata map[string]string) RefineResult {
	brand := metadata["brand"]
	model := metadata["model"]
	pageRef := metadata["page_ref"]

	source := formatSource(brand, model, pageRef)

	switch level {
	case ConfidenceHigh:
		bullets := extractBullets(text, r.MaxBullets)
		return RefineResult{
			Response:      text,
			Confidence:    ConfidenceHigh,
			ConfidencePct: confidencePct,
			Source:        source,
			Brand:         brand,
			BulletPoints:  bullets,
			NeedsTech:     false,
		}

	case ConfidenceMedium:
		intro := "Com base no que encontrei:\n\n"
		content := truncateToFit(text, r.MaxResponseChars-len(intro))
		bullets := extractBullets(content, r.MaxBullets)
		return RefineResult{
			Response:      intro + content,
			Confidence:    ConfidenceMedium,
			ConfidencePct: confidencePct,
			Source:        source,
			Brand:         brand,
			BulletPoints:  bullets,
			NeedsTech:     false,
		}

	case ConfidenceLow:
		intro := "Encontrei algumas informações, mas não tenho certeza se respondem completamente sua dúvida.\n\n"
		content := truncateToFit(text, r.MaxResponseChars-len(intro)-50)
		return RefineResult{
			Response:      intro + content + "\n\nConsulte o manual do seu modelo específico ou ligue para o suporte.",
			Confidence:    ConfidenceLow,
			ConfidencePct: confidencePct,
			Source:        source,
			Brand:         brand,
			NeedsTech:     true,
		}

	default:
		return RefineResult{
			Response:      "Não encontrei informação relevante nos manuais de serviço.\n\nDica: Verifique se o modelo do seu aparelho está listado no painel interno.",
			Confidence:    ConfidenceNone,
			ConfidencePct: 0,
			Source:        "",
			NeedsTech:     true,
		}
	}
}

// highConfidenceResponse generates high confidence response
func (r *Refiner) highConfidenceResponse(bestChunk *ChunkResult, allChunks []ChunkResult, query string) RefineResult {
	if bestChunk == nil {
		return r.noConfidenceResponse(query)
	}

	brand := bestChunk.Metadata["brand"]
	model := bestChunk.Metadata["model"]
	pageRef := bestChunk.Metadata["page_ref"]
	code := bestChunk.Metadata["error_code"]

	source := formatSource(brand, model, pageRef)

	// Format error code response
	if code != "" {
		text := bestChunk.Text
		bullets := extractBullets(text, r.MaxBullets)
		return RefineResult{
			Response:      text,
			Confidence:    ConfidenceHigh,
			ConfidencePct: 0.9,
			Source:        source,
			Brand:         brand,
			ErrorCode:     code,
			BulletPoints:  bullets,
			NeedsTech:     false,
		}
	}

	bullets := extractBullets(bestChunk.Text, r.MaxBullets)
	return RefineResult{
		Response:      bestChunk.Text,
		Confidence:    ConfidenceHigh,
		ConfidencePct: 0.85,
		Source:        source,
		Brand:         brand,
		BulletPoints:  bullets,
		NeedsTech:     false,
	}
}

// mediumConfidenceResponse generates medium confidence response
func (r *Refiner) mediumConfidenceResponse(bestChunk *ChunkResult, allChunks []ChunkResult, query string) RefineResult {
	if bestChunk == nil {
		return r.lowConfidenceResponse(bestChunk, allChunks, query)
	}

	brand := bestChunk.Metadata["brand"]
	model := bestChunk.Metadata["model"]
	pageRef := bestChunk.Metadata["page_ref"]

	source := formatSource(brand, model, pageRef)

	intro := "Com base no que encontrei:\n\n"
	content := truncateToFit(bestChunk.Text, r.MaxResponseChars-len(intro)-100)
	bullets := extractBullets(content, r.MaxBullets)

	return RefineResult{
		Response:      intro + content + "\n\nSe o problema persistir, recomendo chamar um técnico.",
		Confidence:    ConfidenceMedium,
		ConfidencePct: 0.70,
		Source:        source,
		Brand:         brand,
		BulletPoints:  bullets,
		NeedsTech:     true,
	}
}

// lowConfidenceResponse generates low confidence response
func (r *Refiner) lowConfidenceResponse(bestChunk *ChunkResult, allChunks []ChunkResult, query string) RefineResult {
	var text string
	var brand string

	if bestChunk != nil {
		text = bestChunk.Text
		brand = bestChunk.Metadata["brand"]
	} else {
		text = query
	}

	intro := "Encontrei algumas informações, mas não tenho certeza se respondem completamente sua dúvida.\n\n"
	content := truncateToFit(text, r.MaxResponseChars-len(intro)-100)

	return RefineResult{
		Response:      intro + content + "\n\nConsulte o manual do seu modelo específico ou ligue para o suporte.",
		Confidence:    ConfidenceLow,
		ConfidencePct: 0.50,
		Source:        "",
		Brand:         brand,
		NeedsTech:     true,
	}
}

// noConfidenceResponse generates no confidence response
func (r *Refiner) noConfidenceResponse(query string) RefineResult {
	return RefineResult{
		Response:      "Não encontrei informação relevante nos manuais de serviço.\n\nDica: Verifique se o modelo do seu aparelho está listado no painel interno.",
		Confidence:    ConfidenceNone,
		ConfidencePct: 0,
		Source:        "",
		NeedsTech:     true,
	}
}

// formatSource formats citation string
func formatSource(brand, model, pageRef string) string {
	if brand == "" {
		return ""
	}
	if pageRef != "" {
		return brand + " " + model + " (p." + pageRef + ")"
	}
	return brand + " " + model
}

// extractBullets extracts up to n bullet points from text
func extractBullets(text string, max int) []string {
	lines := strings.Split(text, "\n")
	var bullets []string

	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Skip empty lines and headers
		if line == "" || isHeader(line) {
			continue
		}
		// Clean bullet markers
		line = strings.TrimPrefix(line, "- ")
		line = strings.TrimPrefix(line, "* ")
		line = strings.TrimPrefix(line, "• ")

		if len(line) > 10 { // Skip very short lines
			bullets = append(bullets, line)
			if len(bullets) >= max {
				break
			}
		}
	}

	return bullets
}

// isHeader checks if line is a header (all caps, short)
func isHeader(line string) bool {
	if len(line) > 30 {
		return false
	}
	upper := strings.ToUpper(line)
	return upper == line && strings.Count(line, " ") < 3
}

// truncateToFit truncates text to max chars
func truncateToFit(text string, maxChars int) string {
	if len(text) <= maxChars {
		return text
	}
	// Try to truncate at sentence boundary
	for i := maxChars; i > maxChars-200 && i > 0; i-- {
		if text[i] == '.' || text[i] == '\n' {
			return text[:i+1]
		}
	}
	return text[:maxChars] + "..."
}

// parseFloat parses float from string, returns default on error
func parseFloat(s string) float64 {
	var num float64
	decimals := 0
	hasDecimal := false

	for _, c := range s {
		if c >= '0' && c <= '9' {
			if hasDecimal {
				num += float64(c-'0') / float64(decimals)
				decimals *= 10
			} else {
				num = num*10 + float64(c-'0')
			}
		} else if c == '.' && !hasDecimal {
			hasDecimal = true
			decimals = 10
		} else if c != ' ' && c != ',' {
			break
		}
	}

	if num == 0 {
		return 0.5
	}
	return num / 10
}

// min returns minimum of two floats
func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// FormatForWhatsApp formats refine result for WhatsApp (compact, emoji-free)
func (r *Refiner) FormatForWhatsApp(result RefineResult) string {
	var sb strings.Builder

	// Add confidence indicator
	switch result.Confidence {
	case ConfidenceHigh:
		sb.WriteString("✅ ")
	case ConfidenceMedium:
		sb.WriteString("⚠️ ")
	case ConfidenceLow:
		sb.WriteString("❓ ")
	default:
		sb.WriteString("❌ ")
	}

	// Add response
	sb.WriteString(result.Response)

	// Add source if available
	if result.Source != "" {
		sb.WriteString("\n\nFonte: ")
		sb.WriteString(result.Source)
	}

	// Truncate to WhatsApp limit
	output := sb.String()
	if len(output) > r.MaxResponseChars {
		output = output[:r.MaxResponseChars-3] + "..."
	}

	return output
}