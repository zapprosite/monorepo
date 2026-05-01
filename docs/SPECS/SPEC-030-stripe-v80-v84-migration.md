---
name: SPEC-030 Stripe v80 → v84 Migration
description: Migrar stripe-go da v80.2.1 para v84.2.0 - client pattern mudou de global stripe.Key para stripe.NewClient()
type: specification
---

# SPEC-030: Stripe v80 → v84 Migration

**Status:** COMPLETED
**Created:** 2026-04-12
**Updated:** 2026-04-12
**Author:** will
**Related:** SPEC-029 (library audit findings)
**Priority:** 🔴 CRITICAL

---

## Objective

Migrar stripe-go da v80.2.1 para v84.2.0 seguindo o migration plan documentado no SPEC-029. O billing flow é critical path — qualquer erro impacta receita.

**Problema:** O novo client pattern do stripe-go v84+ quebra o código existente em 4 arquivos. Migration deve ser executada com backup e testing completo.

---

## Breaking Changes (from SPEC-029)

### 1. Client Instantiation — CRITICAL

```go
// v80 (OLD) — global stripe.Key
stripe.Key = "sk_test_xxx"
customer.New(params)

// v84 (NEW) — client-scoped
sc := stripe.NewClient("sk_test_xxx")
sc.V1Customers.Create(ctx, params)
```

### 2. Checkout Session Creation — CRITICAL

```go
// v80 (OLD)
params := &stripe.CheckoutSessionParams{...}
sess, err := session.New(params)

// v84 (NEW)
sc := stripe.NewClient("sk_test_xxx")
params := &stripe.CheckoutSessionParams{...}
sess, err := sc.V1CheckoutSessions.New(ctx, params)
```

### 3. API Version Change
- API Version: `2025-03-31.basil` (introduced in v82)
- Some params structures changed
- Metadata handling may differ

---

## Files Affected

| File | Changes Required | Risk |
|------|----------------|------|
| `internal/billing/stripe.go` | stripe.NewClient(), sc.V1CheckoutSessions.New() | HIGH |
| `internal/billing/webhook.go` | Webhook event parsing (may need signature lib update) | MEDIUM |
| `go.mod` | stripe-go/v80 → stripe-go/v84 | LOW |
| `go.sum` | auto-update | LOW |
| `tests/integration/billing_test.go` | Update test client pattern | MEDIUM |

---

## Agent Tasks (Parallel Execution)

### Task 1: Backup Branch Creation
**Owner:** agent-1
**Verify:** Backup branch exists before any code changes
**Command:** `git checkout -b backup/pre-migration-stripe-v84`

### Task 2: go.mod Update
**Owner:** agent-2
**Action:** `go get github.com/stripe/stripe-go/v84@v84.2.0`
**Verify:** `grep "stripe-go" go.mod` shows v84

### Task 3: stripe.go Migration (Primary)
**Owner:** agent-3
**File:** `internal/billing/stripe.go`
**Changes:**
- Replace `stripe.Key = apiKey` with `sc := stripe.NewClient(apiKey)`
- Replace `session.New(params)` with `sc.V1CheckoutSessions.New(ctx, params)`
- Store `sc` in StripeBilling struct
- Update all methods to use `s.sc.V1CheckoutSessions.New(ctx, params)`

### Task 4: StripeBilling Struct Update
**Owner:** agent-4
**File:** `internal/billing/stripe.go`
**Changes:**
```go
type StripeBilling struct {
    sc *stripe.Client  // add client field
}
func NewStripeBilling() (*StripeBilling, error) {
    sc := stripe.NewClient(apiKey)
    return &StripeBilling{sc: sc}, nil
}
```

### Task 5: webhook.go Review
**Owner:** agent-5
**File:** `internal/billing/webhook.go`
**Analysis:**
- Does webhook need stripe client?
- Signature verification using local `hmacSHA256` — no stripe dependency
- Event parsing uses raw JSON — no stripe dependency
- Report any issues

### Task 6: Import Updates
**Owner:** agent-6
**Files:** All billing files
**Changes:**
```go
// OLD
"github.com/stripe/stripe-go/v80"
"github.com/stripe/stripe-go/v80/checkout/session"

// NEW
"github.com/stripe/stripe-go/v84"
```
**Verify:** `grep -r "stripe-go/v80" --include="*.go"` returns nothing

### Task 7: Build Verification
**Owner:** agent-7
**Command:** `go build ./...`
**Verify:** No stripe-related errors
**If fails:** Revert and report

### Task 8: Unit Tests
**Owner:** agent-8
**Command:** `go test ./internal/billing/... -v`
**Verify:** All billing tests pass
**Note:** May need to mock stripe client for tests

### Task 9: Integration Test Preparation
**Owner:** agent-9
**File:** `tests/integration/billing_test.go`
**Changes:** Update test clients to use stripe.NewClient pattern
**Verify:** Tests compile and pass

### Task 10: Migration Report
**Owner:** agent-10
**Output:** Document all changes, test results, any issues found
**Verify:** Migration complete, build passes, tests pass

---

## Migration Steps (Sequential)

### Phase 1: Backup (Day 1 - Hour 0)
```bash
git checkout -b backup/pre-migration-stripe-v84
git push origin backup/pre-migration-stripe-v84
```

### Phase 2: Code Migration (Day 1 - Hours 1-4)
1. `go get github.com/stripe/stripe-go/v84@v84.2.0`
2. Update `internal/billing/stripe.go`:
   - Add `sc *stripe.Client` to StripeBilling struct
   - Replace `stripe.Key = apiKey` with `stripe.NewClient(apiKey)`
   - Replace `session.New(params)` with `s.sc.V1CheckoutSessions.New(ctx, params)`
3. Update imports from v80 to v84
4. `go build ./...` — verify compilation

### Phase 3: Testing (Day 1 - Hours 4-6)
```bash
go test ./internal/billing/... -v -count=1
```

### Phase 4: Staging Deployment (Day 1 - Evening)
1. Deploy to staging
2. Manual checkout flow test (free/trial/paid)
3. Webhook test with test events
4. Monitor for 24h

### Phase 5: Production (Day 2)
1. Deploy to production
2. Monitor billing metrics
3. Watch for errors

---

## Rollback Plan

```bash
# If critical issue found:
git checkout feature/stripe-v84-backup
go get github.com/stripe/stripe-go/v80@v80.2.1
go mod tidy
go build ./...
```

---

## Success Criteria

| # | Criterion | Status |
|---|-----------|--------|
| SC-1 | Backup branch created | ✅ feature/stripe-v84-backup |
| SC-2 | go.mod updated to v84 | ✅ v84.2.0 |
| SC-3 | stripe.go uses new client pattern | ✅ stripe.NewClient() + V1CheckoutSessions.Create() |
| SC-4 | No compilation errors | ✅ go build ./... |
| SC-5 | All unit tests pass | ✅ 27/27 tests pass |
| SC-6 | Integration tests pass | ⬜ pending staging |
| SC-7 | Staging checkout flow works | ⬜ pending staging |
| SC-8 | Webhooks process correctly | ⬜ pending staging |
| SC-9 | Production deployment complete | ⬜ pending |
| SC-10 | Monitoring shows no billing errors | ⬜ pending |

---

## Verification Commands

```bash
# After migration
grep "stripe-go/v80" --include="*.go" -r .  # should return nothing
grep "stripe.Key" internal/billing/stripe.go  # should return nothing
go build ./...  # should pass
go test ./internal/billing/... -v  # should all pass
```

---

## Open Questions

| # | Question | Impact | Owner |
|---|----------|--------|-------|
| OQ-1 | Do integration tests exist for billing? | HIGH | agent-9 |
| OQ-2 | Do we have Stripe test mode keys? | HIGH | will |
| OQ-3 | Is there a staging environment? | MEDIUM | will |

---

## Notes from SPEC-029

- stripe.NewClient() is the new pattern (not stripe.New())
- API version 2025-03-31.basil introduced in v82
- Metadata structures may have changed
- SubscriptionData params structure modified
- Webhook processing may differ in event parsing

---

## Timeline

- **Day 1 AM:** Backup, migration, build
- **Day 1 PM:** Testing
- **Day 1 EOD:** Deploy to staging
- **Day 2 AM:** Staging verification
- **Day 2 PM:** Production deployment

---

## Migration Completed — 2026-04-12

### Code Changes

**Files modified (3):**
- `internal/billing/stripe.go` — Client pattern migration
- `internal/billing/stripe_test.go` — Test fix
- `internal/billing/plans.go` — IsStripeConfigured fix

**Key changes:**
```go
// OLD v80 pattern
stripe.Key = apiKey
sess, err := session.New(params)

// NEW v84 pattern
sc := stripe.NewClient(apiKey)
sess, err := sc.V1CheckoutSessions.Create(ctx, params)
```

### Param Types Changed
- `CheckoutSessionParams` → `CheckoutSessionCreateParams`
- `CheckoutSessionLineItemParams` → `CheckoutSessionCreateLineItemParams`
- `CheckoutSessionSubscriptionDataParams` → `CheckoutSessionCreateSubscriptionDataParams`

### Build & Tests
- `go build ./...` ✅
- `go test ./internal/billing/...` ✅ 27/27 tests pass

### Backup Branch
- `feature/stripe-v84-backup` pushed to origin