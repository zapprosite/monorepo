# Skill: vision-local

**Alias:** `/img`

**Description:** Analisa imagens usando Qwen2.5-VL local via Ollama. Envia a imagem para `qwen2.5vl:7b` em `localhost:11434` e retorna a descrição em português.

**Quando usar:** Quando o utilizador enviar uma imagem ou mencionar "analisa esta imagem", "o que é isto", "describe a tela", etc.

**Input:** Caminho para ficheiro de imagem (PNG, JPG, WEBP, etc.)

**Output:** Descrição textual da imagem em português brasileiro.

**Como funciona:**
1. Recebe o caminho da imagem
2. Faz encode base64
3. Envia para Ollama Qwen2.5-VL
4. Retorna a descrição

**Exemplo de uso:**
```
/img /home/will/Desktop/screenshot.png
```

**Fallback:** Se Qwen2.5-VL não responder, tenta com Gemma4 (text-only se não houver imagem).

**Timing:** Timeout 60s para imagens grandes.
