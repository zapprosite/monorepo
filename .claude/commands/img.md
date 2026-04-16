---
description: Analisa imagem com Qwen2.5-VL local via Ollama.
---

Analisa imagem com qwen2.5vl:7b local via Ollama.

Uso: `/img <caminho-da-imagem>`

Exemplos:

- `/img /home/will/Desktop/screenshot.png`
- `/img /tmp/print.png`

Processo:

1. Verifica se Ollama está acessível (localhost:11434)
2. Verifica se qwen2.5vl:7b está disponível
3. Faz encode base64 da imagem
4. Envia para qwen2.5vl:7b via POST /api/generate
5. Retorna a descrição em português

Se a imagem não existir ou qwen2.5vl:7b falhar, reporta o erro específico.
