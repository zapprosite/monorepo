package agents

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestIntakeAgent_Execute tests the intake agent's main Execute method.
func TestIntakeAgent_Execute(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	t.Run("parses_text_message", func(t *testing.T) {
		agent := NewIntakeAgent("test-secret", "")

		payload := createTestWhatsAppPayload()
		payload["entry"].([]map[string]any)[0]["changes"].([]map[string]any)[0]["value"].(map[string]any)["messages"].([]map[string]any)[0]["type"] = "text"
		payload["entry"].([]map[string]any)[0]["changes"].([]map[string]any)[0]["value"].(map[string]any)["messages"].([]map[string]any)[0]["text"] = map[string]any{
			"body": "Hello, my AC is not working",
		}

		task := &SwarmTask{
			TaskID: "test-intake-1",
			Input: map[string]any{
				"webhook_payload": payload,
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.NotNil(t, result)

		// Verify output keys
		require.Equal(t, "5511999999999", result["phone"])
		require.Equal(t, "text", result["message_type"])
		require.NotEmpty(t, result["request_id"])
		require.True(t, result["intake.success"].(bool))
	})

	t.Run("parses_image_message", func(t *testing.T) {
		agent := NewIntakeAgent("test-secret", "")

		payload := createTestWhatsAppPayload()
		payload["entry"].([]map[string]any)[0]["changes"].([]map[string]any)[0]["value"].(map[string]any)["messages"].([]map[string]any)[0]["type"] = "image"
		payload["entry"].([]map[string]any)[0]["changes"].([]map[string]any)[0]["value"].(map[string]any)["messages"].([]map[string]any)[0]["image"] = map[string]any{
			"id":        "img_123",
			"mime_type": "image/jpeg",
			"sha256":    "abc123",
			"caption":   "Photo of error code on AC unit",
		}

		task := &SwarmTask{
			TaskID: "test-intake-image",
			Input: map[string]any{
				"webhook_payload": payload,
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.NotNil(t, result)

		require.Equal(t, "image", result["message_type"])
		require.Equal(t, "img_123", result["media_id"])
		require.NotEmpty(t, result["media_url"])
	})

	t.Run("parses_location_message", func(t *testing.T) {
		agent := NewIntakeAgent("test-secret", "")

		payload := createTestWhatsAppPayload()
		payload["entry"].([]map[string]any)[0]["changes"].([]map[string]any)[0]["value"].(map[string]any)["messages"].([]map[string]any)[0]["type"] = "location"
		payload["entry"].([]map[string]any)[0]["changes"].([]map[string]any)[0]["value"].(map[string]any)["messages"].([]map[string]any)[0]["location"] = map[string]any{
			"latitude":  -23.5505,
			"longitude": -46.6333,
			"name":      "São Paulo Office",
			"address":   "Av. Paulista, 1000",
		}

		task := &SwarmTask{
			TaskID: "test-intake-location",
			Input: map[string]any{
				"webhook_payload": payload,
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.NotNil(t, result)

		require.Equal(t, "location", result["message_type"])
		normalizedText := result["normalized_text"].(string)
		require.Contains(t, normalizedText, "São Paulo Office")
		require.Contains(t, normalizedText, "-23.5505")
	})

	t.Run("validates_signature", func(t *testing.T) {
		agent := NewIntakeAgent("mysecret", "")

		payload := createTestWhatsAppPayload()
		payloadBytes, _ := json.Marshal(payload)

		// Generate valid HMAC signature
		import_go_crypto_hmac := func() {}
		_ = import_go_crypto_hmac

		task := &SwarmTask{
			TaskID: "test-intake-sig",
			Input: map[string]any{
				"webhook_payload":    payload,
				"x_hub_signature_256": "sha256=invalid",
			},
		}

		// Invalid signature should fail
		_, err := agent.Execute(ctx, task)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid")
	})

	t.Run("normalizes_utf8", func(t *testing.T) {
		agent := NewIntakeAgent("test-secret", "")

		// Payload with special Unicode characters
		payload := createTestWhatsAppPayload()
		payload["entry"].([]map[string]any)[0]["changes"].([]map[string]any)[0]["value"].(map[string]any)["messages"].([]map[string]any)[0]["text"] = map[string]any{
			"body": "Hi! \u200B\u200C\u200D AC\u00A0error\u201CE1\u201D",
		}

		task := &SwarmTask{
			TaskID: "test-intake-utf8",
			Input: map[string]any{
				"webhook_payload": payload,
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		normalizedText := result["normalized_text"].(string)
		// Should not contain zero-width characters
		require.NotContains(t, normalizedText, "\u200B")
		require.NotContains(t, normalizedText, "\u200C")
		require.NotContains(t, normalizedText, "\u200D")
		// Non-breaking space should become regular space
		require.NotContains(t, normalizedText, "\u00A0")
		// Curly quotes should become straight quote
		require.NotContains(t, normalizedText, "\u201C")
		require.NotContains(t, normalizedText, "\u201D")
	})

	t.Run("missing_webhook_payload", func(t *testing.T) {
		agent := NewIntakeAgent("test-secret", "")

		task := &SwarmTask{
			TaskID: "test-intake-missing",
			Input:  map[string]any{},
		}

		_, err := agent.Execute(ctx, task)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing webhook_payload")
	})

	t.Run("no_messages_in_payload", func(t *testing.T) {
		agent := NewIntakeAgent("test-secret", "")

		payload := map[string]any{
			"object": "whatsapp_business_account",
			"entry": []map[string]any{
				{
					"id":      "123456789",
					"changes": []map[string]any{},
				},
			},
		}

		task := &SwarmTask{
			TaskID: "test-intake-empty",
			Input: map[string]any{
				"webhook_payload": payload,
			},
		}

		_, err := agent.Execute(ctx, task)
		require.Error(t, err)
		require.Contains(t, err.Error(), "no messages")
	})
}

// TestIntakeAgent_StateWriting verifies the agent writes correct fields to shared state.
func TestIntakeAgent_StateWriting(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	agent := NewIntakeAgent("test-secret", "")

	payload := createTestWhatsAppPayload()
	task := &SwarmTask{
		TaskID: "test-state-write",
		Input: map[string]any{
			"webhook_payload": payload,
		},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	// Required fields that must be written to shared state
	requiredKeys := []string{
		"request_id",
		"phone",
		"message_type",
		"normalized_text",
		"message_id",
		"timestamp",
		"intake.success",
	}

	for _, key := range requiredKeys {
		_, exists := result[key]
		require.True(t, exists, "Agent must write %s to shared state", key)
	}

	// Verify types
	require.IsType(t, "", result["request_id"])
	require.IsType(t, "", result["phone"])
	require.IsType(t, "", result["message_type"])
	require.IsType(t, "", result["normalized_text"])
	require.IsType(t, true, result["intake.success"])
}
