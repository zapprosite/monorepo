# GOVERNANCE — Regras Operacionais do Monorepo

> **Data:** 2026-04-22
> **Authority:** will-zappro (Principal Engineer - Platform Governance)
> **Source of Truth:** `/srv/ops/ai-governance/` + docs/GOVERNANCE/

---

## Contexto de Carga (ORDEM OBRIGATORIA)

Antes de qualquer tarefa, todo LLM **DEVE** ler nesta ordem:

### 1. AGENTS.md (Source of Truth para Processos)

```bash
cat /srv/monorepo/AGENTS.md | tail -200
```

**Contents:**
- Pipeline de 3 fases (SPEC-090)
- 7 agentes especializados
- Network & Port Governance
- Anti-Hardcoded Pattern
- LLM Tiering (MiniMax + Ollama)

### 2. Second Brain TREE (Estrutura de Conhecimento)

```bash
cat ~/Desktop/hermes-second-brain/TREE.md 2>/dev/null || ls ~/Desktop/hermes-second-brain/
```

**Purpose:** Mapeia estrutura de conhecimento cross-project.

### 3. OPS Governance (Regras Operacionais)

```bash
cat /srv/ops/ai-governance/README.md
cat /srv/ops/ai-governance/CONTRACT.md
cat /srv/ops/ai-governance/GUARDRAILS.md
```

**Contents:**
- CONTRACT.md — Principios nao-negociaveis
- GUARDRAILS.md — Operacoes proibidas
- APPROVAL_MATRIX.md — Matriz de aprovacoes
- CHANGE_POLICY.md — Snapshot antes de mudancas

### 4. Sistema Atual (Se Mudanca de Infra)

```bash
cat ~/Desktop/SYSTEM_ARCHITECTURE.md 2>/dev/null
```

**Purpose:** Documentacao de infraestrutura atual.

---

## Projetos do Ecossistema

| Projeto | Path | Tipo | Stack |
|---------|------|------|-------|
| **Monorepo** | `/srv/monorepo` | pnpm workspaces + Fastify/tRPC | TypeScript, Biome |
| **Second Brain** | `~/Desktop/hermes-second-brain` | Obsidian-style vault | Markdown, Git |
| **Hermes Agent** | `~/.hermes/hermes-agent` | Python asyncio | Claude Code, MCP |
| **OPS Scripts** | `/srv/ops/scripts` | Bash + Terraform | Docker, ZFS |

---

## Hardware & Infraestrutura

```
PC PRINCIPAL (Gen5 4TB NVMe + RTX 4090 24GB + 64GB RAM)
  ├── Headless Ubuntu Server (SSH do PC secundario)
  ├── ZFS pool: tank (4TB RAID-Z)
  └── VRAM: 23GB livre quando Gemma4 nao esta em uso

PC SECUNDARIO (Gen3 1TB NVMe + RTX 3060 12GB + 32GB RAM)
  └── Dashboard principal (SSH para PC principal)

SERVICOS PRINCIPAIS:
  ├── Qdrant (6333) → tank/data/qdrant
  ├── n8n (5678) → tank/n8n
  ├── Gitea (3000) → tank/gitea
  ├── Coolify (80/443) → tank/coolify
  ├── Hermes Gateway (8642) → ~/.hermes
  └── LiteLLM (4000) → pooling para MiniMax/GPT
```

---

## NEVER DO List (ZFS Rollback Restrictions)

### Operacoes Proibidas (NUNCA EXECUTAR)

```
- wipefs /dev/nvme*              → destroi ZFS pool
- zpool destroy tank             → destroi todos os dados
- rm -rf /srv/data/*             → deleta dados de producao
- rm -rf /srv/backups/*          → deleta backups
- docker volume prune -f         → deleta volumes sem backup
- Bypass Traefik com port forward direto
- Abrir portas sem verificar PORTS.md primeiro
```

### Anti-Hardcoded Rules (OBRIGATORIO)

```
# ❌ PROIBIDO — hardcoded
MY_KEY = 'sk-123456'
STT_URL = 'http://localhost:8202'
API_KEY = 'sk-abc123...'

# ✅ CORRETO — sempre via process.env
const STT_URL = process.env.STT_DIRECT_URL ?? 'http://localhost:8202';
const GW_KEY = process.env.AI_GATEWAY_FACADER_KEY ?? '';
```

**Fonte canonica:** `.env` como unica fonte de verdade para secrets.

---

## Mudancas Estruturais — Checklist

Antes de qualquer mudanca estrutural:

1. Ler `CONTRACT.md` em `/srv/ops/ai-governance/`
2. Verificar `GUARDRAILS.md` se requer aprovacao
3. Criar ZFS snapshot antes: `sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-<motivo>`
4. Documentar em `/srv/ops/ai-governance/logs/`

---

## Comandos Seguros (Sem Aprovacao)

```bash
# Status
docker ps
docker compose -f /srv/apps/platform/docker-compose.yml ps
zpool status tank
zfs list -t snapshot

# Backups
/srv/ops/scripts/backup-postgres.sh
/srv/ops/scripts/backup-qdrant.sh
```

---

## Network & Port Governance

### Stack de Rede Completo

```
INTERNET → Cloudflare → cloudflared → TRAEFIK (80/443/8080) → UFW → SERVICES
```

### Antes de qualquer porta ou subdominio:

1. Ler `/srv/monorepo/docs/INFRASTRUCTURE/PORTS.md`
2. Ler `/srv/monorepo/docs/INFRASTRUCTURE/SUBDOMAINS.md`
3. Verificar com `ss -tlnp | grep :PORTA`
4. Atualizar ambos os docs se adicionar porta/subdominio

### Portas Reservadas (Nunca Usar)

| Porta | Servico | Status |
|-------|---------|--------|
| :3000 | Open WebUI proxy | RESERVED |
| :4000 | LiteLLM production | RESERVED |
| :4001 | Hermes Agent Bot | RESERVED |
| :4002 | ai-gateway OpenAI compat | RESERVED |
| :8000 | Coolify PaaS | RESERVED |
| :8080 | Open WebUI (Coolify managed) | RESERVED |
| :8642 | Hermes Gateway | RESERVED |
| :6333 | Qdrant | RESERVED |

### Portas Livres para Dev

- Faixa `:4002`–`:4099` (microservicos)
- `:5173` (Vite frontend)

---

## Voice & TTS

### TTS (Edge TTS — canonical)

```bash
~/.hermes/scripts/tts-edge.sh "texto" 7220607041
```

### STT (Groq Whisper Turbo — 150min/dia gratis)

```bash
curl -X POST https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F "file=@audio.ogg" \
  -F "model=whisper-large-v3-turbo"
```

---

## LLM Tiering — Canonical Stack

| Modelo | Uso | Custo |
|--------|-----|-------|
| MiniMax M2.7 | Chat principal (via LiteLLM :4000) | Token plan |
| GPT-4o-mini | Fallback automatico | $0.15/1M tokens |
| Gemma4:26b-q4 | Codigo local (Ollama) | Gratis |

### VRAM Strategy

- Gemma4 carregado sob demanda (22GB VRAM)
- LiteLLM faz pooling automatico entre MiniMax/GPT

---

## Auditoria (will-zappro e "ruthless auditor")

Antes de implementar algo, questione:

- ✅ Isso e necessario mesmo? Reduz complexidade ou só adiciona?
- ✅ Segue a estrategia de custo-beneficio? (MiniMax + GPT Plus + OpenAI API)
- ✅ Vie useful life do hardware? (evitar swap no Gen5)
- ✅ Documentado? (ADR se mudanca estrutural)

---

## Output Format

Sempre que entregar resultado ao usuario:

```
📋 Resultado: [descricao curta]

[detalhes se necessario]

🔗 Referências:
  • /srv/monorepo/docs/SPECS/SPEC-XXX.md
  • /srv/ops/ai-governance/CONTRACT.md

💾 Audio: MEDIA:<path_do_audio>
```

---

## Referencias

- [AGENTS.md](../../AGENTS.md) — Documentacao completa dos agentes
- [WORKFLOW-SPEC-PGPIPE.md](../WORKFLOW-SPEC-PGPIPE.md) — Pipeline de 3 fases
- [ARCHITECTURE-OVERVIEW.md](../ARCHITECTURE-OVERVIEW.md) — Arquitetura de infraestrutura
- [INFRASTRUCTURE/PORTS.md](../INFRASTRUCTURE/PORTS.md) — Mapa de portas
- [INFRASTRUCTURE/SUBDOMAINS.md](../INFRASTRUCTURE/SUBDOMAINS.md) — Subdominios Cloudflare
