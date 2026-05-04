---
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab
spec: SPEC-206
title: Agent Harness — dotcontext MCP Audit & qwen2.5:14b Gap
status: draft
date: 2026-05-02
author: Nexus SRE
---

# SPEC-206 — Agent Harness: dotcontext MCP Audit + qwen2.5:14b Gap

## 1. Auditoria Completa — Estado do dotcontext MCP

### 1.1 Harness MCP (mcp__dotcontext__harness)

| Componente | Status | Observação |
|---|---|---|
| Sessions | ✅ 1 ativa | `a03a2008-216b-48da-bf60-41fa58b61846` — "mcp-activity" |
| Traces | ✅ 6 eventos | JSONL append-only, 1 sessão |
| Artifacts | ❌ 0 | Nunca capturados |
| Checkpoints | ❌ 0 | Sem replay capability |
| Tasks | ❌ 0 | Sem task contracts |
| Handoffs | ❌ 0 | Sem transferências |
| Policies | ❌ 0 | Sem gate rules |
| **Sensors** | ❌ FALTA | `.context/harness/sensors.json` não existe |
| **Workflow** | ❌ NÃO INICIADO | PREVC nunca foi `workflow-init` |

### 1.2 Agent Discovery (14 built-in agents)

```
code-reviewer, bug-fixer, feature-developer, refactoring-specialist,
test-writer, documentation-writer, performance-optimizer, security-auditor,
backend-specialist, frontend-specialist, architect-specialist,
devops-specialist, database-specialist, mobile-specialist
```

### 1.3 Skills Ativas (10 em .context/skills/)

| Skill | Fases PREVC |
|---|---|
| api-design | P, R |
| bug-investigation | E, V |
| code-review | R, V |
| commit-message | E, C |
| documentation | P, C |
| feature-breakdown | P |
| pr-review | R, V |
| refactoring | E |
| security-audit | R, V |
| test-generation | E, V |

---

## 2. Arquitetura de 5 Camadas (Agent Harness Stack)

```
Layer 5: Human Oversight
  └── Approve PRs, set priorities

Layer 4: Orchestration (PREVC)
  └── P → R → E → V → C

Layer 3: 14 Coding Agents
  └── code-reviewer, feature-developer, bug-fixer, etc.

Layer 2: 10 Skills
  └── .context/skills/*.md

Layer 1: Infrastructure
  └── MCP (dotcontext, filesystem, Gmail, Calendar, HF, etc.)
```

---

## 3. Lacunas Críticas Identificadas

| Finding | Severidade | Ação |
|---|---|---|
| `sensors.json` não existe | 🔴 Alta | Criar com métricas de qualidade |
| `workflow-init` nunca executado | 🔴 Alta | Executar PREVC workflow |
| 0 tasks/handoffs gravados | 🟡 Média | Usar createTask em cada feature |
| 0 policies configuradas | 🟡 Média | Definir gate rules |
| 0 artifacts capturados | 🟡 Média | Ativar recordArtifact |
| 0 checkpoints | 🟡 Média | Usar checkpoint em milestones |
| AGENTS.md read_secrets flagged | 🟡 Média | Limpar segredos documentados |

---

## 4. CRÍTICO — qwen2.5:14b NÃO está no fluxo

### 4.1 Encontrado no Ollama

```bash
$ curl -s localhost:11434/api/tags | python3 -c "..."
qwen2.5-coder:14b-q6k   ← DISPONÍVEL mas NÃO DOCUMENTADO
qwen2.5vl:3b            ← Documentado
nomic-embed-text:latest ← Documentado
```

### 4.2 Model Stack Atual (de docs)

| Modelo | Provider | Uso | Status |
|---|---|---|---|
| hermes-brain | OpenRouter API | LLM primário | ✅ |
| llama3-portuguese-tomcat-8b | Ollama | PT-BR filter | ✅ |
| qwen2.5-coder:14b-q6k | Ollama | **Code Generation** | ✅ Documentado |
| qwen2.5vl:3b | Ollama | **Vision STT** | ✅ Documentado |
| nomic-embed-text | Ollama | Embeddings | ✅ |

### 4.3 SPEC-204 Não Menciona qwen2.5:14b

- SPEC-204 (Nexus Unified Agent Harness) define 7×7=49 agentes
- **Nenhum agente usa qwen2.5:14b como modelo de code generation**
- O fluxo atual usa `openrouter/hermes-brain` como único LLM
- `qwen2.5-coder:14b-q6k` está disponível mas ignorado

### 4.4 Implicação

O agente `code-reviewer`, `feature-developer`, `bug-fixer`, etc. usam o mesmo modelo que faz STT/TTS/chat. **Não há especializados de code generation** como deveria haver num harness enterprise.

---

## 5. SPEC de Referência

- **SPEC-204** — Nexus Unified Agent Harness Framework (fonte principal)
- **SPEC-NEXUS-HERMES-INTEGRATION** — PREVC ↔ Hermes Memory mapping
- **hermes-second-brain/pipeline.json** — Pipeline de health do Second Brain
- **hermes-second-brain/SOUL.md** — Memory architecture

---

## 6. Ação Necessária

1. **Criar `.context/harness/sensors.json`** — métricas de qualidade
2. **Executar `workflow-init`** — ativar PREVC
3. **Documentar qwen2.5:14b** no stack de modelos
4. **Criar SPEC para code generation agent** usando qwen2.5-coder:14b
5. **Adicionar ao pipeline.json** existente em hermes-second-brain

---

## 7. Files Criados/Atualizados

| Ficheiro | Ação |
|---|---|
| `docs/SPECS/SPEC-206-agent-harness-dotcontext-audit.md` | Criado (este) |
| `ops/docs/HARNESS-AUDIT-2026-05-02.md` | Criado |
| `hermes-second-brain/docs/HARNESS-AUDIT-2026-05-02.md` | Criado |
| `hermes-second-brain/pipeline.json` | Atualizado com stage dotcontext |

---

**Status:** DRAFT
**Owner:** Nexus SRE
**Next:** workflow-init + sensors.json creation
