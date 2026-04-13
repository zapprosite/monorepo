---
archived: true
superseded_by:
  - SPEC-024 (monorepo test pipeline)
  - smoke-tests/ directory
see_also:
  - SPEC-024
---

> ⚠️ ARCHIVED — Superseded by [SPEC-024](../SPEC-024.md) (monorepo test pipeline) and smoke-tests/ directory.

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
