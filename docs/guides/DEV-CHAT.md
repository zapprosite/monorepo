# Dev Chat — Modo de Desenvolvimento WhatsApp/Terminal

Ativa um chat interativo no terminal para testar o pipeline RAG/Agents sem WhatsApp oficial.

## Quick Start

```bash
# Terminal 1 — Simulator
export SIMULATE_WHATSAPP=true
go run cmd/whatsapp-simulator/main.go &

# Terminal 2 — Swarm workers
export DEV_MODE=true
export SIMULATE_WHATSAPP=true
go run cmd/swarm/main.go &

# Terminal 3 — Chat REPL
go run cmd/chat/main.go -i
```

## Fluxo

```
chat REPL → HTTP POST → whatsapp-simulator :9378 → Redis queue → swarm worker → stdout
```

## Comandos REPL

| Comando | Descrição |
|---------|-----------|
| `/quit`, `/exit` | Sair |
| `/clear` | Limpar histórico |
| `/status` | Status do simulator |
| `/queue` | Ver fila Redis |
| `/help` | Ajuda |

## Teste Rápido

```bash
# Sem REPL — envie uma mensagem direta
go run cmd/chat/main.go "Ar condensing unit not cooling"
```

```bash
# Via curl
curl -X POST http://localhost:9378/api/simulate/incoming \
  -H "Content-Type: application/json" \
  -d '{"from": "5511999999999", "text": "Error code E1 on split system"}'
```

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DEV_MODE` | `false` | Pula validação HMAC |
| `SIMULATE_WHATSAPP` | `false` | Log stdout em vez de API calls |
| `REDIS_ADDR` | `localhost:6379` | Endereço Redis |
| `WHATSAPP_SIMULATOR_PORT` | `9378` | Porta do simulator |

## Refinamento Iterativo

1. Digite mensagem no REPL
2. Veja resposta no stdout do worker
3. Ajuste prompts/parametros
4. Test again until satisfied
5. Migrar para WhatsApp oficial

## Quando Migrar

1. `pkill -f whatsapp-simulator`
2. Configurar `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`
3. Remover `DEV_MODE` e `SIMULATE_WHATSAPP`
4. Expor webhook para Meta
