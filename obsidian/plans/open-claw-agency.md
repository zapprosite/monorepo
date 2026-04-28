# Plano: OpenClaw Agency Hub — Design & Marketing

**Data:** 2026-04-05 | **Host:** will-zappro | **Bot:** @CEO_REFRIMIX_bot

## Contexto

O bot OpenClaw Telegram funciona com MiniMax M2.7 direto. O host tem 37 containers rodando (Qdrant, Supabase, LiteLLM, Open WebUI, Firefox, N8N, Kokoro TTS, Ollama GPU, etc). O objetivo e transformar o bot em hub de agencia de design/marketing com: embeddings locais via Nomic → Qdrant, time de agents especializados, vault Obsidian, e dashboard de monitoramento.

---

## FASE 1: Pipeline de Embeddings (Nomic → LiteLLM → Qdrant)

### 1.1 Testar embeddings via LiteLLM
```bash
curl -s http://10.0.1.1:4000/v1/embeddings \
  -H "Authorization: Bearer ${LITELLM_KEY}" \
  -d '{"model":"embedding-nomic","input":"teste de embedding"}'
```

### 1.2 Criar 4 collections no Qdrant (dim 768 = nomic-embed-text)
- `clients` — briefs, preferencias, historico
- `brand-guides` — cores, fontes, identidade visual
- `campaigns` — campanhas, metricas, resultados
- `knowledge` — documentacao, processos, templates

```bash
# De dentro do container (mesma rede Docker)
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f curl -s -X PUT \
  http://qdrant-c95x9bgnhpedt0zp7dfsims7:6333/collections/knowledge \
  -H "api-key: vmEbyCYrU68bR7lkzCbL05Ey4BPnTZgr" \
  -H "Content-Type: application/json" \
  -d '{"vectors":{"size":768,"distance":"Cosine"}}'
# Repetir para clients, brand-guides, campaigns
```

### 1.3 Snapshot ZFS antes de prosseguir
```bash
sudo zfs snapshot -r "tank@pre-$(date +%Y%m%d-%H%M%S)-agency-setup"
```

**Decisao:** NAO usar plugin `memory-lancedb` (hardcoded para dim 1536/3072). Criar skill customizada `qdrant-rag`.

---

## FASE 2: Skill customizada `qdrant-rag`

### 2.1 Criar skill no workspace do bot
**Arquivo:** `/data/workspace/skills/qdrant-rag/SKILL.md`

Funcionalidade:
- Embed texto via LiteLLM (`embedding-nomic`, 768 dims)
- Search semantico no Qdrant (collections: clients, brand-guides, campaigns, knowledge)
- Upsert de novos documentos
- Tudo via tools nativos `exec` + `web_fetch` (sem binario externo)

### 2.2 Script helper
**Arquivo:** `/data/workspace/scripts/qdrant-helper.sh`
- Funcoes: `embed()`, `search()`, `upsert()`, `ingest_folder()`
- Bot invoca via tool `exec`

### 2.3 Indexar workspace existente
- Ler todos os `.md` do workspace
- Chunkar em blocos de ~500 tokens
- Gerar embeddings via LiteLLM
- Inserir no Qdrant collection `knowledge`

---

## FASE 3: Conectar servicos como tools

### Servicos ja acessiveis (mesma rede):
| Servico | Endpoint (de dentro do container) |
|---|---|
| Qdrant | `qdrant-c95x9bgnhpedt0zp7dfsims7:6333` |
| LiteLLM | `10.0.1.1:4000` |
| Kokoro TTS | `10.0.19.6:8880` |
| SearXNG | `10.0.1.1:8888` |

### Servicos em rede separada (precisam bridge):
```bash
# Conectar Supabase Postgres a rede do OpenClaw
docker network connect qgtzrmi6771lt8l7x8rqx72f ll01e4eis7wog1fnbzomc6jv
```

### NAO conectar (interface humana, sem valor como tool):
- Open WebUI (UI para humanos)
- Firefox VNC (uso manual)

### Atualizar TOOLS.md no workspace
Documentar todos os endpoints com auth para o bot consultar.

---

## FASE 4: Vault Obsidian (no workspace existente)

**Decisao:** NAO instalar skill `obsidian` (requer Linuxbrew no container, pesado). Usar tools nativos `read`/`write` + Qdrant para busca semantica.

### 4.1 Reorganizar workspace como vault
```
/data/workspace/
├── .obsidian/              # Config minima (compativel com Obsidian desktop via SSH mount)
├── 00-inbox/               # Novos documentos
├── 01-clients/             # Por cliente
│   └── cliente-nome/
│       ├── brief.md
│       └── brand-guide.md
├── 02-campaigns/           # Campanhas ativas
├── 03-templates/           # Templates reutilizaveis
│   ├── brief-template.md
│   ├── campaign-template.md
│   └── brand-guide-template.md
├── 04-knowledge/           # Base de conhecimento
├── architecture/           # Ja existe
├── memory/                 # Ja existe
├── skills/                 # Ja existe
└── scripts/                # Helpers
```

### 4.2 Criar templates de agencia
- Brief de cliente
- Campanha de marketing
- Brand guide
- Calendario editorial
- Post social media

---

## FASE 5: Time de Agentes Especializados

### Arquitetura
CEO MIX (main) orquestra e delega para 4 subagents:

| Agente | Especialidade | Modelo |
|---|---|---|
| `creative` | Copywriting, headlines, textos, AIDA/PAS | minimax/MiniMax-M2.7 |
| `design` | Briefs visuais, brand guides, analise de imagem (llava) | minimax/MiniMax-M2.7 |
| `social` | Calendario editorial, tendencias, timing, publicacao | minimax/MiniMax-M2.7 |
| `project` | Gestao de tarefas, timeline, status reports | minimax/MiniMax-M2.7 |

### 5.1 Criar agentes
```bash
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f openclaw agents add creative \
  --workspace /data/workspace/agents/creative --model "minimax/MiniMax-M2.7"
# Repetir para design, social, project
```

### 5.2 SOUL.md de cada agente
Cada agente recebe system prompt especializado com:
- Papel e expertise
- Tom de voz
- Tools que deve usar (qdrant-rag, web_search, browser, etc)
- Limites (nao publicar sem aprovacao do CEO MIX)

### 5.3 Routing
CEO MIX permanece como unico ponto de contato no Telegram. Ele delega via subagents (maxConcurrent=4, subagents=8 ja configurado).

---

## FASE 6: Dashboard OpenClaw-bot-review

### 6.1 Clonar repo
```bash
cd /home/will && git clone https://github.com/xmanrui/OpenClaw-bot-review.git
```

### 6.2 Deploy via Coolify
- Recurso: Public Repository
- URL: `https://github.com/xmanrui/OpenClaw-bot-review`
- Build: Nixpacks (Next.js auto)
- Env: Gateway URL + token do OpenClaw
- **Porta:** Verificar PORTS.md (sugestao: 4010+)
- **Subdominio:** Verificar SUBDOMAINS.md (sugestao: `agents.zappro.site`)

---

## FASE 7: Skills adicionais

### Instalar via ClawHub:
| Skill | Uso |
|---|---|
| `github` | Integracao Gitea (API compatible) |
| `coding-agent` | Gerar codigo/automacoes |
| `video-frames` | Extracao de frames para analise |
| `model-usage` | Monitorar custo de tokens |

### NAO instalar agora:
- Slack/Discord/WhatsApp (canais nao ativos)
- Apple Notes/Bear (macOS only)
- Obsidian skill (substituida por vault + tools nativos)

---

## Sequencia de Execucao

```
Dia 1-2:  FASE 1 — Pipeline embeddings + collections Qdrant
Dia 2-3:  FASE 2 — Skill qdrant-rag + ingestao
Dia 3-4:  FASE 3 — Conectar servicos (Supabase bridge)
Dia 4:    FASE 4 — Vault structure + templates
Dia 5-7:  FASE 5 — Agents especializados + SOUL.md + testes
Dia 7-8:  FASE 6 — Dashboard deploy
Dia 8-10: FASE 7 — Skills extras + documentacao
```

## Riscos

| Risco | Mitigacao |
|---|---|
| memory-lancedb incompativel com nomic (768 dims) | Usar skill customizada qdrant-rag |
| Supabase em rede separada | `docker network connect` |
| Tokens MiniMax caros para subagents | Considerar gemma4 local para subagents |
| Container sem obsidian-cli | Nao instalar — usar tools nativos |
| Dashboard incompativel com OpenClaw 2026.2.6 | Testar local antes de Coolify |

## Verificacao

Apos cada fase:
1. Snapshot ZFS
2. Testar funcionalidade end-to-end via Telegram
3. Verificar logs: `docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f --tail 20`
4. Confirmar que modelo primario continua `minimax/MiniMax-M2.7`

---

**Arquivos criticos:**
- Container: `/data/.openclaw/openclaw.json` — config principal
- Host: `/home/will/zappro-lite/config.yaml` — LiteLLM config
- Host: `/srv/ops/ai-governance/OPENCLAW_DEBUG.md` — guia de debug
- Rule: `~/.claude/rules/openclaw-litellm-governance.md` — guardrails

---

## REGRA DE OURO (para qualquer LLM)

```
MODELO PRIMARIO = minimax/MiniMax-M2.7 DIRETO (api.minimax.io)
LITELLM = SOMENTE proxy GPU (llava, gemma4, nomic, kokoro-tts)
NUNCA rotear o modelo primario pelo LiteLLM
```
