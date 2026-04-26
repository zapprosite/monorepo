# OpenWebUI + OpenClaw Bridge — Arquitetura Técnica

**Versão:** 1.0.0
**Data:** 2026-04-09
**Stack:** OpenWebUI (frontend) + OpenClaw Bot (backend agent) + Bridge Stack (MCP)

---

## 1. Visão Geral da Arquitetura

Este documento descreve a arquitetura de integracao onde **OpenWebUI** atua como interface de chat (frontend) e **OpenClaw Bot** fornece capacidades agenticas (controle de browser, operacoes de arquivo, etc.) acessiveis via protocolo MCP.

### Fluxo de Dados

```
Utilizador (Browser)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Cloudflare Access (OAuth Google)                                   │
│  https://chat.zappro.site                                           │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OpenWebUI (:8080)                                                 │
│  Container: open-webui-wbmqefxhd7vdn2dme3i6s9an                     │
│  Rede: wbmqefxhd7vdn2dme3i6s9an, qgtzrmi6771lt8l7x8rqx72f           │
│  LLM: Ollama qwen2.5vl (:11434)                                    │
│  STT: wav2vec2 (:8201)                                              │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼ (MCP Tool Call)
┌─────────────────────────────────────────────────────────────────────┐
│  openwebui_bridge_agent (:3456)                                     │
│  Container: openwebui-bridge-agent                                  │
│  Rede: wbmqefxhd7vdn2dme3i6s9an + qgtzrmi6771lt8l7x8rqx72f         │
│  Ferramentas: bridge_chat, bridge_status, bridge_list_tools        │
│  Formato de resposta: CEO MIX (curto, direto, PT-BR)               │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼ (MCP Tool Call)
┌─────────────────────────────────────────────────────────────────────┐
│  openclaw_mcp_wrapper (:3457)                                      │
│  Container: openclaw-mcp-wrapper                                    │
│  Rede: qgtzrmi6771lt8l7x8rqx72f                                     │
│  Base URL: http://10.0.19.4:8080 (OpenClaw Bot)                     │
│  Auth: Bearer token (OPENCLAW_GATEWAY_TOKEN)                       │
│  Ferramentas: get_status, invoke_tool, restart_browser,             │
│               list_sessions, send_message, get_browser_status       │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼ (HTTP POST /tools/invoke)
┌─────────────────────────────────────────────────────────────────────┐
│  OpenClaw Bot (:8080)                                               │
│  Container: openclaw-qgtzrmi6771lt8l7x8rqx72f                      │
│  Rede: qgtzrmi6771lt8l7x8rqx72f                                     │
│  IP: 10.0.19.4                                                      │
│  Agentes + Tools: browser, arquivos, sessoes                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Diagrama ASCII Simplificado

```
                         ┌──────────────┐
                         │  Utilizador  │
                         │   (Browser)  │
                         └──────┬───────┘
                                │
                    ┌──────────▼──────────┐
                    │   Cloudflare Access   │
                    │  chat.zappro.site    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │      OpenWebUI       │
                    │       :8080          │
                    │   (wbmqefx rede)     │
                    └──────────┬──────────┘
                               │ MCP /tools/call
                    ┌──────────▼──────────┐
                    │  openwebui_bridge   │
                    │     _agent :3456     │
                    │   (bridge stack)    │
                    └──────────┬──────────┘
                               │ MCP /tools/call
                    ┌──────────▼──────────┐
                    │  openclaw_mcp_       │
                    │    wrapper :3457     │
                    │   (qgtzrmi rede)     │
                    └──────────┬──────────┘
                               │ HTTP POST /tools/invoke
                    ┌──────────▼──────────┐
                    │    OpenClaw Bot     │
                    │      :8080          │
                    │   IP: 10.0.19.4     │
                    │   (qgtzrmi rede)    │
                    └─────────────────────┘
```

---

## 2. Inventario de Componentes

### 2.1 OpenWebUI (Existente)

| Atributo | Valor |
|----------|-------|
| **Nome** | OpenWebUI |
| **Proposito** | Interface de chat (frontend) com Ollama integrado |
| **Porta** | 8080 |
| **Container** | open-webui-wbmqefxhd7vdn2dme3i6s9an |
| **Redes Docker** | wbmqefxhd7vdn2dme3i6s9an, qgtzrmi6771lt8l7x8rqx72f |
| **URL Externa** | https://chat.zappro.site |
| **Autenticacao** | OAuth via Cloudflare Access (Google) |

**Variaveis de Ambiente (principais):**

| Variavel | Valor |
|----------|-------|
| SERVICE_URL | https://chat.zappro.site |
| OLLAMA_BASE_URL | http://10.0.5.1:11434 |
| AUDIO_STT_ENGINE | openai |
| AUDIO_STT_OPENAI_BASE_URL | http://10.0.19.8:8201/v1 |

**Healthcheck:** GET /health (via Nginx proxy)

**Dependencias:**
- Ollama com modelo qwen2.5vl (:11434)
- wav2vec2 STT (:8201)
- Cloudflare Access (autenticacao OAuth)

---

### 2.2 OpenClaw Bot (Existente)

| Atributo | Valor |
|----------|-------|
| **Nome** | OpenClaw Bot |
| **Proposito** | Agente backend com tools de browser, arquivos e sessoes |
| **Porta** | 8080 |
| **Container** | openclaw-qgtzrmi6771lt8l7x8rqx72f |
| **Rede Docker** | qgtzrmi6771lt8l7x8rqx72f |
| **IP** | 10.0.19.4 |
| **Autenticacao** | Bearer token (OPENCLAW_GATEWAY_TOKEN) |

**Endpoints Principais:**

| Metodo | Path | Descricao |
|--------|------|-----------|
| GET | / | Health/status do bot |
| POST | /start | Iniciar browser |
| POST | /stop | Parar browser |
| POST | /tools/invoke | Invocar uma tool |

**Healthcheck:** GET /

**Dependencias:**
- Browser automation (Playwright/DrissionBrowser)
- Deepgram API (via wav2vec2-proxy)

---

### 2.3 openclaw_mcp_wrapper (Este Projeto)

| Atributo | Valor |
|----------|-------|
| **Nome** | OpenClaw MCP Wrapper |
| **Proposito** | Expor ferramentas do OpenClaw via protocolo MCP |
| **Porta** | 3457 |
| **Container** | openclaw-mcp-wrapper |
| **Rede Docker** | qgtzrmi6771lt8l7x8rqx72f |
| **Base URL** | http://10.0.19.4:8080 |
| **Autenticacao** | Bearer token (OPENCLAW_GATEWAY_TOKEN de Infisical) |
| **Dockerfile** | Dockerfile.openclaw-mcp-wrapper |
| **Entry Point** | /app/entrypoint.sh |

**Variaveis de Ambiente:**

| Variavel | Origem | Descricao |
|----------|--------|-----------|
| PORT | Default: 3457 | Porta do servidor MCP |
| OPENCLAW_BASE_URL | Infisical ou fallback | URL base do OpenClaw |
| OPENCLAW_GATEWAY_TOKEN | Infisical | Token Bearer para autenticacao |
| INFISICAL_TOKEN | Coolify | Token de servico do Infisical |
| INFISICAL_PROJECT_ID | Coolify | ID do projeto no Infisical |
| INFISICAL_ENV | Coolify | Environment slug (dev/prod) |
| INFISICAL_SECRET_PATH | Coolify | Path dos secrets (/ ) |
| SECRET_KEYS | Default | OPENCLAW_GATEWAY_TOKEN,OPENCLAW_BASE_URL |

**Healthcheck:**
```bash
python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:3457/health')"
```

**Dependencias:**
- OpenClaw Bot (:8080)
- Infisical SDK (para fetching de secrets)

---

### 2.4 openwebui_bridge_agent (Este Projeto)

| Atributo | Valor |
|----------|-------|
| **Nome** | OpenWebUI Bridge Agent |
| **Proposito** | Intermediar entre OpenWebUI e OpenClaw; formatar respostas em CEO MIX |
| **Porta** | 3456 |
| **Container** | openwebui-bridge-agent |
| **Redes Docker** | qgtzrmi6771lt8l7x8rqx72f, wbmqefxhd7vdn2dme3i6s9an |
| **Base URL (MCP Wrapper)** | http://openclaw-mcp-wrapper:3457 |
| **Auth** | Bearer token (OPENCLAW_GATEWAY_TOKEN de Infisical) |
| **Dockerfile** | Dockerfile.openwebui-bridge-agent |
| **Entry Point** | /app/entrypoint.sh |

**Variaveis de Ambiente:**

| Variavel | Origem | Descricao |
|----------|--------|-----------|
| PORT | Default: 3456 | Porta do servidor MCP |
| OPENCLAW_BASE_URL | Default | URL do MCP wrapper local |
| OPENCLAW_GATEWAY_TOKEN | Infisical | Token Bearer para autenticacao |
| INFISICAL_TOKEN | Coolify | Token de servico do Infisical |
| INFISICAL_PROJECT_ID | Coolify | ID do projeto no Infisical |
| INFISICAL_ENV | Coolify | Environment slug (dev/prod) |
| INFISICAL_SECRET_PATH | Coolify | Path dos secrets (/ ) |
| SECRET_KEYS | Default | OPENCLAW_GATEWAY_TOKEN |

**Healthcheck:**
```bash
python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:3456/health')"
```

**Dependencias:**
- openclaw_mcp_wrapper (via depends_on com condition: service_healthy)
- Infisical SDK (para fetching de secrets)

---

## 3. Especificacao dos Tools MCP

### 3.1 Ferramentas do openclaw_mcp_wrapper

#### get_status

**Nome:** `get_status`

**Descricao:** Verifica o status/saude do OpenClaw Bot.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string" },
    "openclaw": { "type": "object" }
  }
}
```

**Exemplo de Chamada:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_status",
    "arguments": {}
  },
  "id": 1
}
```

**Exemplo de Resposta:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "ok",
    "openclaw": {
      "version": "1.0.0",
      "browser_running": true
    }
  },
  "id": 1
}
```

---

#### invoke_tool

**Nome:** `invoke_tool`

**Descricao:** Invoca uma ferramenta especifica no OpenClaw.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "tool": {
      "type": "string",
      "description": "Nome da tool (ex: sessions_list, browser_*, send_message)"
    },
    "action": {
      "type": "string",
      "description": "Acao (default: json)"
    },
    "args": {
      "type": "object",
      "description": "Argumentos opcionais para a tool"
    }
  },
  "required": ["tool"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "ok": { "type": "boolean" },
    "response": { "type": "string" }
  }
}
```

**Exemplo de Chamada:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "invoke_tool",
    "arguments": {
      "tool": "sessions_list",
      "action": "json",
      "args": {}
    }
  },
  "id": 2
}
```

---

#### restart_browser

**Nome:** `restart_browser`

**Descricao:** Reinicia o browser do OpenClaw (stop + start sequencial).

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string" }
  }
}
```

**Exemplo de Chamada:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "restart_browser",
    "arguments": {}
  },
  "id": 3
}
```

---

#### list_sessions

**Nome:** `list_sessions`

**Descricao:** Lista todas as sessoes ativas do OpenClaw.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "sessions": { "type": "array" }
  }
}
```

---

#### send_message

**Nome:** `send_message`

**Descricao:** Envia uma mensagem para uma sessao do OpenClaw.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "description": "ID da sessao para enviar mensagem"
    },
    "message": {
      "type": "string",
      "description": "Texto da mensagem"
    }
  },
  "required": ["session_id", "message"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "response": { "type": "string" },
    "ok": { "type": "boolean" }
  }
}
```

---

#### get_browser_status

**Nome:** `get_browser_status`

**Descricao:** Verifica se o browser do OpenClaw esta em execucao.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "browser_running": { "type": "boolean" },
    "details": { "type": "object" },
    "error": { "type": "string" }
  }
}
```

---

### 3.2 Ferramentas do openwebui_bridge_agent

#### bridge_chat

**Nome:** `bridge_chat`

**Descricao:** Envia mensagem ao OpenClaw via MCP wrapper e retorna resposta formatada em CEO MIX.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "description": "Mensagem para enviar ao OpenClaw"
    },
    "session_id": {
      "type": "string",
      "description": "ID da sessao (opcional)"
    }
  },
  "required": ["message"]
}
```

**Output Schema (CEO MIX):**
```json
{
  "type": "object",
  "properties": {
    "response": { "type": "string" },
    "style": { "type": "string", "const": "ceo_mix" },
    "tool_used": { "type": "string" },
    "action_taken": { "type": "string" }
  }
}
```

**Exemplo de Chamada:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "bridge_chat",
    "arguments": {
      "message": "Navega para google.com e faz screenshot",
      "session_id": "sessao-123"
    }
  },
  "id": 10
}
```

**Exemplo de Resposta:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "response": "Screenshot capturado com sucesso. URL: https://www.google.com",
    "style": "ceo_mix",
    "tool_used": "send_message",
    "action_taken": "Enviada mensagem para OpenClaw: Navega para google.com..."
  },
  "id": 10
}
```

**Formato CEO MIX:**
- Curto e direto
- Tom profissional em PT-BR
- `Resposta: [curto] | Contexto: [se necessario]`

---

#### bridge_status

**Nome:** `bridge_status`

**Descricao:** Verifica se o OpenClaw esta acessivel via bridge.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string" },
    "openclaw_reachable": { "type": "boolean" },
    "openclaw_response": { "type": "object" },
    "error": { "type": "string" }
  }
}
```

---

#### bridge_list_tools

**Nome:** `bridge_list_tools`

**Descricao:** Lista ferramentas disponiveis no OpenClaw.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string" },
    "tools": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    },
    "error": { "type": "string" }
  }
}
```

---

## 4. Topologia de Rede

### Redes Docker

```
Rede: qgtzrmi6771lt8l7x8rqx72f
  Proposito: Rede do OpenClaw e seus componentes
  Containers:
    - openclaw-qgtzrmi6771lt8l7x8rqx72f (OpenClaw Bot)     IP: 10.0.19.4
    - openclaw-mcp-wrapper                                  IP: (DHCP)
    - openclaw (servico interno se existir)

Rede: wbmqefxhd7vdn2dme3i6s9an
  Proposito: Rede do OpenWebUI e bridge agent
  Containers:
    - open-webui-wbmqefxhd7vdn2dme3i6s9an (OpenWebUI)
    - openwebui-bridge-agent (bridge stack)
    - openclaw-mcp-wrapper (tambem nesta rede para comunicacao bridge->wrapper)
```

### Diagrama de Rede

```
┌─────────────────────────────────────────────────────────────────────┐
│  Rede: wbmqefxhd7vdn2dme3i6s9an (OpenWebUI)                        │
│                                                                     │
│  ┌─────────────────┐         ┌─────────────────┐                  │
│  │   OpenWebUI     │◄────────│ openwebui_      │                  │
│  │   :8080         │  MCP    │ bridge_agent    │                  │
│  └─────────────────┘         │ :3456           │                  │
│                              └────────┬────────┘                  │
└─────────────────────────────────────┼─────────────────────────────┘
                                      │ MCP
┌─────────────────────────────────────┼─────────────────────────────┐
│  Rede: qgtzrmi6771lt8l7x8rqx72f     │ (OpenClaw)                  │
│                                     ▼                              │
│  ┌─────────────────┐         ┌─────────────────┐                  │
│  │ openclaw_mcp_   │────────►│  OpenClaw Bot   │                  │
│  │ wrapper :3457   │  HTTP   │  :8080           │                  │
│  └─────────────────┘         │  IP: 10.0.19.4   │                  │
│                              └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Comunicacao Entre Componentes

| Origem | Destino | Protocolo | Porta | Autenticacao |
|--------|---------|-----------|-------|--------------|
| OpenWebUI | bridge_agent | HTTP/MCP | 3456 | Via OpenWebUI internals |
| bridge_agent | mcp_wrapper | HTTP/MCP | 3457 | Bearer token |
| mcp_wrapper | OpenClaw Bot | HTTP | 8080 | Bearer token |

---

## 5. Modelo de Seguranca

### 5.1 Infisical SDK para Secrets em Runtime

Todos os containers do bridge stack usam `entrypoint.sh` que:

1. Faz fetch dos secrets do Infisical na inicializacao
2. Exporta como variaveis de ambiente
3. Executa a aplicacao Python

**Secrets Fetcheados:**

| Secret | Descricao |
|--------|-----------|
| OPENCLAW_GATEWAY_TOKEN | Token Bearer para OpenClaw |
| OPENCLAW_BASE_URL | URL base do OpenClaw (opcional) |

**Fluxo:**
```
Container Start
    │
    ▼
entrypoint.sh
    │
    ├─► Infisical SDK Client
    │       │
    │       ▼
    │    GET /secrets (project_id, env, path)
    │       │
    │       ▼
    │    Export secrets as ENV vars
    │
    ▼
Python App (le de os.environ)
```

### 5.2 Autenticacao Bearer Token

```
OpenWebUI
    │
    ├─► MCP call ──► bridge_agent ──► mcp_wrapper ──► OpenClaw
    │                    │                  │              │
    │                    │                  │         Bearer Token
    │                    │                  │         (OPENCLAW_GATEWAY_TOKEN)
    │                    │                  │
    │                    │             Sem auth entre
    │                    │             containers (mesma rede)
    │                    │
    │              Sem auth (localhost)
```

### 5.3 Isolamento de Rede Docker

- `qgtzrmi6771lt8l7x8rqx72f`: Apenas OpenClaw + mcp_wrapper
- `wbmqefxhd7vdn2dme3i6s9an`: OpenWebUI + bridge_agent + mcp_wrapper
- Containers em redes diferentes so se comunicam via portas expostas

### 5.4 Cloudflare Access OAuth

- OpenWebUI exposto em https://chat.zappro.site
- Cloudflare Access protege o endpoint
- Bypass para /oauth/* (autenticacao Google)
- Nao ha autenticacao adicional entre componentes internos

---

## 6. Bibliotecas e Dependencias

### Imagem Base

```dockerfile
FROM python:3.11-slim
```

### Dependencias Python

| Pacote | Versao | Uso |
|--------|--------|-----|
| infisical-python | >= 0.22.0 | Fetch de secrets do Infisical |

### Codigo da Aplicacao (Stdlib Only)

| Modulo | Proposito |
|--------|-----------|
| http.server | Servidor HTTP para MCP |
| json | Serializacao/deserializacao JSON |
| urllib.request | Requisicoes HTTP para OpenClaw API |
| base64 | Codificacao Basic Auth (dev fallback) |
| threading | Concurrencia (se necessario) |
| socket | SO_REUSEADDR para servidor HTTP |

### Diagrama de Dependencias

```
┌─────────────────────────────────────────────────────────┐
│  python:3.11-slim                                       │
├─────────────────────────────────────────────────────────┤
│  infisical-python >= 0.22.0                            │
│      │                                                  │
│      ├── requests (transitive)                         │
│      └── urllib3 (transitive)                         │
├─────────────────────────────────────────────────────────┤
│  Python Stdlib                                          │
│      ├── http.server (HTTPServer, BaseHTTPRequestHandler)
│      ├── json                                           │
│      ├── urllib.request, urllib.error                  │
│      ├── base64                                         │
│      ├── socket                                         │
│      └── threading                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Estrategia de Testing

### 7.1 Health Checks

**openclaw_mcp_wrapper:**
```bash
curl -s http://localhost:3457/health
# Resposta: {"status": "ok", "service": "openclaw-mcp-wrapper"}
```

**openwebui_bridge_agent:**
```bash
curl -s http://localhost:3456/health
# Resposta: {"status": "ok", "service": "openwebui-bridge-agent"}
```

### 7.2 Testes de Protocolo MCP

**Listar Tools:**
```bash
curl -s -X POST http://localhost:3457/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list", "params": {}, "id": 1}'
```

**Invocar Tool:**
```bash
curl -s -X POST http://localhost:3457/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "get_status", "arguments": {}}, "id": 2}'
```

### 7.3 Teste E2E Completo

```bash
# 1. Verificar health do bridge
curl -s http://localhost:3456/health

# 2. Listar tools disponiveis
curl -s -X POST http://localhost:3456/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list", "params": {}, "id": 1}'

# 3. Verificar status do OpenClaw via bridge
curl -s -X POST http://localhost:3456/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "bridge_status", "arguments": {}}, "id": 2}'

# 4. Enviar mensagem via bridge (CEO MIX)
curl -s -X POST http://localhost:3456/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "bridge_chat", "arguments": {"message": "Qual e o status do browser?"}}, "id": 3}'
```

### 7.4 Smoke Test Script

```python
#!/usr/bin/env python3
"""Smoke test para o bridge stack."""
import urllib.request
import json

def test_health(url: str, name: str) -> bool:
    try:
        with urllib.request.urlopen(f"{url}/health", timeout=5) as resp:
            data = json.loads(resp.read())
            print(f"[OK] {name}: {data}")
            return data.get("status") == "ok"
    except Exception as e:
        print(f"[FAIL] {name}: {e}")
        return False

def test_mcp(url: str, method: str, params: dict, name: str) -> bool:
    try:
        payload = json.dumps({"method": method, "params": params, "id": 1}).encode()
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            print(f"[OK] {name}: {data.get('result', data)}")
            return "error" not in data
    except Exception as e:
        print(f"[FAIL] {name}: {e}")
        return False

if __name__ == "__main__":
    results = []
    results.append(test_health("http://localhost:3457", "openclaw-mcp-wrapper health"))
    results.append(test_health("http://localhost:3456", "openwebui-bridge-agent health"))
    results.append(test_mcp("http://localhost:3456/mcp", "tools/list", {}, "bridge_list_tools"))
    results.append(test_mcp("http://localhost:3456/mcp", "tools/call", {"name": "bridge_status", "arguments": {}}, "bridge_status"))
    results.append(test_mcp("http://localhost:3456/mcp", "tools/call", {"name": "bridge_chat", "arguments": {"message": "Teste"}}, "bridge_chat"))

    print(f"\n{sum(results)}/{len(results)} testes passaram")
```

---

## 8. Deployment (Coolify)

### 8.1 Ficheiros de Deployment

```
docs/OPERATIONS/SKILLS/
├── Dockerfile.openclaw-mcp-wrapper    # Build para MCP wrapper
├── Dockerfile.openwebui-bridge-agent  # Build para bridge agent
├── docker-compose.bridge.yml          # Orquestacao
├── entrypoint.sh                      # Fetch de secrets (compartilhado)
├── openclaw_mcp_wrapper.py           # Codigo MCP wrapper
└── openwebui_bridge_agent.py         # Codigo bridge agent
```

### 8.2 docker-compose.bridge.yml

```yaml
version: "3.9"

services:
  openclaw-mcp-wrapper:
    build:
      context: .
      dockerfile: Dockerfile.openclaw-mcp-wrapper
    container_name: openclaw-mcp-wrapper
    ports:
      - "3457:3457"
    environment:
      PORT: 3457
      INFISICAL_TOKEN: "${INFISICAL_TOKEN:-}"
      INFISICAL_PROJECT_ID: "${INFISICAL_PROJECT_ID:-}"
      INFISICAL_ENV: "${INFISICAL_ENV:-dev}"
      INFISICAL_SECRET_PATH: "${INFISICAL_SECRET_PATH:-/}"
      SECRET_KEYS: "OPENCLAW_GATEWAY_TOKEN"
      OPENCLAW_BASE_URL: "${OPENCLAW_BASE_URL:-http://10.0.19.4:8080}"
      OPENCLAW_TOKEN: "${OPENCLAW_GATEWAY_TOKEN:-}"
    networks:
      - qgtzrmi6771lt8l7x8rqx72f
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:3457/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    restart: unless-stopped

  openwebui-bridge-agent:
    build:
      context: .
      dockerfile: Dockerfile.openwebui-bridge-agent
    container_name: openwebui-bridge-agent
    ports:
      - "3456:3456"
    environment:
      PORT: 3456
      INFISICAL_TOKEN: "${INFISICAL_TOKEN:-}"
      INFISICAL_PROJECT_ID: "${INFISICAL_PROJECT_ID:-}"
      INFISICAL_ENV: "${INFISICAL_ENV:-dev}"
      INFISICAL_SECRET_PATH: "${INFISICAL_SECRET_PATH:-/}"
      SECRET_KEYS: "OPENCLAW_GATEWAY_TOKEN"
      OPENCLAW_BASE_URL: "http://openclaw-mcp-wrapper:3457"
      OPENCLAW_TOKEN: "${OPENCLAW_GATEWAY_TOKEN:-}"
    networks:
      - qgtzrmi6771lt8l7x8rqx72f
      - wbmqefxhd7vdn2dme3i6s9an
    depends_on:
      openclaw-mcp-wrapper:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:3456/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    restart: unless-stopped

networks:
  qgtzrmi6771lt8l7x8rqx72f:
    external: true
  wbmqefxhd7vdn2dme3i6s9an:
    external: true
```

### 8.3 Variaveis de Ambiente (Coolify)

| Variavel | Valor | Descricao |
|----------|-------|-----------|
| INFISICAL_TOKEN | (do Coolify) | Token de servico do Infisical |
| INFISICAL_PROJECT_ID | (do Coolify) | ID do projeto Infisical |
| INFISICAL_ENV | dev | Environment slug |
| INFISICAL_SECRET_PATH | / | Path dos secrets |
| OPENCLAW_BASE_URL | http://10.0.19.4:8080 | URL do OpenClaw Bot |

### 8.4 Orden de Startup

1. **openclaw-mcp-wrapper** inicia primeiro
2. Healthcheck espera que :3457 esteja pronto
3. **openwebui-bridge-agent** inicia depois (via depends_on)
4. Healthcheck espera que :3456 esteja pronto
5. OpenWebUI pode agora invocar tools via bridge

### 8.5 Healthcheck Dependencies

```
openwebui-bridge-agent
    │
    depends_on (condition: service_healthy)
        │
        ▼
openclaw-mcp-wrapper
    │
    healthcheck (interval: 30s, timeout: 5s, retries: 3)
        │
        ▼
GET http://localhost:3457/health
```

---

## 9. Formato CEO MIX

O bridge agent formata todas as respostas no estilo **CEO MIX**:

### Regras

1. **Curto:** Maximo 2-3 frases
2. **Direto:** Comecar com a conclusao/resposta
3. **PT-BR:** Lingua portuguesa brasileira
4. **Profissional:** Tom de assistente executivo

### Estrutura

```json
{
  "response": "Resposta principal curta",
  "style": "ceo_mix",
  "tool_used": "nome_da_tool",
  "action_taken": "Descricao do que foi feito"
}
```

### Exemplos

**Sucesso:**
```json
{
  "response": "Screenshot capturado. Google.com carregado em 1.2s.",
  "style": "ceo_mix",
  "tool_used": "send_message",
  "action_taken": "Browser executou navegacao e screenshot"
}
```

**Erro:**
```json
{
  "response": "Erro ao comunicar com OpenClaw: timeout apos 30s",
  "style": "ceo_mix",
  "tool_used": "send_message",
  "action_taken": "Falha no envio de mensagem"
}
```

---

## 10. Limitacoes e Consideracoes

### Limites de Rate

- **Bridge Agent:** 10 req/min por canal
- **OpenClaw Bot:** Limite propio (depende da tool)

### Timeouts

| Operacao | Timeout |
|----------|---------|
| Requisicao API OpenClaw | 30s |
| Healthcheck | 5s |
| MCP call | Variavel (ate 30s) |

### Restricoes

1. OpenClaw Bot **nao** e um LLM server — e um bot com tools
2. Respostas de tools podem ser verbose (limitar a 500 chars se necessario)
3. Browser automation requer que o browser esteja em execucao

---

## 11. Troubleshooting

### Problemas Comuns

| Sintoma | Causa Possivel | Solucao |
|---------|----------------|---------|
| `connection refused` no bridge | mcp_wrapper nao esta pronto | Verificar healthcheck do mcp_wrapper |
| `401 Unauthorized` | Token invalido ou nao configurado | Verificar OPENCLAW_GATEWAY_TOKEN no Infisical |
| `tool not available` | Browser do OpenClaw nao esta rodando | Invocar `restart_browser` |
| Resposta vazia | Sessao nao existe ou expirou | Invocar `list_sessions` para verificar |

### Comandos de Debug

```bash
# Ver logs do container
docker logs openclaw-mcp-wrapper
docker logs openwebui-bridge-agent

# Ver health manualmente
curl http://localhost:3457/health
curl http://localhost:3456/health

# Ver secrets exportados (dentro do container)
docker exec openclaw-mcp-wrapper env | grep OPENCLAW

# Testar comunicacao OpenClaw diretamente
curl -s http://10.0.19.4:8080/ -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN"
```

---

## 12. Glossario

| Termo | Definicao |
|-------|-----------|
| **MCP** | Model Context Protocol — protocolo para tools/agents |
| **CEO MIX** | Estilo de resposta curta, direta, em PT-BR |
| **Bridge Stack** | openwebui_bridge_agent + openclaw_mcp_wrapper |
| **Infisical** | Plataforma de gerenciamento de secrets |
| **Coolify** | Plataforma de deploy auto-hospedada |
| **wav2vec2** | Modelo de STT (Speech-to-Text) local |

---

*Documento gerado em 2026-04-09*
*Stack: OpenWebUI + OpenClaw Bridge*
