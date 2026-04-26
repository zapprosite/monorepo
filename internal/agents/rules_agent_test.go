package agents

import (
	"context"
	"strings"
	"testing"
)

func TestRulesResponseAgent_Creation(t *testing.T) {
	agent := NewRulesResponseAgent()
	if agent == nil {
		t.Fatal("NewRulesResponseAgent returned nil")
	}
	if len(agent.rules) == 0 {
		t.Error("expected rules to be loaded")
	}
}

func TestRulesResponseAgent_AgentType(t *testing.T) {
	agent := NewRulesResponseAgent()
	if agent.AgentType() != "rules" {
		t.Errorf("expected agent type 'rules', got %q", agent.AgentType())
	}
}

func TestRulesResponseAgent_MaxRetries(t *testing.T) {
	agent := NewRulesResponseAgent()
	if agent.MaxRetries() != 2 {
		t.Errorf("expected MaxRetries 2, got %d", agent.MaxRetries())
	}
}

func TestRulesResponseAgent_TimeoutMs(t *testing.T) {
	agent := NewRulesResponseAgent()
	if agent.TimeoutMs() != 5000 {
		t.Errorf("expected TimeoutMs 5000, got %d", agent.TimeoutMs())
	}
}

func TestRulesResponseAgent_FindBestResponse(t *testing.T) {
	agent := NewRulesResponseAgent()

	tests := []struct {
		name      string
		message   string
		intent    string
		entities  map[string]interface{}
		wantEmpty bool
	}{
		{
			name:      "cooling problem",
			message:   "O ar nao gela",
			wantEmpty: false,
		},
		{
			name:      "error code e1",
			message:   "Erro E1 no ar",
			wantEmpty: false,
		},
		{
			name:      "noise complaint",
			message:   "O ar faz barulho estranho",
			wantEmpty: false,
		},
		{
			name:      "maintenance query",
			message:   "Como fazer manutencao",
			wantEmpty: false,
		},
		{
			name:      "empty message",
			message:   "",
			wantEmpty: false, // empty message returns default greeting, not empty string
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response := agent.findBestResponse(tt.message, tt.intent, tt.entities)
			if tt.wantEmpty && response != "" {
				t.Errorf("expected empty response, got %q", response)
			}
			if !tt.wantEmpty && response == "" {
				t.Error("expected non-empty response")
			}
		})
	}
}

func TestRulesResponseAgent_CalculateMatchScore(t *testing.T) {
	agent := NewRulesResponseAgent()

	rule := &TechnicalRule{
		Keywords:  []string{"nao gela", "ar quente"},
		ErrorCodes: []string{"e1", "e2"},
		Priority:  10,
	}

	tests := []struct {
		name      string
		message   string
		minScore  int
	}{
		{"has keyword", "meu ar nao gela", 15}, // 5 (keyword) + 10 (priority)
		{"has error code", "erro e1 no visor", 25}, // 20 (error code) + 5 (keyword) + 10 (priority)
		{"no match", "hello world", 10}, // just priority
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lowerMessage := strings.ToLower(tt.message)
			score := agent.calculateMatchScore(rule, lowerMessage)
			if score < tt.minScore {
				t.Errorf("expected score >= %d, got %d", tt.minScore, score)
			}
		})
	}
}

func TestRulesResponseAgent_GetDefaultResponse(t *testing.T) {
	agent := NewRulesResponseAgent()

	response := agent.getDefaultResponse()
	if response == "" {
		t.Error("expected non-empty default response")
	}

	// Should contain greeting-like content (Oi is common to all greetings)
	if !strings.Contains(response, "Oi") && !strings.Contains(response, "ajudar") {
		t.Error("expected greeting in default response")
	}
}

func TestRulesResponseAgent_GetFallbackResponse(t *testing.T) {
	agent := NewRulesResponseAgent()

	response := agent.getFallbackResponse("some random message")
	if response == "" {
		t.Error("expected non-empty fallback response")
	}
}

func TestRulesResponseAgent_GetFallbackResponse_WithErrorCode(t *testing.T) {
	agent := NewRulesResponseAgent()

	response := agent.getFallbackResponse("Meu ar mostra erro e3")
	if response == "" {
		t.Error("expected non-empty fallback response with error code")
	}

	// Should mention the error code
	if !strings.Contains(response, "E3") && !strings.Contains(response, "e3") {
		t.Error("expected error code E3 in fallback response")
	}
}

func TestRulesResponseAgent_FormatForWhatsApp(t *testing.T) {
	agent := NewRulesResponseAgent()

	tests := []struct {
		name      string
		response  string
		wantCount int
	}{
		{
			name:      "short message",
			response:  "Mensagem curta",
			wantCount: 1,
		},
		{
			name:      "exact limit",
			response:  strings.Repeat("a", 4096),
			wantCount: 1,
		},
		{
			name:      "just over limit",
			response:  strings.Repeat("a", 4097),
			wantCount: 2,
		},
		{
			name:      "triple limit",
			response:  strings.Repeat("a", 8193),
			wantCount: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			messages := agent.formatForWhatsApp(tt.response)
			if len(messages) != tt.wantCount {
				t.Errorf("expected %d messages, got %d", tt.wantCount, len(messages))
			}

			// Verify each message is under limit
			for i, msg := range messages {
				if len(msg) > 4096 {
					t.Errorf("message %d exceeds 4096 chars: %d", i, len(msg))
				}
			}
		})
	}
}

func TestRulesResponseAgent_FormatForWhatsApp_WithSentenceBreaks(t *testing.T) {
	agent := NewRulesResponseAgent()

	// Message with sentence breaks
	response := "Primeira frase. Segunda frase. Terceira frase."
	messages := agent.formatForWhatsApp(response)

	if len(messages) != 1 {
		t.Errorf("expected 1 message for short response, got %d", len(messages))
	}
}

func TestRulesResponseAgent_Execute(t *testing.T) {
	agent := NewRulesResponseAgent()

	task := &SwarmTask{
		Input: map[string]interface{}{
			"query":          "O ar nao gela",
			"normalized_text": "",
			"intent":         "",
			"entities":       map[string]interface{}{},
			"message_id":     "msg_123",
		},
	}

	result, err := agent.Execute(context.Background(), task)
	if err != nil {
		t.Errorf("Execute() failed: %v", err)
	}

	if result["response_text"] == "" {
		t.Error("expected response_text in result")
	}
	if result["reply_to"] != "msg_123" {
		t.Errorf("expected reply_to msg_123, got %v", result["reply_to"])
	}
	if result["message_count"] == 0 {
		t.Error("expected message_count > 0")
	}
}

func TestRulesResponseAgent_Execute_WithNormalizedText(t *testing.T) {
	agent := NewRulesResponseAgent()

	task := &SwarmTask{
		Input: map[string]interface{}{
			"query":          "",
			"normalized_text": "Erro e1 no visor",
			"intent":         "",
			"entities":       map[string]interface{}{},
		},
	}

	result, err := agent.Execute(context.Background(), task)
	if err != nil {
		t.Errorf("Execute() failed: %v", err)
	}

	response := result["response_text"].(string)
	if response == "" {
		t.Error("expected response_text in result")
	}
}

func TestRulesResponseAgent_Execute_WithBrandEntity(t *testing.T) {
	agent := NewRulesResponseAgent()

	task := &SwarmTask{
		Input: map[string]interface{}{
			"query":   " Springer air conditioning",
			"entities": map[string]interface{}{
				"brand": "Springer",
			},
		},
	}

	result, err := agent.Execute(context.Background(), task)
	if err != nil {
		t.Errorf("Execute() failed: %v", err)
	}

	response := result["response_text"].(string)
	if response == "" {
		t.Error("expected response_text in result")
	}

	// Brand placeholder should be replaced
	if strings.Contains(response, "[MARCA]") {
		t.Error("brand placeholder should have been replaced")
	}
}

func TestRulesResponseAgent_Execute_EmptyInput(t *testing.T) {
	agent := NewRulesResponseAgent()

	task := &SwarmTask{
		Input: map[string]interface{}{},
	}

	result, err := agent.Execute(context.Background(), task)
	if err != nil {
		t.Errorf("Execute() failed: %v", err)
	}

	// Should still return a default response
	response := result["response_text"].(string)
	if response == "" {
		t.Error("expected response_text even with empty input")
	}
}

func TestRulesResponseAgent_BrandFiltering(t *testing.T) {
	agent := NewRulesResponseAgent()

	// Test with a brand-specific message
	messages := []string{
		" Springer",
		" Midea",
		" LG split",
	}

	for _, msg := range messages {
		response := agent.findBestResponse(msg, "", nil)
		if response == "" {
			t.Errorf("expected response for message %q", msg)
		}
	}
}

func TestRulesResponseAgent_ErrorCodeScoring(t *testing.T) {
	agent := NewRulesResponseAgent()

	// Error codes should get higher scores
	errorMessages := []string{
		"erro e1",
		"erro e2",
		"erro e3",
		"erro e4",
		"erro e5",
		"erro e6",
		"erro e9",
	}

	for _, msg := range errorMessages {
		t.Run(msg, func(t *testing.T) {
			response := agent.findBestResponse(msg, "", nil)
			if response == "" {
				t.Errorf("expected response for error code %q", msg)
			}
		})
	}
}

func TestTechnicalRule_Structure(t *testing.T) {
	rule := TechnicalRule{
		Keywords:    []string{"test keyword"},
		Responses:   []string{"response 1", "response 2"},
		BrandFilter: []string{"BrandA"},
		ErrorCodes:  []string{"e1"},
		Priority:     10,
	}

	if len(rule.Keywords) != 1 {
		t.Errorf("expected 1 keyword, got %d", len(rule.Keywords))
	}
	if len(rule.Responses) != 2 {
		t.Errorf("expected 2 responses, got %d", len(rule.Responses))
	}
	if rule.Priority != 10 {
		t.Errorf("expected priority 10, got %d", rule.Priority)
	}
}

func TestRulesResponseAgent_ImplementsAgentInterface(t *testing.T) {
	agent := NewRulesResponseAgent()
	var _ AgentInterface = agent
}
