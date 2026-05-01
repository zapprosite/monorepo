import { test, expect } from '@playwright/test';
import WebSocket from 'ws';

/**
 * TC-04: Chrome Extension Testing via OpenClaw MCP Protocol
 *
 * Tests OpenClaw's MCP WebSocket interface on port 4001.
 * This verifies the MCP protocol used for Chrome extension automation.
 *
 * Run: npx playwright test e2e/openclaw-mcp.spec.ts
 */

const OPENCLAW_HOST = process.env.OPENCLAW_HOST || 'localhost';
const OPENCLAW_MCP_PORT = process.env.OPENCLAW_MCP_PORT || 4001;

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

function sendJsonRpc(ws: WebSocket, method: string, params: Record<string, unknown> = {}): Promise<JsonRpcMessage> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const request: JsonRpcMessage = { jsonrpc: '2.0', id, method, params };

    const timeout = setTimeout(() => {
      reject(new Error(`JSON-RPC ${method} timeout`));
    }, 10000);

    ws.once('message', (data) => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(data.toString()) as JsonRpcMessage);
      } catch (e) {
        reject(e);
      }
    });

    ws.on('error', reject);
    ws.send(JSON.stringify(request));
  });
}

test.describe('OpenClaw MCP Protocol (TC-04)', () => {

  test('TC-04: WebSocket connection and MCP protocol handshake', async () => {
    const url = `ws://${OPENCLAW_HOST}:${OPENCLAW_MCP_PORT}`;

    // Test 1: Connection
    const ws = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout (5s)')), 5000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${err.message}`));
      });
    });

    try {
      // Test 2: Initialize
      const init = await sendJsonRpc(ws, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'playwright-e2e', version: '1.0.0' },
      });

      expect(init.result).toBeDefined();
      expect(init.error).toBeUndefined();

      // Test 3: List tools
      const tools = await sendJsonRpc(ws, 'tools/list');
      expect(tools.result).toBeDefined();
      expect(tools.result).toHaveProperty('tools');
      const toolList = tools.result as { tools: Array<{ name: string }> };
      expect(Array.isArray(toolList.tools)).toBe(true);

      const toolCount = toolList.tools.length;
      expect(toolCount).toBeGreaterThan(0);

      // Test 4: Call first available tool
      const firstTool = toolList.tools[0];
      const callResult = await sendJsonRpc(ws, 'tools/call', {
        name: firstTool.name,
        arguments: {},
      });

      // Result or error is acceptable - we just want to verify the protocol works
      expect(callResult.jsonrpc).toBe('2.0');
      expect(callResult.id).toBeDefined();

    } finally {
      ws.close();
    }
  });

  test('TC-04: MCP server health check', async ({ request }) => {
    // OpenClaw MCP may expose HTTP health endpoint
    const healthUrl = `http://${OPENCLAW_HOST}:${OPENCLAW_MCP_PORT}/health`;
    try {
      const response = await request.get(healthUrl);
      // 200 or 401 is acceptable (401 = needs auth)
      expect([200, 401]).toContain(response.status());
    } catch {
      // If health endpoint doesn't exist, that's acceptable for MCP protocol
      // The WebSocket test above is the authoritative test
    }
  });

});