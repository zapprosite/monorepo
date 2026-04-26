package agents

import (
	"context"
	"errors"
	"fmt"

	"github.com/redis/go-redis/v9"
	"github.com/will-zappro/hvacr-swarm/internal/billing"
)

// BillingAgent handles billing events from the swarm.
type BillingAgent struct {
	rdb      *redis.Client
	billing  *billing.StripeBilling
	maxRetries int
	timeoutMs  int
}

// NewBillingAgent creates a new BillingAgent.
func NewBillingAgent(rdb *redis.Client, stripeBilling *billing.StripeBilling) *BillingAgent {
	return &BillingAgent{
		rdb:        rdb,
		billing:    stripeBilling,
		maxRetries: 3,
		timeoutMs:  30000,
	}
}

// Execute processes billing tasks from the swarm.
// It handles event_type: request_used, upgrade_requested, payment_received, subscription_deleted.
func (b *BillingAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	eventType, ok := task.Input["event_type"].(string)
	if !ok {
		return nil, errors.New("missing event_type in task input")
	}

	switch eventType {
	case "request_used":
		return b.handleRequestUsed(ctx, task)
	case "upgrade_requested":
		return b.handleUpgradeRequested(ctx, task)
	case "payment_received":
		return b.handlePaymentReceived(ctx, task)
	case "subscription_deleted":
		return b.handleSubscriptionDeleted(ctx, task)
	default:
		return nil, fmt.Errorf("unknown event_type: %s", eventType)
	}
}

// AgentType returns "billing".
func (b *BillingAgent) AgentType() string {
	return "billing"
}

// MaxRetries returns 3.
func (b *BillingAgent) MaxRetries() int {
	return b.maxRetries
}

// TimeoutMs returns 30000.
func (b *BillingAgent) TimeoutMs() int {
	return b.timeoutMs
}

func (b *BillingAgent) handleRequestUsed(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	phone, ok := task.Input["phone"].(string)
	if !ok || phone == "" {
		return nil, errors.New("missing phone in task input")
	}

	allowed, remaining, err := billing.CheckAndDecrement(ctx, b.rdb, phone)
	if err != nil {
		return nil, fmt.Errorf("check and decrement: %w", err)
	}

	return map[string]any{
		"event_type":    "request_used",
		"phone":         phone,
		"allowed":       allowed,
		"remaining":     remaining,
		"decision":      map[bool]string{true: "allow", false: "block"}[allowed],
	}, nil
}

func (b *BillingAgent) handleUpgradeRequested(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	phone, ok := task.Input["phone"].(string)
	if !ok || phone == "" {
		return nil, errors.New("missing phone in task input")
	}

	plan, ok := task.Input["plan"].(string)
	if !ok || plan == "" {
		return nil, errors.New("missing plan in task input")
	}

	if b.billing == nil {
		return nil, errors.New("stripe billing not configured")
	}

	checkoutURL, err := b.billing.CreateCheckout(ctx, phone, plan)
	if err != nil {
		return nil, fmt.Errorf("create checkout: %w", err)
	}

	return map[string]any{
		"event_type":   "upgrade_requested",
		"phone":        phone,
		"plan":        plan,
		"checkout_url": checkoutURL,
	}, nil
}

func (b *BillingAgent) handlePaymentReceived(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	phone, ok := task.Input["phone"].(string)
	if !ok || phone == "" {
		return nil, errors.New("missing phone in task input")
	}

	plan, ok := task.Input["plan"].(string)
	if !ok || plan == "" {
		return nil, errors.New("missing plan in task input")
	}

	if err := billing.ActivatePlan(ctx, b.rdb, phone, plan); err != nil {
		return nil, fmt.Errorf("activate plan: %w", err)
	}

	if plan == string(billing.PlanPro) || plan == string(billing.PlanEnterprise) {
		if err := billing.SetUnlimitedRequests(ctx, b.rdb, phone); err != nil {
			return nil, fmt.Errorf("set unlimited: %w", err)
		}
	}

	return map[string]any{
		"event_type": "payment_received",
		"phone":      phone,
		"plan":       plan,
		"activated": true,
	}, nil
}

func (b *BillingAgent) handleSubscriptionDeleted(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	phone, ok := task.Input["phone"].(string)
	if !ok || phone == "" {
		return nil, errors.New("missing phone in task input")
	}

	if err := billing.ActivatePlan(ctx, b.rdb, phone, string(billing.PlanFree)); err != nil {
		return nil, fmt.Errorf("activate free plan: %w", err)
	}

	if err := billing.SetFreeRequests(ctx, b.rdb, phone); err != nil {
		return nil, fmt.Errorf("set free requests: %w", err)
	}

	return map[string]any{
		"event_type": "subscription_deleted",
		"phone":      phone,
		"plan":       "free",
		"downgraded": true,
	}, nil
}

// Ensure BillingAgent implements AgentInterface at compile time.
var _ AgentInterface = (*BillingAgent)(nil)