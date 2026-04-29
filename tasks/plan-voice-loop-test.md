# Plan: Voice Loop Test — Telegram Audio/Image Testing Agent

**Autor:** will + Claude Code
**Data:** 2026-04-08
**Status:** DRAFT

---

## 1. Objetivo

Criar um agente de teste loop via Telegram integrado no OpenClaw. O agente recebe audio (voz) e imagens, processa-os através do voice pipeline (TTS/STT/Vision), e refatora testes dinamicamente com base nos resultados.

---

## 2. Arquitetura

```
Telegram
    │
    ├──► OpenClaw Bot (@CEO_REFRIMIX_bot)
    │         │
    │         ├──► /loop — entra em modo loop de testes
    │         │         │
    │         │         ├──► Recebe audio → STT (wav2vec2)
    │         │         ├──► Recebe imagem → Vision (qwen2.5-vl)
    │         │         ├──► Responde com TTS (Kokoro)
    │         │         └──► Coleta resultados → refatora testes
    │         │
    │         └──► /test — executa smoke test completo
    │                   │
    │                   └──► pipeline-openclaw-voice.sh
    │
    └──► LiteLLM Proxy (:4000)
              │
              ├──► whisper-1 → wav2vec2 (STT)
              ├──► tts-1 → Kokoro (TTS)
              ├──► qwen2.5-vl (Vision)
              └──► tom-cat-8b (LLM PT-BR)
```

---

## 3. Componentes a Implementar

### 3.1 Skill: `/loop` (OpenClaw)

Skill que entra em modo loop iterativo:

```
/loop — entra modo loop
  → Aguarda audio (transcreve via whisper-1)
  → Aguarda imagem (analisa via qwen2.5-vl)
  → Responde com TTS (pm_santa)
  → Mostra resultado STT/Vision
  → Repete até usuário enviar /stop
```

### 3.2 Skill: `/test` (OpenClaw)

Executa smoke test e retorna resultado:

```
/test — executa teste completo
  → Roda pipeline-openclaw-voice.sh
  → Retorna output formatado
  → Usa TTS para ler resumo
```

### 3.3 Script: `voice-loop-agent.sh`

Script bash que implementa o loop:

```
voice-loop-agent.sh
  ├── Recebe audio via Telegram API
  ├── Transcreve com LiteLLM whisper-1
  ├── Analisa imagem com qwen2.5-vl
  ├── Gera resposta com tom-cat-8b
  ├── Sintetiza resposta com Kokoro TTS
  └── Envia audio de volta via Telegram
```

### 3.4 Coleta de Dados

Resultados guardados em:

```
/srv/monorepo/tasks/results/
  ├── YYYYMMDD-HHMMSS-stt.json   # Resultados STT
  ├── YYYYMMDD-HHMMSS-vision.json # Resultados Vision
  ├── YYYYMMDD-HHMMSS-tts.json   # Resultados TTS
  └── loop-session-YYYYMMDD.json  # Sessão completa
```

---

## 4. Fluxo de Teste Loop

```
[User] ──► Audio no Telegram ──► OpenClaw /loop
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │ 1. STT (whisper-1) │
                          │    Transcreve audio │
                          └──────────┬──────────┘
                                     ▼
                          ┌─────────────────────┐
                          │ 2. LLM (tom-cat-8b)│
                          │   Analisa texto    │
                          └──────────┬──────────┘
                                     ▼
                          ┌─────────────────────┐
                          │ 3. TTS (Kokoro)    │
                          │   Responde em voz  │
                          └──────────┬──────────┘
                                     ▼
                               [User] ◄── Audio
```

```
[User] ──► Imagem no Telegram ──► OpenClaw /loop
                                       │
                                       ▼
                             ┌─────────────────────┐
                             │ Vision (qwen2.5-vl) │
                             │  Analisa imagem    │
                             └──────────┬──────────┘
                                        ▼
                             ┌─────────────────────┐
                             │ LLM (tom-cat-8b)   │
                             │  Interpreta visão  │
                             └──────────┬──────────┘
                                        ▼
                             ┌─────────────────────┐
                             │ TTS (Kokoro)       │
                             │  Responde em voz   │
                             └──────────┬──────────┘
                                        ▼
                                  [User] ◄── Audio
```

---

## 5. Tarefas

### Tarefa 1: Skill `/loop` no OpenClaw

**Ficheiro:** `/data/workspace/skills/voice-loop/SKILL.md`

**Conteúdo:**
- Comando: `/loop` — inicia modo loop
- Comando: `/stop` — para loop
- Comando: `/status` — mostra estado atual
- Estado: `loop_active`, `last_audio`, `last_image`, `results[]`

**Critério de aceite:** `/loop` no Telegram inicia modo iterativo

---

### Tarefa 2: Script `voice-loop-agent.sh`

**Ficheiro:** `/srv/monorepo/tasks/voice-loop-agent.sh`

**Funcionalidades:**
- `receive_audio()` — baixa audio do Telegram
- `transcribe()` — LiteLLM whisper-1 → texto
- `analyze_image()` — LiteLLM qwen2.5-vl → descrição
- `generate_response()` — LiteLLM tom-cat-8b → texto
- `synthesize()` — LiteLLM tts-1 → audio
- `send_audio()` — envia audio para Telegram

**Critério de aceite:** Script processa audio e retorna transcrição

---

### Tarefa 3: Sistema de Coleta de Resultados

**Ficheiro:** `/srv/monorepo/tasks/results/` (já existe)

**Formato JSON por teste:**
```json
{
  "timestamp": "2026-04-08T14:30:00Z",
  "type": "stt|vision|tts",
  "input": "...",
  "output": "...",
  "model": "whisper-1|qwen2.5-vl|tts-1",
  "latency_ms": 1234,
  "status": "success|fail",
  "error": null
}
```

**Critério de aceite:** Todos os testes guardam JSON em `/srv/monorepo/tasks/results/`

---

### Tarefa 4: Refatoração Automática

O agente analiza resultados e propõe ajustes:

```
Se STT accuracy < 80%:
  → Sugere aumentar sample rate
  → Propoe alternative STT

Se TTS latency > 5s:
  → Sugere cache Redis
  → Propoe voz alternativa

Se Vision falha:
  → Verifica conectividade LiteLLM
  → Testa qwen2.5-vl direto
```

**Critério de aceite:** Agente sugere refatoração baseada em métricas

---

### Tarefa 5: Integração OpenClaw `/test`

**Ficheiro:** `/data/workspace/skills/voice-test/SKILL.md`

```
/test — executa smoke test completo
  → Executa pipeline-openclaw-voice.sh
  → Filtra output relevante
  → Lê resultados de /srv/monorepo/tasks/results/
  → Responde via TTS com resumo
```

**Critério de aceite:** `/test` retorna resultado do smoke test

---

## 6. Dependências

```
Telegram Bot Token: ${TELEGRAM_BOT_TOKEN}
LiteLLM Key: ${LITELLM_KEY}
OpenClaw Container: openclaw-qgtzrmi6771lt8l7x8rqx72f
LiteLLM Container: zappro-litellm (10.0.1.1:4000)
wav2vec2 Container: zappro-wav2vec2 (wav2vec2:8201)
```

---

## 7. Checkpoints

| Fase | Checkpoint | Critério |
|------|-----------|----------|
| 1 | `/loop` funciona | OpenClaw aceita comando e entra em modo loop |
| 2 | STT via Telegram | Audio enviado → texto retornado |
| 3 | Vision via Telegram | Imagem enviada → descrição retornada |
| 4 | TTS responde | Resposta em audio enviada ao Telegram |
| 5 | Coleta JSON | Resultados em `/srv/monorepo/tasks/results/` |
| 6 | `/test` funciona | Smoke test executado e resultado retornado |

---

## 8. NÃO ESCOPO

- Alteração de modelos STT/TTS (SPEC-004, SPEC-005 são protegidos)
- Deployment de novos containers (infra já está operacional)
- Modificação de OpenClaw core (apenas skills/agents)
