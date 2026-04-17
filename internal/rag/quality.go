package rag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Quality flags for chunk analysis
const (
	FlagNoErrorCodes           = "no_error_codes"
	FlagFragmented             = "fragmented"
	FlagLowInformation         = "low_information"
	FlagSafetyWarningMissing    = "safety_warning_missing"
)

// QualityScore represents the quality assessment of a chunk
type QualityScore struct {
	Score     float64  `json:"score"`     // 0-1 quality score
	Reasoning string   `json:"reasoning"` // Explanation of the score
	Flags     []string `json:"flags"`     // Quality issues detected
}

// QualityScorer evaluates chunk quality using qwen2.5-vl
type QualityScorer struct {
	llmEndpoint string
	llmAPIKey   string
	modelName   string
	threshold   float64
	rateLimit   time.Duration // minimum time between requests
	lastRequest time.Time
	mu          sync.Mutex
}

// NewQualityScorer creates a new QualityScorer
func NewQualityScorer() *QualityScorer {
	endpoint := os.Getenv("LITELLM_ENDPOINT")
	if endpoint == "" {
		endpoint = "http://localhost:4000"
	}
	apiKey := os.Getenv("LITELLM_API_KEY")

	return &QualityScorer{
		llmEndpoint: endpoint,
		llmAPIKey:   apiKey,
		modelName:   "qwen2.5-vl",
		threshold:   0.5,
		rateLimit:   500 * time.Millisecond, // max 2 requests per second
	}
}

// NewQualityScorerWithThreshold creates a QualityScorer with custom threshold
func NewQualityScorerWithThreshold(threshold float64) *QualityScorer {
	s := NewQualityScorer()
	s.threshold = threshold
	return s
}

// qualityPrompt is the system prompt for chunk quality evaluation
const qualityPrompt = `You are an HVAC service manual expert evaluating a document chunk for RAG quality.

Evaluate this chunk and respond with ONLY valid JSON:

{
  "score": 0.0-1.0,
  "reasoning": "brief explanation (1-2 sentences) of why this score was given",
  "flags": ["list of quality issues: no_error_codes, fragmented, low_information, safety_warning_missing"]
}

Scoring guidelines:
- score >= 0.8: HIGH quality - contains error codes, diagnostic procedures, safety warnings, specific model info
- score 0.5-0.8: MEDIUM quality - useful content but may lack specific error codes or be somewhat generic
- score < 0.5: LOW quality - generic content, fragmented, repetitive, or lacks actionable HVAC information

Evaluate for:
- Presence of error codes (E0, E1, CH01, etc.)
- Diagnostic or troubleshooting procedures
- Safety warnings and cautions
- Specific model/brand references
- Technical specifications
- Complete sentences vs fragmented text

Flags to use when applicable:
- "no_error_codes": chunk lacks error/fault codes but claims to be diagnostic
- "fragmented": text appears cut off or mid-sentence
- "low_information": repetitive, generic, or marketing language
- "safety_warning_missing": procedure without safety information`

// ScoreChunk evaluates a single chunk and updates its QualityScore
func (qs *QualityScorer) ScoreChunk(ctx context.Context, chunk *ChunkResult) (*QualityScore, error) {
	// Rate limit check BEFORE acquiring lock to avoid blocking other goroutines
	qs.mu.Lock()
	sinceLast := time.Since(qs.lastRequest)
	if sinceLast < qs.rateLimit {
		// Calculate sleep duration, release lock, sleep, re-acquire
		sleepDur := qs.rateLimit - sinceLast
		qs.mu.Unlock()
		time.Sleep(sleepDur)
		qs.mu.Lock()
	}
	qs.lastRequest = time.Now()
	qs.mu.Unlock()

	// Prepare the prompt with chunk content
	promptText := fmt.Sprintf("Evaluate this HVAC document chunk:\n\n---CHUNK START---\n%s\n---CHUNK END---\n\nContent type: %s\nSection: %s",
		chunk.Text,
		chunk.ContentType,
		chunk.Section,
	)

	// Call qwen2.5-vl via LiteLLM
	result, err := qs.callLLM(ctx, promptText)
	if err != nil {
		// On failure, set score to 0 and return
		chunk.QualityScore = 0
		return &QualityScore{
			Score:     0,
			Reasoning: fmt.Sprintf("scoring failed: %v", err),
			Flags:     []string{},
		}, nil
	}

	// Update chunk's QualityScore
	chunk.QualityScore = result.Score

	return result, nil
}

// ScoreChunkBatch evaluates multiple chunks with rate limiting
// Errors are handled gracefully - failed chunks get score=0
func (qs *QualityScorer) ScoreChunkBatch(ctx context.Context, chunks []ChunkResult) []ChunkResult {
	results := make([]ChunkResult, len(chunks))

	for i := range chunks {
		chunk := &chunks[i]
		score, err := qs.ScoreChunk(ctx, chunk)
		if err != nil {
			// Graceful error handling: set score to 0
			chunk.QualityScore = 0
			results[i] = *chunk
			continue
		}
		results[i] = *chunk
		_ = score // chunk already updated
	}

	return results
}

// callLLM invokes qwen2.5-vl via LiteLLM for chunk scoring
func (qs *QualityScorer) callLLM(ctx context.Context, prompt string) (*QualityScore, error) {
	payload := map[string]interface{}{
		"model": qs.modelName,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": prompt,
					},
				},
			},
		},
		"temperature": 0.1,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", qs.llmEndpoint+"/v1/chat/completions", bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if qs.llmAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+qs.llmAPIKey)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http call: %w", err)
	}
	defer resp.Body.Close()

	var llmResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&llmResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(llmResp.Choices) == 0 {
		return nil, fmt.Errorf("no response from qwen2.5-vl")
	}

	return qs.parseQualityResponse(llmResp.Choices[0].Message.Content)
}

// parseQualityResponse extracts QualityScore from LLM response
func (qs *QualityScorer) parseQualityResponse(content string) (*QualityScore, error) {
	// Try to find JSON in response
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")

	if start == -1 || end == -1 || end <= start {
		return nil, fmt.Errorf("no JSON found in response")
	}

	jsonStr := content[start : end+1]

	var result QualityScore
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	// Validate and set defaults
	if result.Score < 0 {
		result.Score = 0
	}
	if result.Score > 1 {
		result.Score = 1
	}
	if result.Flags == nil {
		result.Flags = []string{}
	}

	return &result, nil
}

// UpdateQualityScore is a convenience function to update a chunk's quality score
func UpdateQualityScore(chunk *ChunkResult, score *QualityScore) {
	chunk.QualityScore = score.Score
}

// IsHighQuality returns true if score >= 0.8
func (qs *QualityScorer) IsHighQuality(score float64) bool {
	return score >= 0.8
}

// IsMediumQuality returns true if score is between 0.5 and 0.8
func (qs *QualityScorer) IsMediumQuality(score float64) bool {
	return score >= 0.5 && score < 0.8
}

// IsLowQuality returns true if score < 0.5
func (qs *QualityScorer) IsLowQuality(score float64) bool {
	return score < 0.5
}

// ShouldInclude returns true if chunk meets the quality threshold
func (qs *QualityScorer) ShouldInclude(score float64) bool {
	return score >= qs.threshold
}

// QualitySummary provides a human-readable summary of quality
func QualitySummary(score float64) string {
	switch {
	case score >= 0.8:
		return "high quality - use directly"
	case score >= 0.5:
		return "medium quality - include with caveat"
	default:
		return "low quality - flag for review or exclude"
	}
}
