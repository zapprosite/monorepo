# HVAC Web Search Providers — MiniMax MCP Landscape

## Overview

This document describes the MiniMax MCP ecosystem as it relates to the HVAC runtime's web search layer and multimedia content generation.

---

## 1. MiniMax-AI/MiniMax-MCP

**Repository:** https://github.com/minimax-ai/minimax-mcp

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

## 2. MiniMax Token Plan MCP

**Documentation:** platform.minimax.io/docs/guides/token-plan-mcp-guide

**What it provides:**
- `web_search` tool
- `understand_image` tool

**Current status in the runtime:**
- **NOT integrated** in the runtime FastAPI (`hvac_rag_pipe`)
- Available via:
  - Hermes/Nexus bridge
  - Direct MCP connection

**Note:** If you need MiniMax web search in the runtime, you must connect via Hermes/Nexus or establish a direct MCP connection. It is not wired into `WEB_SEARCH_PROVIDER` by default.

---

## 3. MiniMax-AI/minimax_search

**Repository:** https://github.com/MiniMax-AI/minimax_search

**What it provides:**
- Web search
- Browsing via Serper + Jina Reader + MiniMax LLM

**Required API keys:**
- `SERPER_API_KEY`
- `JINA_API_KEY`
- `MINIMAX_API_KEY`

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

**MiniMax MCP in WEB_SEARCH_PROVIDER:**
- There is a stub entry for `minimax_mcp` in `WEB_SEARCH_PROVIDER`
- It currently returns `[]` (empty results) — **placeholder, not functional**
- If MiniMax Token Plan MCP web search is desired, the stub must be replaced with a real implementation

---

## Summary Table

| Provider | Search | Image Underst. | Multimedia | Integrated in Runtime |
|---|---|---|---|---|
| MiniMax-MCP (minimax-ai) | No | No | TTS, video, image, music, voice clone | No |
| MiniMax Token Plan MCP | Yes (`web_search`, `understand_image`) | Yes | No | No (via Hermes/Nexus only) |
| minimax_search | Yes | No | No | No (Tavily preferred) |
| Tavily (runtime default) | Yes | No | No | Yes |
| ddg (fallback) | Yes | No | No | Yes |
| google_news_rss (fallback) | Yes | No | No | Yes |

---

## How to Use MiniMax Token Plan MCP

Since it is not integrated into the runtime FastAPI, you have two paths:

### Option A — Hermes/Nexus Bridge
Connect via the existing Hermes/Nexus MCP bridge. The bridge handles authentication and tool routing between Claude Code and the MiniMax Token Plan MCP server.

### Option B — Direct MCP Connection
Configure a direct MCP connection in your client setup pointing to:
```
https://api.minimax.io/mcp  (or self-hosted)
```
With the Token Plan MCP tools enabled.

---

## When to Use What

| Goal | Provider |
|---|---|
| Generate speech/audio | MiniMax-MCP |
| Generate video | MiniMax-MCP |
| Generate images | MiniMax-MCP |
| Generate music | MiniMax-MCP |
| Clone voice | MiniMax-MCP |
| Web search (runtime default) | Tavily |
| Web search fallback | ddg / google_news_rss |
| Web search via MiniMax | MiniMax Token Plan MCP (via Hermes/Nexus or direct) |
| Image understanding via MiniMax | MiniMax Token Plan MCP (via Hermes/Nexus or direct) |
