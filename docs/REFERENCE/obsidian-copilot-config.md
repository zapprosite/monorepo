# Obsidian Copilot - Configuracao e Integracao

## Estado da Instalacao

**Obsidian Copilot NAO esta instalado** no cofre ~/obsidian-vault/.obsidian/plugins/

O plugin requer instalacao manual via Community Plugins do Obsidian.

---

## Instalacao

1. Abrir **Obsidian → Settings → Community plugins**
2. Desativar **Safe mode** (se ativo)
3. Clicar **Browse**, buscar por **"Copilot for Obsidian"**
4. Clicar **Install**, depois **Enable**
5. Ir em **Settings → Copilot → Basic** e configurar API keys

---

## Configuracao Recomendada

### Modelo: MiniMax via API

O plugin soporta qualquer provedor OpenAI-compatible. Para usar MiniMax:

1. Configurar API key do MiniMax em **Settings → Copilot → Basic → Set Keys**
2. Selecionar **OpenRouter** ou **Custom OpenAI-compatible** como provedor
3. Usar endpoint: `https://api.minimax.io/anthropic/v1`

**Nota:** O modelo MiniMax M2.7 suporta ate 204k tokens de contexto.

### Parametros LLM

| Configuracao | Valor Pesquisa | Valor Criativo |
|--------------|---------------|----------------|
| Temperature  | 0.3           | 0.7            |
| Max Tokens  | 2000          | 2000           |
| Conversation Turns | 15 (default) | 15 (default) |

> **Default do plugin:** Temperature 0.1, Max Tokens 1000
> Ajustar conforme necessario para balancear criatividade e precisao

### Embedding Model (Vault QA)

| Opcao | Uso |
|-------|-----|
| `text-embedding-3-small` | **Recomendado** - OpenAI, bom custo-beneficio |
| Ollama local | Opcao privada e gratuita, mais lento |

**Configuracao:**
1. Ir em **Settings → Copilot → QA/Vault QA**
2. Selecionar embedding model
3. O indexing ocorre automaticamente ao entrar em Vault QA mode

### Project Mode ({folder} syntax)

Project Mode permite criar contexto baseado em pastas e tags:

**Sintaxe:**
```
{01-Projects}      # Pasta especific a
{02-Archive/**}     # Com wildcards
{tag:research}      # Por tag YAML
```

**Configuracao por projeto:**
- Nome e descricao do projeto
- Modelo AI especifico por projeto
- Historico de chat separado por projeto
- Possibilidade de switching entre contextos (trabalho/pessoal/escrita)

### System Prompt (PT-BR Assistant)

Criar prompt personalizado em **Settings → Copilot → Custom Prompts**:

```
# Prompt do Assistant PT-BR

Voce e um assistente de IA que ajuda a gerenciar notas e conhecimento pessoal.
Responda sempre em portugues brasileiro (PT-BR).
Use contexto das notas do cofre para responder duvidas especificas.
Quando necessario, faca referencias diret as notas mencionando titulos com [[ ]].
Mantenha tom profissional mas accesible.
```

---

## Vault QA (Embedding-Based Search)

Vault QA usa RAG (Retrieval-Augmented Generation) para buscar no cofre inteiro:

1. **Embedding model** deve estar configurado
2. **Indexing** ocorre automaticamente ao entrar em Vault QA
3. Para re-indexar manualmente: Command Palette (Ctrl/Cmd + P) → "Refresh Vault Index"
4. Para forcar reindex completo: "Force Reindex Vault"

**Limite de contexto:** 15 conversation turns (default)

**Estr ate gia de Auto-Index:**
- **ON MODE SWITCH (Recomendado)** - Indexa ao trocar para Vault QA
- **NEVER** - Indexacao manual
- **ON STARTUP** - Indexa ao abrir o Obsidian

---

## Integracao com Claude Code (MCP Tools)

### Como Claude Code pode usar Obsidian Copilot

Obsidian Copilot funciona como interface de chat dentro do Obsidian. Para integrar com workflows do Claude Code:

#### 1. Context Sharing via Obsidian

Claude Code pode:
- Ler notas do cofre Obsidian via file system
- Consultar informacoes estruturadas em markdown
- Usar {folder} syntax para referenciar projetos

#### 2. Fluxo de Trabalho Compartilhado

```
Claude Code                    Obsidian Copilot
    |                                |
    |-- Research/dados -->  Escrita em notas
    |                                |
    |<-- Consulta vault  <--  Vault QA mode
    |                                |
    |-- Revisao -->          [[Note]] references
```

#### 3. Recomendacao Pratica

Manter notas em formato limpo com tags YAML frontmatter para facilitar:
- Buscas semanticas via Vault QA
- Project Mode com filtro por tag
- Referencias cruzadas com [[wiki-links]]

---

## Quick Commands (Atalhos)

| Atalho | Funcao |
|--------|--------|
| `Ctrl/Cmd + L` | Adicionar selecao ao contexto do chat |
| `Ctrl/Cmd + K` | Quick Command na selecao |
| `/` | Command Palette no chat |
| Right-click | Edit and Apply with One Click |

---

## FAQ

### Vault search nao encontra notas

1. Verificar se embedding model esta configurado
2. Forcar reindex via Command Palette
3. Nao trocar embedding model apos indexing (quebra resultados)

### Token limit error

- Max tokens refere-se a **completion tokens** (saida), nao input
- Manter mensagens curtas
- Para contexto ilimitado, usar **Vault QA mode**

### API key nao funciona MiniMax

Usar OpenRouter como intermediario:
1. Obter API key do OpenRouter
2. Configurar MiniMax como modelo custom em OpenRouter
3. Ou usar endpoint direto `https://api.minimax.io/anthropic/v1` com provider compatible

---

## Referencias

- Documentacao oficial: https://obsidiancopilot.com/en/docs
- Repository: https://github.com/logancyang/obsidian-copilot
- YouTube: https://www.youtube.com/@loganhallucinates
