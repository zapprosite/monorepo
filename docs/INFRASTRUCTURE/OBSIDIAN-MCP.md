# Obsidian MCP - Integracao Claude Code

> **Data:** 2026-04-13
> **Objetivo:** Conectar Claude Code CLI ao vault Obsidian via MCP tools
> **Servidor:** [@blacksmithers/obsidian-forge-mcp](https://github.com/blacksmithers/obsidian-forge-mcp) v0.5.3
> **Vault:** `/home/will/obsidian-vault`

---

## Visao Geral

O obsidian-forge-mcp e o servidor MCP mais capaz para Obsidian, com **27 ferramentas** incluindo:

- **Notas:** read, write, edit, append, delete
- **Busca:** smart_search (BM25 rankeado), search_vault, search_content, recent_notes, daily_note
- **Canvas:** create, read, patch, relayout (auto-layout com dagre)
- **Inteligencia:** vault_themes (TF-IDF), vault_suggest (reorganizacao)
- **Links:** update_links, backlinks
- **Batch:** operacoes em lote

**Diferencial:** Nao requer plugin Obsidian - opera diretamente no filesystem.

---

## instalacao

```bash
npm install -g @blacksmithers/obsidian-forge-mcp
```

Verificacao:
```bash
obsidian-forge --help
# Output: [obsidian-forge] Starting...
#         [obsidian-forge] Vault: --help
#         Connected via stdio
```

---

## Configuracao ~/.mcp.json

Adicionar ao `mcpServers`:

```json
{
  "mcpServers": {
    // ... outros servers ...
    "obsidian": {
      "command": "node",
      "args": ["/home/will/.npm-global/lib/node_modules/@blacksmithers/obsidian-forge-mcp/dist/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/home/will/obsidian-vault"
      }
    }
  }
}
```

**Atencao:** Nao usar `obsidian-forge` diretamente como command - o binario symlink nao funciona bem com Claude Code. Usar o path direto para `dist/index.js`.

---

## Ferramentas Disponiveis

### Notas (6)

| Tool | Funcao |
|------|--------|
| `read_note` | Ler conteudo + metadados. Fuzzy path resolution. |
| `write_note` | Criar ou sobrescrever nota. |
| `edit_note` | Find-replace in-place. Exact match. |
| `edit_regex` | Regex find-replace. Single file ou grep-sub no vault. |
| `append_note` | Anexar a existente, ou criar se nao existe. |
| `delete_note` | Mover para `.trash` (seguro) ou permanente. |

### Busca e Descoberta (8)

| Tool | Funcao |
|------|--------|
| `smart_search` | **BM25 rankeado.** Typo tolerance, field boosting, snippets. |
| `search_reindex` | Forcar reindex apos operacoes em lote. |
| `search_vault` | Busca rapida por nome/path do indice em memoria. |
| `search_content` | Full-text grep. Para matches literais/exatos. |
| `list_dir` | Listagem de diretorio com timestamps. Sort por nome, data ou tamanho. |
| `recent_notes` | Arquivos modificados recentemente. Instant do indice. |
| `daily_note` | Nota diaria (ou qualquer data). |
| `vault_status` | Contagem de arquivos, tipos, saude do indice. |

### Arquivos (3)

| Tool | Funcao |
|------|--------|
| `batch_rename` | Renomear/mover arquivos. Pares explicitos ou regex. Auto-updates wikilinks. Dry run default. |
| `delete_folder` | Deletar diretorios vazios ou nao-vazios. Move para `.trash` por default. Safety guards para `.obsidian`, `.git`, `.trash`. |
| `prune_empty_dirs` | Encontrar e remover todos diretorios vazios. Dry run default. |

### Links (2)

| Tool | Funcao |
|------|--------|
| `update_links` | Atualizar todos wikilinks no vault apos mover/renomear. Dry run default. |
| `backlinks` | Encontrar todos arquivos que linkam para um arquivo. Line numbers, context, embed detection. |

### Metadata (1)

| Tool | Funcao |
|------|--------|
| `frontmatter` | Ler/escrever/merge YAML frontmatter como dados estruturados. |

### Canvas (4)

| Tool | Funcao |
|------|--------|
| `canvas_create` | Grafo semantico → `.canvas` auto-layout via dagre. |
| `canvas_read` | Canvas → grafo semantico (labels + conexoes, nao coordenadas). |
| `canvas_patch` | Adicionar/remover/atualizar com posicao relativa + fuzzy matching. |
| `canvas_relayout` | Re-layout canvas existente. Preview antes de commitar. |

### Inteligencia (2)

| Tool | Funcao |
|------|--------|
| `vault_themes` | Extracao de temas TF-IDF + clustering. Atlas do vault com warnings cross-folder. |
| `vault_suggest` | Engine de reorganizacao: consolidar, criar MOCs, arquivar stale, triar orphans. |

### Batch (1)

| Tool | Funcao |
|------|--------|
| `batch` | Executar multiplas operacoes - read, write, edit, regex, rename, frontmatter, delete. |

---

## Uso com Claude Code

### Listar arquivos do vault

```
List the files in my vault
```

### Busca inteligente

```
Search my vault for notes about "terraform cloudflare"
```

### Ler nota especifica

```
Read the note at 00-Inbox/daily-2026-04-13.md
```

### Criar nova nota

```
Create a new note at 01-Projects/quantum-dispatch.md with content:
# Quantum Dispatch

## Status
- [ ] Phase 1: Bootstrap
- [ ] Phase 2: Implementation
```

### Nota diaria

```
Create today's daily note in _Daily folder
```

### Canvas visual

```
Create a canvas showing the architecture: API Gateway → Auth Service → Database, with Cache also connecting to Database
```

---

## Estrutura do Vault

```
/home/will/obsidian-vault/
├── 00-Inbox/          # Entrada de notas
├── 01-Projects/        # Projetos ativos
├── 02-Areas/           # Areas de responsabilidade
├── 03-Resources/       # Recursos e referencias
├── 04-Archives/        # Arquivos mortos
├── _Daily/             # Notas diarias (templated)
├── _MOC/               # Maps of Content
├── _Templates/         # Templates de notas
├── AI-PROMPTS.md       # Prompts de IA
├── INDEX.md            # Indice principal
└── README.md           # Readme do vault
```

---

## Alternativas Consideradas

| Package | Version | Pros | Contras |
|---------|---------|------|---------|
| `obsidian-mcp-server` (cyanheads) | 2.0.7 | Funcionalidades basicas OK | Nao tem canvas, smart search, intelligence |
| `@zethictech/obsidian-mcp` | 1.1.6 | CLI wrapper oficial | Funcionalidades limitadas |
| `@blacksmithers/obsidian-forge-mcp` | 0.5.3 | **27 tools, BM25, canvas, vault intelligence** | Mais pesado (~95 packages) |

**Escolha:** obsidian-forge-mcp - unico com smart search rankeado, canvas support, e vault intelligence.

---

## Troubleshooting

### "Vault not found" ou index vazio

```bash
# Verificar se o vault existe e tem .obsidian
ls -la /home/will/obsidian-vault/

# Reindexar manualmente
# O servidor reindexa automaticamente, mas forcar se vazio
```

### symlink "command not found"

Se `obsidian-forge` nao funcionar como command, usar path direto:

```json
{
  "command": "node",
  "args": ["/home/will/.npm-global/lib/node_modules/@blacksmithers/obsidian-forge-mcp/dist/index.js"]
}
```

### Permissao negada ao criar notas

```bash
# Verificar permissoes do vault
ls -la /home/will/obsidian-vault/

# Corrigir se necessario
chmod 755 /home/will/obsidian-vault/
chmod +w /home/will/obsidian-vault/**/*
```

---

## Referencias

- [obsidian-forge-mcp GitHub](https://github.com/blacksmithers/obsidian-forge-mcp)
- [NPM Package](https://www.npmjs.com/package/@blacksmithers/obsidian-forge-mcp)
- [JSON Canvas Spec](https://jsoncanvas.org/)
- [Orama BM25](https://github.com/oramasearch/orama)
- [Dagre Layout](https://github.com/dagrejs/dagre)

---

## Autor

GPT (@will-zappro) - 2026-04-13
