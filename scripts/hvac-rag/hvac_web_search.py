#!/usr/bin/env python3
"""
HVAC web search providers.

Runtime order:
  MiniMax MCP web search -> Tavily HTTP API -> DuckDuckGo Lite -> Google News RSS.

Tavily Remote MCP is kept for agent validation/health, but runtime uses the
Tavily HTTP API as requested.

All functions return normalized search results:
  {provider, confidence, title, url, snippet}
Secrets are never logged or returned.
"""

import json
import os
import re
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any

import httpx


WEB_SEARCH_TIMEOUT = int(os.environ.get("WEB_SEARCH_TIMEOUT", "15"))
WEB_SEARCH_PROVIDER = os.environ.get("WEB_SEARCH_PROVIDER", "minimax_mcp").strip().lower()
WEB_SEARCH_FALLBACKS = [
    p.strip().lower()
    for p in os.environ.get("WEB_SEARCH_FALLBACKS", "tavily,ddg,google_news").split(",")
    if p.strip()
]
TAVILY_MCP_URL = os.environ.get("TAVILY_MCP_URL", "https://mcp.tavily.com/mcp/").strip()
TAVILY_API_URL = os.environ.get("TAVILY_API_URL", "https://api.tavily.com/search").strip()
TAVILY_USAGE_URL = os.environ.get("TAVILY_USAGE_URL", "https://api.tavily.com/usage").strip()
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "").strip()
GOOGLE_NEWS_RSS_URL = os.environ.get(
    "GOOGLE_NEWS_RSS_URL",
    "https://news.google.com/rss/search",
).strip()


def _safe_log(msg: str) -> None:
    print(f"[hvac-web-search] {msg}")


def _provider_result(provider: str, title: str, url: str, snippet: str, confidence: float) -> dict:
    return {
        "provider": provider,
        "confidence": confidence,
        "title": (title or "").strip()[:180],
        "url": (url or "").strip(),
        "snippet": re.sub(r"\s+", " ", (snippet or "").strip())[:500],
    }


async def search_web_minimax_mcp(query: str) -> list[dict]:
    """
    Placeholder for MiniMax MCP web_search.

    The local runtime does not have a MiniMax web_search MCP endpoint configured
    yet. Keep this provider in the router so it can become primary without
    changing callers once the endpoint is available.
    """
    _safe_log("minimax_mcp web_search not configured")
    return []


def _tavily_mcp_endpoint() -> str:
    if not TAVILY_API_KEY:
        return TAVILY_MCP_URL
    separator = "&" if "?" in TAVILY_MCP_URL else "?"
    return f"{TAVILY_MCP_URL}{separator}tavilyApiKey={urllib.parse.quote(TAVILY_API_KEY)}"


def _mcp_headers(session_id: str | None = None) -> dict:
    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-06-18",
    }
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    return headers


def _parse_mcp_response(text: str) -> dict:
    text = text.strip()
    if not text:
        return {}
    if text.startswith("data:"):
        payload_lines = []
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                payload_lines.append(line[5:].strip())
        for payload in reversed(payload_lines):
            if payload and payload != "[DONE]":
                try:
                    return json.loads(payload)
                except json.JSONDecodeError:
                    continue
        return {}
    return json.loads(text)


def _json_candidates(value: Any) -> list[dict]:
    candidates = []
    if isinstance(value, dict):
        candidates.append(value)
        for nested in value.values():
            candidates.extend(_json_candidates(nested))
    elif isinstance(value, list):
        for item in value:
            candidates.extend(_json_candidates(item))
    elif isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                candidates.extend(_json_candidates(json.loads(stripped)))
            except json.JSONDecodeError:
                pass
    return candidates


def _normalize_tavily_payload(payload: Any) -> list[dict]:
    normalized = []
    for candidate in _json_candidates(payload):
        results = candidate.get("results")
        if not isinstance(results, list):
            continue
        for item in results:
            if not isinstance(item, dict):
                continue
            title = item.get("title") or item.get("name") or ""
            url = item.get("url") or item.get("link") or ""
            snippet = item.get("content") or item.get("snippet") or item.get("description") or ""
            score = item.get("score")
            confidence = 0.82
            if isinstance(score, (int, float)):
                confidence = max(0.6, min(0.95, float(score)))
            if title and url:
                normalized.append(_provider_result("tavily_mcp", title, url, snippet, confidence))
            if len(normalized) >= 5:
                return normalized
    return normalized


async def search_web_tavily_mcp(query: str) -> list[dict]:
    """
    Search through Tavily Remote MCP using the tavily_search tool.

    This speaks Streamable HTTP directly instead of shelling out to npx/uvx.
    """
    if not TAVILY_API_KEY:
        _safe_log("tavily_mcp not configured")
        return []

    endpoint = _tavily_mcp_endpoint()
    async with httpx.AsyncClient(timeout=WEB_SEARCH_TIMEOUT, follow_redirects=True) as client:
        try:
            init_payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "hvac-rag", "version": "1.0.0"},
                },
            }
            init_response = await client.post(endpoint, headers=_mcp_headers(), json=init_payload)
            if init_response.status_code not in (200, 202):
                _safe_log(f"tavily_mcp initialize HTTP {init_response.status_code}")
                return []

            session_id = init_response.headers.get("Mcp-Session-Id")
            await client.post(
                endpoint,
                headers=_mcp_headers(session_id),
                json={"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
            )

            call_payload = {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "tavily_search",
                    "arguments": {
                        "query": query,
                        "search_depth": "basic",
                        "max_results": 5,
                        "include_answer": False,
                        "include_raw_content": False,
                        "include_images": False,
                    },
                },
            }
            response = await client.post(endpoint, headers=_mcp_headers(session_id), json=call_payload)
            if response.status_code != 200:
                _safe_log(f"tavily_mcp search HTTP {response.status_code}")
                return []
            payload = _parse_mcp_response(response.text)
            results = _normalize_tavily_payload(payload.get("result", payload))
            _safe_log(f"tavily_mcp returned {len(results)} results")
            return results
        except httpx.TimeoutException:
            _safe_log("tavily_mcp timeout")
        except Exception as exc:
            _safe_log(f"tavily_mcp error: {type(exc).__name__}")
    return []


async def search_web_tavily_api(query: str) -> list[dict]:
    """Runtime search through Tavily HTTP API."""
    if not TAVILY_API_KEY:
        _safe_log("tavily_api not configured")
        return []

    payload = {
        "query": query,
        "search_depth": "basic",
        "max_results": 5,
        "include_answer": False,
        "include_raw_content": False,
        "include_images": False,
    }
    try:
        async with httpx.AsyncClient(timeout=WEB_SEARCH_TIMEOUT, follow_redirects=True) as client:
            response = await client.post(
                TAVILY_API_URL,
                headers={
                    "Authorization": f"Bearer {TAVILY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.status_code != 200:
            _safe_log(f"tavily_api HTTP {response.status_code}")
            return []
        data = response.json()
        results = []
        for item in data.get("results", [])[:5]:
            title = item.get("title") or ""
            url = item.get("url") or ""
            snippet = item.get("content") or item.get("snippet") or ""
            score = item.get("score")
            confidence = 0.82
            if isinstance(score, (int, float)):
                confidence = max(0.6, min(0.95, float(score)))
            if title and url:
                results.append(_provider_result("tavily_api", title, url, snippet, confidence))
        _safe_log(f"tavily_api returned {len(results)} results")
        return results
    except httpx.TimeoutException:
        _safe_log("tavily_api timeout")
    except Exception as exc:
        _safe_log(f"tavily_api error: {type(exc).__name__}")
    return []


async def search_web_ddg(query: str) -> list[dict]:
    """
    Last-resort HTML fallback using DuckDuckGo Lite.
    Returns list of dicts with {provider, confidence, title, url, snippet}.
    """
    try:
        encoded_q = urllib.parse.quote(query)
        ddg_url = f"https://lite.duckduckgo.com/lite/?q={encoded_q}&kl=br-pt"
        async with httpx.AsyncClient(timeout=WEB_SEARCH_TIMEOUT, follow_redirects=True) as client:
            response = await client.get(
                ddg_url,
                headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"},
            )
        if response.status_code != 200:
            _safe_log(f"ddg HTTP {response.status_code}")
            return []
        results = []
        for match in re.finditer(r'<a class="result-link" href="([^"]+)"[^>]*>([^<]+)</a>', response.text):
            url = match.group(1)
            title = re.sub(r"<[^>]+>", "", match.group(2)).strip()
            snippet_pos = match.end()
            snippet_match = re.search(
                r'<td class="result-snippet">([^<]+)</td>',
                response.text[snippet_pos:snippet_pos + 500],
            )
            snippet = re.sub(r"<[^>]+>", "", (snippet_match.group(1) if snippet_match else "")).strip()
            if title and url:
                results.append(_provider_result("ddg", title, url, snippet, 0.45))
            if len(results) >= 5:
                break
        _safe_log(f"ddg returned {len(results)} results")
        return results
    except Exception as exc:
        _safe_log(f"ddg error: {type(exc).__name__}")
        return []


async def search_web_google_news(query: str) -> list[dict]:
    """Fallback external check using Google News RSS."""
    params = {
        "q": query,
        "hl": "pt-BR",
        "gl": "BR",
        "ceid": "BR:pt-419",
    }
    url = f"{GOOGLE_NEWS_RSS_URL}?{urllib.parse.urlencode(params)}"
    try:
        async with httpx.AsyncClient(timeout=WEB_SEARCH_TIMEOUT, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "hvac-rag/1.0"})
        if response.status_code != 200:
            _safe_log(f"google_news_rss HTTP {response.status_code}")
            return []
        root = ET.fromstring(response.text)
        results = []
        for item in root.findall(".//item"):
            title = item.findtext("title", default="")
            link = item.findtext("link", default="")
            description = item.findtext("description", default="")
            snippet = re.sub(r"<[^>]+>", " ", description)
            if title and link:
                results.append(_provider_result("google_news_rss", title, link, snippet, 0.55))
            if len(results) >= 5:
                break
        _safe_log(f"google_news_rss returned {len(results)} results")
        return results
    except Exception as exc:
        _safe_log(f"google_news_rss error: {type(exc).__name__}")
        return []


async def search_web(query: str) -> list[dict]:
    """Provider router. Primary provider first, configured fallbacks after."""
    providers = [WEB_SEARCH_PROVIDER] + [p for p in WEB_SEARCH_FALLBACKS if p != WEB_SEARCH_PROVIDER]
    for provider in providers:
        if provider in ("minimax", "minimax_mcp", "minimax_mcp_web_search"):
            results = await search_web_minimax_mcp(query)
        elif provider in ("tavily", "tavily_api"):
            results = await search_web_tavily_api(query)
        elif provider == "tavily_mcp":
            results = await search_web_tavily_mcp(query)
        elif provider == "ddg":
            results = await search_web_ddg(query)
        elif provider in ("google_news", "google_news_rss"):
            results = await search_web_google_news(query)
        else:
            _safe_log(f"unknown provider skipped: {provider}")
            results = []
        if results:
            return results
    return []


async def web_search_health() -> dict:
    """Return provider health without exposing API keys."""
    configured = bool(TAVILY_API_KEY)
    api_reachable = False
    mcp_reachable = False
    if configured:
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
                usage_response = await client.get(
                    TAVILY_USAGE_URL,
                    headers={"Authorization": f"Bearer {TAVILY_API_KEY}"},
                )
            api_reachable = usage_response.status_code == 200
        except Exception:
            api_reachable = False

        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
                response = await client.post(
                    _tavily_mcp_endpoint(),
                    headers=_mcp_headers(),
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "initialize",
                        "params": {
                            "protocolVersion": "2025-06-18",
                            "capabilities": {},
                            "clientInfo": {"name": "hvac-healthcheck", "version": "1.0.0"},
                        },
                    },
                )
            mcp_reachable = response.status_code in (200, 202)
        except Exception:
            mcp_reachable = False

    return {
        "status": "pass" if configured and api_reachable else "degraded",
        "service": "web_search",
        "provider_order": [WEB_SEARCH_PROVIDER] + [p for p in WEB_SEARCH_FALLBACKS if p != WEB_SEARCH_PROVIDER],
        "tavily_configured": configured,
        "tavily_api_endpoint": TAVILY_API_URL,
        "tavily_api_reachable": api_reachable,
        "tavily_mcp_endpoint": TAVILY_MCP_URL,
        "tavily_mcp_reachable": mcp_reachable,
        "fallbacks": WEB_SEARCH_FALLBACKS,
        "ddg": "available" if "ddg" in WEB_SEARCH_FALLBACKS else "disabled",
        "google_news_rss": (
            "available"
            if "google_news" in WEB_SEARCH_FALLBACKS or "google_news_rss" in WEB_SEARCH_FALLBACKS
            else "disabled"
        ),
    }
