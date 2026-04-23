# LLM Provider Architecture

## Overview

Hermes Agency uses a tiered LLM provider strategy with MiniMax M2.7 as the primary provider, Ollama for local/vision tasks, Groq and OpenAI via LiteLLM proxy, and OpenRouter for aggregated provider access.

## Provider Priority Chain

```
Primary: MiniMax M2.7 (via LiteLLM :4000)
  ↓ (failure or timeout > 10s)
Fallback 1: Ollama Gemma4-12b-it (:11434)
  ↓ (failure or timeout > 30s)
Fallback 2: Groq via LiteLLM
  ↓ (failure or timeout > 30s)
Fallback 3: OpenAI GPT-4o via LiteLLM
  ↓ (ALL FAIL)
Error: last failure reason
```

## Provider Endpoints

| Provider    | Endpoint                     | Port  | Use Case                    |
|-------------|------------------------------|-------|-----------------------------|
| MiniMax     | api.minimax.io               | 443   | Primary text, CEO routing  |
| Ollama      | localhost                     | 11434 | Vision, STT, local fallback |
| Groq        | via LiteLLM                  | 4000  | Fast inference               |
| OpenAI      | via LiteLLM                  | 4000  | GPT models                   |
| OpenRouter  | via LiteLLM                  | 4000  | Aggregated providers        |
| LiteLLM     | localhost                    | 4000  | Unified proxy               |

## Task-to-Provider Mapping

| Task Type             | Primary        | Fallback           | Notes                     |
|-----------------------|----------------|--------------------|---------------------------|
| CEO routing decision  | MiniMax        | Ollama Gemma4     | Fast, cheap               |
| Creative writing      | MiniMax        | Ollama Gemma4      | Scripts, copy, content    |
| Code/Analysis         | Ollama qwen2.5vl:7b | MiniMax       | Local for privacy         |
| Vision                | Ollama qwen2.5vl:7b | —               | Always local              |
| Embeddings            | Ollama nomic-embed-text | OpenAI ada-002 | 768d → 1536d projection  |
| Portuguese content     | MiniMax        | —                  | Better PT-BR              |
| Background tasks      | Groq           | OpenAI             | Fast inference            |
| Complex reasoning     | MiniMax/GPT-4  | —                  | >5s acceptable            |
| Fast response (<500ms)| Ollama        | Groq                | Local or fast inference  |

## Cost Management

### Token Counting

Each provider tracks:
- `tokensIn`: input tokens
- `tokensOut`: output tokens
- `totalCost`: accumulated cost

### Budget Alerts

| Threshold | Action                          |
|-----------|--------------------------------|
| 80%       | Alert: budget nearly exhausted |
| 100%      | Route to cheaper providers only |

### Provider Cost Per 1M Tokens

| Provider   | Model           | Input Cost | Output Cost |
|------------|-----------------|------------|-------------|
| MiniMax    | minimax-m2.7    | $0.10      | $0.10       |
| Ollama     | gemma4-12b-it   | $0         | $0          |
| Ollama     | qwen2.5vl:7b    | $0         | $0          |
| Groq       | llama-3.3-70b   | $0.05      | $0.08       |
| OpenAI     | gpt-4o          | $2.50      | $10.00      |

## Latency Routing

| Requirement     | Provider | Expected Latency |
|-----------------|----------|------------------|
| < 500ms         | Ollama   | Local, minimal   |
| 1-5s            | Groq     | Fast inference   |
| > 5s acceptable  | MiniMax  | Complex reasoning|
| > 5s acceptable | GPT-4o   | Complex reasoning|

## Retry with Backoff

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,    // 1s
  maxDelay: 4000,     // 4s
  jitter: 500,        // ±500ms
  perAttemptTimeout: 30000, // 30s
};
```

Backoff sequence: 1s → 2s → 4s (±jitter)

## Embedding Strategy

```typescript
const EMBEDDING_CONFIG = {
  primary: {
    provider: 'ollama',
    model: 'nomic-embed-text',
    dimensions: 768,
    endpoint: 'http://localhost:11434/api/embeddings',
  },
  fallback: {
    provider: 'openai',
    model: 'text-embedding-ada-002',
    dimensions: 1536,
    endpoint: 'http://localhost:4000/embeddings',
  },
};
```

### Dimension Projection

When switching from nomic-embed-text (768d) to ada-002 (1536d), apply a projection layer:
```typescript
// Project 768d → 1536d via linear projection matrix
const projectionMatrix = loadProjectionMatrix('nomic-to-ada002.pt');
```

## LiteLLM Configuration

LiteLLM proxy (:4000) routes to:

```yaml
model_list:
  - model_name: minimax-m2.7
    litellm_params:
      model: minimax/MiniMax-Text-01
      api_key: os.environ/MINIMAX_API_KEY

  - model_name: gemma4-12b-it
    litellm_params:
      model: ollama/gemma4-12b-it
      api_base: http://localhost:11434

  - model_name: qwen2.5vl:7b
    litellm_params:
      model: ollama/qwen2.5vl:7b
      api_base: http://localhost:11434

  - model_name: groq-llama-3.3-70b
    litellm_params:
      model: groq/llama-3.3-70b-versatile

  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
```

## Health Checks

Each provider should be checked periodically:

```typescript
interface ProviderHealth {
  provider: string;
  healthy: boolean;
  latencyMs: number;
  lastChecked: Date;
  error?: string;
}
```

## Implementation Notes

- **router.ts** — Primary text routing via MiniMax only
- **bot.ts** — Vision/STT use Ollama directly
- **rag-instance-organizer.ts** — Uses Trieve for vector search (not embedding providers directly)

## File Structure

```
hermes-agency/src/
├── litellm/
│   └── router.ts       # LLM chain router
├── skills/
│   └── rag-instance-organizer.ts  # RAG operations via Trieve
└── services/
    └── embedding.ts    # (future) Embedding provider routing
```
