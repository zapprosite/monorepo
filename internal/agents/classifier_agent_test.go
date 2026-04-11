package agents

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestClassifierAgent_EntityExtraction tests entity extraction for HVAC domain.
func TestClassifierAgent_EntityExtraction(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	t.Run("extracts_brand_midea", func(t *testing.T) {
		agent := NewClassifierAgent("") // Empty API key forces rule-based extraction

		task := &SwarmTask{
			TaskID: "test-classifier-brand",
			Input: map[string]any{
				"normalized_text": "Meu ar condicionado Midea está com problema",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.NotNil(t, result)

		entities, ok := result["entities"].(*Entity)
		require.True(t, ok, "entities should be *Entity type")
		require.Equal(t, "midea", entities.Brand)
	})

	t.Run("extracts_brand_springer", func(t *testing.T) {
		agent := NewClassifierAgent("")

		task := &SwarmTask{
			TaskID: "test-classifier-springer",
			Input: map[string]any{
				"normalized_text": "Split Springer 12000 BTU não gela",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		entities := result["entities"].(*Entity)
		require.Equal(t, "springer", entities.Brand)
	})

	t.Run("extracts_btu", func(t *testing.T) {
		agent := NewClassifierAgent("")

		task := &SwarmTask{
			TaskID: "test-classifier-btu",
			Input: map[string]any{
				"normalized_text": "Preciso de ajuda com meu ar 24000 BTU",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		entities := result["entities"].(*Entity)
		require.Equal(t, "24000", entities.BTU)
	})

	t.Run("extracts_error_code", func(t *testing.T) {
		agent := NewClassifierAgent("")

		testCases := []struct {
			errorCode string
			text      string
		}{
			{"E1", "Split apresentando erro E1"},
			{"E5", "AC mostrando código E5 no visor"},
			{"F5", "Springer com falha F5"},
			{"P2", "Midea dando P2"},
		}

		for _, tc := range testCases {
			t.Run(tc.errorCode, func(t *testing.T) {
				task := &SwarmTask{
					TaskID: "test-classifier-error-" + tc.errorCode,
					Input: map[string]any{
						"normalized_text": tc.text,
					},
				}

				result, err := agent.Execute(ctx, task)
				require.NoError(t, err)

				entities := result["entities"].(*Entity)
				require.Equal(t, tc.errorCode, entities.ErrorCode)
			})
		}
	})

	t.Run("extracts_refrigerant", func(t *testing.T) {
		agent := NewClassifierAgent("")

		task := &SwarmTask{
			TaskID: "test-classifier-refrigerant",
			Input: map[string]any{
				"normalized_text": "Manutenção preventiva - equipo usa R-410A",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		entities := result["entities"].(*Entity)
		require.Equal(t, "R-410A", entities.Refrigerant)
	})

	t.Run("extracts_multiple_entities", func(t *testing.T) {
		agent := NewClassifierAgent("")

		task := &SwarmTask{
			TaskID: "test-classifier-multi",
			Input: map[string]any{
				"normalized_text": "Springer Midea 24000 BTU erro E1 código F5",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		entities := result["entities"].(*Entity)
		// Should extract first matching brand
		require.NotEmpty(t, entities.Brand)
		require.Equal(t, "24000", entities.BTU)
		require.Equal(t, "E1", entities.ErrorCode)
	})

	t.Run("handles_empty_text", func(t *testing.T) {
		agent := NewClassifierAgent("")

		task := &SwarmTask{
			TaskID: "test-classifier-empty",
			Input: map[string]any{
				"normalized_text": "",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		entities := result["entities"].(*Entity)
		require.Empty(t, entities.Brand)
		require.Empty(t, entities.BTU)
		require.Empty(t, entities.ErrorCode)
	})
}

// TestClassifierAgent_IntentClassification tests intent classification.
func TestClassifierAgent_IntentClassification(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	t.Run("classifies_technical", func(t *testing.T) {
		agent := NewClassifierAgent("")

		task := &SwarmTask{
			TaskID: "test-intent-technical",
			Input: map[string]any{
				"normalized_text": "Meu ar condicionado está apresentando erro E1 e não gela",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		require.Equal(t, string(IntentTechnical), result["intent"])
	})

	t.Run("classifies_greeting", func(t *testing.T) {
		agent := NewClassifierAgent("")

		greetings := []string{
			"Olá, bom dia!",
			"Oi, tudo bem?",
			"Boa tarde!",
			"Hello!",
		}

		for _, greeting := range greetings {
			task := &SwarmTask{
				TaskID: "test-intent-greeting",
				Input: map[string]any{
					"normalized_text": greeting,
				},
			}

			result, err := agent.Execute(ctx, task)
			require.NoError(t, err)
			require.Equal(t, string(IntentGreeting), result["intent"])
		}
	})

	t.Run("classifies_billing", func(t *testing.T) {
		agent := NewClassifierAgent("")

		task := &SwarmTask{
			TaskID: "test-intent-billing",
			Input: map[string]any{
				"normalized_text": "Gostaria de saber o valor da fatura do meu plano",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		require.Equal(t, string(IntentBilling), result["intent"])
	})

	t.Run("classifies_commercial", func(t *testing.T) {
		agent := NewClassifierAgent("")

		task := &SwarmTask{
			TaskID: "test-intent-commercial",
			Input: map[string]any{
				"normalized_text": "Quanto custa para instalar um split 12000 BTU?",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		require.Equal(t, string(IntentCommercial), result["intent"])
	})

	t.Run("rewrites_query_with_entities", func(t *testing.T) {
		agent := NewClassifierAgent("")

		task := &SwarmTask{
			TaskID: "test-rewrite",
			Input: map[string]any{
				"normalized_text": "Springer Midea 24000 BTU erro E1",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		rewritten := result["rewritten_query"].(string)
		require.NotEmpty(t, rewritten)
		require.Contains(t, rewritten, "Springer Midea 24000 BTU erro E1")
	})
}

// TestClassifierAgent_StateWriting verifies classifier writes to shared state.
func TestClassifierAgent_StateWriting(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	agent := NewClassifierAgent("")

	task := &SwarmTask{
		TaskID: "test-classifier-state",
		Input: map[string]any{
			"normalized_text": "Split Springer com problema",
		},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	// Required fields
	requiredKeys := []string{
		"intent",
		"entities",
		"rewritten_query",
		"classifier.success",
	}

	for _, key := range requiredKeys {
		_, exists := result[key]
		require.True(t, exists, "Agent must write %s to shared state", key)
	}
}
