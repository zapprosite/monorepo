# INCIDENT-2026-04-09: OpenClaw TTS Route Fix — Partial Resolution

**Data:** 2026-04-09
**Severidade:** 🟡 MEDIUM
**Tipo:** Voice Pipeline / Config
**Status:** ⚠️ PARTIAL (baseUrl requires Coolify UI)

---

## Sumário

Tentativa de corrigir a rota TTS do OpenClaw para usar TTS Bridge (`:8013`) com voz `pm_santa`. O problema: o schema do OpenClaw stripping o campo `baseUrl` do config em disco, e a única forma de configurar é via `OPENAI_TTS_BASE_URL` env var (requer Coolify UI).

---

## Configuração Alcançada

```json
"messages": {
  "tts": {
    "auto": "inbound",
    "provider": "openai",
    "openai": {
      "model": "kokoro",
      "voice": "pm_santa"
    }
  }
}
```

**O que funciona:**
- `voice: "pm_santa"` ✅ (via `openclaw config set`)
- `model: "kokoro"` ✅ (via `openclaw config set`)

**O que NÃO funciona:**
- `baseUrl: "http://10.0.19.5:8013/v1"` ❌ (schema stripped)

**Alternativa de fix:** `OPENAI_TTS_BASE_URL=http://10.0.19.5:8013/v1` via env var

---

## Root Cause

O schema do OpenClaw (schema.base.generated.ts, linha ~16685) define `messages.tts` com campos específicos (`auto`, `enabled`, `mode`, `provider`, etc.) mas NÃO inclui `baseUrl` ou `providers` como sub-campo de `tts`. O schema só permite estrutura FLAT em `messages.tts` com chaves pre-definidas.

Quando `openclaw.json` é written com `baseUrl` dentro de `tts.openai` ou `tts.providers.openai`, o OpenClaw reescreve o arquivo na inicialização e REMOVE esses campos inválidos pelo schema.

---

## Timeline

| Hora | Evento |
|------|--------|
| 03:41 | Início da investigação — 50 agents |
| 03:50 | Descoberta configuração: voice `pm_alex`, baseUrl via OpenAI direto |
| 04:15 | Configurado voice + model via `openclaw config set` |
| 04:30 | Tentativa de adicionar baseUrl — schema stripping detectado |
| 04:45 | Teste via .env file — não funciona (entrypoint não faz load de .env) |
| 05:00 | Conclusão: baseUrl só via env var |

---

## Solução Necessária (Requer Ação Manual)

**No Coolify UI:** Adicionar variável de ambiente ao container `openclaw-qgtzrmi6771lt8l7x8rqx72f`:
```
OPENAI_TTS_BASE_URL=http://10.0.19.5:8013/v1
```

**Alternativa:** Editar via volume antes do restart:
```python
# Script para adicionar baseUrl ANTES do restart
config['messages']['tts']['openai']['baseUrl'] = 'http://10.0.19.5:8013/v1'
# Mas este é Stripped na inicialização - não funciona
```

---

## Smoke Test Results

```
Total:   15
Passed:  13
Failed:  2 (Vision llava [DEPRECATED - now qwen2.5-vl] - LiteLLM instável no momento)
```

TTS Bridge verification: ✅ 3/3 testes passam
- pm_santa → 200 ✅
- pf_dora → 200 ✅  
- af_sarah → 400 ✅

---

## Prevenção

1. Documentar que `messages.tts.openai.baseUrl` não é suportado pelo schema
2. Usar sempre `OPENAI_TTS_BASE_URL` env var para TTS custom endpoint
3. Criar skill para verificar TTS config antes de restart

---

**Registrado:** 2026-04-09
**Autor:** will + Claude Code
**Proxima revisão:** 2026-04-16
