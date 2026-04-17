# ARCHITECT Research: infra-from-spec

**Skill:** `infra-from-spec`
**Path:** `.claude/skills/infra-from-spec/SKILL.md`
**Date:** 2026-04-17
**Veredito:** DELETE

---

## Key Findings

### 1. PROIBIDO Violations (CRITICAL — SPEC-066)

The skill explicitly contains two PROIBIDO violations:

```
## Dependencias
- `MINIMAX_API_KEY` em Infisical vault
- Endpoint: `https://api.minimax.io/anthropic/v1`
```

Per SPEC-066: *"PROIBIDO: minimax, anthropic, token."* — `infra-from-spec` depends on MiniMax and a MiniMax API endpoint. This cannot be patched — the skill must be **deleted**.

### 2. Overlap with Existing Skills

| Function | Skill | Status |
|----------|-------|--------|
| Terraform subdomain | `new-subdomain` | ✅ Already exists |
| Docker Compose generation | NONE | Gap — but MiniMax dependency blocks use |
| Prometheus alerts | NONE | Gap — but MiniMax dependency blocks use |
| Gitea workflow | NONE | Gap — but MiniMax dependency blocks use |

`infra-from-spec` would overlap significantly with `new-subdomain` (subdomain via Terraform). The `/infra-gen terraform subdomain` command is redundant — `new-subdomain` is the canonical skill for that task.

### 3. Bounded Context Analysis

**Faz (correct):**
- Reads existing files before generating (avoids conflicts)
- Follows monorepo formatting (`map(object({...}))` for Terraform)
- Generates healthchecks for Docker services (SPEC-023 pattern)
- Human approval required before apply

**Nao faz (correct):**
- Does not auto-apply Terraform
- Does not update PORTS.md/SUBDOMAINS.md automatically
- Human-gated subnet/port exposure

The bounded context is well-designed — the problem is the MiniMax dependency.

### 4. Trigger Collision Risk

Skill trigger is `/infra-gen`. No existing command in monorepo uses this trigger — no collision.

---

## Recommendations

### Delete — `infra-from-spec`

**Reason:** MiniMax dependency is PROIBIDO per SPEC-066. The skill cannot be rewritten to use a different LLM without changing its fundamental design. The Docker/Prometheus/Gitea generation capabilities are valid gaps in the skill ecosystem, but they belong in a separate skill that uses `ollama` or `litellm` (local) instead of MiniMax.

### For Docker Compose Generation

Consider a future skill (not MiniMax) that:
- Reads `PORTS.md` for port allocation
- Generates Docker Compose with healthchecks per SPEC-023 pattern
- Does NOT call external LLM APIs for code generation (use local Ollama if LLM needed)

### For Prometheus Alerts / Gitea Workflows

These are template-driven, not LLM-generation tasks. A better approach:
- `smoke-test-gen` style: template + Zod schema input → file generation
- No external LLM dependency needed — fill templates from SPEC context

---

## SPEC-066 Action

| AC | Recommendation |
|----|----------------|
| `infra-from-spec/` | **DELETE** — MiniMax PROIBIDO, trigger `/infra-gen` has no other owner, subdomain covered by `new-subdomain`, Docker/Prometheus/Gitea generation is a valid gap but MiniMax dependency is a hard blocker |

---

## What to Keep (salvageable patterns)

The **bounded context** design (read existing files first, human approval, governance-aware) is good and should inform any future skill in this space. The trigger pattern `/infra-gen [provider] [resource]` is clean.

If Docker Compose, Prometheus alerts, or Gitea workflow generation is needed without MiniMax, those should be separate skills using:
- Local Ollama (`OLLAMA_URL`) for any LLM generation
- Template-based generation for standard patterns
- Explicit file read before write (infra-from-spec's pre-flight check pattern)
