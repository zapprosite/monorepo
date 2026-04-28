# Context Fetch Workflow

## 1. Purpose

Before executing any Plan (P) or Execute (E) phase, Nexus agents must fetch relevant context from Hermes Second Brain via the context_fetch operation. This ensures agents operate with awareness of prior decisions, ongoing tasks, and accumulated knowledge.

## 2. Trigger

- Nexus enters **Plan (P)** phase
- Nexus enters **Execute (E)** phase

## 3. Method

Agents query the Qdrant vector search API (or Mem0 fallback) to retrieve semantically relevant memories.

## 4. Collections

Search across these Qdrant collections:

- `claude-code-memory`
- `second-brain`
- `will`

## 5. Query Construction

1. Extract a concise task description from the current phase (goal, intent, or problem statement)
2. Generate an embedding via local Ollama endpoint (`http://localhost:11434/api/embeddings`)
3. Use the embedding vector to search Qdrant with similarity threshold

## 6. Result Format

Return memories as a single concatenated snippet:

- Maximum **2000 tokens**
- Include source collection and relevance score when available
- Strip redundant boilerplate

## 7. Injection

Append the fetched memory snippet to the worker context before task execution begins:

```
[HERMES CONTEXT]
<fetched memories>
[/HERMES CONTEXT]
```

## 8. Example curl Command

```bash
# Search Qdrant for relevant memories
curl -X POST "http://localhost:6333/collections/claude-code-memory/points/search" \
  -H "Content-Type: application/json" \
  -d '{
    "vector": "<ollama-embedding>",
    "limit": 5,
    "score_threshold": 0.7
  }'
```

```bash
# Generate embedding via Ollama
curl -X POST "http://localhost:11434/api/embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "Describe the current task goal and constraints..."
  }'
```

Note: Replace `<ollama-embedding>` with the actual embedding returned by Ollama. Do not hardcode secrets — use environment variables or secrets management for API keys.
