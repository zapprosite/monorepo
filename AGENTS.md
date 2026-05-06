# AGENTS.md — Monorepo Command Center

> **Data:** 2026-05-06
> **Canonical reference:** `docs/HOMELAB.md`
> **Milestone Audit:** [M1 Audit Passed (Tech Debt Identified)](.planning/v1.0-MILESTONE-AUDIT.md)

---

## 📜 COMUNICADO GLOBAL RULES — Lei Suprema do Repositório

> **Status:** ✅ Em vigor | **Última atualização:** 2026-05-06
> **Aplicação:** Todos os agentes, humanos e automações que interagem com este repositório.

### 🚫 Regras Absolutas (Quebra = Bloqueio de Deploy)

| # | Regra | Penalidade |
|---|-------|-----------|
| R1 | **NUNCA hardcodar secrets.** Usar `os.environ.get()` ou vault. | CI falha |
| R2 | **NUNCA comitar arquivos `.env`.** | Git hook rejeita |
| R3 | **Commits atômicos** — uma feature/fix por commit. | Revert |
| R4 | **Testes antes ou junto com código.** | PR rejeitado |
| R5 | **Docs em PT-BR, código em EN.** | Biome/CI falha |
| R6 | **Zero deploy sem smoke test.** | Rollback |
| R7 | **Alterações em AGENTS.md ou SPECs exigem commit separado** `docs:`. | Revert |
| R8 | **Hermes é tree-only.** Sem estado persistente gigante fora do monorepo. | Bloqueio |

### 🌳 Hermes Tree-Only (ADR-001)

**Hermes-second-brain é tree-only.** O estado canônico reside no monorepo e Qdrant.

---

## 🏛️ Hierarquia de Decisão

```
SPEC.md > AGENTS.md > CLAUDE.md > Código-fonte
```

---

## Apps & Packages — Mínimo Viável (Core 2026)

| App/Package | Tipo | Stack | Gateway |
|-------------|------|-------|---------|
| `apps/api` | API | Fastify + OrchidORM + tRPC | :4017 (Local) |
| `apps/web` | Web | React 19 + MUI + tRPC | — |
| `apps/ai-gateway` | Voice | Fastify + edge-tts + Groq | :4002 |
| `packages/ui` | UI Lib | React + Material UI | — |
| `packages/zod-schemas` | Schemas | TypeScript + Zod | — |
| `packages/config` | Config | TypeScript | — |

**Motores de Domínio:**
- `scripts/hvac-rag/` — Core Engine para Inverter RAG (Dual-Index).

---

## Tool Panel

| Tool | Alias | Descrição |
|------|-------|-----------|
| `/sync` | — | Sincroniza docs → memória vetorial |
| `/scraper` | — | Pipeline HVAC: extração e indexação |
| `/status` | — | Homelab health overview |
| `/turbo` | — | Git flow: commit + merge + tag |

---

## CI/CD Loop

```
PUSH → Gitea Actions (lint + build + test)
PR → AI Review + Human Gate
Merge → Deploy Coolify + Smoke Tests
```

---

## Quick Reference

```bash
pnpm install
pnpm build
pnpm test
bash scripts/sre-check.sh ci
```
