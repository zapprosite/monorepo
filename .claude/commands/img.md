---
description: Analisa imagem com Qwen2.5-VL local via Ollama.
---

Analisa imagem com Qwen3-VL local via Ollama.

Uso: `/img <caminho-da-imagem>`

Exemplos:

- `/img /home/will/Desktop/screenshot.png`
- `/img /tmp/print.png`

Processo:

1. Verifica se Ollama está acessível (localhost:11434)
2. Verifica se Qwen3-VL-8B-Instruct está disponível
3. Faz encode base64 da imagem
4. Envia para Qwen3-VL via POST /api/generate
5. Retorna a descrição em português

Se a imagem não existir ou Qwen3-VL falhar, reporta o erro específico.
