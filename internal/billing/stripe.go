package billing

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/stripe/stripe-go/v84"
)

// BillingSimulation controls whether billing operations hit real APIs or mocks.
var BillingSimulation = os.Getenv("BILLING_SIMULACAO") == "true"

// MockCheckoutURL is the simulation response for checkout sessions.
const MockCheckoutURL = "https://checkout.stripe.com/simulate/mock_session_123"

// ErrNoPriceID is returned when no Stripe price ID is configured for a plan.
var ErrNoPriceID = errors.New("no stripe price id configured for plan")

// StripeBilling handles Stripe checkout sessions.
type StripeBilling struct {
	sc *stripe.Client
}

// NewStripeBilling creates a new StripeBilling client.
// It reads the API key from STRIPE_API_KEY environment variable.
func NewStripeBilling() (*StripeBilling, error) {
	apiKey := os.Getenv("STRIPE_API_KEY")
	if apiKey == "" {
		return nil, errors.New("STRIPE_API_KEY not set")
	}
	sc := stripe.NewClient(apiKey)
	return &StripeBilling{sc: sc}, nil
}

// NewStripeBillingWithKey creates a StripeBilling with an explicit API key.
func NewStripeBillingWithKey(apiKey string) *StripeBilling {
	sc := stripe.NewClient(apiKey)
	return &StripeBilling{sc: sc}
}

// CreateCheckout creates a Stripe Checkout session for the given phone and plan.
// It returns the checkout URL on success.
//
// When BILLING_SIMULACAO=true, returns a mock URL without calling Stripe API.
// When BILLING_SIMULACAO=false, calls real Stripe API.
func (s *StripeBilling) CreateCheckout(ctx context.Context, phone, plan string) (string, error) {
	planEnum := Plan(plan)
	if planEnum == PlanFree || planEnum == PlanTrial {
		return "", errors.New("free and trial plans do not require checkout")
	}

	priceID, ok := StripePriceIDs[planEnum]
	if !ok || priceID == "" || priceID == stripePriceFallback {
		return "", fmt.Errorf("%w: %s", ErrNoPriceID, plan)
	}

	// SIMULATION MODE: Return mock checkout URL without calling Stripe.
	if BillingSimulation {
		return simulateCheckout(phone, plan), nil
	}

	params := &stripe.CheckoutSessionCreateParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		LineItems: []*stripe.CheckoutSessionCreateLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		Mode:       stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		SuccessURL: stripe.String(os.Getenv("STRIPE_SUCCESS_URL")),
		CancelURL:  stripe.String(os.Getenv("STRIPE_CANCEL_URL")),
		Metadata: map[string]string{
			"phone": phone,
			"plan":  plan,
		},
		SubscriptionData: &stripe.CheckoutSessionCreateSubscriptionDataParams{
			Metadata: map[string]string{
				"phone": phone,
				"plan":  plan,
			},
		},
	}

	sess, err := s.sc.V1CheckoutSessions.Create(ctx, params)
	if err != nil {
		return "", fmt.Errorf("stripe checkout failed: %w", err)
	}

	return sess.URL, nil
}

// simulateCheckout returns a mock checkout URL for simulation mode.
func simulateCheckout(phone, plan string) string {
	return fmt.Sprintf("%s?phone=%s&plan=%s&time=%d",
		MockCheckoutURL, phone, plan, time.Now().Unix())
}

// SetSimulation enables/disables billing simulation mode.
// Used for testing without Stripe API calls.
func SetSimulation(enabled bool) {
	BillingSimulation = enabled
}