---
name: browser-dev
description: Chrome DevTools Protocol via Playwright — screenshot, inspect, scrape pages. Use quando precisar analisar DOM, tirar screenshots, ou automatizar browser headless.
user-invocable: true
disable-model-invocation: false
allowed-tools:
  - Bash
  - Read
version: 1.0.0
---

# Skill: Browser Dev — Chrome DevTools via Playwright

## Synopsis

`/browser-dev <url> [action]`

Abre página com Chrome headless via Playwright + Chrome DevTools Protocol para screenshots, DOM inspection, ou scraping.

## Description

Usa Playwright com Chrome headless para:
- Screenshot de páginas web
- Extrair DOM/HTML
- Avaliar JavaScript na página
- Monitorizar network requests
- Debug de páginas que requerem JavaScript

## Requirements

- Google Chrome installed (`/usr/bin/google-chrome`)
- Playwright (`npx playwright`)
- Python playwright: `pip install playwright`

## Usage

```
/browser-dev https://example.com screenshot
/browser-dev https://example.com html
/browser-dev https://example.com evaluate "document.title"
```

## Actions

| Action | Description |
|--------|-------------|
| `screenshot` | Screenshot da página (default) |
| `html` | Extrai HTML completo do DOM |
| `evaluate` | Executa JS e retorna resultado |
| `console` | Captura console logs da página |
| `network` | Lista network requests |

## Implementation

```python
import asyncio
from playwright.async_api import async_playwright

async def browser_action(url, action="screenshot"):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        page = await browser.new_page()
        await page.goto(url, wait_until="networkidle")

        if action == "screenshot":
            await page.screenshot(path="/tmp/screenshot.png")
            return "/tmp/screenshot.png"
        elif action == "html":
            return await page.content()
        elif action == "evaluate":
            return await page.evaluate("document.title")
```

## Bash Example

```bash
# Screenshot via CLI
npx playwright screenshot --browser chromium https://example.com /tmp/example.png

# HTML via CLI
chromium --headless --dump-dom https://example.com > /tmp/dom.html
```

## Sources

- Playwright: https://playwright.dev
- Chrome DevTools Protocol: https://chromedevtools.github.io/devtools-protocol/
