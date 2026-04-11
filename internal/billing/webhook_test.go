package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVerifySignature(t *testing.T) {
	secret := "whsec_test_secret"
	h := &WebhookHandler{webhookSecret: secret}

	// Create valid signature
	timestamp := "1234567890"
	payload := []byte(`{"id":"evt_123","type":"checkout.session.completed"}`)
	signed := timestamp + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signed))
	expectedSig := hex.EncodeToString(mac.Sum(nil))
	sig := "t=" + timestamp + ",v1=" + expectedSig

	err := h.verifySignature(payload, sig)
	require.NoError(t, err)
}

func TestVerifySignature_InvalidSignature(t *testing.T) {
	secret := "whsec_test_secret"
	h := &WebhookHandler{webhookSecret: secret}

	payload := []byte(`{"id":"evt_123","type":"checkout.session.completed"}`)
	sig := "t=1234567890,v1=invalid_signature"

	err := h.verifySignature(payload, sig)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "signature mismatch")
}

func TestVerifySignature_MissingTimestamp(t *testing.T) {
	secret := "whsec_test_secret"
	h := &WebhookHandler{webhookSecret: secret}

	payload := []byte(`{"id":"evt_123"}`)
	sig := "v1=somesignature"

	err := h.verifySignature(payload, sig)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "missing signature fields")
}

func TestVerifySignature_MissingSignature(t *testing.T) {
	secret := "whsec_test_secret"
	h := &WebhookHandler{webhookSecret: secret}

	payload := []byte(`{"id":"evt_123"}`)
	sig := "t=1234567890"

	err := h.verifySignature(payload, sig)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "missing signature fields")
}

func TestVerifySignature_EmptySignature(t *testing.T) {
	h := &WebhookHandler{webhookSecret: "secret"}
	err := h.verifySignature([]byte(`{}`), "")
	assert.Error(t, err)
}

func TestHmacSHA256(t *testing.T) {
	data := "hello world"
	key := "secret"
	result := hmacSHA256(data, key)

	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(data))
	expected := hex.EncodeToString(mac.Sum(nil))

	assert.Equal(t, expected, result)
}

func TestHmacEqual(t *testing.T) {
	assert.True(t, hmacEqual("abc", "abc"))
	assert.False(t, hmacEqual("abc", "xyz"))
}

func TestWebhookEvent_Struct(t *testing.T) {
	event := WebhookEvent{
		ID:    "evt_123",
		Type:  "checkout.session.completed",
		Phone: "+5511999999999",
		Plan:  "pro",
		SubID: "sub_456",
	}

	data, err := json.Marshal(event)
	require.NoError(t, err)

	var restored WebhookEvent
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)

	assert.Equal(t, "evt_123", restored.ID)
	assert.Equal(t, "checkout.session.completed", restored.Type)
	assert.Equal(t, "+5511999999999", restored.Phone)
	assert.Equal(t, "pro", restored.Plan)
	assert.Equal(t, "sub_456", restored.SubID)
}

func TestCheckoutSessionData_Parsing(t *testing.T) {
	data := `{"metadata":{"phone":"+5511999999999","plan":"pro"},"subscription":"sub_123"}`
	var sess checkoutSessionData
	err := json.Unmarshal([]byte(data), &sess)
	require.NoError(t, err)

	assert.Equal(t, "+5511999999999", sess.Metadata.Phone)
	assert.Equal(t, "pro", sess.Metadata.Plan)
	assert.Equal(t, "sub_123", sess.Subscription)
}

func TestInvoiceData_Parsing(t *testing.T) {
	data := `{"subscription":"sub_456","metadata":{"phone":"+5511888888888","plan":"enterprise"}}`
	var inv invoiceData
	err := json.Unmarshal([]byte(data), &inv)
	require.NoError(t, err)

	assert.Equal(t, "sub_456", inv.Subscription)
	assert.Equal(t, "+5511888888888", inv.Metadata.Phone)
	assert.Equal(t, "enterprise", inv.Metadata.Plan)
}

func TestSubscriptionData_Parsing(t *testing.T) {
	data := `{"id":"sub_789","customer":"cus_123","metadata":{"phone":"+5511777777777","plan":"pro"}}`
	var sub subscriptionData
	err := json.Unmarshal([]byte(data), &sub)
	require.NoError(t, err)

	assert.Equal(t, "sub_789", sub.ID)
	assert.Equal(t, "cus_123", sub.Customer)
	assert.Equal(t, "+5511777777777", sub.Metadata.Phone)
	assert.Equal(t, "pro", sub.Metadata.Plan)
}

func TestNewWebhookHandler_MissingSecret(t *testing.T) {
	os.Unsetenv("STRIPE_WEBHOOK_SECRET")

	_, err := NewWebhookHandler(nil, &StripeBilling{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "STRIPE_WEBHOOK_SECRET not set")
}

func TestWebhookEvent_JSONRoundTrip(t *testing.T) {
	event := WebhookEvent{
		ID:   "evt_test",
		Type: "test.type",
	}

	data, err := json.Marshal(event)
	require.NoError(t, err)

	var restored WebhookEvent
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)
	assert.Equal(t, event.ID, restored.ID)
	assert.Equal(t, event.Type, restored.Type)
}

func TestCheckoutSessionData_MissingFields(t *testing.T) {
	// Test with missing phone
	data := `{"metadata":{"plan":"pro"},"subscription":"sub_123"}`
	var sess checkoutSessionData
	err := json.Unmarshal([]byte(data), &sess)
	require.NoError(t, err)
	assert.Equal(t, "", sess.Metadata.Phone)
	assert.Equal(t, "pro", sess.Metadata.Plan)
}

func TestInvoiceData_MissingFields(t *testing.T) {
	// Test with missing plan
	data := `{"subscription":"sub_456","metadata":{"phone":"+5511888888888"}}`
	var inv invoiceData
	err := json.Unmarshal([]byte(data), &inv)
	require.NoError(t, err)
	assert.Equal(t, "+5511888888888", inv.Metadata.Phone)
	assert.Equal(t, "", inv.Metadata.Plan)
}

func TestSubscriptionData_WithCustomer(t *testing.T) {
	data := `{"id":"sub_abc","customer":"cus_xyz","metadata":{"phone":"+5511000000000","plan":"trial"}}`
	var sub subscriptionData
	err := json.Unmarshal([]byte(data), &sub)
	require.NoError(t, err)

	assert.Equal(t, "sub_abc", sub.ID)
	assert.Equal(t, "cus_xyz", sub.Customer)
	assert.Equal(t, "+5511000000000", sub.Metadata.Phone)
	assert.Equal(t, "trial", sub.Metadata.Plan)
}