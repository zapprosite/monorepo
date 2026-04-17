# Skill: LiteLLM Voice & Vision — Via Telegram

**Para criar este skill no Hermes Agent via Telegram:**

1. Abre o Telegram e vai ao bot `@CEO_REFRIMIX_bot`
2. Envia: `/skill_creator`
3. O bot vai guiar o processo — descreve:

---

## Prompt para o Skill Creator

```
Cria um skill chamado "lite-llm-voice" com esta descrição:
"Usa modelos LiteLLM para TTS (Kokoro), STT (faster-whisper), Vision (qwen2.5vl:7b) e LLM (Gemma4-12b-it PT-BR)"

O skill deve poder:
- Sintetizar voz com Kokoro TTS (vozes pm_santa, pm_alex, pf_dora)
- Transcrever audio com whisper-1 (faster-whisper)
- Analisar imagens com qwen2.5vl:7b
- Responder em PT-BR com Gemma4-12b-it

Usa sempre o endpoint http://localhost:4000/v1 com a API key [LITELLM_API_KEY]

Os modelos disponíveis são:
- tts-1 (Kokoro) para síntese de voz
- whisper-1 (faster-whisper) para transcrição
- qwen2.5vl:7b para visão
- Gemma4-12b-it para LLM em português
```

---

## Após criar via Telegram

O skill vai aparecer em `/data/workspace/skills/lite-llm-voice/SKILL.md`.

## Ou criar manualmente

Se preferir criar direto, edita o ficheiro:

```bash
docker exec Hermes Agent-qgtzrmi6771lt8l7x8rqx72f sh -c 'mkdir -p /data/workspace/skills/lite-llm-voice && cat > /data/workspace/skills/lite-llm-voice/SKILL.md << "EOF"
# Skill: LiteLLM Voice & Vision

... conteúdo do skill ...
EOF'
```
