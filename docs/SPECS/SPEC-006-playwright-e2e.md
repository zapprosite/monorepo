# SPEC-006: Playwright E2E + Chrome Extension Testing

**Status:** DRAFT
**Created:** 2026-04-08
**Author:** will

---

## Overview

Playwright E2E tests for `perplexity-agent` (Streamlit + browser-use) and Chrome extension testing workflow via OpenClaw MCP protocol.

---

## Goals

### Must Have
- [ ] Playwright smoke test for perplexity-agent (HTTP 200, Streamlit UI)
- [ ] Playwright E2E test for search interaction
- [ ] Chrome extension testing via OpenClaw MCP protocol
- [ ] CI/CD integrateable (exit 0/1)

### Should Have
- [ ] Screenshots on failure
- [ ] Video recording on failure
- [ ] Parallel execution

---

## Non-Goals

- Load testing (k6)
- Visual regression testing
- Mobile responsiveness

---

## Tech Stack

- **Playwright** (`npx playwright`) — E2E testing
- **OpenClaw MCP** — Chrome extension testing protocol
- **Browser-use** — browser automation under test

---

## Test Cases

### TC-01: Smoke Test (HTTP Health)

```python
def test_perplexity_agent_health():
    response = requests.get("http://localhost:4004/_stcore/health")
    assert response.status_code == 200
```

### TC-02: Streamlit UI Loads

```python
def test_streamlit_ui_loads():
    page.goto("http://localhost:4004")
    assert page.title() == "Perplexity Agent"
    assert page.locator("stMarkdown").count() > 0
```

### TC-03: Chat Input Works

```python
def test_chat_input_works():
    page.goto("http://localhost:4004")
    page.fill("stTextInput input", "What is 2+2?")
    page.click("stButton button")
    # Wait for response
    page.wait_for_timeout(5000)
    # Should have response in chat
    assert len(page.locator(".stChatMessage")) > 0
```

### TC-04: Chrome Extension (OpenClaw MCP)

```python
def test_openclaw_mcp_protocol():
    # Test via WebSocket MCP protocol
    # OpenClaw exposes MCP on port 4001
    # Verify: connect, list tools, call tool
    pass
```

---

## CI/CD Integration

```yaml
# .github/workflows/e2e.yml
- name: Run E2E Tests
  run: |
    npx playwright test --reporter=list
  timeout: 10m
```

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | HTTP 200 on /_stcore/health | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4004/_stcore/health` |
| AC-2 | Streamlit UI loads in <5s | Playwright navigation timing |
| AC-3 | Chat input accepts text | Playwright interaction |
| AC-4 | MCP protocol responds | WebSocket / JSON-RPC |
