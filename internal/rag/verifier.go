package rag

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

// qwen2.5-vl verification prompt
const verificationPrompt = `You are an HVAC service manual expert. Analyse this document and respond with ONLY valid JSON:

{
  "document_type": "service_manual | product_listing | marketing | unknown",
  "confidence": 0.0-1.0,
  "has_diagnostic_content": true/false,
  "indicators": ["list of found elements - error code tables, wiring diagrams, troubleshooting steps, parts lists"],
  "error_codes_found": ["list of any error/fault codes like E1, E2, CH10, F0"],
  "procedures_found": ["list of diagnostic or repair procedures"],
  "safety_warnings_found": true/false,
  "is_duplicate_likely": true/false,
  "duplicate_of_model": "if duplicate, specify known model",
  "reasoning": "brief explanation of classification"
}

Look specifically for:
- Error code tables with diagnostic steps
- Wiring diagrams with connector pinouts
- Safety warnings in structured format
- Revision/date blocks with part numbers
- Troubleshooting flowcharts
- Parts lists with numbers

Reject if:
- Only product photos without specs
- Marketing language ("best-in-class", "premium")
- No error codes or diagnostic content
- Generic content that could fit any brand`

// Verifier handles qwen2.5-vl visual verification of manuals
type Verifier struct {
	llmEndpoint string
	llmAPIKey   string
	modelName   string
}

// NewVerifier creates a new Verifier
func NewVerifier() *Verifier {
	endpoint := os.Getenv("LITELLM_ENDPOINT")
	if endpoint == "" {
		endpoint = "http://localhost:4000"
	}
	apiKey := os.Getenv("LITELLM_API_KEY")

	return &Verifier{
		llmEndpoint: endpoint,
		llmAPIKey:   apiKey,
		modelName:   "qwen2.5-vl",
	}
}

// VerifyFromFile verifies a PDF/image file using qwen2.5-vl
func (v *Verifier) VerifyFromFile(ctx context.Context, filePath string) (*ValidationResult, error) {
	// Convert PDF page to image
	imageData, err := v.pdfPageToImage(filePath)
	if err != nil {
		return nil, fmt.Errorf("pdf to image: %w", err)
	}

	// Call qwen2.5-vl
	result, err := v.verifyImage(ctx, imageData)
	if err != nil {
		return nil, fmt.Errorf("qwen2.5-vl verify: %w", err)
	}

	return result, nil
}

// VerifyFromImage verifies an image using qwen2.5-vl
func (v *Verifier) VerifyFromImage(ctx context.Context, imageBase64 string) (*ValidationResult, error) {
	return v.verifyImage(ctx, imageBase64)
}

// pdfPageToImage converts first page of PDF to base64 PNG
func (v *Verifier) pdfPageToImage(pdfPath string) (string, error) {
	// Check if pdftoppm is available
	if _, err := exec.LookPath("pdftoppm"); err != nil {
		// Fallback: try mupdf or directly read PDF
		return v.pdfToImageMuPDF(pdfPath)
	}

	// Use pdftoppm for conversion
	cmd := exec.Command("pdftoppm", "-png", "-singlefile", "-f", "1", "-l", "1", pdfPath, "/tmp/manual_page")
	if err := cmd.Run(); err != nil {
		return v.pdfToImageMuPDF(pdfPath)
	}

	// Read the generated PNG
	data, err := os.ReadFile("/tmp/manual_page.png")
	if err != nil {
		return "", fmt.Errorf("read png: %w", err)
	}

	return base64.StdEncoding.EncodeToString(data), nil
}

// pdfToImageMuPDF uses mupdf for PDF conversion
func (v *Verifier) pdfToImageMuPDF(pdfPath string) (string, error) {
	// Try mutool or gs
	if path, err := exec.LookPath("mutool"); err == nil {
		cmd := exec.Command(path, "convert", "-o", "/tmp/manual_page.png", "-F", "png", "-r", "150", pdfPath, "1")
		if err := cmd.Run(); err != nil {
			return "", fmt.Errorf("mutool convert: %w", err)
		}
		data, err := os.ReadFile("/tmp/manual_page.png")
		if err != nil {
			return "", fmt.Errorf("read mutool output: %w", err)
		}
		return base64.StdEncoding.EncodeToString(data), nil
	}

	// Try ghostscript
	if path, err := exec.LookPath("gs"); err == nil {
		cmd := exec.Command(path, "-dBATCH", "-dNOPAUSE", "-sDEVICE=png16m",
			"-r150", "-sOutputFile=/tmp/manual_page.png", pdfPath)
		if err := cmd.Run(); err != nil {
			return "", fmt.Errorf("gs convert: %w", err)
		}
		data, err := os.ReadFile("/tmp/manual_page.png")
		if err != nil {
			return "", fmt.Errorf("read gs output: %w", err)
		}
		return base64.StdEncoding.EncodeToString(data), nil
	}

	return "", fmt.Errorf("no PDF converter available (pdftoppm, mutool, or gs required)")
}

// verifyImage calls qwen2.5-vl to verify image content
func (v *Verifier) verifyImage(ctx context.Context, imageBase64 string) (*ValidationResult, error) {
	// Prepare LiteLLM request
	payload := map[string]interface{}{
		"model": v.modelName,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": verificationPrompt,
					},
					{
						"type": "image_url",
						"image_url": map[string]string{
							"url": fmt.Sprintf("data:image/png;base64,%s", imageBase64),
						},
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

	// Call LiteLLM
	req, err := http.NewRequestWithContext(ctx, "POST", v.llmEndpoint+"/v1/chat/completions", bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if v.llmAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+v.llmAPIKey)
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

	content := llmResp.Choices[0].Message.Content

	// Extract JSON from response
	result, err := v.parseValidationResponse(content)
	if err != nil {
		return nil, fmt.Errorf("parse validation: %w", err)
	}

	return result, nil
}

// parseValidationResponse extracts JSON from LLM response
func (v *Verifier) parseValidationResponse(content string) (*ValidationResult, error) {
	// Try to find JSON in response
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")

	if start == -1 || end == -1 || end <= start {
		return nil, fmt.Errorf("no JSON found in response")
	}

	jsonStr := content[start : end+1]

	var result ValidationResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	// Post-process: validate and set defaults
	if result.DocumentType == "" {
		result.DocumentType = "unknown"
	}
	if result.Confidence == 0 && result.HasDiagnosticContent {
		result.Confidence = 0.5
	}

	return &result, nil
}

// ExtractErrorCodes extracts error codes from text using regex
func ExtractErrorCodes(text string) []string {
	patterns := []string{
		// LG-style: CH01, CH02, etc
		`CH\d{2,}`,
		// Samsung-style: E101, E126, etc
		`E\d{3}`,
		// Standard: E0-E9, F0-F9, P0-P9
		`[EFP]\d`,
		// Daikin: A1, A5, C4, etc
		`[A-C]\d`,
	}

	var codes []string
	seen := make(map[string]bool)

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindAllString(text, -1)
		for _, m := range matches {
			upper := strings.ToUpper(m)
			if !seen[upper] {
				codes = append(codes, upper)
				seen[upper] = true
			}
		}
	}

	return codes
}

// VerifyMarkdownContent verifies text-only content (when no image available)
func (v *Verifier) VerifyMarkdownContent(ctx context.Context, content string) (*ValidationResult, error) {
	// Simple heuristic-based verification for text content
	result := &ValidationResult{
		Indicators:      []string{},
		ErrorCodesFound: ExtractErrorCodes(content),
	}

	upper := strings.ToUpper(content)

	// Check document type indicators
	if strings.Contains(upper, "ERROR CODE") || strings.Contains(upper, "TROUBLESHOOT") {
		result.DocumentType = "service_manual"
		result.Indicators = append(result.Indicators, "error_code_table", "troubleshooting")
		result.HasDiagnosticContent = true
	} else if strings.Contains(upper, "SPEC") || strings.Contains(upper, "SPECIFICATION") {
		result.DocumentType = "service_manual"
		result.Indicators = append(result.Indicators, "specifications")
		result.HasDiagnosticContent = true
	} else if strings.Contains(upper, "PRODUCT") || strings.Contains(upper, "BEST-IN-CLASS") {
		result.DocumentType = "marketing"
		result.HasDiagnosticContent = false
	} else if strings.Contains(upper, "PARTS LIST") || strings.Contains(upper, "PRICE") {
		result.DocumentType = "product_listing"
		result.HasDiagnosticContent = false
	} else {
		result.DocumentType = "unknown"
		result.HasDiagnosticContent = false
	}

	// Check for diagnostic procedures
	if strings.Contains(upper, "DIAGNOSTIC") || strings.Contains(upper, "STEP") ||
		strings.Contains(upper, "CHECK") || strings.Contains(upper, "TEST") {
		result.ProceduresFound = []string{"diagnostic_steps"}
	}

	// Check for safety warnings
	if strings.Contains(upper, "WARNING") || strings.Contains(upper, "CAUTION") ||
		strings.Contains(upper, "DANGER") {
		result.SafetyWarningsFound = true
		result.Indicators = append(result.Indicators, "safety_warnings")
	}

	// Calculate confidence
	confidence := 0.5
	if result.HasDiagnosticContent {
		confidence += 0.2
	}
	if len(result.ErrorCodesFound) > 0 {
		confidence += 0.15
	}
	if result.SafetyWarningsFound {
		confidence += 0.1
	}
	result.Confidence = confidence

	return result, nil
}