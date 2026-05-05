# SPEC-300 — Monorepo Mínimo Viável: Exclusão em Massa de Obsoletos

**Data:** 2026-05-04
**Autor:** SRE Dev Senior (will-zappro)
**Status:** DRAFT → Aprovação para execução
**Motivação:** Chegada na empresa, análise da dívida técnica do junior anterior. Repositório com excesso de arquivos, apps duplicadas, specs mortas, e documentação desatualizada.

---

## 1. Diagnóstico: O que está errado

O monorepo `/srv/monorepo` acumulou **dívida técnica de junior** ao longo de meses:

- **Apps fantasmas:** `perplexity-agent`, `hvac-manual-downloader`, `list-web`, `obsidian-web`, `painel-organism`, `orchestrator` (tudo duplicado ou legado)
- **Docs salada:** SPECs mortas, guias desatualizados, referências a serviços extintos
- **Arquivos órfãos:** `.streamlit`, `uv.lock` (1MB+), `node_modules` versionados, logs
- **Múltiplos gateways LLM:** LiteLLM (:4018), ai-gateway (:4002 com chat), OpenRouter direto, Groq direto — tudo conflitando
- **Configs legadas:** `apps/perplexity-agent/` com `config.py` apontando para Infisical, `browser_agent.py` chamando OpenRouter direto
- **Pasta `obsidian/` espelho:** Duplicação de docs já existentes em `docs/`

**Resultado:** 180 arquivos modificados no último `git diff`, 641 referências a portas/aliases legados espalhadas por docs.

---

## 2. O que é CORE (manter)

Regra: Se não estiver nesta lista, é candidato a remoção.

| Componente | Path | Função | Status |
|-----------|------|--------|--------|
| **CRM** | `apps/api/` + Coolify | Sistema de CRM em produção | ✅ Estável |
| **OpenWebUI** | Coolify container `openwebui-hvac` | Chat interface para HVAC | ✅ Estável |
| **FAQ / RAG** | `scripts/hvac-rag/`, Qdrant collection `hvac_manuals_v1` | Pipeline de RAG com embeddings | ✅ Estável |
| **Hermes Agents** | `services/orchestrator/` (container `task-orchestrator`) | Orquestração de agentes + memória | ✅ Estável |
| **Gitea** | `gitea` (:3300) | Git hosting + CI/CD | ✅ Estável |
| **Coolify** | `coolify` (:8000) | PaaS para deploys | ✅ Estável |
| **LiteLLM** | `litellm-proxy` (:4018/v1) | Gateway LLM único | ✅ Estável |
| **Voice Gateway** | `ai-gateway` (:4002) | TTS + STT | ✅ Estável |
| **Qdrant** | `qdrant` (:6333) | Vector DB | ✅ Estável |
| **Ollama** | systemd (:11434) | LLM local (Qwen, Nomic) | ✅ Estável |
| **Hermes Second Brain** | `/srv/hermes-second-brain/` | Memória persistente + tasks | ✅ Estável |
| **Nexo / SRE** | `scripts/nexus-*.sh`, `scripts/sre-check.sh` | Automação SRE | ✅ Estável |

---

## 3. O que é LIXO (remover)

### 3.1 Apps — Prune Total

| App | Motivo da remoção |
|-----|-------------------|
| `apps/perplexity-agent/` | Legado. Hermes já faz browser automation. Streamlit nunca deployado. |
| `apps/hvac-manual-downloader/` | One-time script mascarado como app. Lógica movida para `scripts/hvac-rag/`. |
| `apps/list-web/` | Static HTML lista de tools. Integrar no `apps/web` principal. |
| `apps/obsidian-web/` | Vault viewer. Integrar no `apps/web` principal. |
| `apps/painel-organism/` | Dashboard React fragmentado. Integrar no `apps/web` principal. |
| `apps/orchestrator/` | Duplicado de `services/orchestrator/`. Pasta vazia. |

### 3.2 Docs — Prune Agressiva

| Categoria | Ação |
|-----------|------|
| `docs/SPECS/` | Mover specs de apps removidas para `docs/SPECS-dead/` |
| `docs/INCIDENTS/` | Manter, mas adicionar header: "[APP REMOVIDO 2026-05-04]" |
| `obsidian/` | **Apagar completamente.** É espelho de `docs/`. Source of truth é `docs/`. |
| `docs/REFERENCE/painel-context.md` | Apagar. App removido. |
| `docs/SPECS/SPEC-115-painel-organism.md` | Mover para `SPECS-dead/`. |
| `docs/SPECS/SPEC-033-hvac-manual-browser-use-agent.md` | Mover para `SPECS-dead/`. |

### 3.3 Arquivos Órfãos

| Arquivo/Padrão | Ação |
|----------------|------|
| `apps/*/uv.lock` | Apagar (gerado automaticamente, não versionar) |
| `apps/*/.streamlit/` | Apagar (config legada Streamlit) |
| `apps/*/.python-version` | Apagar (sem uso) |
| `apps/*/trigger-workflow.txt` | Apagar (arquivo vazio) |
| `apps/*/e2e/` (vazio) | Apagar |
| `apps/archived/` | Mover conteúdo para `archive/` na raiz e apagar pasta |
| `pnpm-lock.yaml` entries de apps removidas | `pnpm install` para regenerar |

### 3.4 Configs Obsoletas no `.env`

| Variável | Ação |
|----------|------|
| `OPENROUTER_MODEL`, `OPENROUTER_API_BASE` | Remover. LiteLLM gerencia aliases. |
| `STT_PROXY_URL=http://localhost:8204` | Remover. STT agora é Groq cloud. |
| `WHISPER_MEDIUM_PORT=8204` | Remover. Whisper local extinto. |
| `OLLAMA_URL` duplicado de `OLLAMA_BASE_URL` | Consolidar em uma só. |

---

## 4. Arquitetura Alvo — Mínimo Viável

```
srv/monorepo/
├── apps/
│   ├── api/                    # CRM + backend (Fastify + tRPC)
│   ├── web/                    # Frontend principal (React + MUI)
│   └── ai-gateway/             # Voice Gateway :4002 (TTS + STT Groq)
│
├── config/
│   └── litellm/
│       └── config.yaml         # hermes-* aliases (único gateway LLM)
│
├── scripts/
│   ├── hvac-rag/               # Pipeline RAG + download manual
│   ├── nexus-*.sh              # SRE automation
│   └── sre-check.sh            # Health check unificado
│
├── docs/
│   ├── SPECS/                  # Specs ativos (mover mortas para SPECS-dead/)
│   ├── INFRASTRUCTURE/         # Architecture, ports, services
│   ├── OPERATIONS/             # Runbooks, SOPs
│   └── GOVERNANCE/             # Regras, contratos
│
├── services/
│   └── orchestrator/           # Hermes JSON-RPC (state + graph + tools)
│
├── archive/                    # Projetos mortos (não versionar no git)
│   └── CRM-REFRIMIX/
│
├── AGENTS.md                   # Source of truth (atualizado)
├── CLAUDE.md                   # Agent instructions (atualizado)
├── README.md                   # Overview minimalista
└── .env.example                # Env template limpo
```

**Regra de ouro:** Se um arquivo não é lido semanalmente por um humano ou executado por um script, é lixo.

---

## 5. Plano de Execução

### Fase 1 — Poda Agressiva (Dia 1)

```bash
# 1.1 Apps
rm -rf apps/perplexity-agent
rm -rf apps/hvac-manual-downloader
rm -rf apps/list-web
rm -rf apps/obsidian-web
rm -rf apps/painel-organism
rm -rf apps/orchestrator

# 1.2 Espelho obsidian (fonte canônica é docs/)
rm -rf obsidian/

# 1.3 Arquivos órfãos
find apps -name "uv.lock" -delete
find apps -name ".streamlit" -type d -exec rm -rf {} +
find apps -name ".python-version" -delete
find apps -name "trigger-workflow.txt" -delete

# 1.4 Archive
mv apps/archived/* archive/ 2>/dev/null; rm -rf apps/archived

# 1.5 Specs mortas
mv docs/SPECS/SPEC-115-painel-organism.md docs/SPECS-dead/
mv docs/SPECS/SPEC-033-hvac-manual-*.md docs/SPECS-dead/
mv docs/SPECS/SPEC-006-playwright-e2e.md docs/SPECS-dead/  # referencia perplexity-agent
```

### Fase 2 — Consolidação de Gateways (Dia 1)

```bash
# 2.1 LiteLLM é o único gateway LLM
# Já configurado: hermes-* aliases em config/litellm/config.yaml
# Porta: 4018/v1

# 2.2 ai-gateway vira voice-gateway (apenas TTS + STT)
# Já configurado: rotas /v1/audio/speech e /v1/audio/transcriptions
# Chat/Models removidos do index.ts
# Porta: 4002

# 2.3 Atualizar .env.example
# Remover OPENROUTER_MODEL, OPENROUTER_API_BASE
# Remover STT_PROXY_URL legado
# Consolidar OLLAMA_URL
```

### Fase 3 — Docs e Referências (Dia 2)

```bash
# 3.1 Atualizar docs principais
sed -i 's/localhost:4000/localhost:4018/g' docs/INFRASTRUCTURE/*.md
sed -i 's/localhost:4002/localhost:4018/g' docs/OPERATIONS/*.md  # onde era LLM
# Nota: ai-gateway :4002 agora é só voice, ajustar contexto

# 3.2 Remover tabelas de serviços removidos
grep -rl "perplexity-agent\|hvac-manual-downloader\|list-web\|obsidian-web\|painel-organism" docs/ | xargs -I {} bash -c 'sed -i "/perplexity-agent/d; /hvac-manual-downloader/d; /list-web/d; /obsidian-web/d; /painel-organism/d" {}'

# 3.3 Regenerar pnpm-lock
pnpm install  # remove entradas de apps deletadas
```

### Fase 4 — Visual Profissional (Dia 2)

```bash
# 4.1 README.md minimalista
# - Badges: status, plataforma, licença
# - Diagrama Mermaid com 2 gateways
# - Tabela de serviços (5 linhas)
# - Quick start (3 comandos)

# 4.2 AGENTS.md como source of truth
# - Arquitetura de 2 gateways no topo
# - Apps ativas apenas
# - Tool stack mínima

# 4.3 CLAUDE.md limpo
# - Estrutura de diretórios atualizada
# - Security rules
# - Quick commands
```

### Fase 5 — Validação (Dia 3)

```bash
# 5.1 Build
pnpm build

# 5.2 Type check
pnpm tsc --noEmit

# 5.3 Lint
biome check .

# 5.4 Health check
bash scripts/sre-check.sh ci --json

# 5.5 Smoke tests
curl -sf http://localhost:4018/v1/models -H "Authorization: Bearer $LITELLM_MASTER_KEY"
curl -sf http://localhost:4002/health
```

---

## 6. Critério de Aceitação

- [ ] `git diff --stat` mostra < 50 arquivos modificados (não 180+)
- [ ] `docker ps` mostra apenas containers essenciais (< 15)
- [ ] `ls apps/` mostra apenas 3 diretórios: `api/`, `web/`, `ai-gateway/`
- [ ] Nenhuma referência a `:4000` como LLM gateway nos docs
- [ ] Nenhuma referência a `perplexity-agent`, `list-web`, `obsidian-web`, `painel-organism` nos docs ativos
- [ ] `pnpm build` passa sem erros
- [ ] `biome check .` passa sem erros
- [ ] README.md cabe em 1 tela (sem scroll)

---

## 7. Riscos e Mitigação

| Risco | Mitigação |
|-------|-----------|
| Quebrar build ao remover apps do pnpm workspace | `pnpm install` regenera lockfile; testar `pnpm build` |
| Referências ocultas em scripts não versionados | Buscar com `grep -r` antes e depois |
| Coolify ainda aponta para apps removidas | Verificar painel Coolify e remover recursos mortos |
| DNS/subdomínios de apps removidas | `scripts/prune-subdomain.sh` para limpar Cloudflare |
| Dados de usuário em apps removidas | Não há — apps removidas não tinham usuários reais |

---

## 8. Aprovação

**Autor:** will-zappro (SRE Dev Senior)
**Data de início proposta:** 2026-05-04
**Duração estimada:** 3 dias
**Requer aprovação:** Não — execução autorizada pelo principal engineer

---

*Este SPEC substitui qualquer plano anterior de organização. A regra é: menos é mais. Um repositório com 50 arquivos bem organizados vale mais que um com 500 em salada.*
