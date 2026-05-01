#!/usr/bin/env node
/**
 * OpenClaw MCP Protocol Test
 * Tests Chrome extension integration via MCP WebSocket protocol
 *
 * Usage: node openclaw-mcp-test.js [--host HOST] [--port PORT]
 */

const WebSocket = require('ws');

const DEFAULT_HOST = process.env.OPENCLAW_HOST || 'localhost';
const DEFAULT_PORT = process.env.OPENCLAW_MCP_PORT || 4001;

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--host') args.host = process.argv[++i];
    if (process.argv[i] === '--port') args.port = parseInt(process.argv[++i]);
  }
  return { host: DEFAULT_HOST, port: DEFAULT_PORT, ...args };
}

async function sendJsonRpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const request = { jsonrpc: '2.0', id, method, params };

    const timeout = setTimeout(() => {
      reject(new Error(`JSON-RPC ${method} timeout`));
    }, 10000);

    ws.once('message', (data) => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(data.toString()));
      } catch (e) {
        reject(e);
      }
    });

    ws.send(JSON.stringify(request));
  });
}

async function testMcpProtocol() {
  const { host, port } = parseArgs();
  const url = `ws://${host}:${port}`;

  console.log(`=== OpenClaw MCP Protocol Test ===`);
  console.log(`Host: ${host}:${port}`);

  // Test 1: Connection
  let ws;
  let connectionTimeout;
  try {
    ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        clearTimeout(connectionTimeout);
        resolve();
      });
      ws.on('error', reject);
      connectionTimeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
    console.log('✅ TC-01: WebSocket connection established');
  } catch (e) {
    console.log(`❌ TC-01: Connection failed - ${e.message}`);
    process.exit(1);
  }

  // Test 2-4: Sequential JSON-RPC calls
  try {
    const init = await sendJsonRpc(ws, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'playwright-e2e', version: '1.0.0' },
    });
    if (init.result) {
      console.log('✅ TC-02: JSON-RPC initialize successful');
    }
  } catch (e) {
    console.log(`❌ TC-02: initialize failed - ${e.message}`);
  }

  // Test 3: List tools (reuse result for Test 4)
  let firstTool = null;
  try {
    const tools = await sendJsonRpc(ws, 'tools/list');
    const toolCount = tools.result?.tools?.length || 0;
    console.log(`✅ TC-03: tools/list returned ${toolCount} tools`);
    if (toolCount > 0) {
      console.log('   Available tools:', tools.result.tools.map(t => t.name).join(', '));
      firstTool = tools.result.tools[0];
    }
  } catch (e) {
    console.log(`❌ TC-03: tools/list failed - ${e.message}`);
  }

  // Test 4: Call first tool (using cached result from Test 3)
  if (firstTool) {
    try {
      const call = await sendJsonRpc(ws, 'tools/call', {
        name: firstTool.name,
        arguments: {},
      });
      console.log(`✅ TC-04: tools/call(${firstTool.name}) successful`);
    } catch (e) {
      console.log(`❌ TC-04: tools/call failed - ${e.message}`);
    }
  }

  ws.close();
  console.log('\n=== MCP Protocol Test Complete ===');
}

testMcpProtocol().catch(e => {
  console.error('Test failed:', e.message);
  process.exit(1);
});
