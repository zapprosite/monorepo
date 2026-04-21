# Dev Chat Skill — WhatsApp/Terminal Development Mode

Ativa o modo de desenvolvimento interativo para testar o pipeline RAG/Agents sem expor ao WhatsApp oficial.

## Conceito

- **Terminal** vira um chat WhatsApp simulado
- Mensagens entram via `cmd/chat` (REPL)
- `cmd/whatsapp-simulator` (porta 9378) coloca na fila Redis
- Swarm workers processam com `SIMULATE_WHATSAPP=true`
- Respostas aparecem no stdout do worker

## Arquitetura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐     ┌────────────┐
│  chat REPL  │────▶│ whatsapp-simulator│────▶│ Redis Queue│────▶│swarm worker│
│  cmd/chat   │     │   :9378          │     │intake      │     │ (dev mode) │
└─────────────┘     └──────────────────┘     └─────────────┘     └────────────┘
```

## Ativação

### 1. variáveis de ambiente

```bash
export DEV_MODE=true
export SIMULATE_WHATSAPP=true
export REDIS_ADDR=localhost:6379
```

### 2. Iniciar o whatsapp-simulator (porta 9378)

```bash
go run cmd/whatsapp-simulator/main.go
```

### 3. Iniciar os swarm workers (outro terminal)

```bash
go run cmd/swarm/main.go
```

### 4. Iniciar o chat REPL (terceiro terminal)

```bash
go run cmd/chat/main.go -i
```

## Comandos do REPL

| Comando | Descrição |
|---------|-----------|
| `/quit`, `/exit` | Sair |
| `/clear` | Limpar histórico de mensagens |
| `/status` | Status do simulator |
| `/queue` | Ver fila Redis |
| `/help` | Ajuda |

## Fluxo de Mensagens

1. Usuário digita no REPL
2. `cmd/chat` envia POST para `:9378/api/simulate/incoming`
3. `whatsapp-simulator` coloca na fila `swarm:queue:intake`
4. Swarm worker consome, processa pelo pipeline (intake → classifier → rag → ranking → response)
5. `ResponseAgent` com `SimulatedGraphAPIClient` loga resposta no stdout

## Keys de Configuração

| Variável | Default | Descrição |
|----------|---------|-----------|
| `DEV_MODE` | `false` | Pula validação de assinatura WhatsApp |
| `SIMULATE_WHATSAPP` | `false` | Usa SimulatedGraphAPIClient (sem API calls) |
| `SIMULATE_WHATSAPP` em `whatsapp-simulator` | `false` | Habilita modo simulação |
| `REDIS_ADDR` | `localhost:6379` | Endereço Redis |
| `WHATSAPP_SIMULATOR_PORT` | `9378` | Porta do simulator |

## Componentes

### cmd/chat/main.go
- REPL interativo
- Comandos de gerenciamento
- Integração com whatsapp-simulator via HTTP

### cmd/whatsapp-simulator/main.go
- Servidor HTTP na porta 9378
- Endpoints WhatsApp Cloud API mock
- Integração direta com Redis

### internal/whatsapp/simulator.go
- `SimulatedGraphAPIClient`
- Implementa interface `SenderClient`
- Loga no stdout em vez de chamar Graph API

### internal/agents/response_agent.go
- `NewResponseAgent` detecta `isDevMode()` ou `IsSimulated()`
- Usa `SimulatedGraphAPIClient` quando `SIMULATE_WHATSAPP=true`

### internal/agents/intake_agent.go
- `isDevMode()` pula validação HMAC
- `isWhatsAppSimulated()` pula download de mídia

## Testing

```bash
# Teste direto sem REPL
curl -X POST http://localhost:9378/api/simulate/incoming \
  -H "Content-Type: application/json" \
  -d '{"from": "5511999999999", "text": "Ar condensing unit not cooling"}'

# Ver mensagens
curl http://localhost:9378/api/messages

# Ver fila
curl http://localhost:9378/api/queue

# Limpar
curl -X DELETE http://localhost:9378/api/messages
```

## Quando Migrar para WhatsApp Oficial

1. Parar `whatsapp-simulator`
2. Configurar `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`
3. Remover `SIMULATE_WHATSAPP=true` e `DEV_MODE=true`
4. Expor webhook para receber mensagens reais

## Refinamento Iterativo

O fluxo de refinement funciona igual ao produção:
1. Mandar mensagem no REPL
2. Ver resposta no stdout do worker
3. Se resposta não boa, ajustar prompts/parametros
4. Testar novamente até满意
5. Migrar para WhatsApp oficial
