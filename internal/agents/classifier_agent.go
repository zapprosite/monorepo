package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

// Intent represents a classified user intent.
type Intent string

const (
	IntentTechnical   Intent = "technical"
	IntentCommercial  Intent = "commercial"
	IntentBilling     Intent = "billing"
	IntentGreeting    Intent = "greeting"
	IntentImageSearch Intent = "image_search"
	IntentUnknown     Intent = "unknown"
)

// Entity represents extracted entities from user input.
type Entity struct {
	Brand        string `json:"brand,omitempty"`
	Model        string `json:"model,omitempty"`
	BTU          string `json:"btu,omitempty"`
	ErrorCode    string `json:"error_code,omitempty"`
	Part         string `json:"part,omitempty"`
	Refrigerant  string `json:"refrigerant,omitempty"`
	PriceRange   string `json:"price_range,omitempty"`
	Location     string `json:"location,omitempty"`
}

// ClassifierAgent classifies user messages and extracts entities.
// It uses MiniMax M2 for intent classification and entity extraction.
type ClassifierAgent struct {
	minimaxAPIKey string
}

// NewClassifierAgent creates a new ClassifierAgent.
func NewClassifierAgent(minimaxAPIKey string) *ClassifierAgent {
	return &ClassifierAgent{
		minimaxAPIKey: minimaxAPIKey,
	}
}

// AgentType returns the agent type identifier.
func (c *ClassifierAgent) AgentType() string {
	return "classifier"
}

// MaxRetries returns the maximum retry attempts.
func (c *ClassifierAgent) MaxRetries() int {
	return 3
}

// TimeoutMs returns the timeout in milliseconds.
func (c *ClassifierAgent) TimeoutMs() int {
	return 8000
}

// HTTPClient is a simple HTTP client interface for testing.
type HTTPClient interface {
	Do(req *Request) (*Response, error)
}

// Request represents an HTTP request.
type Request struct {
	Method string
	URL    string
	Body   interface{}
	Headers map[string]string
}

// Response represents an HTTP response.
type Response struct {
	StatusCode int
	Body       []byte
	Headers    map[string]string
}

// Execute classifies the message and extracts entities.
func (c *ClassifierAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	startTime := time.Now()
	defer func() {
		task.TimeoutMs = int(time.Since(startTime).Milliseconds())
	}()

	// 1. Read normalized_text from state (passed via input)
	normalizedText, ok := task.Input["normalized_text"].(string)
	if !ok || normalizedText == "" {
		normalizedText = ""
	}

	// Read conversation history if available
	conversationHistory, _ := task.Input["conversation_history"].([]string)
	historyText := strings.Join(conversationHistory, "\n")

	// Read phone for context
	phone, _ := task.Input["phone"].(string)

	// 2. Classify intent using LLM (MiniMax M2)
	intent, err := c.classifyIntent(ctx, normalizedText, historyText, phone)
	if err != nil {
		// Fallback to rule-based classification
		intent = c.ruleBasedClassification(normalizedText)
	}

	// 3. Extract entities
	entities, err := c.extractEntities(ctx, normalizedText, intent)
	if err != nil {
		// Fallback to rule-based entity extraction
		entities = c.ruleBasedEntityExtraction(normalizedText)
	}

	// 4. Rewrite query for retrieval
	rewrittenQuery := c.rewriteQuery(normalizedText, intent, entities)

	// 5. Write to shared state
	result := map[string]any{
		"intent":           string(intent),
		"entities":         entities,
		"rewritten_query":  rewrittenQuery,
		"classifier.success": true,
	}

	return result, nil
}

// classifyIntent uses MiniMax M2 to classify the user intent.
func (c *ClassifierAgent) classifyIntent(ctx context.Context, text, history, phone string) (Intent, error) {
	if c.minimaxAPIKey == "" || text == "" {
		return c.ruleBasedClassification(text), nil
	}

	// Build prompt for intent classification
	prompt := fmt.Sprintf(`Classifique a intenção da seguinte mensagem de WhatsApp de um cliente de climatização (HVAC).

Contexto do cliente: %s
Histórico da conversa:
%s

Mensagem atual: %s

Responda APENAS com uma das seguintes intenções (sem texto adicional):
- technical: pergunta técnica sobre equipamento, manutenção, reparação, peças
- commercial: pergunta comercial sobre preços, orçamentos, serviços, agendamento
- billing: questões sobre faturamento, pagamentos, faturas, cobranças
- greeting: saudação, cumprimento, conversa casual
- image_search: usuário enviou uma imagem para análise
- unknown: não é possível determinar a intenção

Intenção:`, phone, history, text)

	// Call MiniMax API
	resp, err := c.callMiniMax(ctx, prompt)
	if err != nil {
		return IntentUnknown, err
	}

	intent := strings.TrimSpace(resp)
	switch strings.ToLower(intent) {
	case "technical":
		return IntentTechnical, nil
	case "commercial":
		return IntentCommercial, nil
	case "billing":
		return IntentBilling, nil
	case "greeting":
		return IntentGreeting, nil
	case "image_search":
		return IntentImageSearch, nil
	default:
		return IntentUnknown, nil
	}
}

// extractEntities uses MiniMax to extract entities from the message.
func (c *ClassifierAgent) extractEntities(ctx context.Context, text string, intent Intent) (*Entity, error) {
	entity := &Entity{}

	if text == "" {
		return entity, nil
	}

	if c.minimaxAPIKey == "" {
		return c.ruleBasedEntityExtraction(text), nil
	}

	// Build prompt for entity extraction
	prompt := fmt.Sprintf(`Extraia as seguintes entidades da mensagem HVAC:
- brand: marca do equipamento (ex: Springer, Midea, LG, Daikin, Carrier, York, etc.)
- model: modelo específico se mencionado
- btu: potência em BTU se mencionada (ex: 12000, 24000)
- error_code: código de erro se mencionado (ex: E1, F5, P2)
- part: peça ou componente mencionado
- refrigerant: tipo de gás refrigerante (ex: R-410A, R-22, R-134a)
- price_range: faixa de preço se mencionada
- location: localização ou zona se mencionada

Mensagem: %s

Responda em JSON com os campos acima (vazios se não mencionados).`, text)

	resp, err := c.callMiniMax(ctx, prompt)
	if err != nil {
		return c.ruleBasedEntityExtraction(text), nil
	}

	// Parse JSON response
	if err := json.Unmarshal([]byte(resp), entity); err != nil {
		// Fallback to rule-based
		return c.ruleBasedEntityExtraction(text), nil
	}

	return entity, nil
}

// rewriteQuery rewrites the query for better retrieval.
func (c *ClassifierAgent) rewriteQuery(text string, intent Intent, entities *Entity) string {
	if text == "" {
		return ""
	}

	// Build enhanced query with entities
	var parts []string
	parts = append(parts, text)

	if entities.Brand != "" {
		parts = append(parts, "marca: "+entities.Brand)
	}
	if entities.Model != "" {
		parts = append(parts, "modelo: "+entities.Model)
	}
	if entities.BTU != "" {
		parts = append(parts, entities.BTU+" BTU")
	}
	if entities.ErrorCode != "" {
		parts = append(parts, "código erro: "+entities.ErrorCode)
	}
	if entities.Part != "" {
		parts = append(parts, "peça: "+entities.Part)
	}
	if entities.Refrigerant != "" {
		parts = append(parts, "gás: "+entities.Refrigerant)
	}

	return strings.Join(parts, " | ")
}

// ruleBasedClassification provides fallback classification without LLM.
func (c *ClassifierAgent) ruleBasedClassification(text string) Intent {
	text = strings.ToLower(text)

	// Greeting patterns
	greetings := []string{"oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "hey", "hi", "hello"}
	for _, g := range greetings {
		if strings.Contains(text, g) {
			return IntentGreeting
		}
	}

	// Billing patterns
	billing := []string{"fatura", "pagamento", "cobranca", "cobrar", "valor", "nota fiscal", "recibo", "boleto", "debito", "credito"}
	for _, b := range billing {
		if strings.Contains(text, b) {
			return IntentBilling
		}
	}

	// Image patterns
	if strings.Contains(text, "[imagem]") || strings.Contains(text, "foto") || strings.Contains(text, "imagem") {
		return IntentImageSearch
	}

	// Technical patterns
	technical := []string{"erro", "falha", "nao funciona", "não funciona", "barulho", "vazando", "gotejando", "pression", "temperatura", "nao liga", "não liga", "revisão", "manutenção", "consertar", "reparar", "peça", "código"}
	for _, t := range technical {
		if strings.Contains(text, t) {
			return IntentTechnical
		}
	}

	// Commercial patterns
	commercial := []string{"preço", "valor", "orcamento", "orçamento", "quanto custa", "instalar", "serviço", "agendar", "manutenção", "plano", "contrato"}
	for _, co := range commercial {
		if strings.Contains(text, co) {
			return IntentCommercial
		}
	}

	return IntentUnknown
}

// ruleBasedEntityExtraction provides fallback entity extraction without LLM.
func (c *ClassifierAgent) ruleBasedEntityExtraction(text string) *Entity {
	entity := &Entity{}
	textLower := strings.ToLower(text)
	textUpper := strings.ToUpper(text)

	// Common brands (including Samsung and common misspellings)
	brandMap := map[string]string{
		"springer":   "springer",
		"midea":      "midea",
		"lg":         "lg",
		"daikin":     "daikin",
		"carrier":    "carrier",
		"york":       "york",
		"trane":      "trane",
		"panasonic":  "panasonic",
		"electrolux": "electrolux",
		"consul":     "consul",
		"philco":     "philco",
		"adt":        "adt",
		"hitachi":    "hitachi",
		"mitsubishi": "mitsubishi",
		"samsung":    "samsung",
		"samgsung":   "samsung",
		"samung":     "samsung",
	}
	for match, brand := range brandMap {
		if strings.Contains(textLower, match) {
			entity.Brand = brand
			break
		}
	}

	// BTU patterns
	btuPatterns := []string{"12000", "18000", "24000", "30000", "36000", "48000", "60000"}
	for _, btu := range btuPatterns {
		if strings.Contains(text, btu) {
			entity.BTU = btu
			break
		}
	}

	// Error code patterns (E1, F5, P2, etc.)
	errorCodes := []string{"E0", "E1", "E2", "E3", "E4", "E5", "F1", "F2", "F3", "F4", "F5", "P1", "P2", "P3", "P4", "P5"}
	for _, ec := range errorCodes {
		if strings.Contains(textUpper, ec) {
			entity.ErrorCode = ec
			break
		}
	}

	// LG error codes: CH01-CH99
	lgErrorPattern := regexp.MustCompile(`CH\d{2}`)
	if match := lgErrorPattern.FindString(textUpper); match != "" {
		entity.ErrorCode = match
	}

	// Samsung error codes: E101-E502
	samsungErrorPattern := regexp.MustCompile(`E1[0-9][0-9]|E2[0-9][0-9]|E3[0-9][0-9]|E4[0-2][0-9]|E5[0-2]`)
	if match := samsungErrorPattern.FindString(textUpper); match != "" {
		entity.ErrorCode = match
	}

	// Daikin error codes: A1-C99
	daikinErrorPattern := regexp.MustCompile(`[ABC][0-9]{1,2}`)
	if match := daikinErrorPattern.FindString(textUpper); match != "" {
		entity.ErrorCode = match
	}

	// Specific known error codes for each brand
	knownLGErrors := []string{"CH01", "CH02", "CH06", "CH08", "CH10", "CH11", "CH29", "CH57", "CH59", "CH99"}
	for _, ec := range knownLGErrors {
		if strings.Contains(textUpper, ec) {
			entity.ErrorCode = ec
			break
		}
	}

	knownSamsungErrors := []string{"E101", "E121", "E126", "E128", "E129", "E154", "E201", "E261", "E306", "E401", "E502"}
	for _, ec := range knownSamsungErrors {
		if strings.Contains(textUpper, ec) {
			entity.ErrorCode = ec
			break
		}
	}

	knownDaikinErrors := []string{"A1", "A5", "A6", "C1", "C4", "C28", "C30", "C35", "C36", "C59"}
	for _, ec := range knownDaikinErrors {
		if strings.Contains(textUpper, ec) {
			entity.ErrorCode = ec
			break
		}
	}

	// Refrigerant patterns
	refrigerants := []string{"r-410a", "r-22", "r-134a", "r-32", "r-290", "r-407c"}
	for _, r := range refrigerants {
		if strings.Contains(textLower, r) {
			entity.Refrigerant = strings.ToUpper(r)
			break
		}
	}

	return entity
}

// callMiniMax calls the MiniMax API for text generation using the Anthropic-compatible endpoint.
func (c *ClassifierAgent) callMiniMax(ctx context.Context, prompt string) (string, error) {
	if c.minimaxAPIKey == "" {
		// Try environment variable as fallback
		c.minimaxAPIKey = os.Getenv("MINIMAX_API_KEY")
	}
	if c.minimaxAPIKey == "" {
		return "", fmt.Errorf("minimax API key not configured")
	}

	reqBody := MiniMaxRequest{
		Model: "MiniMax-M2",
		Messages: []MiniMaxMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens: 100,
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
	req.Header.Set("Authorization", "Bearer "+c.minimaxAPIKey)

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

// Ensure ClassifierAgent implements AgentInterface
var _ AgentInterface = (*ClassifierAgent)(nil)
