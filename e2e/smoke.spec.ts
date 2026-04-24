import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:4000'
const AUTH = { username: 'admin', password: process.env.E2E_PASSWORD || 'admin' }

test.describe('LiteLLM Smoke E2E', () => {
  test('health endpoint returns 200 or 401', async ({ page }) => {
    const response = await page.request.get(`${BASE}/health`, {
        headers: { Authorization: `Bearer ${process.env.LITELLM_KEY || 'fake'}` }
    })
    // Health may return 401 (auth required) but should not 500
    expect([200, 401]).toContain(response.status())
  })

  test('chat completions endpoint accepts POST', async ({ page }) => {
    const response = await page.request.post(`${BASE}/v1/chat/completions`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LITELLM_KEY || 'sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1'}`
        },
        data: {
            model: 'minimax-m2.7',
            messages: [{ role: 'user', content: 'Say exactly: OK' }],
            max_tokens: 10
        }
    })
    // 200 OK or 401 Unauthorized - both acceptable
    expect([200, 401]).toContain(response.status())
  })

  test('embeddings endpoint accepts POST', async ({ page }) => {
    const response = await page.request.post(`${BASE}/v1/embeddings`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LITELLM_KEY || 'sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1'}`
        },
        data: {
            model: 'embedding-nomic',
            input: 'hello'
        }
    })
    expect([200, 401]).toContain(response.status())
  })
})

test.describe('Hermes Agency E2E', () => {
  const HERMES_URL = process.env.HERMES_URL || 'http://localhost:4003'

  test('hermes health check', async ({ page }) => {
    const response = await page.request.get(`${HERMES_URL}/health`)
    expect([200, 404]).toContain(response.status()) // 404 means no /health implemented
  })
})
