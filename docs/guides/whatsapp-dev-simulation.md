---
name: WhatsApp DEV Simulation Guide
description: Como usar o modo simulação WhatsApp para testar fluxos no terminal (DEV mode)
type: guide
---

# WhatsApp DEV Simulation Mode

## Visão Geral

O modo DEV simulation (`SIMULATE_WHATSAPP=true` + `DEV_MODE=true`) permite testar todo o fluxo de WhatsApp **sem necessidade de credenciais reais** da Meta Graph API. Ideal para:
- Desenvolvimento local
- Testes em staging
- CI/CD sem credenciais
- Smoke tests automatizados
- Debug de fluxos RAG

## Variáveis de Ambiente

| Variável | Valores | Default | Descrição |
|----------|---------|---------|-----------|
| `DEV_MODE` | `true` / `false` | `false` | Ativa modo desenvolvimento |
| `SIMULATE_WHATSAPP` | `true` / `false` | `false` | Simula envio WhatsApp |
| `WHATSAPP_PHONE` | string | - | Phone number default para testes |

## quickstart

### 1. Modo Simulation (DEV)

```bash
# Ativar simulação
export DEV_MODE=true
export SIMULATE_WHATSAPP=true

# Rodar o swarm
go run ./cmd/swarm

# Em outro terminal, enviar mensagem simulada
./bin/whatsapp-simulator \
  --phone +5511999999999 \
  --text "ar inverter Springer erro E8"
```

### 2. Output Esperado

```
=== WhatsApp DEV Simulator ===
DEV_MODE: true
SIMULATE_WHATSAPP: true
Phone: +5511999999999
Message: ar inverter Springer erro E8
Queue: swarm:queue:intake

✅ Pushed to Redis queue: swarm:queue:intake

📱 SIMULATED WHATSAPP MESSAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: +5511999999999
Message ID: sim_1712900000_5511999999999
Message: ar inverter Springer erro E8
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[WHATSAPP SIMULATED] To: +5511999999999 | Message: ar inverter Springer erro E8

✅ Simulation complete. Check swarm logs for RAG processing.
```

## CLI Tool Usage

### Enviar Mensagem Simulada

```bash
./bin/whatsapp-simulator \
  --phone +5511999999999 \
  --text "ar inverter Springer erro E8"
```

### Com Redis Externo

```bash
REDIS_ADDR=10.0.19.50:6379 ./bin/whatsapp-simulator \
  --phone +5511999999999 \
  --text "Springer Xtreme Save Connect erro E8"
```

### Formato da Mensagem

A mensagem é formatada como JSON e pushada para Redis:

```json
{
  "id": "sim_1712900000_5511999999999",
  "phone": "+5511999999999",
  "text": "ar inverter Springer erro E8",
  "timestamp": 1712900000,
  "source": "whatsapp-simulator",
  "simulated": true
}
```

## Fluxo Completo (DEV)

```
┌─────────────────────────────────────────────────────────┐
│ Terminal Input (whatsapp-simulator)                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Redis LPUSH → swarm:queue:intake                        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ intake_agent → classifier                              │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ RAG Query (Qdrant + Error Codes + Manuals)              │
│  - chunker.go: 512 tokens error codes                   │
│  - refiner.go: confidence >= 0.85 = high                │
│  - models/hvac_models.go: brand lookup                  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Response logged to terminal                             │
│ [WHATSAPP SIMULATED] To: +5511999999999 | Message: ...  │
└─────────────────────────────────────────────────────────┘
```

## Exemplos de Queries de Teste

### Error Code Lookup

```bash
./bin/whatsapp-simulator \
  --phone +5511999999999 \
  --text "Springer erro E8"
```

### Model Specs

```bash
./bin/whatsapp-simulator \
  --phone +5511999999999 \
  --text "specs Springer Xtreme Save Connect 12000 BTU"
```

### Diagnostic Procedure

```bash
./bin/whatsapp-simulator \
  --phone +5511999999999 \
  --text "como diagnosticar compressor LG dual inverter CH10"
```

### Multi-Brand

```bash
./bin/whatsapp-simulator --phone +5511999999999 --text "Samsung Wind-Free E101"
./bin/whatsapp-simulator --phone +5511999999999 --text "Daikin Air Performer A5"
./bin/whatsapp-simulator --phone +5511999999999 --text "Consul Facilita E5"
```

## Smoke Test

```bash
cd tests/smoke
./whatsapp_dev_smoke.sh

# Saída esperada:
# [TEST 1] Simulator help... ✅ PASS
# [TEST 2] Redis connection... ✅ PASS
# [TEST 3] Queue push... ✅ PASS
# [TEST 4] Error code query... ✅ PASS
# [TEST 5] Model lookup... ✅ PASS
```

## Código - Como Funciona

### SimulatedGraphAPIClient

O `SimulatedGraphAPIClient` em `internal/whatsapp/simulator.go` implementa a mesma interface do `GraphAPIClient`, mas ao invés de chamar a Graph API:

```go
func (c *SimulatedGraphAPIClient) SendText(ctx context.Context, to, message string) (*SendTextResponse, error) {
    fmt.Printf("[WHATSAPP SIMULATED] To: %s | Message: %s\n", to, message)
    return &SendTextResponse{
        MessagingID: "simulated_msg_id",
        // ...
    }, nil
}
```

### Verificação de Modo

```go
// internal/whatsapp/simulator.go
func IsSimulated() bool {
    return os.Getenv("SIMULATE_WHATSAPP") == "true"
}

// internal/whatsapp/sender.go
if IsSimulated() {
    return simulatedClient.SendText(ctx, to, message)
}
return realClient.SendText(ctx, to, message)
```

## Difference: Simulation vs Production

| Aspecto | Simulação | Production |
|---------|-----------|------------|
| API Meta | ❌ Não chamada | ✅ Chamada |
| Tempo de resposta | < 1ms | ~200-500ms |
| Custo | Grátis | $0.01-0.05/msg |
| Credenciais | Não precisas | WHATSAPP_TOKEN necessário |
| Rate limits | Nenhum | 1000 requests/hour |
| Webhooks | Não gerados | Gerados |

## Troubleshooting

### "Redis connection refused"
Verificar se Redis está rodando localmente ou configurar `REDIS_ADDR`:

```bash
export REDIS_ADDR=10.0.19.50:6379
./bin/whatsapp-simulator --phone +5511999999999 --text "test"
```

### "Queue not found"
A fila `swarm:queue:intake` é criada automaticamente pelo swarm. Verificar se `cmd/swarm/main.go` está configurado corretamente.

### Mock URL não aparece
Verificar se `SIMULATE_WHATSAPP=true` está setado no environment.

## Próximos Passos

1. Configure WhatsApp Business API credentials (quando for production)
2. Registre webhook endpoint em main.go
3. Teste smoke em staging com simulação
4. Troque para modo production quando pronto

---

**Authority:** will
**Created:** 2026-04-12