package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// WebhookEvent represents a processed Stripe webhook event.
type WebhookEvent struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Phone string `json:"phone,omitempty"`
	Plan  string `json:"plan,omitempty"`
	SubID string `json:"subscription_id,omitempty"`
}

// WebhookHandler processes Stripe webhook events idempotently.
type WebhookHandler struct {
	rdb           *redis.Client
	billing       *StripeBilling
	webhookSecret string
}

// NewWebhookHandler creates a new webhook handler.
func NewWebhookHandler(rdb *redis.Client, billing *StripeBilling) (*WebhookHandler, error) {
	secret := os.Getenv("STRIPE_WEBHOOK_SECRET")
	if secret == "" {
		return nil, errors.New("STRIPE_WEBHOOK_SECRET not set")
	}
	return &WebhookHandler{
		rdb:           rdb,
		billing:       billing,
		webhookSecret: secret,
	}, nil
}

// Handle processes an incoming Stripe webhook request.
// It returns the event type and any error.
// body must be the raw request body; sig is the Stripe-Signature header value.
func (h *WebhookHandler) Handle(ctx context.Context, body io.Reader, sig string) (string, error) {
	payload, err := io.ReadAll(body)
	if err != nil {
		return "", fmt.Errorf("read body: %w", err)
	}

	if err := h.verifySignature(payload, sig); err != nil {
		return "", fmt.Errorf("signature verification: %w", err)
	}

	var evt struct {
		ID   string          `json:"id"`
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(payload, &evt); err != nil {
		return "", fmt.Errorf("unmarshal event: %w", err)
	}

	// Idempotency: skip if event already processed
	dedupKey := fmt.Sprintf("stripe:event:%s", evt.ID)
	exists, err := h.rdb.SetNX(ctx, dedupKey, "1", 7*24*60*60*time.Second).Result()
	if err != nil {
		return "", fmt.Errorf("dedup check: %w", err)
	}
	if !exists {
		return evt.Type, nil // already processed
	}

	switch evt.Type {
	case "checkout.session.completed":
		return evt.Type, h.handleCheckoutCompleted(ctx, evt.Data)
	case "invoice.paid":
		return evt.Type, h.handleInvoicePaid(ctx, evt.Data)
	case "customer.subscription.deleted":
		return evt.Type, h.handleSubscriptionDeleted(ctx, evt.Data)
	default:
		return evt.Type, nil
	}
}

// verifySignature verifies the Stripe webhook signature.
func (h *WebhookHandler) verifySignature(payload []byte, sig string) error {
	parts := strings.Split(sig, ",")
	var timestamp, signature string
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			signature = kv[1]
		}
	}
	if timestamp == "" || signature == "" {
		return errors.New("missing signature fields")
	}

	signedPayload := timestamp + "." + string(payload)
	expected := hmacSHA256(signedPayload, h.webhookSecret)
	if !hmacEqual(signature, expected) {
		return errors.New("signature mismatch")
	}
	return nil
}

func hmacSHA256(data, key string) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

func hmacEqual(a, b string) bool {
	return a == b
}

type checkoutSessionData struct {
	Metadata     struct {
		Phone string `json:"phone"`
		Plan  string `json:"plan"`
	} `json:"metadata"`
	Subscription string `json:"subscription"`
}

func (h *WebhookHandler) handleCheckoutCompleted(ctx context.Context, data json.RawMessage) error {
	var sess checkoutSessionData
	if err := json.Unmarshal(data, &sess); err != nil {
		return fmt.Errorf("unmarshal checkout session: %w", err)
	}

	phone := sess.Metadata.Phone
	plan := sess.Metadata.Plan
	if phone == "" || plan == "" {
		return errors.New("missing phone or plan in checkout session metadata")
	}

	if err := ActivatePlan(ctx, h.rdb, phone, plan); err != nil {
		return fmt.Errorf("activate plan: %w", err)
	}

	if plan == string(PlanTrial) {
		if err := SetTrialRequests(ctx, h.rdb, phone); err != nil {
			return fmt.Errorf("set trial requests: %w", err)
		}
	}

	return nil
}

type invoiceData struct {
	Subscription string `json:"subscription"`
	Metadata     struct {
		Phone string `json:"phone"`
		Plan  string `json:"plan"`
	} `json:"metadata"`
}

func (h *WebhookHandler) handleInvoicePaid(ctx context.Context, data json.RawMessage) error {
	var inv invoiceData
	if err := json.Unmarshal(data, &inv); err != nil {
		return fmt.Errorf("unmarshal invoice: %w", err)
	}

	phone := inv.Metadata.Phone
	plan := inv.Metadata.Plan
	if phone == "" || plan == "" {
		return errors.New("missing phone or plan in invoice metadata")
	}

	if err := ActivatePlan(ctx, h.rdb, phone, plan); err != nil {
		return fmt.Errorf("activate plan: %w", err)
	}

	if err := SetUnlimitedRequests(ctx, h.rdb, phone); err != nil {
		return fmt.Errorf("set unlimited requests: %w", err)
	}

	return nil
}

type subscriptionData struct {
	ID       string `json:"id"`
	Customer string `json:"customer"`
	Metadata struct {
		Phone string `json:"phone"`
		Plan  string `json:"plan"`
	} `json:"metadata"`
}

func (h *WebhookHandler) handleSubscriptionDeleted(ctx context.Context, data json.RawMessage) error {
	var sub subscriptionData
	if err := json.Unmarshal(data, &sub); err != nil {
		return fmt.Errorf("unmarshal subscription: %w", err)
	}

	phone := sub.Metadata.Phone
	if phone == "" {
		return errors.New("missing phone in subscription metadata")
	}

	if err := ActivatePlan(ctx, h.rdb, phone, string(PlanFree)); err != nil {
		return fmt.Errorf("activate free plan: %w", err)
	}

	if err := SetFreeRequests(ctx, h.rdb, phone); err != nil {
		return fmt.Errorf("set free requests: %w", err)
	}

	return nil
}