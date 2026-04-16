# SPEC-052: Hermes Agent + Context7 MCP + Web Search Integration

**Date:** 2026-04-15
**Author:** Principal Engineer
**Status:** ACTIVE
**Type:** Integration
**Branch:** feature/swift-kernel-1776284093

---

## Objective

Documentar e implementar a integração do Hermes Agent com Context7 MCP para pesquisa de documentação e capacidades de web search — usando 14 agentes em paralelo para researching e building.

---

## Background

Após o prune total do OpenClaw (SPEC-051), o foco agora é usar o Hermes Agent como assistente central com:

1. **Context7 MCP** — pesquisa de documentação de bibliotecas/frameworks/APIs
2. **Web Search** — Tavily + WebSearch para pesquisa web em tempo real
3. **MCP Servers** — Claude Code como host MCP para ferramentas externas

**Problema encontrado:** Tavily e Context7 estão com quotas esgotadas (erro 432, quota mensal gasta). Necessário plano de contingência.

---

## Canonical Stack (Post-SPEC-051)

| Serviço               | Porta       | Status    | Notas                                 |
| --------------------- | ----------- | --------- | ------------------------------------- |
| Hermes Gateway        | :8642       | ✅ ACTIVO | OpenAI-compatible API, Bearer token   |
| ai-gateway            | :4002       | ✅ ACTIVO | OpenAI facade, gpt-4o → gemma4-12b-it |
| faster-whisper-medium | :8204       | ✅ ACTIVO | Canonical STT, WER ~7-8%              |
| Kokoro TTS            | :8012/:8013 | ✅ ACTIVO | PT-BR voices pm_santa/pf_dora         |
| Ollama                | :11434      | ✅ ACTIVO | Vision: qwen2.5vl:7b, local fallback  |

---

## Context7 MCP Integration

### O que é Context7

Context7 é um MCP server que fornece documentação actualizada de bibliotecas e frameworks. Funciona como "USB-C para documentação de APIs" — um標準 interface para múltiplas fontes.

**Como funciona:**

```
Claude Code (MCP Host) → Context7 MCP Server → Documentation APIs
```

### Configuração no Claude Code

Em `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"],
      "env": {
        "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"
      }
    }
  }
}
```

**Variável de ambiente (`.env`):**

```
CONTEXT7_API_KEY=ctx7sk-5f90a2d7-65cb-429a-8229-7a0af858846f
```

### Uso

```bash
# Resolução de library ID
claude << 'EOF'
Use mcp__context7__resolve-library-id for "React" or "nextjs"
then query docs with mcp__context7__query-docs
EOF
```

### Padrão de Implementação (Python/FastMCP)

```python
# Anti-hardcoded: all config via process.env
import os
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-context7-tool")

@mcp.tool()
async def query_docs(query: str, library: str) -> str:
    """Query Context7 for documentation.

    Args:
        query: The search query about the library
        library: Library name (e.g., 'react', 'nextjs')
    """
    api_key = os.getenv("CONTEXT7_API_KEY")
    # ... fetch from Context7 API
```

### Fluxo

1. `resolve-library-id` → obtém ID canónico (ex: `/vercel/next.js`)
2. `query-docs` com library ID + query → documentação renderizada

---

## Web Search Integration

### Serviços Disponíveis

| Serviço   | Tipo     | Quota             | Status        |
| --------- | -------- | ----------------- | ------------- |
| Tavily    | MCP      | 20 req/day (free) | ⚠️ Esgotada   |
| WebSearch | Built-in | Limitado          | ⚠️ API errors |
| Context7  | MCP      | 20 req/day (free) | ⚠️ Esgotada   |

### Plano de Contingência (quotas esgotadas)

Quando todas as quotas estão esgotadas:

1. **WebFetch directo** — buscar URLs conhecidos
2. **Treinamento do modelo** — conhecimento já em context
3. **Tomorrow retry** — quotas resetam às 00:00 UTC

```python
# Padrão de fallback
async def fetch_with_fallback(url: str, prompt: str) -> str:
    try:
        return await context7_query(url, prompt)
    except QuotaExceeded:
        return await webfetch_direct(url, prompt)
```

---

## MCP Architecture (Recap)

### Modelo conceptual

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Host (Claude Code)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ MCP Client 1│  │ MCP Client 2│  │ MCP Client N│         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │  STDIO    │    │   HTTP    │    │   HTTP    │
    │  (local)  │    │ (stream)  │    │ (stream)  │
    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
          │                │                │
    ┌─────▼───────────────▼─────────────────▼─────┐
    │              MCP Servers                      │
    │  context7  │  filesystem  │  custom-tools  │
    └─────────────────────────────────────────────┘
```

### Dois Transportes

| Transporte          | Caso de Uso                    | Autenticação                 |
| ------------------- | ------------------------------ | ---------------------------- |
| **STDIO**           | Servers locais (mesma máquina) | Nenhuma                      |
| **Streamable HTTP** | Servers remotos                | Bearer token, API key, OAuth |

### Três Primitivas

| Primitiva     | Propósito                         | Exemplo                                 |
| ------------- | --------------------------------- | --------------------------------------- |
| **Tools**     | Funções executáveis pelo LLM      | `filesystem.read`, `calculator.compute` |
| **Resources** | Dados/context (file contents, DB) | `file:///config.yaml`, `db://users`     |
| **Prompts**   | Templates de interactação         | `code_review_prompt`, `test_template`   |

### STDIO Logging Caveat

> **Nunca escreva para stdout** em servers STDIO — corrompe o stream JSON-RPC. Use `sys.stderr` ou logging library.

```python
# ❌ Bad
print("Processing")

# ✅ Good
import logging
logging.info("Processing")
# or
print("Processing", file=sys.stderr)
```

---

## Hermes Agent MCP Patterns

### Hermes como MCP Host

O Hermes Agent (:8642) pode actuar como MCP host para connects a servers externos:

```yaml
# Configuração conceptual
mcp:
  servers:
    - name: context7
      type: streamable-http
      url: https://api.context7.io
      auth:
        type: bearer
        token: ${CONTEXT7_API_KEY}
```

### Integração com Claude Code

Claude Code é o MCP host principal no ambiente de desenvolvimento:

```bash
# Ver servers MCP configurados
claude --mcp-list

# Adicionar server
claude --mcp-add "context7" "npx -y @context7/mcp-server"
```

---

## 14 Agent Research (Resultados)

### Execução Anterior

| Agente  | Tópico                | Resultado                                     |
| ------- | --------------------- | --------------------------------------------- |
| a94b5fc | MCP Patterns          | ✅ Sucesso — WebFetch modelcontextprotocol.io |
| a6e596b | Hermes Voice Pipeline | ⚠️ Parcial — Telegram docs ✅, Whisper ✅     |
| ace55df | MiniMax API           | ❌ Falhou — quotas esgotadas                  |
| aa254b1 | Claude Code Session   | ❌ Falhou — quotas esgotadas                  |
| a0b7b1c | Claude Code CLI       | ⏳ Pending                                    |

### Findings MCP (a94b5fc)

**O que é MCP:** Open standard para conectar AI apps a fontes externas — "USB-C para AI."

**Arquitectura:**

- MCP Host (Claude Code) → MCP Client → MCP Server
- STDIO: local, óptima performance
- HTTP Streamable: remoto, autenticação flexível

**SDKs:** Python (`mcp`), TypeScript (`@modelcontextprotocol/sdk`)

**3 Primitivas:** Tools, Resources, Prompts

**Padrão Python:**

```python
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("my-server")

@mcp.tool()
async def my_tool(arg: str) -> str:
    """Description for LLM."""
    return result
```

### Findings Hermes Voice (a6e596b)

**Telegram Voice Flow:**

1. `message.voice` → Voice object (`file_id`, `duration`, `mime_type`)
2. `getFile(file_id)` → download path
3. Download OGG/opus → Whisper STT

**Whisper:** Model sizes tiny→turbo, Transformer seq2seq, multilingual

**Kokoro TTS:** `KPipeline` + voice name, 24kHz output, Apache-2.0

---

## Próximos Passos

1. [ ] Verificar quotas Context7/Tavily reset (00:00 UTC)
2. [ ] Implementar Context7 MCP server no Claude Code
3. [ ] Criar skill `.claude/skills/context7-mcp/` para uso futuro
4. [ ] Documentar Hermes Agent MCP integration patterns
5. [ ] Testar Tavily research com query específica

---

## References

- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP Specification](https://modelcontextprotocol.io/specification/latest)
- [Context7 MCP Server](https://github.com/context7/mcp-server)
- [SPEC-051 OpenClaw Prune](./SPEC-051-openclaw-prune-specs-polish.md)
- [SPEC-HERMES-INTEGRATION](./SPEC-HERMES-INTEGRATION.md)
- [SPEC-047 AI Gateway](./SPEC-047-enterprise-polish-ai-gateway-ptbr.md)

---

**Status:** Research compilado — aguardando quota reset para validação completa
