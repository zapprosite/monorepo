---
version: 1.0
author: will-zappro
date: 2026-04-13
---

# Smart Connections - Configuracao Local

Plugin Obsidian para busca semantica via embeddings locais (Ollama).

## Visao Geral

Smart Connections permite consultar o vault usando linguagem natural. Em vez de buscar por palavras-chave, o plugin encontra notas **semanticamente relacionadas** usando vetores de embeddings.

**Stack:**
- **Plugin:** Smart Connections (Obsidian Community)
- **Embeddings:** Ollama local (`nomic-embed-text`)
- **Contexto:** 2048 tokens maximo

---

## 1. Instalacao

### 1.1 Instalar Plugin

1. Abrir Obsidian
2. Settings → Community Plugins → Desativar Safe Mode
3. Buscar "Smart Connections" → Install
4. Enable

### 1.2 Verificar Instalacao

```bash
# Verificar se Ollama esta rodando
curl http://localhost:11434/api/tags

# Listar modelos disponiveis
ollama list
```

O modelo `nomic-embed-text` deve estar presente.

### 1.3 Instalar Modelo de Embeddings

```bash
# Pull do nomic-embed-text (necessario para Smart Connections)
ollama pull nomic-embed-text
```

**Tamanho:** ~274MB

---

## 2. Configuracao

### 2.1 Configurar Embeddings Local

1. Settings → Smart Connections
2. **Embedding Model:** `Ollama`
3. **Ollama Base URL:** `http://localhost:11434`
4. **Model Name:** `nomic-embed-text`
5. **Dimension:** 768 (default nomic-embed-text)

### 2.2 Chunk Size e Overlap

| Parametro | Valor | Descricao |
|-----------|-------|-----------|
| Chunk Size | 512 | Tokens por chunk (artigos longos = menor) |
| Chunk Overlap | 50 | Tokens sobrepostos entre chunks |
| Max Context | 2048 | Contexto maximo do modelo |

**Nota:** Chunk size maior = menos chunks, busca mais rapida. Para documentacao tecnica, 512 funciona bem.

### 2.3 Configurar Pastas a Indexar

1. Settings → Smart Connections → Files
2. **Index these folders:** (incluir)
   - `/` (raiz do vault)
3. **Exclude these folders:** (excluir)
   - `_Daily`
   - `_Templates`
   - `.obsidian`
   - `node_modules`
   - `plugins`

**Exemplo de configuracao yaml:**

```yaml
# .obsidian/smart-connections.json (manual)
{
  "embeddings": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "baseURL": "http://localhost:11434"
  },
  "indexing": {
    "chunkSize": 512,
    "chunkOverlap": 50,
    "excludeFolders": ["_Daily", "_Templates", ".obsidian"]
  }
}
```

---

## 3. Indexacao do Vault

### 3.1 Primeira Indexacao

1. Smart Connections panel (atalho: `Ctrl/Cmd + P` → "Smart Connections: Index vault")
2. Aguardar indexacao completa
3. Status mostra progresso

**Tempo estimado:** Vault com 500 notas ≈ 2-5 minutos

### 3.2 Re-indexacao

- Automatica ao editar notas
- Manual: `Ctrl/Cmd + P` → "Smart Connections: Rebuild index"

### 3.3 Verificar Status

```
Smart Connections panel → Status indicator
- 🟢 Green: Indexado e pronto
- 🟡 Yellow: Indexando
- 🔴 Red: Erro de conexao
```

---

## 4. Consulta via Embeddings

### 4.1 Painel Smart Connections

1. Abrir painel: `Ctrl/Cmd + L` (default)
2. Digitar query em linguagem natural
3. Resultados ordenados por similaridade

### 4.2 Exemplo de Queries

| Query | Retorna |
|-------|---------|
| "como configuro o TTS bridge?" | Notas sobre TTS Bridge |
| "monitoramento Prometheus" | Docs de monitoring |
| "automatizacoes n8n" | Workflows e guias n8n |

### 4.3 Embed in Note

```
Cmd/Ctrl + E (Smart Connections: Insert embedding)
```

Insere link para nota mais similar no ponto atual.

---

## 5. Troubleshooting

### 5.1 Ollama Nao Responde

**Sintoma:** `Error: Cannot connect to Ollama`

```bash
# Verificar se Ollama esta rodando
ps aux | grep ollama

# Reiniciar Ollama
systemctl --user restart ollama

# Ou manual
ollama serve
```

### 5.2 Modelo Nao Encontrado

**Sintoma:** `model not found: nomic-embed-text`

```bash
# Verificar modelos instalados
ollama list

# Instalar se necessario
ollama pull nomic-embed-text
```

### 5.3 Indexacao Lenta

**Sintoma:** Indexacao demora muito

Solucoes:
- Reduzir `chunkSize` para 256
- Excluir mais pastas (node_modules, arquivos binarios)
- Verificar se Ollama tem recursos suficientes (`ollama ps`)

### 5.4 Resultados Irrelevantes

**Sintoma:** Notas similares nao facem sentido

Causas:
- Vault muito pequeno (< 20 notas) - embeddings precisam de contexto
- Chunk size muito grande para conteudo curto
- Indexacao desatualizada

Solucao:
```bash
# Limpar e reindexar
rm -rf .obsidian/smart-connections-index
# Rebuild via painel
```

### 5.5 Memoria Ollama

**Sintoma:** Ollama consome muita RAM

```bash
# Ver consumo
ollama ps

# Limpar modelos carregados
ollama stop nomic-embed-text
```

---

## 6. Performance

| Metrica | Valor |
|---------|-------|
| Embedding por chunk | ~50-100ms (nomic-embed-text) |
| Vault com 500 notas | ~2-5 min indexacao |
| RAM Ollama (idle) | ~500MB |
| RAM Ollama (nomic) | ~1-2GB |

---

## 7. Configuracao Avancada

### 7.1 Variables de Ambiente (Ollama)

```bash
# ~/.bashrc ou /etc/environment
OLLAMA_HOST=0.0.0.0        # Permitir conexoes externas
OLLAMA_MODELS=/srv/data/ollama/models
OLLAMA_NUM_PARALLEL=2     # Requests simultaneas
```

### 7.2 Docker Ollama

```yaml
# docker-compose.yml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    volumes:
      - /srv/data/ollama:/root/.ollama
    ports:
      - "11434:11434"
    restart: unless-stopped
    # Para GPU NVIDIA
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]
```

---

## 8. Referencias

- Plugin: https://obsidian.md/plugins?id=smart-connections
- Ollama: https://ollama.ai
- Nomic Embed Text: https://nomic.ai/blog/nomic-embed-text

---

## 9. Checklist de Setup

- [ ] Ollama instalado e rodando
- [ ] `nomic-embed-text` pullado (`ollama pull nomic-embed-text`)
- [ ] Smart Connections instalado no Obsidian
- [ ] Configurado provider: Ollama / URL: localhost:11434 / Model: nomic-embed-text
- [ ] Chunk size: 512 / Overlap: 50
- [ ] Pastas _Daily e _Templates excluidas
- [ ] Vault indexado
- [ ] Teste: buscar nota relacionada
