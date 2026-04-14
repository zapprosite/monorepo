# SPEC-HERMES-INTEGRATION: Hermes Agent Integration Patterns

**Date:** 2026-04-14
**Author:** will-zappro
**Status:** RESEARCH_COMPLETE
**Type:** Architecture
**Branch:** feature/quantum-helix-done

---

## Executive Summary

Hermes Agent is now running as the central AI gateway for the homelab. This document defines integration patterns for other services to consume LLM capabilities through Hermes instead of calling providers directly.

**Current Status (2026-04-14 10:xx UTC):**
- Hermes Gateway: RUNNING on `localhost:8642`
- Health: `{"status":"ok","platform":"hermes-agent"}`
- API: OpenAI-compatible `/v1/chat/completions` + `/v1/models`
- Primary LLM: MiniMax/MiniMax-M2.7
- Fallback LLM: Ollama/qwen2.5vl:7b (local RTX 4090)
- Telegram: Connected (polling mode)

---

## 1. Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      HERMES GATEWAY (:8642)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  OpenAI-compatible API (/v1/chat/completions)        │  │
│  │  Auth: Bearer token (HERMES_API_KEY)                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐              │
│         ▼                 ▼                 ▼              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  MiniMax    │  │   Ollama    │  │   Kokoro    │       │
│  │  M2.7       │  │  qwen2.5vl  │  │   TTS       │       │
│  │  (Primary)  │  │  (Fallback) │  │  :8013      │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                           │                                │
│                           ▼                                │
│                   ┌─────────────┐                         │
│                   │  wav2vec2   │                         │
│                   │  STT :8202  │                         │
│                   └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │  Telegram │        │ Voice    │        │  Skills  │
   │  Bot      │        │ Pipeline │        │  (33+)   │
   └──────────┘        └──────────┘        └──────────┘
```

---

## 2. Hermes Gateway API Reference

### 2.1 Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check |
| `/v1/models` | GET | Bearer | List available models |
| `/v1/chat/completions` | POST | Bearer | OpenAI-compatible chat completions |

### 2.2 Authentication

```bash
# Get HERMES_API_KEY from secrets.env
HERMES_API_KEY=$(grep HERMES_API_KEY ~/.hermes/secrets.env | cut -d= -f2)
```

### 2.3 Chat Completions Example

```bash
curl -X POST http://localhost:8642/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HERMES_API_KEY}" \
  -d '{
    "model": "hermes-agent",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-xxxxx",
  "object": "chat.completion",
  "model": "hermes-agent",
  "choices": [{
    "message": {"role": "assistant", "content": "Hi! How can I help you?"},
    "finish_reason": "stop"
  }],
  "usage": {"prompt_tokens": 12, "completion_tokens": 44, "total_tokens": 56}
}
```

### 2.4 Models Endpoint

```bash
curl http://localhost:8642/v1/models \
  -H "Authorization: Bearer ${HERMES_API_KEY}"
```

**Response:**
```json
{
  "object": "list",
  "data": [{"id": "hermes-agent", "object": "model", "owned_by": "hermes"}]
}
```

---

## 3. Integration Patterns

### 3.1 Pattern A: Direct API Integration (Recommended for internal services)

For services running on the same host or in Docker:

```typescript
// services/llm.ts
const HERMES_URL = process.env.HERMES_GATEWAY_URL || 'http://localhost:8642';
const HERMES_API_KEY = process.env.HERMES_API_KEY;

async function chat(prompt: string): Promise<string> {
  const response = await fetch(`${HERMES_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${HERMES_API_KEY}`
    },
    body: JSON.stringify({
      model: 'hermes-agent',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000
    })
  });
  const data = await response.json();
  return data.choices[0].message.content;
}
```

**Environment Variables:**
```env
HERMES_GATEWAY_URL=http://localhost:8642
HERMES_API_KEY=<from ~/.hermes/secrets.env>
```

### 3.2 Pattern B: OpenAI-compatible Client

For applications using OpenAI SDK:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.HERMES_API_KEY,
  baseURL: `${process.env.HERMES_GATEWAY_URL}/v1`
});

// Use exactly as OpenAI API
const completion = await client.chat.completions.create({
  model: 'hermes-agent',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

### 3.3 Pattern C: MCP Tool Integration

Hermes skills can be called via MCP protocol:

```bash
# Via hermes mcp tools
hermes mcp list              # List available tools
hermes mcp call <tool> <args> # Call a specific tool
```

**Available MCP Skills (sample):**
- `coolify_sre` - Coolify SRE monitoring
- `perplexity_browser` - Web browsing via Perplexity
- `github/*` - GitHub operations
- `mcp/*` - MCP server management

### 3.4 Pattern D: Telegram Bot (Voice Pipeline)

For voice-enabled interactions:

```
User Voice → Telegram → wav2vec2 STT (:8202) → Hermes → Kokoro TTS (:8013) → User Voice
```

```typescript
// Voice-enabled bot integration
const voiceResponse = await fetch(`${HERMES_URL}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${HERMES_API_KEY}` },
  body: JSON.stringify({
    model: 'hermes-agent',
    messages: [{ role: 'user', content: audioTranscript }],
    // TTS auto-rendered via Kokoro if voice output requested
  })
});
```

---

## 4. Current LLM API Usage in Monorepo

### 4.1 Audit Results

**Services calling LLM APIs directly:** NONE
**Services referencing LLM URLs:** 1 file

| File | Type | Usage |
|------|------|-------|
| `apps/list-web/tools.js` | URL references only | Defines `LITELLM_URL`, `HERMES_GATEWAY_URL`, `OLLAMA_URL` for UI links |

### 4.2 Conclusion

The monorepo currently does NOT have services that call LLM APIs directly with API keys. All AI capabilities are accessed via:
1. LiteLLM Proxy (port 4000) for OpenWebUI and other apps
2. Hermes Gateway (port 8642) for Telegram bot and voice pipeline
3. Direct Ollama (port 11434) for local models

---

## 5. Hermes vs bot.zappro.site Replacement

### 5.1 Current State

| Subdomain | Target | Status |
|-----------|--------|--------|
| `bot.zappro.site` | `10.0.19.7:8080` (OpenClaw) | OFFLINE - 502 |
| `hermes.zappro.site` | `10.0.5.2:8642` (Hermes) | Tunnel configured, needs validation |

### 5.2 Should hermes.zappro.site Replace bot.zappro.site?

**Recommendation: YES, with a phased approach**

| Phase | Action | Rationale |
|-------|--------|-----------|
| Phase 1 | Keep both subdomains | bot.zappro.site returns 502, hermes.zappro.site becomes primary |
| Phase 2 | Update clients to use hermes.zappro.site | Migrate Telegram bot to hermes.zappro.site |
| Phase 3 | Deprecate bot.zappro.site | Remove from tunnel, return 404 |

**Rationale:**
1. Hermes Gateway provides OpenAI-compatible API + Telegram + Voice Pipeline
2. Single endpoint for all AI capabilities
3. Hermes has built-in fallback to Ollama (local RTX 4090)
4. Cost savings: MiniMax quotas preserved for critical tasks
5. Skills system provides extensibility

### 5.3 Hermes Gateway Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| `hermes mcp serve` exits after each request | Cannot serve as persistent MCP server | Use Hermes Gateway API directly |
| Single model (`hermes-agent`) in /v1/models | No model selection per request | Configured at startup, fallback automatic |
| No streaming support (presumed) | Real-time apps may be affected | Test with streaming requests |

---

## 6. Services That Should Integrate with Hermes

### 6.1 Priority Integration Candidates

| Service | Current LLM Method | Recommended Hermes Integration |
|---------|-------------------|-------------------------------|
| **Claude Code agents** | Direct API calls | Use Hermes for non-critical tasks, preserve MiniMax quota |
| **Voice Pipeline** | Direct Kokoro/wav2vec2 | Already integrated via Hermes Gateway |
| **n8n workflows** | LiteLLM or direct | Add Hermes as additional LLM provider |
| **OpenWebUI (chat.zappro.site)** | LiteLLM proxy | Keep LiteLLM, use Hermes for specific skills |

### 6.2 NOT Recommended for Hermes Integration

| Service | Reason |
|---------|--------|
| **OpenWebUI** | Already has direct LiteLLM integration with model selection UI |
| **Gitea AI features** | May require specific model support |
| **Prometheus AlertManager** | Uses fixed alert templates, not LLM |

---

## 7. Environment Variables for Hermes Integration

```env
# Hermes Gateway
HERMES_GATEWAY_URL=http://localhost:8642
HERMES_API_KEY=<from ~/.hermes/secrets.env>

# Voice Pipeline (built-in)
KOKORO_TTS_URL=http://localhost:8013/v1
WAV2VEC2_STT_URL=http://localhost:8202/v1

# Fallback (when Hermes is down)
OLLAMA_URL=http://localhost:11434
LITELLM_URL=http://10.0.19.7:4000
```

---

## 8. Health Monitoring

### 8.1 Hermes Gateway Health

```bash
# Local health check
curl http://localhost:8642/health
# Returns: {"status":"ok","platform":"hermes-agent"}

# Remote health check (via hermes.zappro.site when available)
curl https://hermes.zappro.site/health
```

### 8.2 Integration Health Check Pattern

```typescript
async function isHermesHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.HERMES_GATEWAY_URL}/health`);
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
```

---

## 9. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Hermes API key exposure | Store in `~/.hermes/secrets.env`, not in code |
| External access to Hermes | Cloudflare Access for hermes.zappro.site |
| Rate limiting | Hermes handles via MiniMax quotas |
| Audit logging | Check Hermes logs in `~/.hermes/logs/` |

---

## 10. Migration Checklist

### Phase 1: Validate Hermes Gateway (DONE)

- [x] Hermes Gateway running on port 8642
- [x] Health endpoint responding
- [x] OpenAI-compatible API working
- [x] Telegram bot connected
- [x] Voice pipeline components integrated

### Phase 2: Expose hermes.zappro.site (PENDING)

- [ ] Cloudflare tunnel ingress configured
- [ ] hermes.zappro.site DNS propagated
- [ ] External health check returns 200
- [ ] Telegram bot functional via hermes.zappro.site

### Phase 3: Deprecate bot.zappro.site (FUTURE)

- [ ] All clients migrated to hermes.zappro.site
- [ ] bot.zappro.site returns 404
- [ ] SUBDOMAINS.md updated

---

## 11. References

| Document | Path |
|---------|------|
| SPEC-038 (Hermes-Agent Migration) | `docs/SPECS/SPEC-038-hermes-agent-migration.md` |
| SPEC-039 (Takeover Validation) | `docs/SPECS/SPEC-039-hermes-takeover-validation.md` |
| SPEC-043 (Subdomain Prune) | `docs/SPECS/SPEC-043-subdomain-prune-hermes-migration.md` |
| Voice Pipeline | `memory/voice-pipeline-hermes-14-04-2026.md` |
| Hermes Config | `~/.hermes/config.yaml` |
| Hermes Crons | `~/.hermes/hermes.json` |

---

**Status:** Ready for implementation of Phase 2 (expose hermes.zappro.site)

**Next Actions:**
1. Verify Cloudflare tunnel ingress for hermes.zappro.site → :8642
2. Test external health: `curl https://hermes.zappro.site/health`
3. Update SUBDOMAINS.md with hermes.zappro.site entry
4. Document HERMES_API_KEY retrieval in skills
