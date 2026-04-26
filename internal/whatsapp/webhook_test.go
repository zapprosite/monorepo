package whatsapp

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

const testAppSecret = "test-app-secret-12345"

func TestWebhook_ValidSignature(t *testing.T) {
	handler := NewWebhookHandler(testAppSecret)

	payload := []byte(`{"object":"whatsapp_business_account","entry":[{"id":"BIZ_ID","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"phone_number_id":"PH_ID"},"contacts":[{"profile":{"name":"João"},"wa_id":"5511999887766"}],"messages":[{"from":"5511999887766","id":"wamid.xxx","timestamp":"1712534280","type":"text","text":{"body":"Erro E4 no split Carrier?"}}]}}]}]}`)
	signature := computeSignature(payload, testAppSecret)

	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", signature)
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code, "Expected 200 OK for valid signature")

	var resp map[string]string
	err := json.NewDecoder(rr.Body).Decode(&resp)
	require.NoError(t, err)
	require.Equal(t, "ok", resp["status"])
}

func TestWebhook_InvalidSignature(t *testing.T) {
	handler := NewWebhookHandler(testAppSecret)

	payload := []byte(`{"object":"whatsapp_business_account"}`)

	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", "sha256=invalidsignature")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	require.Equal(t, http.StatusForbidden, rr.Code, "Expected 403 Forbidden for invalid signature")
}

func TestWebhook_MissingSignature(t *testing.T) {
	handler := NewWebhookHandler(testAppSecret)

	payload := []byte(`{"object":"whatsapp_business_account"}`)

	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	require.Equal(t, http.StatusForbidden, rr.Code, "Expected 403 Forbidden for missing signature")
}

func TestWebhook_ExtractMessage(t *testing.T) {
	payload := []byte(`{
		"object": "whatsapp_business_account",
		"entry": [{
			"id": "BIZ_ID",
			"changes": [{
				"field": "messages",
				"value": {
					"messaging_product": "whatsapp",
					"metadata": {"phone_number_id": "PH_ID", "display_name": "TestBot"},
					"contacts": [{"profile": {"name": "João"}, "wa_id": "5511999887766"}],
					"messages": [{
						"from": "5511999887766",
						"id": "wamid.xxx",
						"timestamp": "1712534280",
						"type": "text",
						"text": {"body": "Erro E4 no split Carrier?"}
					}]
				}
			}]
		}]
	}`)

	msg, err := ExtractMessage(payload)
	require.NoError(t, err)
	require.NotNil(t, msg, "Expected message to be extracted")
	require.Equal(t, "5511999887766", msg.From, "From phone number mismatch")
	require.Equal(t, "wamid.xxx", msg.ID, "Message ID mismatch")
	require.Equal(t, "1712534280", msg.Timestamp, "Timestamp mismatch")
	require.Equal(t, "Erro E4 no split Carrier?", msg.Text, "Message text mismatch")
	require.Equal(t, "PH_ID", msg.PhoneNumberID, "Phone number ID mismatch")
}

func TestWebhook_ExtractMessage_NoTextMessage(t *testing.T) {
	payload := []byte(`{
		"object": "whatsapp_business_account",
		"entry": [{
			"id": "BIZ_ID",
			"changes": [{
				"field": "messages",
				"value": {
					"messaging_product": "whatsapp",
					"metadata": {"phone_number_id": "PH_ID"},
					"contacts": [{"profile": {"name": "João"}, "wa_id": "5511999887766"}],
					"messages": [{
						"from": "5511999887766",
						"id": "wamid.yyy",
						"timestamp": "1712534280",
						"type": "image"
					}]
				}
			}]
		}]
	}`)

	msg, err := ExtractMessage(payload)
	require.NoError(t, err)
	require.Nil(t, msg, "Expected nil for non-text message")
}

func TestWebhook_ExtractMessage_InvalidPayload(t *testing.T) {
	payload := []byte(`not valid json`)

	msg, err := ExtractMessage(payload)
	require.Error(t, err, "Expected error for invalid JSON")
	require.Nil(t, msg)
}

func TestWebhook_ExtractMessage_EmptyPayload(t *testing.T) {
	payload := []byte(`{"object":"whatsapp_business_account","entry":[]}`)

	msg, err := ExtractMessage(payload)
	require.NoError(t, err)
	require.Nil(t, msg, "Expected nil for empty entry")
}

func TestWebhook_WrongMethod(t *testing.T) {
	handler := NewWebhookHandler(testAppSecret)

	req := httptest.NewRequest(http.MethodGet, "/webhook", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	require.Equal(t, http.StatusMethodNotAllowed, rr.Code, "Expected 405 Method Not Allowed for GET")
}

func TestWebhook_BadRequest(t *testing.T) {
	handler := NewWebhookHandler(testAppSecret)

	// Invalid JSON body with valid signature
	// ExtractMessage will fail with invalid JSON -> 400 Bad Request
	payload := []byte(`not json`)
	signature := computeSignature(payload, testAppSecret)

	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", signature)
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// ExtractMessage fails with invalid JSON -> 400 Bad Request
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

// computeSignature computes the X-Hub-Signature-256 header value for testing.
func computeSignature(payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}
