package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/rag"
	"github.com/will-zappro/hvacr-swarm/internal/whatsapp"
)

// ResponseAgent generates and sends responses via WhatsApp or Telegram.
type ResponseAgent struct {
	minimaxAPIKey   string
	whatsappToken   string
	phoneNumberID   string
	whatsappSender  whatsapp.SenderClient
	telegramSender  whatsapp.TelegramSenderClient
	refiner         *rag.Refiner
}

const (
	ESCALATION_THRESHOLD    = 0.70
	HIGH_CONFIDENCE         = 0.85
	MINIMAX_FALLBACK_CONF   = 0.95
)

// NewResponseAgent creates a new ResponseAgent.
func NewResponseAgent(minimaxAPIKey, whatsappToken, phoneNumberID string) *ResponseAgent {
	agent := &ResponseAgent{
		minimaxAPIKey:  minimaxAPIKey,
		whatsappToken:  whatsappToken,
		phoneNumberID:  phoneNumberID,
		refiner:        rag.NewRefiner(),
	}
	// Initialize WhatsApp sender - use simulator if DEV_MODE=true or SIMULATE_WHATSAPP=true
	// This allows outbound message simulation during development without Meta API calls
	if isDevMode() || whatsapp.IsSimulated() {
		agent.whatsappSender = whatsapp.NewSimulatedGraphAPIClient()
	} else if whatsappToken != "" && phoneNumberID != "" {
		agent.whatsappSender = whatsapp.NewGraphAPIClient(phoneNumberID, whatsappToken)
	}
	return agent
}

// NewResponseAgentWithTelegram creates a ResponseAgent with Telegram support for dev mode.
func NewResponseAgentWithTelegram(minimaxAPIKey, whatsappToken, phoneNumberID, telegramToken, defaultChatID string) *ResponseAgent {
	agent := NewResponseAgent(minimaxAPIKey, whatsappToken, phoneNumberID)
	if telegramToken != "" {
		agent.telegramSender = whatsapp.NewTelegramBotClient(telegramToken, defaultChatID)
	}
	return agent
}

// AgentType returns the agent type identifier.
func (r *ResponseAgent) AgentType() string {
	return "response"
}

// MaxRetries returns the maximum retry attempts.
func (r *ResponseAgent) MaxRetries() int {
	return 2
}

// TimeoutMs returns the timeout in milliseconds.
func (r *ResponseAgent) TimeoutMs() int {
	return 20000
}

// WhatsAppMessagePayload is the payload for sending WhatsApp messages.
type WhatsAppMessagePayload struct {
	MessagingProduct string `json:"messaging_product"`
	To                string `json:"to"`
	Type             string `json:"type"`
	Text             *struct {
		PreviewURL bool   `json:"preview_url"`
		Body       string `json:"body"`
	} `json:"text,omitempty"`
	Image *struct {
		Link string `json:"link,omitempty"`
		ID   string `json:"id,omitempty"`
		Caption string `json:"caption,omitempty"`
	} `json:"image,omitempty"`
	Template *struct {
		Name       string                 `json:"name"`
		Language   map[string]string      `json:"language"`
		Components []map[string]interface{} `json:"components,omitempty"`
	} `json:"template,omitempty"`
}

// Execute generates a response and sends it via WhatsApp.
func (r *ResponseAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	startTime := time.Now()
	defer func() {
		task.TimeoutMs = int(time.Since(startTime).Milliseconds())
	}()

	// DEBUG: Log all input keys and chat_id value
	inputKeys := make([]string, 0, len(task.Input))
	for k := range task.Input {
		inputKeys = append(inputKeys, k)
	}
	chatIDRaw, hasChatIDRaw := task.Input["chat_id"]
	chatIDStr, chatIDIsString := task.Input["chat_id"].(string)
	log.Printf("[response] DEBUG input keys: %v, chat_id raw: %#v (%T), hasChatIDRaw=%v, chatIDStr=%q isString=%v",
		inputKeys, chatIDRaw, chatIDRaw, hasChatIDRaw, chatIDStr, chatIDIsString)

	// 1. Read assembled_context from state
	assembledContext, _ := task.Input["assembled_context"].(string)
	if assembledContext == "" {
		assembledContext, _ = task.Input["context"].(string)
	}

	// Read query/intent for prompt construction
	query, _ := task.Input["normalized_text"].(string)
	intent, _ := task.Input["intent"].(string)
	entities, _ := task.Input["entities"].(map[string]interface{})
	phone, _ := task.Input["phone"].(string)
	messageID, _ := task.Input["message_id"].(string)

	if phone == "" {
		return nil, fmt.Errorf("missing phone in task input")
	}

	// 2. Generate response using MiniMax M2.7
	responseText, err := r.generateResponse(ctx, query, intent, entities, assembledContext)
	if err != nil {
		return nil, fmt.Errorf("generate response: %w", err)
	}

	// 3. Anti-hallucination check
	hallucinationDetected := false
	if err := r.checkHallucination(responseText, assembledContext); err != nil {
		// If hallucination detected, use fallback response
		responseText = r.getFallbackResponse(intent)
		hallucinationDetected = true
	}

	// 3.5. Calculate confidence first (needed for escalation check)
	confidence := r.calculateConfidence(responseText, assembledContext, hallucinationDetected, intent)

	// 3.6. Evaluate if should escalate to MiniMax
	escalatedResponse, shouldEscalate, err := r.evaluateAndEscalate(
		ctx, query, intent, entities,
		assembledContext, confidence, hallucinationDetected,
	)
	if err != nil {
		log.Printf("[response] ERROR evaluating escalation: %v", err)
	}
	if shouldEscalate && escalatedResponse != "" {
		log.Printf("[response] INFO: escalation triggered (context=%q, confidence=%.2f, hallucination=%v)",
			truncate(assembledContext, 50), confidence, hallucinationDetected)
		responseText = escalatedResponse
		confidence = MINIMAX_FALLBACK_CONF // MiniMax response is high quality
		hallucinationDetected = false
	}

	// 4. Refine response using rag.Refiner
	metadata := map[string]string{
		"intent": intent,
	}
	refinedResult := r.refiner.RefineDirect(responseText, confidence, metadata)

	// 5. Format for WhatsApp using Refiner's formatting (with confidence indicators)
	formattedMessages := r.formatRefinedForWhatsApp(refinedResult)

	// 6. Send via WhatsApp or Telegram
	var sentMessages []string

	// Check if this is a Telegram message (has chat_id in input)
	chatID, hasChatID := task.Input["chat_id"].(string)
	// If hasChatID is true but chatID is empty, try to use TELEGRAM_CHAT_ID from env
	if hasChatID && chatID == "" {
		if envChatID := os.Getenv("TELEGRAM_CHAT_ID"); envChatID != "" {
			chatID = envChatID
			hasChatID = true
			log.Printf("[response] INFO: using default TELEGRAM_CHAT_ID from env since input chat_id was empty")
		}
	}

	for _, msg := range formattedMessages {
		var err error
		log.Printf("[response] DEBUG send decision: hasChatID=%v, chatID=%q, telegramSender=%v, whatsappSender=%v",
			hasChatID, chatID, r.telegramSender != nil, r.whatsappSender != nil)
		if hasChatID && r.telegramSender != nil {
			// Telegram mode - use chat_id as destination
			log.Printf("[response] sending via Telegram to chat_id=%s: %s", chatID, truncate(msg, 50))
			tgResp, err := r.telegramSender.SendText(ctx, chatID, msg)
			if err != nil {
				log.Printf("[response] ERROR sending Telegram: %v", err)
			} else {
				log.Printf("[response] Telegram response: ok=%v, message_id=%d", tgResp.OK, tgResp.Result.MessageID)
			}
		} else if r.whatsappSender != nil {
			// WhatsApp mode
			log.Printf("[response] sending via WhatsApp to phone=%s: %s", phone, truncate(msg, 50))
			err = r.sendWhatsAppMessage(ctx, phone, msg)
		} else {
			// No sender configured - log warning
			log.Printf("[response] WARNING: no sender configured (telegram=%v, whatsapp=%v), skipping message: %s",
				r.telegramSender != nil, r.whatsappSender != nil, truncate(msg, 50))
			err = nil
		}
		if err != nil {
			// Log error but continue with other messages
			continue
		}
		sentMessages = append(sentMessages, msg)
	}

	// 7. Write to shared state
	result := map[string]any{
		"response_text":     refinedResult.Response,
		"sent_messages":     sentMessages,
		"message_count":     len(sentMessages),
		"response.success":  true,
		"confidence":        refinedResult.ConfidencePct,
		"confidence_level":  confidenceLevelToString(refinedResult.Confidence),
		"needs_technician":  refinedResult.NeedsTech,
	}

	if messageID != "" {
		result["reply_to"] = messageID
	}

	return result, nil
}

// calculateConfidence determines the confidence score for the response.
func (r *ResponseAgent) calculateConfidence(responseText, context string, hallucinationDetected bool, intent string) float64 {
	// No response generated
	if responseText == "" {
		return 0.0
	}

	// Hallucination detected = low confidence
	if hallucinationDetected {
		return 0.45
	}

	// No context available - but greeting can be answered without context
	if context == "" {
		if intent == "greeting" {
			return 0.90 // Greetings are high confidence
		}
		return 0.55
	}

	// High confidence indicators: good context + non-fallback response + specific intent
	contextQuality := float64(min(len(context), 500)) / 500.0 // 0-1 based on context length, capped at 500
	if contextQuality > 1.0 {
		contextQuality = 1.0
	}

	// Base confidence from context
	baseConfidence := 0.60 + (contextQuality * 0.25) // 0.60-0.85

	// Boost for specific intents that can be answered well
	switch intent {
	case "technical", "billing", "commercial":
		baseConfidence += 0.05
	case "greeting":
		baseConfidence = 0.90 // Greetings are always high confidence
	}

	// Cap at 0.84 (medium-high, not quite high >= 0.85)
	if baseConfidence > 0.84 {
		baseConfidence = 0.84
	}

	return baseConfidence
}

// formatRefinedForWhatsApp formats a RefineResult for WhatsApp with confidence indicator.
func (r *ResponseAgent) formatRefinedForWhatsApp(result rag.RefineResult) []string {
	const maxLength = 4096

	// Use the refiner's built-in WhatsApp formatting
	formatted := r.refiner.FormatForWhatsApp(result)

	if len(formatted) <= maxLength {
		return []string{formatted}
	}

	// Split into chunks of maxLength, trying to break at sentence boundaries
	var messages []string
	remaining := formatted

	for len(remaining) > maxLength {
		// Find the last sentence boundary before maxLength
		chunk := remaining[:maxLength]
		lastPeriod := strings.LastIndex(chunk, ".")
		lastNewline := strings.LastIndex(chunk, "\n")
		lastBreak := lastPeriod
		if lastNewline > lastBreak {
			lastBreak = lastNewline
		}

		// If no good break point, break at maxLength
		if lastBreak < maxLength/2 {
			lastBreak = maxLength - 1
		} else {
			lastBreak++ // Include the break character
		}

		messages = append(messages, strings.TrimSpace(remaining[:lastBreak]))
		remaining = remaining[lastBreak:]
	}

	if len(remaining) > 0 {
		messages = append(messages, strings.TrimSpace(remaining))
	}

	return messages
}

// generateResponse generates a response using MiniMax M2.7.
func (r *ResponseAgent) generateResponse(ctx context.Context, query, intent string, entities map[string]interface{}, context string) (string, error) {
	if query == "" {
		return r.getFallbackResponse(intent), nil
	}

	// Build prompt based on intent
	var prompt strings.Builder

	switch intent {
	case "greeting":
		prompt.WriteString("Responda à seguinte saudação de forma amigável e profissional:\n\n")
		prompt.WriteString(query)
	case "technical":
		prompt.WriteString("Você é um técnico especialista em climatização (HVAC). Responda à pergunta do cliente de forma clara e útil.\n\n")
		if context != "" {
			prompt.WriteString("Contexto técnico:\n")
			prompt.WriteString(context)
			prompt.WriteString("\n\n")
		}
		prompt.WriteString("Pergunta do cliente:\n")
		prompt.WriteString(query)
	case "commercial":
		prompt.WriteString("Você é um consultor comercial de climatização. Responda à consulta do cliente.\n\n")
		if context != "" {
			prompt.WriteString("Contexto:\n")
			prompt.WriteString(context)
			prompt.WriteString("\n\n")
		}
		prompt.WriteString("Consulta:\n")
		prompt.WriteString(query)
	case "billing":
		prompt.WriteString("Você é um atendente de billing. Responda à questão de faturamento do cliente com precisão.\n\n")
		if context != "" {
			prompt.WriteString("Contexto:\n")
			prompt.WriteString(context)
			prompt.WriteString("\n\n")
		}
		prompt.WriteString("Questão:\n")
		prompt.WriteString(query)
	default:
		prompt.WriteString("Responda à mensagem do cliente:\n\n")
		if context != "" {
			prompt.WriteString("Contexto:\n")
			prompt.WriteString(context)
			prompt.WriteString("\n\n")
		}
		prompt.WriteString("Mensagem:\n")
		prompt.WriteString(query)
	}

	prompt.WriteString("\n\nResposta (responda apenas com a resposta, sem formatação extra):")

	// Check for API key
	if r.minimaxAPIKey == "" {
		r.minimaxAPIKey = os.Getenv("MINIMAX_API_KEY")
	}
	if r.minimaxAPIKey == "" {
		return r.getFallbackResponse(intent), nil
	}

	// Call MiniMax API
	resp, err := r.callMiniMax(ctx, prompt.String())
	if err != nil {
		return r.getFallbackResponse(intent), nil
	}

	return strings.TrimSpace(resp), nil
}

// callMiniMax calls the MiniMax API for text generation.
func (r *ResponseAgent) callMiniMax(ctx context.Context, prompt string) (string, error) {
	if r.minimaxAPIKey == "" {
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
	req.Header.Set("Authorization", "Bearer "+r.minimaxAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("anthropic-dangerous-direct-browser-access", "true")

	client := &http.Client{Timeout: 15 * time.Second}
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

// checkHallucination checks if the response contains hallucinations.
func (r *ResponseAgent) checkHallucination(response, context string) error {
	if response == "" {
		return fmt.Errorf("empty response")
	}

	// Basic hallucination checks
	// 1. Check if response is too generic
	genericResponses := []string{"não sei", "não tenho certeza", "não posso responder", "informação não disponível"}
	responseLower := strings.ToLower(response)
	for _, generic := range genericResponses {
		if strings.Contains(responseLower, generic) && context == "" {
			return fmt.Errorf("response contains generic statement without context")
		}
	}

	// 2. Check if response contradicts itself
	// (simplified check - in production would use more sophisticated methods)
	words := strings.Fields(response)
	if len(words) > 0 && len(words) < 3 {
		return fmt.Errorf("response too short")
	}

	return nil
}

// evaluateAndEscalate decides whether to escalate to MiniMax based on context quality and confidence.
func (r *ResponseAgent) evaluateAndEscalate(ctx context.Context, query, intent string, entities map[string]interface{}, assembledContext string, confidence float64, hallucinationDetected bool) (string, bool, error) {
	// Query vazia - já tem fallback, não escala
	if query == "" {
		return "", false, nil
	}
	// Greeting não precisa de escalação - tem fallback de alta confiança
	if intent == "greeting" && confidence >= 0.80 && !hallucinationDetected {
		return "", false, nil
	}
	// Se contexto bom e confidence alto, não escala
	if assembledContext != "" && confidence >= ESCALATION_THRESHOLD && !hallucinationDetected {
		return "", false, nil // skip escalation, usa fluxo normal
	}
	// Escalona para MiniMax
	response, err := r.escalateToMiniMax(ctx, query, intent, entities, assembledContext)
	return response, true, err
}

// escalateToMiniMax escalates the query to MiniMax M2.7 for processing.
func (r *ResponseAgent) escalateToMiniMax(ctx context.Context, query, intent string, entities map[string]interface{}, assembledContext string) (string, error) {
	// Build prompt for escalation
	var prompt strings.Builder
	prompt.WriteString("Você é um técnico especialista em climatização (HVAC). Responda à pergunta do cliente escalado.\n\n")

	if assembledContext != "" {
		prompt.WriteString("Contexto relevante:\n")
		prompt.WriteString(assembledContext)
		prompt.WriteString("\n\n")
	}

	if intent != "" {
		prompt.WriteString("Intent detectado: ")
		prompt.WriteString(intent)
		prompt.WriteString("\n\n")
	}

	if entities != nil && len(entities) > 0 {
		prompt.WriteString("Entidades identificadas:\n")
		for k, v := range entities {
			prompt.WriteString(fmt.Sprintf("- %s: %v\n", k, v))
		}
		prompt.WriteString("\n")
	}

	prompt.WriteString("Pergunta do cliente:\n")
	prompt.WriteString(query)

	prompt.WriteString("\n\nResposta (responda apenas com a resposta, sem formatação extra):")

	// Check for API key
	if r.minimaxAPIKey == "" {
		r.minimaxAPIKey = os.Getenv("MINIMAX_API_KEY")
	}
	if r.minimaxAPIKey == "" {
		return "", fmt.Errorf("minimax API key not configured for escalation")
	}

	return r.callMiniMax(ctx, prompt.String())
}

// sendWhatsAppMessage sends a message via WhatsApp Cloud API.
func (r *ResponseAgent) sendWhatsAppMessage(ctx context.Context, to, text string) error {
	if r.whatsappSender == nil {
		// No WhatsApp API configured - skip silently (fallback mode)
		return nil
	}

	_, err := r.whatsappSender.SendText(ctx, to, text)
	if err != nil {
		return fmt.Errorf("send WhatsApp message: %w", err)
	}

	return nil
}

// getFallbackResponse returns a fallback response based on intent.
func (r *ResponseAgent) getFallbackResponse(intent string) string {
	switch intent {
	case "greeting":
		return "Olá! Como posso ajudar com seu sistema de climatização hoje?"
	case "technical":
		return "Entendi sua dúvida técnica. Para melhor ajudá-lo, poderia fornecer mais detalhes sobre o modelo e sintoma do equipamento?"
	case "commercial":
		return "Para informações comerciais detalhadas, entre em contato com nossa equipe de vendas. Posso ajudar com mais alguma coisa?"
	case "billing":
		return "Para questões de faturamento, por favor aguarde um momento enquanto verifico suas informações."
	case "image_search":
		return "Recebi sua imagem. Deixe-me analisar e responder em breve."
	default:
		return "Obrigado pela mensagem. Um de nossos especialistas responderá em breve."
	}
}

// Ensure ResponseAgent implements AgentInterface
var _ AgentInterface = (*ResponseAgent)(nil)

// truncate truncates a string to maxLen characters, adding "..." if truncated.
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// confidenceLevelToString converts a ConfidenceLevel to its string representation.
func confidenceLevelToString(level rag.ConfidenceLevel) string {
	switch level {
	case rag.ConfidenceHigh:
		return "high"
	case rag.ConfidenceMedium:
		return "medium"
	case rag.ConfidenceLow:
		return "low"
	default:
		return "none"
	}
}
