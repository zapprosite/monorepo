package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

// MemoryAgent handles conversation persistence and fact extraction.
type MemoryAgent struct {
	redisClient   MemoryRedisInterface
	minimaxAPIKey string
}

// MemoryRedisInterface defines Redis operations needed by MemoryAgent.
type MemoryRedisInterface interface {
	LPush(ctx context.Context, key string, values ...interface{}) error
	LTrim(ctx context.Context, key string, start, stop int64) error
	LRange(ctx context.Context, key string, start, stop int64) ([]string, error)
	HSet(ctx context.Context, key string, values map[string]interface{}) error
	HGetAll(ctx context.Context, key string) (map[string]string, error)
	Incr(ctx context.Context, key string) (int64, error)
	Expire(ctx context.Context, key string, expiration time.Duration) error
	Publish(ctx context.Context, channel string, message interface{}) error
	SAdd(ctx context.Context, key string, members ...interface{}) error
	SMembers(ctx context.Context, key string) ([]string, error)
}

// ConversationEntry represents a single conversation turn.
type ConversationEntry struct {
	Timestamp int64  `json:"timestamp"`
	Role      string `json:"role"` // "user" or "assistant"
	Message   string `json:"message"`
	Intent    string `json:"intent,omitempty"`
	Entities  string `json:"entities,omitempty"`
}

// ExtractedFact represents a fact extracted from conversation.
type ExtractedFact struct {
	Subject   string `json:"subject"`
	Predicate string `json:"predicate"`
	Object    string `json:"object"`
	Timestamp int64  `json:"timestamp"`
	Confidence float64 `json:"confidence"`
}

// NewMemoryAgent creates a new MemoryAgent.
func NewMemoryAgent(redisClient MemoryRedisInterface, minimaxAPIKey string) *MemoryAgent {
	return &MemoryAgent{
		redisClient:   redisClient,
		minimaxAPIKey: minimaxAPIKey,
	}
}

// AgentType returns the agent type identifier.
func (m *MemoryAgent) AgentType() string {
	return "memory"
}

// MaxRetries returns the maximum retry attempts.
func (m *MemoryAgent) MaxRetries() int {
	return 1
}

// TimeoutMs returns the timeout in milliseconds.
func (m *MemoryAgent) TimeoutMs() int {
	return 5000
}

// MemoryInput defines the input schema for MemoryAgent.
type MemoryInput struct {
	Phone        string                 `json:"phone"`
	UserMessage  string                 `json:"user_message"`
	AssistantMsg string                 `json:"assistant_message,omitempty"`
	Intent       string                 `json:"intent,omitempty"`
	Entities     map[string]interface{} `json:"entities,omitempty"`
	GraphID      string                 `json:"graph_id,omitempty"`
}

// MemoryOutput defines the output schema for MemoryAgent.
type MemoryOutput struct {
	Success         bool             `json:"success"`
	PersistedCount   int              `json:"persisted_count"`
	ExtractedFacts   []ExtractedFact `json:"extracted_facts,omitempty"`
	ConversationLen  int              `json:"conversation_len"`
}

// Execute persists conversation and extracts facts.
func (m *MemoryAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	startTime := time.Now()
	defer func() {
		task.TimeoutMs = int(time.Since(startTime).Milliseconds())
	}()

	// Parse input - task.Input is already map[string]any
	var input MemoryInput
	if phone, ok := task.Input["phone"].(string); ok {
		input.Phone = phone
	}
	if userMsg, ok := task.Input["user_message"].(string); ok {
		input.UserMessage = userMsg
	}
	if assistantMsg, ok := task.Input["assistant_message"].(string); ok {
		input.AssistantMsg = assistantMsg
	}
	if intent, ok := task.Input["intent"].(string); ok {
		input.Intent = intent
	}
	if graphID, ok := task.Input["graph_id"].(string); ok {
		input.GraphID = graphID
	}

	if input.Phone == "" {
		return nil, fmt.Errorf("missing phone in memory input")
	}

	// 1. Persist conversation (LPUSH + LTRIM 0 19)
	persistCount, err := m.persistConversation(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("persist conversation: %w", err)
	}

	// 2. Extract facts (LLM)
	facts, err := m.extractFacts(ctx, input)
	if err != nil {
		// Non-fatal - continue without facts
		facts = []ExtractedFact{}
	}

	// 3. Audit log
	m.writeAuditLog(ctx, input, facts)

	// 4. Update metrics
	m.updateMetrics(ctx, input.Phone)

	// Get conversation length
	conversationLen, _ := m.getConversationLength(ctx, input.Phone)

	return map[string]any{
		"memory.success":       true,
		"memory.persisted":     persistCount,
		"memory.facts_extracted": len(facts),
		"memory.conversation_len": conversationLen,
	}, nil
}

// persistConversation saves the conversation turn to Redis.
func (m *MemoryAgent) persistConversation(ctx context.Context, input MemoryInput) (int, error) {
	key := fmt.Sprintf("conversation:%s", input.Phone)

	entries := []ConversationEntry{}

	// Add user message
	if input.UserMessage != "" {
		entries = append(entries, ConversationEntry{
			Timestamp: time.Now().Unix(),
			Role:      "user",
			Message:   input.UserMessage,
			Intent:    input.Intent,
			Entities:  m.serializeEntities(input.Entities),
		})
	}

	// Add assistant message
	if input.AssistantMsg != "" {
		entries = append(entries, ConversationEntry{
			Timestamp: time.Now().Unix(),
			Role:      "assistant",
			Message:   input.AssistantMsg,
		})
	}

	persistCount := 0
	for _, entry := range entries {
		entryJSON, err := json.Marshal(entry)
		if err != nil {
			continue
		}
		if err := m.redisClient.LPush(ctx, key, string(entryJSON)); err != nil {
			return persistCount, err
		}
		persistCount++
	}

	// Trim to last 20 entries (0-19)
	if err := m.redisClient.LTrim(ctx, key, 0, 19); err != nil {
		return persistCount, err
	}

	// Set expiry (30 days)
	m.redisClient.Expire(ctx, key, 30*24*time.Hour)

	return persistCount, nil
}

// getConversationLength returns the number of entries in conversation history.
func (m *MemoryAgent) getConversationLength(ctx context.Context, phone string) (int, error) {
	key := fmt.Sprintf("conversation:%s", phone)
	entries, err := m.redisClient.LRange(ctx, key, 0, -1)
	if err != nil {
		return 0, err
	}
	return len(entries), nil
}

// extractFacts extracts structured facts from the conversation.
func (m *MemoryAgent) extractFacts(ctx context.Context, input MemoryInput) ([]ExtractedFact, error) {
	if input.UserMessage == "" {
		return []ExtractedFact{}, nil
	}

	// Check API key
	if m.minimaxAPIKey == "" {
		m.minimaxAPIKey = os.Getenv("MINIMAX_API_KEY")
	}
	if m.minimaxAPIKey == "" {
		return []ExtractedFact{}, nil
	}

	// Build prompt for fact extraction
	prompt := fmt.Sprintf(`Extraia fatos estruturados da seguinte mensagem de cliente HVAC.
Para cada fato, identifique: Sujeito, Predicado, Objeto.

Mensagem: %s
Intenção: %s

Exemplos de fatos extraídos:
- {"subject": "Cliente", "predicate": "tem", "object": "ar condicionado Springer 12000 BTU", "confidence": 0.9}
- {"subject": "Equipamento", "predicate": "está apresentando", "object": "código de erro E1", "confidence": 0.95}
- {"subject": "Cliente", "predicate": "localizou", "object": "zona sala", "confidence": 0.8}

Responda em JSON array com objetos contendo: subject, predicate, object, confidence (0-1).`, input.UserMessage, input.Intent)

	resp, err := m.callMiniMax(ctx, prompt)
	if err != nil {
		return []ExtractedFact{}, nil
	}

	// Parse JSON response
	var facts []ExtractedFact
	if err := json.Unmarshal([]byte(resp), &facts); err != nil {
		return []ExtractedFact{}, nil
	}

	return facts, nil
}

// callMiniMax calls the MiniMax API for text generation.
func (m *MemoryAgent) callMiniMax(ctx context.Context, prompt string) (string, error) {
	if m.minimaxAPIKey == "" {
		return "", fmt.Errorf("minimax API key not configured")
	}

	reqBody := MiniMaxRequest{
		Model: "MiniMax-M2.7",
		Messages: []MiniMaxMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens: 1024,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	endpoint := "https://api.minimax.io/v1/messages"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+m.minimaxAPIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("MiniMax API returned status %d", resp.StatusCode)
	}

	var result MiniMaxResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(result.Content) == 0 {
		return "", fmt.Errorf("empty response from MiniMax")
	}

	return result.Content[0].Text, nil
}

// writeAuditLog writes an audit log entry.
func (m *MemoryAgent) writeAuditLog(ctx context.Context, input MemoryInput, facts []ExtractedFact) {
	auditEntry := map[string]interface{}{
		"timestamp":    time.Now().Unix(),
		"phone":        input.Phone,
		"intent":        input.Intent,
		"user_message": input.UserMessage,
		"facts_count":  len(facts),
	}

	if input.GraphID != "" {
		auditEntry["graph_id"] = input.GraphID
	}

	auditJSON, _ := json.Marshal(auditEntry)

	// Publish to audit channel
	m.redisClient.Publish(ctx, "memory:audit", string(auditJSON))

	// Also add to sorted set for time-based queries
	auditKey := fmt.Sprintf("audit:%s:%d", input.Phone, time.Now().Unix())
	m.redisClient.SAdd(ctx, "memory:audits", auditKey)
}

// updateMetrics updates usage metrics in Redis.
func (m *MemoryAgent) updateMetrics(ctx context.Context, phone string) {
	// Increment total conversations
	m.redisClient.Incr(ctx, fmt.Sprintf("metrics:%s:total_conversations", phone))

	// Update last interaction timestamp
	metricsKey := fmt.Sprintf("user:%s:metrics", phone)
	m.redisClient.HSet(ctx, metricsKey, map[string]interface{}{
		"last_interaction": time.Now().Unix(),
	})
}

// serializeEntities converts entities map to JSON string.
func (m *MemoryAgent) serializeEntities(entities map[string]interface{}) string {
	if entities == nil {
		return ""
	}
	entitiesJSON, err := json.Marshal(entities)
	if err != nil {
		return ""
	}
	return string(entitiesJSON)
}

// GetConversationHistory retrieves the last N conversation entries.
func (m *MemoryAgent) GetConversationHistory(ctx context.Context, phone string, limit int) ([]ConversationEntry, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}

	key := fmt.Sprintf("conversation:%s", phone)
	entries, err := m.redisClient.LRange(ctx, key, 0, int64(limit-1))
	if err != nil {
		return nil, err
	}

	result := make([]ConversationEntry, 0, len(entries))
	for _, entryJSON := range entries {
		var entry ConversationEntry
		if err := json.Unmarshal([]byte(entryJSON), &entry); err != nil {
			continue
		}
		result = append(result, entry)
	}

	return result, nil
}

// GetUserFacts retrieves all extracted facts for a user.
func (m *MemoryAgent) GetUserFacts(ctx context.Context, phone string) ([]ExtractedFact, error) {
	// In production, this would retrieve facts from Redis
	// For now, return empty facts
	return []ExtractedFact{}, nil
}

// GetConversationSummary returns a text summary of recent conversation.
func (m *MemoryAgent) GetConversationSummary(ctx context.Context, phone string, turns int) (string, error) {
	entries, err := m.GetConversationHistory(ctx, phone, turns)
	if err != nil {
		return "", err
	}

	if len(entries) == 0 {
		return "", nil
	}

	var lines []string
	for _, entry := range entries {
		role := "Cliente"
		if entry.Role == "assistant" {
			role = "Assistente"
		}
		lines = append(lines, fmt.Sprintf("%s: %s", role, entry.Message))
	}

	return strings.Join(lines, "\n"), nil
}

// Ensure MemoryAgent implements AgentInterface
var _ AgentInterface = (*MemoryAgent)(nil)
