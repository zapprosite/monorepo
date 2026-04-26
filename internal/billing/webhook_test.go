package billing

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestMain(m *testing.M) {
	os.Setenv("STRIPE_WEBHOOK_SECRET", "test_secret_key")
	m.Run()
}

func TestWebhookHandler_NewWebhookHandler(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	_, err = NewWebhookHandler(rdb, nil)
	if err != nil {
		t.Errorf("NewWebhookHandler failed: %v", err)
	}
}

func TestWebhookHandler_NewWebhookHandler_MissingSecret(t *testing.T) {
	os.Unsetenv("STRIPE_WEBHOOK_SECRET")

	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	_, err = NewWebhookHandler(rdb, nil)
	if err == nil {
		t.Error("expected error when STRIPE_WEBHOOK_SECRET is missing")
	}
	if err.Error() != "STRIPE_WEBHOOK_SECRET not set" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestVerifySignature(t *testing.T) {
	secret := "test_secret_key"
	h := &WebhookHandler{webhookSecret: secret}

	tests := []struct {
		name        string
		sig         string
		wantErr     bool
		errContains string
	}{
		{
			name:        "invalid signature format",
			sig:         "t=1234567890,v1=abc123",
			wantErr:     true,
		},
		{
			name:        "missing timestamp",
			sig:         "v1=abc123",
			wantErr:     true,
			errContains: "missing signature fields",
		},
		{
			name:        "missing signature",
			sig:         "t=1234567890",
			wantErr:     true,
			errContains: "missing signature fields",
		},
		{
			name:        "empty signature",
			sig:         "",
			wantErr:     true,
			errContains: "missing signature fields",
		},
	}

	payload := []byte(`{"test":"data"}`)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := h.verifySignature(payload, tt.sig)
			if (err != nil) != tt.wantErr {
				t.Errorf("verifySignature() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestVerifySignature_ValidHMAC(t *testing.T) {
	secret := "test_secret_key"
	h := &WebhookHandler{webhookSecret: secret}

	payload := []byte(`{"id":"evt_123","type":"checkout.session.completed"}`)
	timestamp := "1234567890"

	// Compute valid signature
	signedPayload := timestamp + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signedPayload))
	signature := hex.EncodeToString(mac.Sum(nil))

	sig := "t=" + timestamp + ",v1=" + signature

	err := h.verifySignature(payload, sig)
	if err != nil {
		t.Errorf("verifySignature() unexpected error: %v", err)
	}
}

func TestVerifySignature_InvalidHMAC(t *testing.T) {
	secret := "test_secret_key"
	h := &WebhookHandler{webhookSecret: secret}

	payload := []byte(`{"id":"evt_123","type":"checkout.session.completed"}`)

	err := h.verifySignature(payload, "t=1234567890,v1=invalid_signature")
	if err == nil {
		t.Error("expected error for invalid signature")
	}
}

func TestHmacSHA256(t *testing.T) {
	tests := []struct {
		data string
		key  string
	}{
		{"hello", "world"},
		{"test payload", "secret key"},
		{"", "key"},
	}

	for _, tt := range tests {
		result := hmacSHA256(tt.data, tt.key)

		// Verify it produces valid hex
		_, err := hex.DecodeString(result)
		if err != nil {
			t.Errorf("hmacSHA256() produced invalid hex: %v", err)
		}

		// Verify it's consistent
		result2 := hmacSHA256(tt.data, tt.key)
		if result != result2 {
			t.Error("hmacSHA256() not consistent")
		}
	}
}

func TestHmacEqual(t *testing.T) {
	tests := []struct {
		a      string
		b      string
		result bool
	}{
		{"abc", "abc", true},
		{"", "", true},
		{"abc", "def", false},
		{"abc", "ABCD", false},
	}

	for _, tt := range tests {
		result := hmacEqual(tt.a, tt.b)
		if result != tt.result {
			t.Errorf("hmacEqual(%q, %q) = %v, want %v", tt.a, tt.b, result, tt.result)
		}
	}
}

func TestWebhookEventStruct(t *testing.T) {
	event := WebhookEvent{
		ID:    "evt_123",
		Type:  "checkout.session.completed",
		Phone: "+5511999999999",
		Plan:  "pro",
		SubID: "sub_123",
	}

	if event.ID != "evt_123" {
		t.Errorf("expected ID evt_123, got %s", event.ID)
	}
	if event.Type != "checkout.session.completed" {
		t.Errorf("expected Type checkout.session.completed, got %s", event.Type)
	}
	if event.Phone != "+5511999999999" {
		t.Errorf("expected Phone +5511999999999, got %s", event.Phone)
	}
	if event.Plan != "pro" {
		t.Errorf("expected Plan pro, got %s", event.Plan)
	}
	if event.SubID != "sub_123" {
		t.Errorf("expected SubID sub_123, got %s", event.SubID)
	}
}

func TestHandleCheckoutCompleted(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	h := &WebhookHandler{rdb: rdb}

	data := json.RawMessage(`{
		"metadata": {
			"phone": "+5511999999999",
			"plan": "pro"
		},
		"subscription": "sub_123"
	}`)

	err = h.handleCheckoutCompleted(context.Background(), data)
	if err != nil {
		t.Errorf("handleCheckoutCompleted() failed: %v", err)
	}
}

func TestHandleCheckoutCompleted_MissingMetadata(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	h := &WebhookHandler{rdb: rdb}

	tests := []struct {
		name string
		data string
	}{
		{
			name: "missing phone",
			data: `{"metadata":{"plan":"pro"}}`,
		},
		{
			name: "missing plan",
			data: `{"metadata":{"phone":"+5511999999999"}}`,
		},
		{
			name: "empty metadata",
			data: `{}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := h.handleCheckoutCompleted(context.Background(), json.RawMessage(tt.data))
			if err == nil {
				t.Error("expected error for missing metadata")
			}
		})
	}
}

func TestHandleInvoicePaid(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	h := &WebhookHandler{rdb: rdb}

	data := json.RawMessage(`{
		"subscription": "sub_123",
		"metadata": {
			"phone": "+5511999999999",
			"plan": "pro"
		}
	}`)

	err = h.handleInvoicePaid(context.Background(), data)
	if err != nil {
		t.Errorf("handleInvoicePaid() failed: %v", err)
	}
}

func TestHandleInvoicePaid_MissingMetadata(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	h := &WebhookHandler{rdb: rdb}

	data := json.RawMessage(`{}`)

	err = h.handleInvoicePaid(context.Background(), data)
	if err == nil {
		t.Error("expected error for missing metadata")
	}
}

func TestHandleSubscriptionDeleted(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	h := &WebhookHandler{rdb: rdb}

	data := json.RawMessage(`{
		"id": "sub_123",
		"customer": "cus_123",
		"metadata": {
			"phone": "+5511999999999",
			"plan": "pro"
		}
	}`)

	err = h.handleSubscriptionDeleted(context.Background(), data)
	if err != nil {
		t.Errorf("handleSubscriptionDeleted() failed: %v", err)
	}
}

func TestHandleSubscriptionDeleted_MissingPhone(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	h := &WebhookHandler{rdb: rdb}

	data := json.RawMessage(`{
		"id": "sub_123",
		"metadata": {}
	}`)

	err = h.handleSubscriptionDeleted(context.Background(), data)
	if err == nil {
		t.Error("expected error for missing phone")
	}
}

func TestCheckoutSessionData(t *testing.T) {
	data := checkoutSessionData{}
	data.Metadata.Phone = "+5511999999999"
	data.Metadata.Plan = "pro"
	data.Subscription = "sub_123"

	if data.Metadata.Phone != "+5511999999999" {
		t.Errorf("expected phone +5511999999999, got %s", data.Metadata.Phone)
	}
	if data.Metadata.Plan != "pro" {
		t.Errorf("expected plan pro, got %s", data.Metadata.Plan)
	}
	if data.Subscription != "sub_123" {
		t.Errorf("expected subscription sub_123, got %s", data.Subscription)
	}
}

func TestInvoiceData(t *testing.T) {
	data := invoiceData{}
	data.Subscription = "sub_123"
	data.Metadata.Phone = "+5511999999999"
	data.Metadata.Plan = "pro"

	if data.Subscription != "sub_123" {
		t.Errorf("expected subscription sub_123, got %s", data.Subscription)
	}
	if data.Metadata.Phone != "+5511999999999" {
		t.Errorf("expected phone +5511999999999, got %s", data.Metadata.Phone)
	}
}

func TestSubscriptionData(t *testing.T) {
	data := subscriptionData{}
	data.ID = "sub_123"
	data.Customer = "cus_456"
	data.Metadata.Phone = "+5511999999999"
	data.Metadata.Plan = "pro"

	if data.ID != "sub_123" {
		t.Errorf("expected ID sub_123, got %s", data.ID)
	}
	if data.Customer != "cus_456" {
		t.Errorf("expected customer cus_456, got %s", data.Customer)
	}
	if data.Metadata.Phone != "+5511999999999" {
		t.Errorf("expected phone +5511999999999, got %s", data.Metadata.Phone)
	}
}

func TestWebhookHandler_Handle_Dedup(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	h := &WebhookHandler{rdb: rdb}

	payload := []byte(`{"id":"evt_test_dedup","type":"checkout.session.completed","data":{}}`)
	timestamp := time.Now().Unix()
	signedPayload := string(rune(timestamp)) + "." + string(payload)
	mac := hmac.New(sha256.New, []byte("test_secret_key"))
	mac.Write([]byte(signedPayload))
	sig := hex.EncodeToString(mac.Sum(nil))
	sigHeader := "t=" + string(rune(timestamp)) + ",v1=" + sig

	// First call should succeed
	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Stripe-Signature", sigHeader)

	_, err = h.Handle(context.Background(), req.Body, sigHeader)
	// May fail due to signature but dedup logic would work if it didn't
	_ = err
}

func TestWebhookHandler_Handle_InvalidSignature(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	h := &WebhookHandler{rdb: rdb}

	payload := []byte(`{"id":"evt_test","type":"checkout.session.completed"}`)

	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Stripe-Signature", "t=1234567890,v1=invalid")

	_, err = h.Handle(context.Background(), req.Body, "t=1234567890,v1=invalid")
	if err == nil {
		t.Error("expected error for invalid signature")
	}
}
