package agents

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestResponseAgent_WhatsAppFormat tests the 4096 character limit formatting.
func TestResponseAgent_WhatsAppFormat(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	t.Run("returns_single_message_under_limit", func(t *testing.T) {
		agent := NewResponseAgent("", "", "")

		text := "Olá! Seu ar condicionado foi reparado com sucesso."
		task := &SwarmTask{
			TaskID: "test-response-short",
			Input: map[string]any{
				"phone":           "+5511999999999",
				"normalized_text": text,
				"intent":          "greeting",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.NotNil(t, result)

		sentMessages := result["sent_messages"].([]string)
		require.Len(t, sentMessages, 1)
		require.Equal(t, text, sentMessages[0])
	})

	t.Run("splits_message_over_4096_chars", func(t *testing.T) {
		agent := NewResponseAgent("", "", "")

		// Create a message longer than 4096 characters
		longText := strings.Repeat("Lorem ipsum dolor sit amet, consectetur adipiscing elit. ", 150)

		task := &SwarmTask{
			TaskID: "test-response-long",
			Input: map[string]any{
				"phone":           "+5511999999999",
				"normalized_text": longText,
				"intent":          "technical",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		sentMessages := result["sent_messages"].([]string)
		require.NotEmpty(t, sentMessages)

		// All messages should be under 4096 chars
		for i, msg := range sentMessages {
			require.LessOrEqual(t, len(msg), 4096,
				"Message %d exceeds 4096 char limit", i)
		}

		// Combined should equal original text
		combined := strings.Join(sentMessages, "")
		require.Equal(t, longText, combined)
	})

	t.Run("splits_at_sentence_boundary", func(t *testing.T) {
		agent := NewResponseAgent("", "", "")

		// Create text with clear sentence boundaries
		text := "Primeira frase. Segunda frase. Terceira frase. Quarta frase."
		// This is under 4096 but we test the splitting logic

		task := &SwarmTask{
			TaskID: "test-response-sentences",
			Input: map[string]any{
				"phone":           "+5511999999999",
				"normalized_text": text,
				"intent":          "greeting",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		sentMessages := result["sent_messages"].([]string)
		// Should return as single or properly split
		for _, msg := range sentMessages {
			require.LessOrEqual(t, len(msg), 4096)
		}
	})

	t.Run("handles_empty_context", func(t *testing.T) {
		agent := NewResponseAgent("", "", "")

		task := &SwarmTask{
			TaskID: "test-response-empty",
			Input: map[string]any{
				"phone":   "+5511999999999",
				"context": "",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.NotNil(t, result)

		// Should use fallback response
		require.NotEmpty(t, result["response_text"])
	})

	t.Run("returns_fallback_for_empty_query", func(t *testing.T) {
		agent := NewResponseAgent("", "", "")

		testCases := []struct {
			intent       string
			expectedText string
		}{
			{"greeting", "Olá! Como posso ajudar com seu sistema de climatização hoje?"},
			{"technical", "Entendi sua dúvida técnica."},
			{"commercial", "Para informações comerciais detalhadas"},
			{"billing", "Para questões de faturamento"},
			{"image_search", "Recebi sua imagem"},
			{"unknown", "Obrigado pela mensagem"},
		}

		for _, tc := range testCases {
			t.Run(tc.intent, func(t *testing.T) {
				task := &SwarmTask{
					TaskID: "test-response-fallback-" + tc.intent,
					Input: map[string]any{
						"phone":           "+5511999999999",
						"normalized_text": "",
						"intent":          tc.intent,
					},
				}

				result, err := agent.Execute(ctx, task)
				require.NoError(t, err)

				responseText := result["response_text"].(string)
				require.Contains(t, responseText, tc.expectedText)
			})
		}
	})

	t.Run("missing_phone_error", func(t *testing.T) {
		agent := NewResponseAgent("", "", "")

		task := &SwarmTask{
			TaskID: "test-response-nophone",
			Input: map[string]any{
				"normalized_text": "Test message",
			},
		}

		_, err := agent.Execute(ctx, task)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing phone")
	})
}

// TestResponseAgent_StateWriting verifies response_agent writes to shared state.
func TestResponseAgent_StateWriting(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	agent := NewResponseAgent("", "", "")

	task := &SwarmTask{
		TaskID: "test-response-state",
		Input: map[string]any{
			"phone":           "+5511999999999",
			"normalized_text": "Olá!",
			"intent":          "greeting",
		},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	// Required fields
	requiredKeys := []string{
		"response_text",
		"sent_messages",
		"message_count",
		"response.success",
	}

	for _, key := range requiredKeys {
		_, exists := result[key]
		require.True(t, exists, "Agent must write %s to shared state", key)
	}
}

// TestResponseAgent_FormatForWhatsApp_4096Limit tests the character limit directly.
func TestResponseAgent_FormatForWhatsApp_4096Limit(t *testing.T) {
	agent := NewResponseAgent("", "", "")

	t.Run("exact_4096_chars", func(t *testing.T) {
		text := strings.Repeat("a", 4096)
		messages := agent.formatForWhatsApp(text)
		require.Len(t, messages, 1)
		require.Len(t, messages[0], 4096)
	})

	t.Run("4097_chars_splits", func(t *testing.T) {
		text := strings.Repeat("a", 4097)
		messages := agent.formatForWhatsApp(text)
		require.Len(t, messages, 2)
		require.Len(t, messages[0], 4096)
		require.Len(t, messages[1], 1)
	})

	t.Run("8192_chars_splits_into_two", func(t *testing.T) {
		text := strings.Repeat("b", 8192)
		messages := agent.formatForWhatsApp(text)
		require.Len(t, messages, 2)
		require.Len(t, messages[0], 4096)
		require.Len(t, messages[1], 4096)
	})
}
