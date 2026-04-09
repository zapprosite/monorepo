# TODO: Voice Loop Test via Telegram

## Tarefas Extraídas do Plano

### Tarefa 1: Skill `/loop` no OpenClaw
**Ficheiro:** `/data/workspace/skills/voice-loop/SKILL.md`
**Status:** pending

Criar skill que:
- `/loop` — inicia modo loop iterativo (audio + imagem)
- `/stop` — para loop
- `/status` — mostra estado atual do loop

**Critério aceite:** `/loop` no Telegram inicia modo iterativo

---

### Tarefa 2: Script `voice-loop-agent.sh`
**Ficheiro:** `/srv/monorepo/tasks/voice-loop-agent.sh`
**Status:** pending

Implementar funções:
- `receive_audio()` — baixa audio do Telegram (file_id → mp3/ogg)
- `transcribe()` — LiteLLM whisper-1 → texto
- `analyze_image()` — LiteLLM qwen2.5-vl → descrição
- `generate_response()` — LiteLLM tom-cat-8b → texto
- `synthesize()` — LiteLLM tts-1 → mp3
- `send_audio()` — envia mp3 para Telegram

**Critério aceite:** Audio enviado → audio retornado (loop completo)

---

### Tarefa 3: Sistema de Coleta de Resultados
**Ficheiro:** `/srv/monorepo/tasks/results/loop-*.json`
**Status:** pending

Gravar JSON por teste:
```json
{
  "timestamp": "ISO8601",
  "type": "stt|vision|tts",
  "input": "...",
  "output": "...",
  "model": "whisper-1|qwen2.5-vl|tts-1",
  "latency_ms": 1234,
  "status": "success|fail",
  "error": null
}
```

**Critério aceite:** Todos os testes guardam JSON no directorio results/

---

### Tarefa 4: Skill `/test` (Smoke Test)
**Ficheiro:** `/data/workspace/skills/voice-test/SKILL.md`
**Status:** pending

Implementar `/test`:
- Executa `pipeline-openclaw-voice.sh`
- Filtra output para formato Telegram
- Lê últimos resultados de `/srv/monorepo/tasks/results/`
- Responde via TTS com resumo

**Critério aceite:** `/test` retorna resultado smoke test

---

### Tarefa 5: Refatoração Baseada em Métricas
**Script:** `/srv/monorepo/tasks/refactor-advisor.sh`
**Status:** pending

Analisa resultados e sugere:
- Se STT accuracy < 80% → sugere ajustes
- Se TTS latency > 5s → sugere cache
- Se Vision falha → troubleshooting

**Critério aceite:** Agente propõe refatoração baseada em dados coletados

---

## Ordem de Implementação

1. **Tarefa 2** (script base) — porque é o core do loop
2. **Tarefa 1** (skill /loop) — porque expõe o script ao Telegram
3. **Tarefa 3** (coleta) — porque tudo precisa guardar resultados
4. **Tarefa 4** (/test) — porque é extensão natural do loop
5. **Tarefa 5** (refatoração) — porque precisa de dados primeiro
