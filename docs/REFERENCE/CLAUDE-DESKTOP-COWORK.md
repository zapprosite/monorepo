# Claude Code Desktop — Linux Cowork + MiniMax Integration
**Updated:** 2026-04-26

---

## Status

| Component | Status | Endpoint/Model |
|-----------|--------|----------------|
| Claude Code CLI | ✅ Working | MiniMax-M2.7 |
| MiniMax API | ✅ Working | `https://api.minimax.io/anthropic` |
| llm.zappro.site | ✅ Available | LiteLLM (OpenAI-compat) |

---

## Quick Connect (Claude Code CLI)

```bash
export ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
export ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
export ANTHROPIC_MODEL=MiniMax-M2.7

claude --print "ping"
```

---

## Claude Code Desktop (GUI) Configuration

1. **Download:** https://claude.com/download
2. **Model:** Select `MiniMax-M2.7` from model dropdown
3. **API Configuration:**
   - Base URL: `https://api.minimax.io/anthropic`
   - API Key: `${ANTHROPIC_API_KEY}`

---

## MiniMax Token Plan

- **Token Plan:** 15K requests / 5h, 500 rpm
- **API Base:** `https://api.minimax.io` (NOT `api.minimaxi.com`)
- **Endpoint:** `/anthropic/v1/messages` (Anthropic-compatible)

---

## LiteLLM (OpenAI-Compatible)

LiteLLM disponível em `https://llm.zappro.site/v1` para serviços que precisam de OpenAI API.

```bash
# Test LiteLLM
curl -s -H "Authorization: Bearer ${LITELLM_KEY}" \
  https://llm.zappro.site/v1/models | jq '.data[].id'
```

---

## Linux Community Build — Configuração

O Claude Desktop Linux (community build) **não tem GUI para configuração de API**. Use uma das opções abaixo:

### Opção 1: .desktop personalizado (RECOMENDADO)
Lance via `~/.local/share/applications/claude-desktop-minimax.desktop`:
```bash
# O .desktop já está configurado neste diretório
xdg-desktop-menu install --manual ~/.local/share/applications/claude-desktop-minimax.desktop
```

### Opção 2: Alias no shell
```bash
alias claude-minimax='env ANTHROPIC_BASE_URL="https://api.minimax.io/anthropic" \
  ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  ANTHROPIC_MODEL="MiniMax-M2.7" \
  /usr/bin/claude-desktop'
```

### Opção 3: Environment vars persistentes (sistema)
```bash
# Já configurado em /etc/profile.d/zappro-claude.sh
# Recarregar: source /etc/profile.d/zappro-claude.sh
```

### Opção 4: Wrapper script
```bash
# ~/.local/bin/claude-desktop já existe com as vars configuradas
# Adicione ao PATH: export PATH="$HOME/.local/bin:$PATH"
```

---

## Smoke Test

```bash
# Test Claude Code CLI
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic \
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} \
ANTHROPIC_MODEL=MiniMax-M2.7 \
claude --print "ping"
# Expected: pong ✅

# Test LiteLLM
curl -s -H "Authorization: Bearer ${LITELLM_KEY}" \
  https://llm.zappro.site/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"minimax-m2.7","messages":[{"role":"user","content":"ping"}],"max_tokens":5}'
```
