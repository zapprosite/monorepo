---
version: 1.0
author: Principal Engineer
date: 2026-03-16
---

# 📍 Mapa Centralizado de Documentação

**Última Atualização:** 2026-03-16 16:10 UTC
**Propósito:** Única fonte de verdade para localizar qualquer documentação

---

## 🏛️ Estrutura de Responsabilidades

### `./` - GOVERNO (IMUTÁVEL)

**Propósito:** Regras, políticas, recuperação
**Responsável:** Sistema de governança
**Atualização:** Manual, antes de mudanças estruturais

| Documento                       | Propósito                                                |
| ------------------------------- | -------------------------------------------------------- |
| **CONTRACT.md**                 | Princípios não-negociáveis                               |
| **GUARDRAILS.md**               | O que é proibido/permitido                               |
| **CHANGE_POLICY.md**            | Como fazer mudanças seguras                              |
| **APPROVAL_MATRIX.md**          | Matriz de decisão (sim/não/pergunte)                     |
| **RUNBOOK.md**                  | Comandos oficiais                                        |
| **RECOVERY.md**                 | Procedimentos de recuperação                             |
| **SERVICE_MAP.md**              | Dependências de serviços                                 |
| **PARTITIONS.md**               | Realidade de disco e restrições                          |
| **PORTS.md**                    | Alocações de porta                                       |
| **SECRETS_POLICY.md**           | Gestão de credenciais                                    |
| **guide.md**                    | Guia operacional geral                                   |
| **QUICK_START.md**              | Visão geral 5 minutos                                    |
| **README.md**                   | Índice de governança                                     |
| **INCIDENTS.md**                | Log de incidentes                                        |
| **DEPLOYMENT_REPORT.md**        | Histórico de deploys                                     |
| **DATABASE_GOVERNANCE.md**      | Política de DBs, schemas, collections, naming, lifecycle |
| **DOC_CATALOG.md**              | Catálogo humano-legível (gerado por skill)               |
| **skills/catalog-sync.md**      | Skill de varredura e sync do catálogo                    |
| **templates/new-schema.md**     | Template para proposta de novo schema                    |
| **templates/new-collection.md** | Template para proposta de nova collection Qdrant         |

---

## 🆕 Skills Catalog (AI-Claude)

| Skill                            | Descrição                            | Localização                                      |
| -------------------------------- | ------------------------------------ | ------------------------------------------------ |
| **coolify-deploy-trigger**       | Trigger deploy via Coolify API       | `~/.claude/skills/coolify-deploy-trigger/`       |
| **coolify-auto-healer**          | Monitora containers, restart se down | `~/.claude/skills/coolify-auto-healer/`          |
| **coolify-health-check**         | Verifica health endpoint pós-deploy  | `~/.claude/skills/coolify-health-check/`         |
| **coolify-resource-monitor**     | CPU/memory alerts (>80%)             | `~/.claude/skills/coolify-resource-monitor/`     |
| **coolify-incident-diagnostics** | Diagnostica erros e propõe fixes     | `~/.claude/skills/coolify-incident-diagnostics/` |
| **coolify-rollback**             | Rollback para versão anterior        | `~/.claude/skills/coolify-rollback/`             |
| **gitea-coolify-deploy**         | Workflow completo GitOps             | `~/.claude/skills/gitea-coolify-deploy/`         |
| **ai-context-sync**              | Sync docs → memory                   | `~/.claude/mcps/ai-context-sync/`                |

---

### `/home/will/Desktop/` - JOURNAL (AUTOMÁTICO)

**Propósito:** Status atual do sistema
**Responsável:** Skill `maintain-system-documentation.sh`
**Atualização:** Automática, semanal recomendado (ou manual: `bash /home/will/Desktop/maintain-system-documentation.sh`)

| Documento                  | Propósito                                          | Atualização              |
| -------------------------- | -------------------------------------------------- | ------------------------ |
| **SYSTEM_ARCHITECTURE.md** | Status completo do sistema + histórico de fases    | Skill automática         |
| **HOMELAB-MAINTENANCE.md** | Guia completo de manutenção (todos os serviços)    | Manual ao mudar serviços |
| **guide-antigravity.md**   | IDE Antigravity + Codex CLI + Claude Code + Gemini | Manual                   |
| **guide-audio-tts-stt.md** | Pipeline de voz STT/TTS                            | Manual                   |
| **rascunho-s.txt**         | Secrets + Notas críticas                           | Manual                   |

---

### `/home/will/` - HISTÓRICO (REFERÊNCIA)

**Propósito:** Documentação técnica de implementação
**Responsável:** Desenvolvimento/pesquisa anterior
**Atualização:** Raramente, manter para contexto histórico

| Documento                     | Propósito                         | Última Atualização |
| ----------------------------- | --------------------------------- | ------------------ |
| **ARQUITETURA-DETALHADA.md**  | Como tRPC + Orchid ORM funcionam  | 2026-03-16 14:35   |
| **DESKTOP-CONTROLE-APP.md**   | Spec completa da aplicação web    | 2026-03-16 14:38   |
| **TOP-10-MCP-2026.md**        | Pesquisa + ranking de MCPs        | 2026-03-16 15:08   |
| **MONOREPO-NODEJS-PYTHON.md** | Setup monorepo + Node.js + Python | 2026-03-16 13:31   |
| **RECOMENDACOES-EXTRAS.md**   | Melhorias futuras                 | 2026-03-16 13:28   |

---

### `/etc/claude-code/` - POLÍTICA (SISTEMA)

**Propósito:** Regras para Claude Code nesta máquina
**Responsável:** Sistema
**Atualização:** Quando políticas mudam

| Documento     | Propósito                           |
| ------------- | ----------------------------------- |
| **CLAUDE.md** | Instruções globais para Claude Code |

---

## 📌 SINGLE SOURCE OF TRUTH POR TÓPICO

| Tópico                | Arquivo Único          | Localização           | Status             |
| --------------------- | ---------------------- | --------------------- | ------------------ |
| **Hardware specs**    | rascunho-s.txt         | `/home/will/Desktop/` | ✅ Centralizado    |
| **Status Serviços**   | SYSTEM_ARCHITECTURE.md | `/home/will/Desktop/` | ✅ Automático      |
| **Fases (1-3)**       | SYSTEM_ARCHITECTURE.md | `/home/will/Desktop/` | ✅ Atualizado      |
| **MCPs**              | TOP-10-MCP-2026.md     | `/home/will/`         | ✅ Completo        |
| **Políticas**         | ./\*                   | `./`                  | ✅ Governo         |
| **Catálogo de Dados** | DOC_CATALOG.md         | `./`                  | ✅ Auto-gerado     |
| **Governança DB**     | DATABASE_GOVERNANCE.md | `./`                  | ✅ Completo        |
| **Histórico Dev**     | Vários                 | `/home/will/`         | ⚠️ Para referência |

---

## 🔗 NAVEGAÇÃO ENTRE CAMADAS

```
┌─ Você quer saber...              → Vá para
├─ "É permitido fazer X?"          → ./GUARDRAILS.md
├─ "Como mudo algo?"               → ./CHANGE_POLICY.md
├─ "Qual é a política?"            → ./CONTRACT.md
├─ "Status do sistema agora?"      → /home/will/Desktop/SYSTEM_ARCHITECTURE.md
├─ "Qual MCP é melhor?"            → /home/will/TOP-10-MCP-2026.md
├─ "O que existe no banco/Qdrant?"  → ./DOC_CATALOG.md
├─ "Política de schemas/collections?"→ ./DATABASE_GOVERNANCE.md
├─ "Como manter os serviços?"       → /home/will/Desktop/HOMELAB-MAINTENANCE.md
├─ "Como usar o Antigravity IDE?"   → /home/will/Desktop/guide-antigravity.md
├─ "Como o tRPC funciona?"         → /home/will/ARQUITETURA-DETALHADA.md
├─ "Spec da app desktop?"          → /home/will/DESKTOP-CONTROLE-APP.md
└─ "Histórico de mudanças?"        → /home/will/Desktop/SYSTEM_ARCHITECTURE.md (Phase 1-3)
```

---

## 🔄 CICLO DE ATUALIZAÇÃO

```
AUTOMÁTICO (skill - semanal):
  /home/will/Desktop/SYSTEM_ARCHITECTURE.md
  → Coleta status Qdrant, n8n, PostgreSQL
  → Coleta commits git
  → Coleta uso ZFS
  → Gera SYSTEM_ARCHITECTURE.md atualizado

MANUAL (conforme necessário):
  /home/will/Desktop/rascunho-s.txt
  → Atualizar secrets, tokens, credenciais

RARAMENTE:
  ./
  → Apenas quando políticas mudam
  → Antes de mudanças estruturais

REFERÊNCIA (não atualizar):
  /home/will/*.md
  → Histórico técnico, leitura apenas
```

---

## ⚠️ COMO MANTER CONSISTÊNCIA

### Regra 1: Não Duplicar Status

❌ **NÃO FAZER:**

```
ARQUIVO A: "Qdrant está rodando"
ARQUIVO B: "Qdrant está parado"
```

✅ **FAZER:**

```
/home/will/Desktop/SYSTEM_ARCHITECTURE.md: "Qdrant está rodando"
(todos os outros referenciam este arquivo)
```

### Regra 2: Links Sempre Apontam para Verdade

Se documento A fala sobre documento B, incluir link:

```markdown
Para detalhes técnicos, veja: [ARQUITETURA-DETALHADA.md](/home/will/ARQUITETURA-DETALHADA.md)
```

### Regra 3: Governança Vive em /srv/ops/

Nunca colocar política em `/home/will/` ou Desktop.

### Regra 4: Status Vive em Desktop

Nunca copiar status para `./`.

### Regra 5: SÓ PORTUGUÊS EM ARQUIVOS .md

Todos os arquivos .md devem estar em português brasileiro.

---

## 📋 CHECKLIST DE CONSISTÊNCIA

Executar regularmente:

```bash
# Ver se há duplicação de status
grep -r "rodando\|parado" /home/will/ ./ | grep -v SYSTEM_ARCHITECTURE | wc -l

# Ver se há referências quebradas
grep -r "\/home\/will\/" ./ | wc -l

# Versão de todos os arquivos
find /srv/ops/ai-governance -name "*.md" -newer /home/will/Desktop/SYSTEM_ARCHITECTURE.md | wc -l

# Verificar se há conteúdo em inglês em .md
grep -r "^[^#]*[A-Z][a-z]*\s\+[A-Z][a-z]*" /home/will/*.md ./*.md | grep -v "Português\|Qdrant\|PostgreSQL\|n8n\|tRPC\|RTX\|NVMe" | head -20
```

---

## 🚀 COMO USAR ESTE MAPA

1. **Você está perdido?** → Leia este arquivo primeiro
2. **Quer saber política?** → Vá para `./`
3. **Quer saber status?** → Vá para `/home/will/Desktop/SYSTEM_ARCHITECTURE.md`
4. **Quer entender tecnicamente?** → Vá para `/home/will/ARQUITETURA-DETALHADA.md`
5. **Quer ver histórico?** → Leia fases em `/home/will/Desktop/SYSTEM_ARCHITECTURE.md`

---

## ANTI-FRAGILITY CATALOG (2026-04-08)

Documentos que protegem configurações estáveis de "otimizações" que quebram produção.

| Doc                           | Propósito                             | Quando Ler                       |
| ----------------------------- | ------------------------------------- | -------------------------------- |
| ANTI-FRAGILITY.md             | Regras para proteger configs estáveis | Antes de propor qualquer mudança |
| PINNED-SERVICES.md            | Registry de serviços imutáveis        | Antes de tocar voice/AI stack    |
| GUARDRAILS.md §Anti-Fragility | Marcadores de estabilidade            | Quando LLM propor "melhoria"     |

### Marcadores de Estabilidade (LEGEND)

- 📌 PINNED = não mudar sem snapshot + aprovação
- ⚠️ KIT PROTECTED = stack validado como unit
- 🔒 LOCKED = testado em conjunto, quebrar viola
- ✅ STABLE = verificado funcionando

### Fluxo: Proposta de Mudança em Serviço PINNED

```
1. Agente propõe mudança
         ↓
2. LEIA GUARDRAILS.md §Anti-Fragility
         ↓
3. Serviço tem marcador? → SIM → Recusar, indicar ANTI-FRAGILITY.md
                          → NÃO → Proceed with CHANGE_POLICY.md
```

**Criado:** 2026-04-08
**Razão:** Prevenir "otimizações" que quebram production stable configs

---

**Gerado:** 2026-03-16
**Próxima Revisão:** Semanal (junto com SYSTEM_ARCHITECTURE.md)
**Linguagem:** 🇧🇷 Português Brasileiro Obrigatório
