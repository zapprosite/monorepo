package billing

import (
	"os"
	"time"
)

// Plan represents a billing plan.
type Plan string

const (
	PlanFree       Plan = "free"
	PlanTrial      Plan = "trial"
	PlanPro        Plan = "pro"
	PlanEnterprise Plan = "enterprise"
)

// PlanDefinition holds the configuration for a plan.
type PlanDefinition struct {
	Name            string
	Price           int64 // cents BRL
	RequestsLimit  int
	RequestsWindow time.Duration
	Features        []string
}

// PlanFreeDef is the Free tier: R$0, 10 requests/day.
var PlanFreeDef = PlanDefinition{
	Name:            "Free",
	Price:           0,
	RequestsLimit:   10,
	RequestsWindow:  24 * time.Hour,
	Features:        []string{"basic"},
}

// PlanTrialDef is the Trial: R$0, 30 requests/7 days.
var PlanTrialDef = PlanDefinition{
	Name:            "Trial",
	Price:           0,
	RequestsLimit:   30,
	RequestsWindow:  7 * 24 * time.Hour,
	Features:        []string{"full_access"},
}

// PlanProDef is the Pro tier: R$49.90/month, unlimited.
var PlanProDef = PlanDefinition{
	Name:            "Pro",
	Price:           4990,
	RequestsLimit:   -1, // unlimited
	RequestsWindow:  30 * 24 * time.Hour,
	Features:        []string{"all_features"},
}

// PlanEnterpriseDef is the Enterprise tier: R$199/month, unlimited.
var PlanEnterpriseDef = PlanDefinition{
	Name:            "Enterprise",
	Price:           19900,
	RequestsLimit:   -1, // unlimited
	RequestsWindow:  30 * 24 * time.Hour,
	Features:        []string{"all_features", "api_access"},
}

// Plans maps plan enum to definitions.
var Plans = map[Plan]PlanDefinition{
	PlanFree:       PlanFreeDef,
	PlanTrial:      PlanTrialDef,
	PlanPro:        PlanProDef,
	PlanEnterprise: PlanEnterpriseDef,
}

// stripePriceFallback is used when the env var is not set.
// NOTE: This constant is mirrored in stripe.go for billing simulation.
const stripePriceFallback = "STRIPE_PRICE_NOT_CONFIGURED"

// stripePriceEnv gets the Stripe Price ID from env var, or returns fallback.
func stripePriceEnv(key string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return stripePriceFallback
}

// StripePriceIDs maps plan to Stripe Price IDs (from env).
// If env var not set, price ID equals stripePriceFallback which triggers ErrNoPriceID.
var StripePriceIDs = map[Plan]string{
	PlanPro:        stripePriceEnv("STRIPE_PRICE_PRO"),
	PlanEnterprise: stripePriceEnv("STRIPE_PRICE_ENTERPRISE"),
}

// IsStripeConfigured returns true if Stripe Price IDs are set (not fallback).
func IsStripeConfigured() bool {
	return StripePriceIDs[PlanPro] != stripePriceFallback && StripePriceIDs[PlanEnterprise] != stripePriceFallback
}

// GetStripePriceID returns the Stripe Price ID for a plan, or empty string if not set.
func GetStripePriceID(p Plan) string {
	return StripePriceIDs[p]
}

// GetPlanDef returns the definition for a plan.
func GetPlanDef(p Plan) PlanDefinition {
	if def, ok := Plans[p]; ok {
		return def
	}
	return PlanFreeDef
}

// IsUnlimited returns true if the plan has unlimited requests.
func (p PlanDefinition) IsUnlimited() bool {
	return p.RequestsLimit < 0
}