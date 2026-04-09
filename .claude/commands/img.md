---
description: Analisa imagem com LLaVA local via Ollama.
---

Analisa imagem com LLaVA local via Ollama.

Uso: `/img <caminho-da-imagem>`

Exemplos:
- `/img /home/will/Desktop/screenshot.png`
- `/img /tmp/print.png`

Processo:
1. Verifica se Ollama está acessível (localhost:11434)
2. Verifica se llava:latest está disponível
3. Faz encode base64 da imagem
4. Envia para LLaVA via POST /api/generate
5. Retorna a descrição em português

Se a imagem não existir ou LLaVA falhar, reporta o erro específico.
