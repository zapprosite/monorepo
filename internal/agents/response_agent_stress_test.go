package agents

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestResponseAgent_Stress_EscalationThresholds testa os thresholds de escalação
func TestResponseAgent_Stress_EscalationThresholds(t *testing.T) {
	ctx := context.Background()
	agent := NewResponseAgent("", "", "") // Sem API key - escalação vai falhar API

	tests := []struct {
		name                    string
		context                 string
		confidence              float64
		hallucination           bool
		intent                  string
		query                   string
		expectShouldEscalate    bool
	}{
		{
			name:                 "context_vazio_query_vazia_nao_escala",
			context:              "",
			confidence:           0.55,
			hallucination:        false,
			intent:               "unknown",
			query:                "",
			expectShouldEscalate: false, // Query vazia não escala
		},
		{
			name:                 "context_vazio_confidence_baixo_escala",
			context:              "",
			confidence:           0.55,
			hallucination:        false,
			intent:               "technical",
			query:                "meu ar não gela",
			expectShouldEscalate: true, // Deve tentar escalar
		},
		{
			name:                 "context_cheio_confidence_alto_nao_escala",
			context:              "Modelo: split 12000 BTU, gás R-410A",
			confidence:           0.85,
			hallucination:        false,
			intent:               "technical",
			query:                "ar não gela",
			expectShouldEscalate: false,
		},
		{
			name:                 "context_cheio_confidence_70_nao_escala",
			context:              "Modelo: split 12000 BTU",
			confidence:           0.70,
			hallucination:        false,
			intent:               "technical",
			query:                "ar não gela",
			expectShouldEscalate: false, // Exactly at threshold
		},
		{
			name:                 "context_cheio_confidence_69_escala",
			context:              "Modelo: split 12000 BTU",
			confidence:           0.69,
			hallucination:        false,
			intent:               "technical",
			query:                "ar não gela",
			expectShouldEscalate: true, // Abaixo do threshold
		},
		{
			name:                 "hallucination_detected_escala",
			context:              "Modelo: split 12000 BTU",
			confidence:           0.85,
			hallucination:        true,
			intent:               "technical",
			query:                "ar não gela",
			expectShouldEscalate: true, // Hallucination força escalação
		},
		{
			name:                 "greeting_nao_escala",
			context:              "",
			confidence:           0.90,
			hallucination:        false,
			intent:               "greeting",
			query:                "Olá",
			expectShouldEscalate: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, shouldEscalate, _ := agent.evaluateAndEscalate(
				ctx, tt.query, tt.intent, nil, tt.context, tt.confidence, tt.hallucination,
			)
			// Erro de API é esperado quando não tem API key
			// O importante é que shouldEscalate reflete a lógica correta
			require.Equal(t, tt.expectShouldEscalate, shouldEscalate, "escalation decision mismatch")
		})
	}
}

// TestResponseAgent_Stress_ConcurrentRequests testa escalação com requisições concorrentes
func TestResponseAgent_Stress_ConcurrentRequests(t *testing.T) {
	ctx := context.Background()
	agent := NewResponseAgent("", "", "") // Sem API key

	const numRequests = 100
	var wg sync.WaitGroup
	wg.Add(numRequests)

	results := make(chan string, numRequests)
	errors := make(chan error, numRequests)

	start := time.Now()

	for i := 0; i < numRequests; i++ {
		go func(id int) {
			defer wg.Done()

			task := &SwarmTask{
				TaskID: "stress-test-" + string(rune('0'+id%10)),
				Input: map[string]any{
					"phone":           "+5511999999999",
					"normalized_text": "ar não gela",
					"intent":          "technical",
					"context":         "", // Força escalação
				},
			}

			result, err := agent.Execute(ctx, task)
			if err != nil {
				errors <- err
				return
			}
			results <- result["response_text"].(string)
		}(i)
	}

	wg.Wait()
	elapsed := time.Since(start)

	close(results)
	close(errors)

	// Verificações
	require.Len(t, errors, 0, "不应该有错误")

	responseCount := 0
	for range results {
		responseCount++
	}

	t.Logf("Stress test: %d requests in %v (%.2f req/s)",
		numRequests, elapsed, float64(numRequests)/elapsed.Seconds())
	require.Equal(t, numRequests, responseCount)
}

// TestResponseAgent_Stress_LongQuery testa query muito longa
func TestResponseAgent_Stress_LongQuery(t *testing.T) {
	ctx := context.Background()
	agent := NewResponseAgent("", "", "")

	// Query de 10KB
	longQuery := strings.Repeat("O ar condicionado não está funcionando corretamente. ", 400)

	task := &SwarmTask{
		TaskID: "stress-long-query",
		Input: map[string]any{
			"phone":           "+5511999999999",
			"normalized_text": longQuery,
			"intent":          "technical",
			"context":         "",
		},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)
	require.NotEmpty(t, result["response_text"])
}

// TestResponseAgent_Stress_EmptyContextManyEntities testa contexto vazio com muitas entidades
func TestResponseAgent_Stress_EmptyContextManyEntities(t *testing.T) {
	ctx := context.Background()
	agent := NewResponseAgent("", "", "")

	entities := map[string]interface{}{
		"brand":       "Springer",
		"model":       "Slnt 18IB",
		"btu":         18000,
		"type":        "Split",
		"gas":         "R-410A",
		"install_date": "2020-01-15",
		"last_service":  "2024-06-01",
	}

	task := &SwarmTask{
		TaskID: "stress-entities",
		Input: map[string]any{
			"phone":           "+5511999999999",
			"normalized_text": "ar não gela",
			"intent":          "technical",
			"context":         "",
			"entities":        entities,
		},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)
	require.NotEmpty(t, result["response_text"])
}

// TestResponseAgent_Stress_RapidIntentChanges testa mudanças rápidas de intent
func TestResponseAgent_Stress_RapidIntentChanges(t *testing.T) {
	ctx := context.Background()
	agent := NewResponseAgent("", "", "")

	intents := []string{"greeting", "technical", "billing", "commercial", "technical", "greeting"}

	for i, intent := range intents {
		task := &SwarmTask{
			TaskID: "stress-intent-" + string(rune('0'+i)),
			Input: map[string]any{
				"phone":           "+5511999999999",
				"normalized_text": "Olá",
				"intent":          intent,
				"context":         "",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.NotEmpty(t, result["response_text"])
	}
}

// TestResponseAgent_Stress_EscalateToMiniMax testa escalateToMiniMax com diferentes inputs
func TestResponseAgent_Stress_EscalateToMiniMax(t *testing.T) {
	ctx := context.Background()
	agent := NewResponseAgent("", "", "") // Sem API key - vai falhar

	tests := []struct {
		name     string
		query    string
		intent   string
		entities map[string]interface{}
		context  string
	}{
		{
			name:   "apenas_query",
			query:  "ar não gela",
			intent: "technical",
		},
		{
			name:     "query_intent_entities",
			query:    "ar não gela",
			intent:   "technical",
			entities: map[string]interface{}{"brand": "Springer"},
		},
		{
			name:    "query_intent_entities_context",
			query:   "ar não gela",
			intent:  "technical",
			entities: map[string]interface{}{"brand": "Springer", "model": "Slnt 18IB"},
			context: "Contexto técnico do equipamento",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Sem API key, deve retornar erro
			_, err := agent.escalateToMiniMax(ctx, tt.query, tt.intent, tt.entities, tt.context)
			require.Error(t, err) // Espera erro porque não tem API key
		})
	}
}
