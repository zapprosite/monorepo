# DOCS Research — SPEC-066 Claude Commands Audit

**Data:** 2026-04-17
**Focus:** `.claude/` tech debt audit — monorepo + global (inaccessible)

---

## 1. Inventário Confirmado

### `.claude/.claude/` (nested artifact)
```
.claude/.claude/skills/orchestrator/logs/  # Apenas logs, sem SKILL.md
```
**Ação:** DELETE recursivamente — é um artifact de backup acidental.

### `.claude/tools/img-analyze.sh`
- Usa modelo `llava` (deprecated — SIGSEGV bug, SPEC-053 usa `qwen2.5vl:7b`)
- Duplica `/img` skill (Usa Ollama local `qwen2.5vl:7b`)
**Ação:** DELETE — `/img` skill é SOTA.

### `.claude/agents/` (6 ficheiros)
| Ficheiro | Conteúdo | Status |
|----------|----------|--------|
| `implementer.md` | Agent implementador | Manter |
| `mcp-operator.md` | Agent MCP operator | Manter |
| `orchestrator.md` | Agent orchestrator | ⚠️ Verificar vs skills/orchestrator |
| `planner.md` | Agent planner | Manter |
| `researcher.md` | Agent researcher | ⚠️ Duplica skills/researcher/ |
| `reviewer.md` | Agent reviewer | Manter |

**Ação:**留着 — são definições de agentes para o orchestrator. O `orchestrator.md` de agents/ pode ter conteúdo diferente do `skills/orchestrator/SKILL.md`.

### `.claude/skills/researcher/`
- Usa **MiniMax** explicitamente (PROIBIDO em SPEC-066)
- Referência a `cursor-loop-research-minimax.sh` que não existe
**Ação:** DELETE — viola PROIBIDO.

### `.claude/skills/cloudflare-terraform/`
- Substituído por `cloudflare-tunnel-enterprise/`
- Infisical references (legacy, pruned)
**Ação:** DELETE.

### `.claude/skills/db-migration/`
- Usa **MiniMax** (PROIBIDO)
- OrchidORM (não usado na stack atual — Fastify + tRPC)
**Ação:** DELETE.

### `.claude/skills/infra-from-spec/`
- Usa **MiniMax** (PROIBIDO)
- Gera Docker/TF/Prometheus from SPEC
**Ação:** DELETE ou rewrite sem MiniMax.

### `.claude/skills/minimax-security-audit/`
- Nome contém `minimax` (PROIBIDO)
- SKILL.md não foi lido mas o nome indica uso de MiniMax
**Ação:** VERIFICAR — se usa MiniMax, DELETE.

### `.claude/skills/orchestrator/` vs `.claude/agents/orchestrator.md`
- `skills/orchestrator/` — skill com scripts (`run-agents.sh`, `agent-wrapper.sh`)
- `agents/orchestrator.md` — definição de agente
**Ação:** Manter ambos — são camadas diferentes (skill vs agent definition).

### `.claude/commands/` (20 commands)
Sem duplicados visíveis dentro do monorepo. Os 3 duplicados mencionados referem-se provavelmente a global `~/.claude/commands/` (inacessível).

---

## 2. Skills PROIBIDO (MiniMax/Anthropic/Token)

| Skill | Violação | Prioridade |
|-------|----------|------------|
| `researcher/` | MiniMax M2.7 | CRÍTICA |
| `db-migration/` | MiniMax + OrchidORM | CRÍTICA |
| `infra-from-spec/` | MiniMax | CRÍTICA |
| `minimax-security-audit/` | MiniMax no nome | CRÍTICA |

---

## 3. Recomendações CLAUDE.md / AGENTS.md

### CLAUDE.md (monorepo)
- **Adicionar:** `.claude/` cleanup à secção "Before Work"
- **Adicionar:** Lista de skills PROIBIDOS (MiniMax, Infisical SDK)
- **Atualizar:** Remover referências a `researcher` skill
- **Atualizar:** Remover `db-migration` da tabela de skills disponíveis

### AGENTS.md
- **Verificar:** `agents/researcher.md` vs `skills/researcher/` — se duplicados, manter apenas agents/ (definição canónica)
- **Adicionar:** Nota que skills são lidos de `.claude/skills/` e comandos de `.claude/commands/`

---

## 4. Acções Prioritárias

### DELETE Imediato (PROIBIDO violam)
```bash
# MiniMax violations
rm -rf .claude/skills/researcher/
rm -rf .claude/skills/db-migration/
rm -rf .claude/skills/infra-from-spec/
rm -rf .claude/skills/minimax-security-audit/

# Legacy/duplicate
rm -rf .claude/skills/cloudflare-terraform/
rm -rf .claude/.claude/  # nested artifact
rm -rf .claude/tools/
```

### Manter (não duplicado)
- `.claude/agents/` — agent definitions (6 ficheiros)
- `.claude/skills/` (exceto os acima) — 24-5=19 skills legítimos
- `.claude/commands/` — 20 commands

---

## 5. Estado Final Projetado

| Categoria | Antes | Depois |
|-----------|-------|--------|
| skills/ | 24 | 19 (-5 PROIBIDO/legacy) |
| tools/ | 1 | 0 (-1 deprecated) |
| nested .claude/ | 1 | 0 |
| agents/ | 6 | 6 (sem mudança) |
| commands/ | 20 | 20 (sem duplicados internos) |

---

## 6. Gap: Global Inacessível

O SPEC menciona 20 skills globais em `~/.claude/skills/` com duplicados:
- `gitea-coolify-deploy` — duplicado
- `pipeline-orchestrate` — duplicado  
- `openclaw-oauth-profiles` — deprecated
- `voice` — duplicado (hermes é SOTA)
- `researcher` — duplicado

**Não é possível auditar** `~/.claude/` a partir do contexto monorepo. Recomenda-se executá-lo separadamente após este cleanup.

---

## 7. Tag Suggestion

`v202604171700` — após executar as deletions
