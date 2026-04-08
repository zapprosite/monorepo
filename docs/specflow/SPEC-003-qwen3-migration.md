# SPEC-003: Migrar Gemma4 → Gemma2-9B-IT (Q4_K_M GGUF)

## Status: CONCLUIDO (08/04/2026)

## Decisão Final

**Modelo instalado:** `gemma2-9b-it:q4` (instruction tuned, 5.8GB VRAM)
**Motivo:** gemma4:datacenter-20260407 foi removido da Ollama library. gemma2-9b-it Q4_K_M GGUF importado do HuggingFace.

**Descartado:**
- qwen3:14b — não seguia instrucoes de "zero comentário"
- gemma4 base — não é instruction tuned
- mistral-7b-ft — não existe no Ollama library

## Tech Stack

- **GPU:** RTX 4090 24GB (water cooled)
- **VRAM:** ~19.5GB usado, ~5GB livre
- **Ollama:** localhost:11434
- **Model:** gemma2-9b-it:q4 (5.8GB, Q4_K_M)

## Instalação

1. Download GGUF: `hf download zhezhe/gemma-2-9b-it-Q4_K_M-GGUF gemma-2-9b-it-q4_k_m.gguf`
2. Create Modelfile: `/tmp/gguf_models/Modelfile.gemma2-9b-it`
3. Import: `ollama create gemma2-9b-it:q4 -f Modelfile.gemma2-9b-it`

## Config (Modelfile)

```
FROM /tmp/gguf_models/gemma-2-9b-it-q4_k_m.gguf
TEMPLATE "{{ if .System }}{{ .System }}\n{{ end }}{{ .Prompt }}"
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER repeat_penalty 1.1
SYSTEM """Você é um assistente de IA prestativo e útil."""
```

## Testes Voice Pipeline

```
IN: vc que sabe pq o bug ta foda
OUT: Você que sabe porque o bug está fod**.

IN: to fazendo o deploy no cloud e o stakeholder ficou happy
OUT: Estou fazendo o deploy na nuvem e o stakeholder ficou satisfeito.

IN: preciso dar um pull no repo
OUT: preciso dar um pull no repositório.
```

## Scripts Actualizados

Todos actualizados para gemma2-9b-it:q4:
- /home/will/Desktop/voice-pipeline/scripts/voice.sh
- /home/will/Desktop/voice-pipeline/scripts/screenshot.sh
- /home/will/Desktop/voice-pipeline/scripts/jarvis-read-screen.sh
- /home/will/.local/bin/voice-pipeline.sh
- /home/will/Desktop/jarvis-assistant/scripts/command-mode.sh
- /srv/ops/agents/scripts/lib.sh
- /srv/ops/agents/scripts/llm_agent.sh
- /srv/ops/agents/config/agents.yaml
- /srv/ops/agents/config/services.yaml

## System Prompt Voice Pipeline

```
Você é um editor de texto brasileiro. NUNCA explique. NUNCA escreva Prefácio.
Output = ONLY texto corrigido, ZERO mais.
```
