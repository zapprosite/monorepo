# SPEC-020: OpenWebUI ↔ 
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab

## Context

O OpenWebUI tem interface de chat com Ollama (qwen2.5vl). O (sub-agents, tools, browser control). O objetivo é fazer um **bridge bidirecional** onde o OpenWebUI pode invocar as ferramentas e agents do .

**Fluxo:**
```
Utilizador (OpenWebUI)
    │
    ├─► Mensagem → (:3334)
    │                    │
    │                    ├─► _tool → agent processing
    │                    └─► Resposta → OpenWebUI
    │
    └─► LLM Normal (Ollama qwen2.5vl)
```

## Arquitectura

### Componentes
1. **_mcp_wrapper.py** (já existe, porta 3334)
   - `invoke_tool` → chama `POST /tools/invoke`
   - `get_status` → health check
   - `restart_browser` → restart browser do 

2. **openwebui_bridge_agent.py** (novo)
   - Agent que faz de intermediary
   - Recebe mensagem do OpenWebUI via MCP
   - Invoca tools do 
   - Retorna resposta formatada em CEO MIX style

3. **CEO MIX Chat Style**
   - Respostas curtas, directas, em português
   - Tom profissional e eficiente
   - Formato: `Resposta: [curto] | Contexto: [se necessario]`

### Fluxo Técnico
```
OpenWebUI (chat UI)
    │
    ├─► /api/v1/chat/completions (OpenWebUI native)
    │         └─► Ollama qwen2.5vl (sem voice)
    │
    └─► MCP bridge (openwebui_mcp.py :3333)
              └─► _mcp_wrapper.py (:3334)
                        └─► /tools/invoke
                                  └─► agent + tools
```

## Tools do 

| Tool | Descrição | Prioridade |
|------|-----------|------------|
| `_invoke_tool` | Invoca uma tool específica do | Alta |
| `_chat` | Chat com o agent principal do | Alta |
| `_browser_action` | Navega, clica, faz screenshot via browser | Média |
| `_file_search` | Procura ficheiros via agent | Média |
| `_status` | Status dos agents e tools | Baixa |

## Ficheiros a Criar

### 1. `/srv/monorepo/docs/OPERATIONS/SKILLS/openwebui_bridge_agent.py`
```python
# Agent intermediário que:
# - Recebe mensagem via MCP
# - Faz parsing do intent
# - Invoca tool correcta no 
# - Formata resposta em CEO MIX style
```

### 2. Atualizar `openwebui_mcp.py`
- Adicionar tool `_bridge_chat` que invoca o bridge agent

### 3. Atualizar `_mcp_wrapper.py`
- Adicionar tool `chat_with_agent` que faz passthrough para o agent principal

## CEO MIX Response Format

```json
{
  "response": "Resposta curta e directa",
  "style": "ceo_mix",
  "context": "Informação adicional se necessario",
  "tool_used": "nome_da_tool",
  "action_taken": "o que foi feito"
}
```

## Testing

1. `curl` tool invocation via MCP
2. Response time < 5s para tools simples
3. CEO MIX format validation

## Limites

- — é um bot com tools
- Respostas de tools podem ser verbose (limitar a 500 chars)
- Rate limit: 10 req/min por canal

## Status

- [x] Research completo
- [x] SPEC approved
- [x] Dockerfiles criados (, openwebui-bridge-agent)
- [x] entrypoint.sh com 
- [x] docker-compose.bridge.yml com redes qgtzrmi + wbmqefx
- [ ] Deploy via Coolify API (pending)
- [ ] E2E smoke test (super E2E created: smoke-bridge-stack-e2e.sh)
