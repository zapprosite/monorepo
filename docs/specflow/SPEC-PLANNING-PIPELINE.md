# SPEC-PLANNING-PIPELINE: Enterprise Planning Pattern

**Status:** DRAFT
**Date:** 2026-04-09
**Author:** will
**Type:** SPEC

---

## OBJETIVO

Instalar pipeline completo de desenvolvimento enterprise:
1. `/plan` → Opus 4.6 faz discovery, gera PRD
2. `/spec` → transforma PRD em SPEC-*.md estruturado com slices
3. `/pg` → lê SPEC-*.md e gera tasks/pipeline.json (TaskMaster JSON)
4. `/cursor-loop` → consome pipeline.json e executa loop autônomo

---

## ARQUITETURA DO PIPELINE

```
IDEA / PROBLEMA
      ↓
/plan (Opus 4.6 discovery)
      ↓
PRD (docs/specflow/PRD-*.md)
      ↓
/spec (SPEC-*.md com slices)
      ↓
/pg (gera tasks/pipeline.json)
      ↓
/cursor-loop (execução autônoma)
      ↓
DONE / HUMAN GATE
```

---

## COMPONENTES

### 1. Template PRD
**Local:** `docs/TEMPLATES/PRD-template.md`
**Conteúdo:** 12 seções (Problema, Objetivo, RF, RNF, AC, Slices, etc.)

### 2. Template SPEC
**Local:** `docs/TEMPLATES/SPEC-template.md` (existente)
**Função:** Transformar PRD em spec executável

### 3. TaskMaster Config
**Local:** `.taskmaster/config.json`
**Função:** Configurar modelos AI para planning

### 4. Comandos Existentes
| Comando | Status | Observação |
|---------|--------|------------|
| `/pg` | ✅ EXISTE | Lê SPECs, gera pipeline.json |
| `/spec` | ✅ EXISTE | Spec-driven development |
| `/cursor-loop` | ✅ EXISTE | Loop autônomo CI/CD |
| `/plan` | 🆕 NOVO | Gera PRD a partir de ideia |

---

## FLUXO DETALHADO

### Passo 1: /plan
```
1. Receber descrição da feature ou problema
2. Opus 4.6 faz discovery (lê docs/, .agent/, contexto)
3. Gera PRD rascunho em docs/specflow/[date]-PRD-[slug].md
4. Aguarda aprovação humana
```

### Passo 2: /spec
```
1. Receber PRD aprovado
2. Transforma em SPEC-*.md
3. Define slices de entrega
4. Define acceptance criteria
5. Define priorities e dependencies
```

### Passo 3: /pg
```
1. Lê todas as SPEC-*.md em docs/specflow/
2. Extrai tasks e ACs
3. Gera tasks/pipeline.json no padrão TaskMaster
```

### Passo 4: /cursor-loop
```
1. Lê tasks/pipeline.json
2. Consome tasks pendentes em ordem de prioridade
3. Executa: BUILD → TEST → REVIEW → SHIP
4. Para em human gates
5. Atualiza status das tasks via taskmaster MCP
```

---

## RESTRIÇÕES

1. **~/.claude/ global** → INTOCÁVEL
2. **mcp-servers.json** → INTOCÁVEL
3. **Máximo 4 agents simultâneos**
4. **Não reescrever o que já funciona**

---

## TASKMASTER CONFIG

```json
{
  "models": {
    "main": { "provider": "anthropic", "modelId": "claude-sonnet-4-6-20260101" },
    "research": { "provider": "anthropic", "modelId": "claude-opus-4-6-20260201" },
    "fallback": { "provider": "minimax", "modelId": "MiniMax-M2.7" }
  },
  "global": { "projectName": "zappro-monorepo", "defaultSubtasks": 5 }
}
```

---

## PRÓXIMOS PASSOS

1. [ ] Criar `/plan` command (substituir placeholder se existir)
2. [ ] Testar pipeline completo: idea → PRD → SPEC → pipeline.json
3. [ ] Adicionar `.taskmaster/config.json` ao gitignore ou versionar?

---

**Última atualização:** 2026-04-09
