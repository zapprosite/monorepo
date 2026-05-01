# Skill: LiteLLM Voice & Vision — Via Telegram

**Para criar este skill no OpenClaw via Telegram:**

1. Abre o Telegram e vai ao bot `@CEO_REFRIMIX_bot`
2. Envia: `/skill_creator`
3. O bot vai guiar o processo — descreve:

---

## Prompt para o Skill Creator

```
Cria um skill chamado "lite-llm-voice" com esta descrição:
"Usa modelos LiteLLM para TTS (Kokoro), STT (wav2vec2), Vision (qwen2.5-vl) e LLM (tom-cat-8b PT-BR)"

O skill deve poder:
- Sintetizar voz com Kokoro TTS (vozes pm_santa, pm_alex, pf_dora)
- Transcrever audio com whisper-1 (wav2vec2)
- Analisar imagens com qwen2.5-vl
- Responder em PT-BR com tom-cat-8b

Usa sempre o endpoint http://localhost:4000/v1 com a API key ${LITELLM_KEY}

Os modelos disponíveis são:
- tts-1 (Kokoro) para síntese de voz
- whisper-1 (wav2vec2) para transcrição
- qwen2.5-vl para visão
- tom-cat-8b para LLM em português
```

---

## Após criar via Telegram

O skill vai aparecer em `/data/workspace/skills/lite-llm-voice/SKILL.md`.

## Ou criar manualmente

Se preferir criar direto, edita o ficheiro:

```bash
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f sh -c 'mkdir -p /data/workspace/skills/lite-llm-voice && cat > /data/workspace/skills/lite-llm-voice/SKILL.md << "EOF"
# Skill: LiteLLM Voice & Vision

... conteúdo do skill ...
EOF'
```
