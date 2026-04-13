# MiniMax API Reference

## Endpoint

```
POST https://api.minimax.io/anthropic/v1/messages
```

## Authentication

```
Authorization: Bearer <MINIMAX_API_KEY>
anthropic-version: 2023-06-01
```

Token retrieved via Infisical SDK (Python):
- Project ID: e42657ef-98b2-4b9c-9a04-46c093bd6d37
- Environment: dev
- Secret name: MINIMAX_API_KEY

## Model

| Model | Model ID | Uso |
|-------|----------|-----|
| MiniMax-M2.1 | MiniMax-M2.1 | Default, 1024 max_tokens |

## Request

```json
{
  "model": "MiniMax-M2.1",
  "max_tokens": 1024,
  "thinking": {"type": "disabled"},
  "messages": [
    {
      "role": "user",
      "content": "research query"
    }
  ]
}
```

## Response

```json
{
  "content": [{"type": "text", "text": "analysis response"}],
  "id": "msg_xxx",
  "model": "MiniMax-M2.1",
  "role": "assistant",
  "stop_reason": "end_turn"
}
```

## Error Codes

| Code | Meaning |
|------|---------|
| 401 | Token invalido ou faltando |
| 429 | Rate limit excedido |
| 500 | Erro interno MiniMax |

## Rate Limits

- Timeout: 30s per request
- Max tokens: 1024 (response)
