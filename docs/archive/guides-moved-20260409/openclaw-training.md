# CEO MIX — Manual de Treinamento

**Data:** 2026-04-07
**Versão:** 1.0
**Baseado em:** 4 agentes de pesquisa + 62K tokens de pesquisa

---

## Prioridades de Treinamento

### CRÍTICO — Fazer Agora

| # | Tarefa | Por que |
|---|---|---|
| 1 | Popular Qdrant (colecoes VAZIAS) | Qdrant = memoria semantica, esta 100% vazio |
| 2 | MEMORY.md ja criado | Referenciado mas nao existia |
| 3 | SOUL.md ja atualizado | Auto-conhecimento infra + Qdrant protocol |
| 4 | REGRA DE OURO aprendida | MiniMax direto, LiteLLM = GPU only |

---

## Sessao 1: Auto-Conhecimento Infra

### Regra de Ouro

```
MODELO PRIMARIO = minimax/MiniMax-M2.7 DIRETO (api.minimax.io)
LITELLM = SOMENTE GPU local (llava, nomic-embed, kokoro-tts, whisper-stt)
NUNCA rotear o modelo primario pelo LiteLLM
```

### Stack Completa

| Capacidade | Provider | Detalhe |
|---|---|---|
| Texto | MiniMax M2.7 | Direto na API, 200K context |
| Visao | llava | Via LiteLLM, GPU local |
| TTS | Kokoro | GPU local, pm_alex (BR masculino) |
| STT | Whisper | Via LiteLLM, GPU local |
| Memory | Qdrant | 4 collections (vazias - popular) |
| Repo | MCP | Read-only /srv/monorepo |

### Endpoints

| Servico | IP:Porta | Do OpenClaw |
|---|---|---|
| Kokoro TTS | `10.0.19.7:8880` | `http://10.0.19.7:8880` |
| LiteLLM | `10.0.1.1:4000` | `http://10.0.1.1:4000` |
| MCP Monorepo | `10.0.19.50:4006` | `http://10.0.19.50:4006` |
| Qdrant | `10.0.19.5:6333` | via skill qdrant-rag |

---

## Sessao 2: Multi-Client Architecture

### Filosofia

Cada cliente existe em seu proprio universo isolado.
Dados de um cliente NAO vazam para outro.

### Estrutura

```
clients/
├── _templates/           # Templates reutilizaveis
│   ├── brief-template.md
│   ├── brand-guide-template.md
│   ├── campaign-template.md
│   └── post-social-media.md
└── [cliente-slug]/    # UM por cliente
    ├── BRIEF.md        # Brief do cliente
    ├── BRAND/
    │   ├── identity.md
    │   ├── colors.md
    │   ├── typography.md
    │   └── voice.md
    ├── CAMPAIGNS/
    │   └── [ano]-[slug]/
    └── memory/
        └── YYYY-MM-DD.md
```

### Onboarding de Novo Cliente

1. Criar diretorio: `clients/[slug]`
2. Copiar templates de `_templates/`
3. Preencher BRIEF.md
4. Indexar no Qdrant (chunk + metadata)
5. Notificar: "Cliente [Nome] criado"

### REGRA DE OURO DO CLIENTE

```
Nunca misturar contexto de um cliente com outro.
Se o Mestre pergunta sobre "ACME",
tudo vem de clients/acme/ e Qdrant
com filter client_id=acme.
```

---

## Sessao 3: Qdrant Memory Protocol

### Collections

| Collection | Conteudo | Filtro |
|---|---|---|
| `clients-briefs` | Todos os briefs | client_id |
| `clients-brand-guides` | Guias de marca | client_id, section |
| `clients-campaigns` | Campanhas | client_id, status |
| `clients-knowledge` | Conhecimento | category, tags |

### Metadata Obrigatoria por Chunk

```json
{
  "client_id": "[slug]",
  "doc_type": "brief|brand_guide|campaign|knowledge",
  "version": "1.0",
  "created_at": "2026-04-07",
  "chunk_index": 1,
  "total_chunks": 3
}
```

### Regras

- Chunk: ~500 tokens, 50 tokens overlap
- NUNCA upsert PII (CPF, telefone, email) no Qdrant
- Upsert PII: PostgreSQL futuro
- Atualizar = upsert novo + marcar antigo deleted=true

### Como Responder sobre Cliente

```
1. Query Qdrant: search(query, collection=X, filter client_id=Y)
2. Incluir contexto na resposta
3. Se vazio: "Nao tenho isso indexado. Quer adicionar?"
4. Apos criar/atualizar: oferer "Indexo no Qdrant?"
```

---

## Sessao 4: Escalation

| Pergunta | Resposta |
|---|---|
| Infra/Docker/ZFS | "Rode 'c' no terminal do host para acionar Claude Code" |
| Segredos/credenciais | "Nao tenho acesso. Use vault.zappro.site" |
| Dev/codigo | "Posso buscar no monorepo (read-only). Para editar: Claude Code." |

---

## Sessao 5: TTS e Voice

### Regras

- Usa TTS: confirmacoes, status curto (<20 palavras)
- Pula TTS: respostas longas, codigo, URLs, dados estruturados
- Imagem: SEMPRE texto, nunca auto-TTS

### Teste

```bash
curl -X POST "http://10.0.19.7:8880/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Ola, tudo bem?","voice":"pm_alex"}'
```

---

## Proximos Passos (Acao Imediata)

### Fase 1: Popular Qdrant

```
Prioridade 1: Indexar templates em clients-knowledge
  -> 5 templates em clients/_templates/
  -> Chunk ~500 tokens
  -> Metadata: doc_type=template, category=templates

Prioridade 2: Indexar SOUL.md + IDENTITY.md + AGENCY-RULES.md
  -> collection=openclaw-memory
  -> chunks por secao

Prioridade 3: Criar primeiro cliente de teste
  -> clients/acme-001/
  -> Preencher BRIEF.md do template
  -> Indexar
```

### Fase 2: Habilidades a Desenvolver

```
1. ingest_folder: indexar todos .md de um cliente de uma vez
2. upsert_with_filter: insert + delete old versions atomico
3. context_injection: dado tipo de pergunta, carregar contexto automaticamente
```

---

## Referencia Rapida

### Arquivos de Auto-Conhecimento

| Arquivo | O que faz | Carrega |
|---|---|---|
| SOUL.md | Identidade, regras, Qdrant protocol | Toda sessao |
| IDENTITY.md | Nome, stack, personalidade | Toda sessao |
| MEMORY.md | Memoria longo prazo do CEO MIX | Sessao principal |
| TOOLS.md | Endpoints, REGRA DE OURO | Reference |
| USER.md | Perfil do Mestre | Toda sessao |
| AGENTS.md | Protocolo de sessao, heartbeats | Toda sessao |
| architecture/AGENCY-RULES.md | Multi-client, isolation | Quando opera cliente |
| architecture/SELF-KNOWLEDGE.md | Infra completa | Deep reference |

### Skills

| Skill | Funcao |
|---|---|
| qdrant-rag | Semantic search + index |
| openclaw-repo-hunter | Busca OSS no GitHub |
| monorepo-explorer | Read-only /srv/monorepo |
