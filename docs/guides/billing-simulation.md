---
name: Billing Simulation Mode Guide
description: Como usar o modo simulação para testar billing sem chamar Stripe real
type: guide
---

# Billing Simulation Mode

## Visão Geral

O modo simulação (`BILLING_SIMULACAO=true`) permite testar todo o flow de billing **sem chamar a API real do Stripe**. Ideal para:
- Desenvolvimento local
- Testes em staging
- CI/CD sem credenciais
- Smoke tests automatizados

## Variáveis de Ambiente

| Variável | Valores | Default | Descrição |
|----------|---------|---------|-----------|
| `BILLING_SIMULACAO` | `true` / `false` | `false` | Ativa/desativa modo simulação |
| `STRIPE_API_KEY` | string | - | API key do Stripe (obrigatório em modo live) |
| `STRIPE_PRICE_PRO` | price_xxx | - | Price ID do plano Pro |
| `STRIPE_PRICE_ENTERPRISE` | price_xxx | - | Price ID do plano Enterprise |

## quickstart

### 1. Modo Simulação (Default)

```bash
# Ativar simulação
export BILLING_SIMULACAO=true

# Não precisa de STRIPE_API_KEY em modo simulação

# Rodar o swarm
go run ./cmd/swarm

# Testar checkout (free - rejeitado)
curl -X POST http://localhost:8080/api/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","plan":"free"}'
# Response: "free and trial plans do not require checkout"

# Testar checkout (pro - simulation mode)
curl -X POST http://localhost:8080/api/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","plan":"pro"}'
# Response: https://checkout.stripe.com/simulate/mock_session_123?phone=+5511999999999&plan=pro&time=1712900000
```

### 2. Modo Live (Stripe Real)

```bash
# Configurar credenciais
export BILLING_SIMULACAO=false
export STRIPE_API_KEY=sk_test_xxx
export STRIPE_PRICE_PRO=price_xxx
export STRIPE_PRICE_ENTERPRISE=price_yyy

# Rodar o swarm
go run ./cmd/swarm

# Testar checkout real
curl -X POST http://localhost:8080/api/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","plan":"pro"}'
# Response: https://checkout.stripe.com/pay/cs_xxx (URL real)
```

## Comparação: Simulação vs Live

| Aspecto | Simulação | Live |
|---------|-----------|------|
| API Stripe | ❌ Não chamada | ✅ Chamada |
| Tempo de resposta | < 1ms | ~200-500ms |
| Checkout URL | Mock formatado | URL real do Stripe |
| Custo | Grátis | $0 (test mode) |
| Webhook events | Não gerados | Gerados |
| Price IDs | Ignorados | Validados |

## Smoke Test

```bash
# Rodar smoke test
cd tests/smoke
./billing_smoke.sh

# Saída esperada:
# [TEST 1] Free plan checkout rejection... ✅ PASS
# [TEST 2] Trial plan checkout rejection... ✅ PASS
# [TEST 3] Pro plan without price ID... ✅ PASS
# [TEST 4] Simulation URL format check... ✅ PASS
```

## API Endpoints

### POST /api/billing/checkout

Cria uma sessão de checkout.

**Request:**
```json
{
  "phone": "+5511999999999",
  "plan": "pro"
}
```

**Response (simulation):**
```json
{
  "checkout_url": "https://checkout.stripe.com/simulate/mock_session_123?phone=+5511999999999&plan=pro&time=1712900000",
  "simulation": true
}
```

**Response (live):**
```json
{
  "checkout_url": "https://checkout.stripe.com/pay/cs_xxx",
  "simulation": false
}
```

**Response (error):**
```json
{
  "error": "free and trial plans do not require checkout"
}
```

### POST /webhooks/stripe

Recebe eventos do Stripe (checkout.session.completed, invoice.paid, etc).

**Headers:**
- `Stripe-Signature: t=xxx,v1=yyy`

**Body:**
```json
{
  "id": "evt_xxx",
  "type": "checkout.session.completed",
  "data": {
    "metadata": {
      "phone": "+5511999999999",
      "plan": "pro"
    }
  }
}
```

## Código - Como Funciona

```go
// internal/billing/stripe.go

// BillingSimulation controla se operações vão para API real ou mock.
var BillingSimulation = os.Getenv("BILLING_SIMULACAO") == "true"

func (s *StripeBilling) CreateCheckout(ctx context.Context, phone, plan string) (string, error) {
    // ... validações ...

    if BillingSimulation {
        // Retorna URL mock sem chamar Stripe
        return simulateCheckout(phone, plan), nil
    }

    // Chama Stripe real
    return s.sc.V1CheckoutSessions.Create(ctx, params)
}
```

## Trocando entre Modos

### Via Environment Variable

```bash
# Simulacao
export BILLING_SIMULACAO=true

# Live
export BILLING_SIMULACAO=false
export STRIPE_API_KEY=sk_test_xxx
```

### Via Código (Testing)

```go
// Em tests, pode forçar modo simulação
billing.SetSimulation(true)
defer billing.SetSimulation(false)
```

## Status Codes

| Code | Significado |
|------|-------------|
| 200 | Checkout criado com sucesso |
| 400 | Plan inválido (free/trial) ou price ID não configurado |
| 401 | API key inválida (modo live) |
| 500 | Erro interno do Stripe |

## Troubleshooting

### "stripe checkout failed: No such price" (live mode)
Verifique se `STRIPE_PRICE_PRO` está configurado corretamente no dashboard Stripe.

### "STRIPE_API_KEY not set" (live mode)
Configure a variável de ambiente com uma API key válida.

### Mock URL não aparece
Verifique se `BILLING_SIMULACAO=true` está setado no environment.

## Próximos Passos

1. Configure Stripe Price IDs no dashboard
2. Registre o webhook endpoint em main.go
3. Teste smoke em staging com simulação
4. Troque para modo live quando pronto

---

**Authority:** will
**Created:** 2026-04-12