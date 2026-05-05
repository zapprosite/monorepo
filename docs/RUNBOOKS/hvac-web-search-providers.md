# HVAC Web Search Providers — OpenRouter MCP Landscape

## Overview

This document describes the OpenRouter MCP ecosystem as it relates to the HVAC runtime's web search layer and multimedia content generation.

---

## 1. OpenRouter-AI/OpenRouter-MCP

**Repository:** https://github.com/openrouter-ai/openrouter-mcp

**What it provides:**
- TTS (text-to-speech)
- Video generation
- Image generation
- Music generation
- Voice clone

**What it does NOT provide:**
- Web search

**Use case in Hermes/Claude Code:** Multimedia content generation (audio, video, images, music, voice cloning). Not a search provider.

---

## 2. OpenRouter Token Plan MCP

**Documentation:** platform.openrouter.io/docs/guides/token-plan-mcp-guide

**What it provides:**
- `web_search` tool
- `understand_image` tool

**Current status in the runtime:**
- **NOT integrated** in the runtime FastAPI (`hvac_rag_pipe`)
- Available via:
  - Hermes/Nexus bridge
  - Direct MCP connection

**Note:** If you need OpenRouter web search in the runtime, you must connect via Hermes/Nexus or establish a direct MCP connection. It is not wired into `WEB_SEARCH_PROVIDER` by default.

---

## 3. OpenRouter-AI/openrouter_search

**Repository:** https://github.com/OpenRouter-AI/openrouter_search

**What it provides:**
- Web search
- Browsing via Serper + Jina Reader + OpenRouter LLM

**Required API keys:**
- `SERPER_API_KEY`
- `JINA_API_KEY`
- `OPENROUTER_API_KEY`

**Relevance to HVAC runtime:**
- **Not needed** — Tavily already provides web search in the runtime
- Can serve as an alternative search backend if Tavily is unavailable or for cost optimization

---

## 4. Runtime Web Search Stack (hvac_rag_pipe)

**Primary provider:** Tavily HTTP API

**Fallback chain:**
```
tavily → ddg → google_news_rss
```

**OpenRouter MCP in WEB_SEARCH_PROVIDER:**
- There is a stub entry for `openrouter_mcp` in `WEB_SEARCH_PROVIDER`
- It currently returns `[]` (empty results) — **placeholder, not functional**
- If OpenRouter Token Plan MCP web search is desired, the stub must be replaced with a real implementation

---

## Summary Table

| Provider | Search | Image Underst. | Multimedia | Integrated in Runtime |
|---|---|---|---|---|
| OpenRouter-MCP (openrouter-ai) | No | No | TTS, video, image, music, voice clone | No |
| OpenRouter Token Plan MCP | Yes (`web_search`, `understand_image`) | Yes | No | No (via Hermes/Nexus only) |
| openrouter_search | Yes | No | No | No (Tavily preferred) |
| Tavily (runtime default) | Yes | No | No | Yes |
| ddg (fallback) | Yes | No | No | Yes |
| google_news_rss (fallback) | Yes | No | No | Yes |

---

## How to Use OpenRouter Token Plan MCP

Since it is not integrated into the runtime FastAPI, you have two paths:

### Option A — Hermes/Nexus Bridge
Connect via the existing Hermes/Nexus MCP bridge. The bridge handles authentication and tool routing between Claude Code and the OpenRouter Token Plan MCP server.

### Option B — Direct MCP Connection
Configure a direct MCP connection in your client setup pointing to:
```
https://openrouter.ai/api/v1/mcp  (or self-hosted)
```
With the Token Plan MCP tools enabled.

---

## When to Use What

| Goal | Provider |
|---|---|
| Generate speech/audio | OpenRouter-MCP |
| Generate video | OpenRouter-MCP |
| Generate images | OpenRouter-MCP |
| Generate music | OpenRouter-MCP |
| Clone voice | OpenRouter-MCP |
| Web search (runtime default) | Tavily |
| Web search fallback | ddg / google_news_rss |
| Web search via OpenRouter | OpenRouter Token Plan MCP (via Hermes/Nexus or direct) |
| Image understanding via OpenRouter | OpenRouter Token Plan MCP (via Hermes/Nexus or direct) |
