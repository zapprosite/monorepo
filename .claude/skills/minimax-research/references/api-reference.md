# MiniMax API Reference

## Endpoint

```
POST https://api.minimax.io/anthropic/v1/messages
```

## Authentication

Bearer token retrieved via Infisical SDK:

```typescript
const token = await infisicalClient.getSecret({
  secretName: 'MINIMAX_API_TOKEN',
});
```

Header format:
```
Authorization: Bearer <token>
```

## Models

| Model | Model ID | Use Case |
|-------|----------|----------|
| MiniMax-M2.7 | `MiniMax-M2.7` | Deep research, complex analysis (default) |
| MiniMax-M2.1 | `MiniMax-M2.1` | Quick lookups, simpler tasks (fast) |

## Request Format

```json
{
  "model": "MiniMax-M2.7",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "your research query"
    }
  ]
}
```

## Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "analysis response"
    }
  ],
  "id": "msg_xxx",
  "model": "MiniMax-M2.7",
  "role": "assistant",
  "stop_reason": "end_turn"
}
```

## Rate Limits

- Default: 2048 tokens per request
- Max tokens: 1024 (configurable)

## Error Handling

| Error Code | Description |
|------------|-------------|
| 401 | Invalid or missing API token |
| 429 | Rate limit exceeded |
| 500 | MiniMax API server error |

## Infisical Secret Configuration

```typescript
{
  secretName: 'MINIMAX_API_TOKEN',
  workspaceId: process.env.INFISICAL_WORKSPACE_ID,
  environment: 'production',
  secretPath: '/'
}
```