# Skill: vision-local

**Alias:** `/img`

**Description:** Analisa imagens usando Qwen3-VL local via Ollama. Envia a imagem para `Qwen3-VL-8B-Instruct` em `localhost:11434` e retorna a descrição em português.

**Quando usar:** Quando o utilizador enviar uma imagem ou mencionar "analisa esta imagem", "o que é isto", "describe a tela", etc.

**Input:** Caminho para ficheiro de imagem (PNG, JPG, WEBP, etc.)

**Output:** Descrição textual da imagem em português brasileiro.

**Como funciona:**

1. Recebe o caminho da imagem
2. Faz encode base64
3. Envia para Ollama Qwen3-VL
4. Retorna a descrição

**Exemplo de uso:**

```
/img /home/will/Desktop/screenshot.png
```

**Fallback:** Se Qwen3-VL não responder, tenta com Gemma4-12b-it (text-only se não houver imagem).

**Timing:** Timeout 60s para imagens grandes.
