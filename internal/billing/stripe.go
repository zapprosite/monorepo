package billing

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/stripe/stripe-go/v80"
	"github.com/stripe/stripe-go/v80/checkout/session"
)

// ErrNoPriceID is returned when no Stripe price ID is configured for a plan.
var ErrNoPriceID = errors.New("no stripe price id configured for plan")

// StripeBilling handles Stripe checkout sessions.
type StripeBilling struct{}

// NewStripeBilling creates a new StripeBilling client.
// It reads the API key from STRIPE_API_KEY environment variable.
func NewStripeBilling() (*StripeBilling, error) {
	apiKey := os.Getenv("STRIPE_API_KEY")
	if apiKey == "" {
		return nil, errors.New("STRIPE_API_KEY not set")
	}
	stripe.Key = apiKey
	return &StripeBilling{}, nil
}

// NewStripeBillingWithKey creates a StripeBilling with an explicit API key.
func NewStripeBillingWithKey(apiKey string) *StripeBilling {
	stripe.Key = apiKey
	return &StripeBilling{}
}

// CreateCheckout creates a Stripe Checkout session for the given phone and plan.
// It returns the checkout URL on success.
func (s *StripeBilling) CreateCheckout(ctx context.Context, phone, plan string) (string, error) {
	planEnum := Plan(plan)
	if planEnum == PlanFree || planEnum == PlanTrial {
		return "", errors.New("free and trial plans do not require checkout")
	}

	priceID, ok := StripePriceIDs[planEnum]
	if !ok || priceID == "" {
		return "", fmt.Errorf("%w: %s", ErrNoPriceID, plan)
	}

	params := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
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
		SubscriptionData: &stripe.CheckoutSessionSubscriptionDataParams{
			Metadata: map[string]string{
				"phone": phone,
				"plan":  plan,
			},
		},
	}

	sess, err := session.New(params)
	if err != nil {
		return "", fmt.Errorf("stripe checkout failed: %w", err)
	}

	return sess.URL, nil
}