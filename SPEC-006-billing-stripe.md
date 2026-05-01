# SPEC-006: Billing & Stripe

**Status:** DRAFT
**Created:** 2026-04-10
**Author:** will
**Related:** SPEC-002, SPEC-003

---

## Objective

Implementar billing: Stripe checkout, webhook processing, plan activation.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Payments | Stripe (Checkout + Webhooks) |
| Currency | BRL (R$) |
| Plans | Free, Trial, Pro, Enterprise |

---

## Plan Definitions

| Plan | Preço | Requests | Features |
|------|-------|----------|----------|
| Free | R$ 0 | 10/day | Basic |
| Trial | R$ 0 | 30/7d | Full access |
| Pro | R$ 49,90/mês | unlimited | All features |
| Enterprise | R$ 199/mês | unlimited | API access |

---

## billing_agent

```go
type BillingAgent struct{}

func (b *BillingAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    switch task.Input["event_type"] {
    case "request_used":
        // Decrement counter (via Redis Lua)
    case "upgrade_requested":
        // Create Stripe checkout
    case "payment_received":
        // Activate plan in Redis
    case "subscription_deleted":
        // Set to free plan
    }
}
```

---

## Stripe Webhook Events

| Event | Action |
|-------|--------|
| checkout.session.completed | Activate trial |
| invoice.paid | Activate pro/enterprise |
| customer.subscription.deleted | Set to free |

---

## access_control Lua Script

```lua
-- Atomic check + decrement
local remaining = redis.call('GET', KEYS[1])
if remaining == nil or tonumber(remaining) <= 0 then
    return {decision="block", remaining=0}
end
redis.call('DECR', KEYS[1])
return {decision="allow", remaining=redis.call('GET', KEYS[1])}
```

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Free tier blocks after 10 requests | smoke test loop 11x |
| AC-2 | Stripe checkout URL generated | curl webhook mock |
| AC-3 | Plan activated after payment | Stripe webhook test |
| AC-4 | Idempotent webhook processing | Duplicate evt_id ignored |
