---
name: SPEC-009-OpenWebUI-HVAC-Multimodal
description: Arquitetura OpenWebUI multimodal para zappro-clima-tutor — STT/Groq, TTS/Edge, Vision/Qwen, LiteLLM gateway
status: ready
phase: execute
parallel: 20
created: 2026-04-28
author: will
tags: [openwebui, hvac, multimodal, stt, tts, vision, litellm]
---

# SPEC-009: OpenWebUI HVAC Multimodal Architecture

## Objetivo

Implementar a arquitetura multimodal completa para o zappro-clima-tutor:

```
OpenWebUI = interface (chat, voz, anexos)
zappro-clima-tutor / llm.zappro.site = cérebro (memória, RAG, router)
LiteLLM / api.zappro.site = gateway de modelos
MiniMax M2.7 = primary LLM
Groq = STT (whisper-large-v3-turbo)
Edge TTS = TTS (pt-BR-FranciscaNeural)
Qwen2.5VL:3B = visão (Ollama local)
Qdrant/Mem0/Postgres/Hermes = memória e RAG
```

## Arquitetura-Alvo

### Fluxo de Texto/Instrução
```
OpenWebUI → zappro-clima-tutor → llm.zappro.site → LiteLLM → MiniMax M2.7
```

### Fluxo STT
```
OpenWebUI → Groq (whisper-large-v3-turbo) → texto → zappro-clima-tutor
```

### Fluxo TTS
```
zappro-clima-tutor → OpenWebUI → Edge TTS (pt-BR-FranciscaNeural)
```

### Fluxo de Visão
```
OpenWebUI anexo → zappro-clima-tutor → Qwen2.5VL:3B (Ollama :11434) → extrai código → estado → MiniMax
```

## Tarefas

### T-OW01: Config OpenWebUI — API e Modelo Principal
**Arquivo:** `docker-compose.openwebui-hvac.yml`
- OPENAI_API_BASE_URL=http://localhost:4017/v1
- OPENAI_API_KEY=sk-local-zappro-clima
- DEFAULT_MODELS=zappro-clima-tutor
- DEFAULT_PINNED_MODELS=zappro-clima-tutor
- TASK_MODEL_EXTERNAL=zappro-clima-tutor
- ENABLE_OLLAMA_API=false
- Expor SOMENTE zappro-clima-tutor como modelo

### T-OW02: Config STT — Groq Whisper
**Arquivo:** `docker-compose.openwebui-hvac.yml` (env section)
- AUDIO_STT_ENGINE=openai
- AUDIO_STT_OPENAI_API_BASE_URL=https://api.groq.com/openai/v1
- AUDIO_STT_OPENAI_API_KEY=${GROQ_API_KEY}
- AUDIO_STT_MODEL=whisper-large-v3-turbo
- AUDIO_STT_SUPPORTED_CONTENT_TYPES=audio/wav,audio/mpeg,audio/webm,audio/mp4

### T-OW03: Config TTS — Edge TTS
**Arquivo:** `docker-compose.openwebui-hvac.yml` + `docker-compose.edge-tts.yml`
- openai-edge-tts container em :5050
- AUDIO_TTS_ENGINE=openai
- AUDIO_TTS_OPENAI_API_BASE_URL=http://openai-edge-tts:5050/v1
- AUDIO_TTS_OPENAI_API_KEY=not-needed
- AUDIO_TTS_MODEL=tts-1
- AUDIO_TTS_VOICE=pt-BR-FranciscaNeural
- AUDIO_TTS_SPLIT_ON=punctuation

### T-OW04: Config LiteLLM — MiniMax Primary
**Arquivo:** `config/litellm/config.yaml` ou `docker-compose.litellm.yml`
- model_name: minimax-m2.7
- model: openai/MiniMax-M2.7
- api_base: https://api.minimax.io/v1
- fallback: minimax-m2.7-highspeed
- temperature: 0.45-0.55, top_p: 0.9, max_tokens: 1800-2500

### T-OW05: Config Qwen2.5VL — Ollama Visão
**Arquivo:** `scripts/hvac-rag/hvac_vision.py`
- qwen2.5vl:3b via Ollama local :11434
- Usado SOMENTE como ferramenta interna do tutor
- NÃO exposto como modelo público no OpenWebUI
- Fluxo: anexo → detecta imagem → chama Ollama → extrai texto → injeta no estado

### T-OW06: Healthcheck Atualizado
**Arquivo:** `scripts/hvac-rag/hvac-healthcheck.py`
- OpenWebUI (:3456 ou subdomain)
- zappro-clima-tutor (:4017)
- LiteLLM/api.zappro.site (:4000)
- MiniMax model alias
- Groq STT endpoint
- Edge TTS endpoint
- Ollama qwen2.5vl
- Qdrant
- Mem0
- Postgres
- Não imprimir secrets

### T-OW07: Smoke Test Multimodal
**Arquivo:** `scripts/hvac-rag/hvac-daily-smoke.py`
- Teste de chat via zappro-clima-tutor
- Teste de STT (se Groq key disponível)
- Teste de TTS (se Edge TTS disponível)
- Teste de visão com imagem dummy
- Validar que OpenWebUI só mostra zappro-clima-tutor

### T-OW08: Documentação — RUNBOOK
**Arquivo:** `docs/RUNBOOKS/OPENWEBUI-HVAC-MULTIMODAL-ARCHITECTURE.md`
- Arquitetura completa com diagramas
- Variáveis de ambiente
- Fluxos de dados
- Limites de cada componente
- Troubleshooting

### T-OW09: Verificação — Modelo Único Visível
**Validar:**
- OpenWebUI mostra SOMENTE zappro-clima-tutor
- NÃO mostra: minimax-m2.7, qwen2.5vl, hvac-manual-strict, field-tutor, printable, LiteLLM

### T-OW10: Verificação — Fluxo de Texto
**Validar:**
- Chat → zappro-clima-tutor → LiteLLM → MiniMax
- Resposta volta com formato de tutor técnico PT-BR

### T-OW11: Verificação — Segurança
**Validar:**
- api.zappro.site não exposto publicamente
- Qdrant não exposto publicamente
- LiteLLM protegido por Access (Cloudflare)
- Secrets nunca em logs

## Critérios de Aceite

1. OpenWebUI expõe só zappro-clima-tutor como modelo
2. STT usa Groq whisper-large-v3-turbo
3. TTS usa Edge TTS com pt-BR-FranciscaNeural
4. Imagem anexada chama qwen2.5vl:3b via Ollama local
5. LiteLLM é gateway de modelos (não chamada direta)
6. Healthcheck valida todos os componentes
7. Documentação completa com fluxos
8. Smoke test passa

## Componentes

| Componente | URL/Porta | Uso |
|-----------|-----------|-----|
| OpenWebUI | chat.zappro.site | Interface |
| zappro-clima-tutor | llm.zappro.site :4017 | Cérebro |
| LiteLLM | api.zappro.site :4000 | Gateway modelos |
| Groq STT | api.groq.com | Voz→texto |
| Edge TTS | :5050 | Texto→voz |
| Qwen2.5VL | Ollama :11434 | Visão |
| Qdrant | hermes-second-brain-qdrant | RAG |
| Mem0 | localhost | Memória quente |
| Postgres | localhost | Ledger eventos |

## Restrições

- NÃO expor Qdrant publicamente
- NÃO colocar api.zappro.site sem Cloudflare Access
- NÃO expor modelos internos (hvac-manual-strict, etc)
- NÃO imprimir secrets em logs

## Notas de Implementação (2026-04-29)

### Marcas Brasileiras Suportadas
Sistema agora reconhece todas as marcas principais de AC no Brasil:
- Springer, Komeco, Agratto, Comfee, Mondial, PHCO (adicionadas)
- Daikin, Carrier, Midea, LG, Samsung, Gree, Hitachi, Johnson, Elgin, Consul, Electrolux (existentes)

### Fluxo de Fallback Universal
```
Qdrant miss (modelo não indexado)
  → Triagem técnica via MiniMax M2.7 (sempre responde)
  → Fallback web search (DuckDuckGo Lite → Google News RSS)
  → LLM formata resposta em PT-BR
```

### Correções Aplicadas
- "Sprint" não dispara mais rota "printable" (word-boundary regex)
- Respostasforçam PT-BR — sem CJK/Cirílico
- Pydantic v2 compatibility em extract_state_from_messages
