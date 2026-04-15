# OpenWebUI API Reference

> Source: [OpenWebUI Docs](https://github.com/open-webui/docs) — Context7 `/open-webui/docs`
> Base URL (external): `https://chat.zappro.site/api/`
> Authentication: JWT Bearer token (set via `Authorization: Bearer <token>` header)

---

## Chat Completions

### `POST /api/chat/completions`

OpenAI API-compatible chat completion endpoint. Supports Ollama models, OpenAI models, and Open WebUI Function models.

**Request:**

```json
{
  "model": "llama3.1",
  "messages": [
    { "role": "user", "content": "Why is the sky blue?" }
  ]
}
```

**Response (200):**

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "The sky appears blue due to Rayleigh scattering..."
      }
    }
  ]
}
```

**curl:**

```bash
curl -X POST https://chat.zappro.site/api/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "model": "llama3.1",
        "messages": [{"role": "user", "content": "Why is the sky blue?"}]
      }'
```

**With file/collection context:**

```bash
curl -X POST https://chat.zappro.site/api/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "model": "gpt-4-turbo",
        "messages": [{"role": "user", "content": "Explain this document."}],
        "files": [{"type": "collection", "id": "your-collection-id-here"}]
      }'
```

---

## Models

### `GET /api/models`

Retrieves all configured models available through Open WebUI.

**curl:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://chat.zappro.site/api/models
```

**Response (200):**

```json
{
  "models": [
    { "name": "llama3", "provider": "ollama", "model_id": "llama3" },
    { "name": "gpt-4o", "provider": "openai", "model_id": "gpt-4o" }
  ]
}
```

---

## Ollama Proxy Endpoints

Transparent passthrough to native Ollama API. Base path: `/ollama/api/`

### `GET /ollama/api/tags` — List Available Models

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://chat.zappro.site/ollama/api/tags
```

### `POST /ollama/api/generate` — Generate Completion (Streaming)

```bash
curl -X POST https://chat.zappro.site/ollama/api/generate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "model": "llama3.2",
        "prompt": "Why is the sky blue?",
        "stream": true
      }'
```

### `POST /ollama/api/embed` — Generate Embeddings

```bash
curl -X POST https://chat.zappro.site/ollama/api/embed \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "model": "llama3.2",
        "input": ["Open WebUI is great!", "Generate embeddings."]
      }'
```

---

## Chats / History

### `GET /api/chats/{chat_id}`

Retrieves a specific chat conversation including message history, metadata, files, and tags.

**curl:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://chat.zappro.site/api/chats/chat-uuid-12345
```

**Response (200):**

```json
{
  "id": "chat-uuid-12345",
  "title": "Capital of France Discussion",
  "models": ["gpt-4o"],
  "files": [],
  "tags": [{ "id": "auto-tag-1", "name": "geography", "color": "#4CAF50" }],
  "params": {},
  "timestamp": 1720000000000,
  "messages": [
    {
      "id": "user-msg-id",
      "role": "user",
      "content": "Hi, what is the capital of France?",
      "timestamp": 1720000000000,
      "models": ["gpt-4o"]
    },
    {
      "id": "assistant-msg-id",
      "role": "assistant",
      "content": "The capital of France is Paris.",
      "parentId": "user-msg-id",
      "modelName": "gpt-4o",
      "timestamp": 1720000001000
    }
  ]
}
```

---

## File Upload

### `POST /api/v1/files/`

Uploads a file for content extraction and embedding. Supports async processing.

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: application/json" \
  -F "file=@/path/to/your/file" \
  https://chat.zappro.site/api/v1/files/
```

---

## Analytics

### `GET /api/v1/analytics/summary`

Admin-only endpoint. Retrieves usage summaries grouped by date range or group ID.

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://chat.zappro.site/api/v1/analytics/summary?group_id=abc123"
```

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://chat.zappro.site/api/v1/analytics/summary?start_date=1704067200&end_date=1706745600"
```

---

## SCIM 2.0 (User Provisioning)

Base path: `/api/v1/scim/v2/`

Requires `ENABLE_SCIM=True` and SCIM auth tokens configured.

### `GET /api/v1/scim/v2/Users` — List Users

```bash
curl -H "Authorization: Bearer your-scim-token" \
  https://chat.zappro.site/api/v1/scim/v2/Users
```

### `GET /api/v1/scim/v2/Users/{id}` — Get User

```bash
curl -H "Authorization: Bearer your-scim-token" \
  https://chat.zappro.site/api/v1/scim/v2/Users/user-id
```

### `POST /api/v1/scim/v2/Users` — Create User

```bash
curl -X POST \
  -H "Authorization: Bearer your-scim-token" \
  -H "Content-Type: application/scim+json" \
  -d '{
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "userName": "test@example.com",
        "externalId": "idp-user-id-123",
        "displayName": "Test User",
        "name": {
          "givenName": "Test",
          "familyName": "User"
        },
        "emails": [{"value": "test@example.com", "primary": true}],
        "active": true
      }' \
  https://chat.zappro.site/api/v1/scim/v2/Users
```

---

## Environment Configuration (Relevant to API)

| Variable | Default | Description |
|---|---|---|
| `ENABLE_API_KEYS` | `False` | Enable API key generation for programmatic access |
| `ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS` | `False` | Restrict API keys to specific endpoints |
| `API_KEYS_ALLOWED_ENDPOINTS` | — | Comma-separated list of allowed endpoints |
| `ENABLE_OAUTH_TOKEN_EXCHANGE` | `False` | Enable OAuth token exchange for external apps |
| `DEFAULT_USER_ROLE` | `pending` | Default role for new signups (`pending`, `user`, `admin`) |
| `ENABLE_SIGNUP` | `True` | Allow new user signup |
| `ENABLE_PASSWORD_AUTH` | `True` | Enable password login (set `False` for SSO-only) |
| `ENABLE_ADMIN_EXPORT` | `True` | Allow admin database exports |
| `ENABLE_ADMIN_CHAT_ACCESS` | `True` | Admin can view user chats |

---

## Authentication Summary

- **Method:** JWT Bearer token in `Authorization` header
- **Header:** `Authorization: Bearer <token>`
- **API Keys:** Generated in OpenWebUI UI (if `ENABLE_API_KEYS=True`)
- **OAuth:** Google OAuth via Cloudflare Access (bypassed for `/oauth/*`)
- **SCIM:** Separate token-based auth via `SCIM_AUTH_TOKENS`

---

## Notes

- OpenWebUI is **OpenAI API-compatible** — `POST /api/chat/completions` mirrors the OpenAI interface
- Ollama proxy endpoints (`/ollama/api/*`) provide direct Ollama API passthrough
- Audio/STT configuration is handled server-side (environment variables), not via REST API
- File uploads use `multipart/form-data`, not JSON
- Analytics endpoints require admin token
- SCIM endpoints require `ENABLE_SCIM=True` and SCIM auth tokens
