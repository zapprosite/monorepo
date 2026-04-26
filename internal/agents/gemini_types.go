package agents

// GeminiGenerateRequest represents a request to Gemini generateContent API.
type GeminiGenerateRequest struct {
	Contents []GeminiContent `json:"contents"`
}

// GeminiContent represents a content piece in Gemini API.
type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

// GeminiPart represents a part of content in Gemini API.
type GeminiPart struct {
	Text string `json:"text,omitempty"`
}

// GeminiGenerateResponse represents the response from Gemini generateContent API.
type GeminiGenerateResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}
