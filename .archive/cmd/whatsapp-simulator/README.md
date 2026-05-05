# WhatsApp Simulator

Development simulator for WhatsApp Cloud API integration testing.

## Overview

The WhatsApp Simulator provides two modes:

1. **CLI Mode**: Send a single simulated message to the Redis intake queue
2. **Server Mode**: HTTP server that mocks WhatsApp Cloud API endpoints

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_PASSWORD` | Redis authentication password | (none) |

## CLI Mode

Send a single WhatsApp message directly to the Redis queue.

### Usage

```bash
whatsapp-simulator --phone +5511999999999 --text "Springer erro E8"
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--phone` | Recipient phone number (required) | - |
| `--text` | Message text (required) | - |
| `--queue` | Redis queue name | `swatsapp:queue:intake` |
| `--redis` | Redis server address | `localhost:6379` |

### Example

```bash
# Send a test message
whatsapp-simulator --phone +5511999999999 --text "LG dual inverter CH10"

# Use custom Redis
whatsapp-simulator --phone +5511999999999 --text "Test" --redis 10.0.0.1:6379

# Use custom queue
whatsapp-simulator --phone +5511999999999 --text "Test" --queue custom:queue:intake
```

## Server Mode

Run as an HTTP server that mocks WhatsApp Cloud API endpoints.

### Usage

```bash
whatsapp-simulator --port 9378
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--port` | HTTP server port | `9378` |
| `--queue` | Redis queue name | `swarm:queue:intake` |
| `--redis` | Redis server address | `localhost:6379` |
| `--webhook-path` | Webhook endpoint path | `/webhook` |
| `--verify-token` | Webhook verification token | `dev-verification-token` |

### Endpoints

#### Health Check

```
GET /health
```

Returns simulator status and Redis connectivity.

```json
{
  "status": "ok",
  "simulator": "whatsapp-dev",
  "redis": "connected",
  "queue": "swarm:queue:intake",
  "messages_sent": 0
}
```

#### Webhook Verification

```
GET /webhook?hub.mode=subscribe&hub.verify_token=dev-verification-token&hub.challenge=xxx
```

Handles WhatsApp Cloud API webhook verification challenge.

#### Webhook (Incoming Messages)

```
POST /webhook
```

Receives incoming messages from WhatsApp and queues them for processing.

#### Send Message (Mock WhatsApp Cloud API)

```
POST /v1/{phone}/messages
```

Sends a message via the mock WhatsApp Cloud API.

Request body:
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+5511999999999",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Hello from simulator"
  }
}
```

Response:
```json
{
  "messaging_product": "sim_1234567890_5511999999999",
  "contacts": [{"wa_id": "+5511999999999"}],
  "messages": [{"id": "sim_1234567890_5511999999999"}]
}
```

#### Simulate Incoming Message

```
POST /api/simulate/incoming
```

Simulates an incoming WhatsApp message (development helper).

Request body:
```json
{
  "from": "+5511999999999",
  "text": "Springer erro E8"
}
```

Response:
```json
{
  "status": "queued",
  "message": {
    "id": "sim_1234567890_5511999999999",
    "from": "+5511999999999",
    "text": "Springer erro E8",
    "timestamp": 1234567890,
    "type": "text",
    "source": "whatsapp-simulator",
    "simulated": true
  }
}
```

#### List Messages

```
GET /api/messages
```

Returns all messages handled by the simulator.

```json
{
  "count": 2,
  "messages": [...]
}
```

#### Message Count

```
GET /api/messages/count
```

```json
{
  "count": 5
}
```

#### Clear Messages

```
DELETE /api/messages
```

Clears all stored messages.

```json
{
  "status": "cleared"
}
```

#### Queue Info

```
GET /api/queue
```

Returns Redis queue information and sample messages.

```json
{
  "queue": "swarm:queue:intake",
  "length": 3,
  "sample_messages": [...]
}
```

## Testing with curl

### Send a message (CLI mode equivalent via API)

```bash
curl -X POST http://localhost:9378/v1/5511999999999/messages \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+5511999999999",
    "type": "text",
    "text": {"body": "Springer erro E8"}
  }'
```

### Simulate incoming message

```bash
curl -X POST http://localhost:9378/api/simulate/incoming \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+5511999999999",
    "text": "Springer erro E8"
  }'
```

### Check queue status

```bash
curl http://localhost:9378/api/queue
```

### Verify webhook

```bash
curl "http://localhost:9378/webhook?hub.mode=subscribe&hub.verify_token=dev-verification-token&hub.challenge=test123"
```

## Integration with Swarm

The simulator integrates with the HVAC-R swarm by pushing messages to the Redis intake queue (`swarm:queue:intake`).

Message payload structure:
```json
{
  "id": "sim_1234567890_5511999999999",
  "phone": "+5511999999999",
  "text": "Springer erro E8",
  "timestamp": 1234567890,
  "source": "whatsapp-simulator",
  "simulated": true
}
```

## Development

### Running the simulator

```bash
# CLI mode - single message
go run cmd/whatsapp-simulator/main.go --phone +5511999999999 --text "Test"

# Server mode - API server
go run cmd/whatsapp-simulator/main.go --port 9378
```

### Environment setup

```bash
export REDIS_ADDR="localhost:6379"
export REDIS_PASSWORD=""
export SIMULATE_WHATSAPP="true"
export DEV_MODE="true"
```

## Error Codes for Testing

The simulator is useful for testing HVAC-R diagnostic flows:

| Brand | Error Code | Test Message |
|-------|------------|--------------|
| Springer | E8 | `Springer erro E8` |
| LG | CH10 | `LG dual inverter CH10` |
| Samsung | E101 | `Samsung Wind-Free E101` |
| Invalid | xyz123 | `invalid brand xyz123` |

## Notes

- The simulator uses port `9378` by default (not WhatsApp's production ports)
- Messages are queued to Redis for async processing by the swarm
- The `simulated: true` flag indicates messages are from the simulator
- All messages are logged to stdout for debugging
