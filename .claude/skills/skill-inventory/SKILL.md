---
name: skill-inventory
description: Inventory de todas as skills disponiveis no monorepo + como usar para aprender workflows. Ensina como descobrir, invocar e encadear skills para automacao.
---

# Skill Inventory — How to Learn and Use Skills

## Quick Command

```bash
# List all available skills
ls .claude/skills/

# Get help for a specific skill
cat .claude/skills/<skill-name>/SKILL.md
```

## Philosophy

Skills são **microlearning units** — cada skill ensina UM workflow completo com contexto, comandos, e exemplos. Em vez de lembrar HOW, consulta a skill correta.

## Skill Categories

### 🔴 Critical Operations (always available)
| Skill | Teaches | Trigger |
|-------|---------|---------|
| `snapshot-safe` | ZFS snapshot before destructive changes | Before any cleanup/modification |
| `secrets-audit` | Scan code for exposed secrets | Before git push |
| `coolify-access` | Coolify API + deploy via MCP | When deploying to Coolify |

### 🟡 SPEC-Driven Development
| Skill | Teaches | Trigger |
|-------|---------|---------|
| `spec-024-cleanup` | Web post-discontinuity cleanup (THIS SKILL) | SPEC-024 execution |
| `pipeline-gen` | Generate tasks/pipeline.json from SPEC | After /spec creates SPEC |
| `audit-workflow` | Audit trail for AI tool workflow | Post-execution verification |

### 🔵 CI/CD & Deploy
| Skill | Teaches | Trigger |
|-------|---------|---------|
| `gitea-access` | Gitea API: list repos, trigger workflows, check CI | CI/CD automation |
| `coolify-deploy-trigger` | Deploy any Coolify app via API | Deploy without UI |
| `deploy-validate` | Pre-deploy health validation | Before production deploy |

### 🟢 Code Quality
| Skill | Teaches | Trigger |
|-------|---------|---------|
| `code-review` | General code review (5 axes) | Before PR merge |
| `security-audit` | Security checklist (OWASP top 10) | Security-sensitive changes |
| `test-generation` | Generate comprehensive tests | New functionality |

### 🔷 Investigation & Debugging
| Skill | Teaches | Trigger |
|-------|---------|---------|
| `bug-investigation` | 4-phase systematic debugging | Bug fix reviews |
| `mcp-health` | Diagnose all MCP servers | MCP issues |
| `repo-scan` | Detect tasks in multiple formats | Find pending work |
| `context-prune` | Clean old ai-context sessions | Session cleanup |

### 🔧 Infrastructure
| Skill | Teaches | Trigger |
|-------|---------|---------|
| `cloudflare-terraform` | Terraform + Cloudflare Zero Trust Tunnel | Add/verify subdomains |
| `snapshot-safe` | ZFS snapshot with checklist | Before destructive ops |
| `self-healing` | Autonomous learning and auto-correction | Error recovery |

---

## How to Chain Skills

### Example: Deploy Perplexity Agent

```
1. /secrets-audit          → Verify no secrets exposed
2. snapshot-safe           → ZFS snapshot (if destructive)
3. coolify-deploy-trigger  → Deploy via API
4. deploy-validate         → Health check after deploy
5. smoke-test-gen          → Generate smoke tests
```

### Example: SPEC-024 Cleanup

```
1. snapshot-safe           → P0: ZFS snapshot
2. READ tasks/plan-spec024.md → Understand full plan
3. gitea-access            → P1: Check Coolify auth
4. coolify-deploy-trigger  → P2: Deploy with new volume
5. (manual P3-P8)          → Update workflows, docs, SPECs
6. deploy-validate         → P9: Final smoke test
```

---

## Skill Invocation Pattern

```bash
# Via /skill command (Claude Code CLI)
 /<skill-name>

# Via Agent tool (for autonomous loops)
 Skill(skill="coolify-access")

# Direct reference in conversation
 "Use the coolify-access skill to trigger deploy"
```

---

## Creating New Skills

See `create-skill` skill for template and rules.

**Skills directory:** `.claude/skills/<skill-name>/SKILL.md`

**Skill frontmatter:**
```yaml
---
name: skill-name
description: One-line description of what this skill teaches
---

# Skill Name

## Overview
## Context
## Commands
## Examples
## Related Skills
```

---

## Learning Path (Recommended)

### Beginner
1. Read `coolify-access` — understand API-based deploy
2. Use `snapshot-safe` before any destructive change
3. Run `secrets-audit` before every push

### Intermediate
4. Chain `gitea-access` + `coolify-deploy-trigger` for automated deploys
5. Use `code-review` before merging any PR
6. Generate tasks from SPECs with `pipeline-gen`

### Advanced
7. Create custom skills for your workflows (see `create-skill`)
8. Chain multiple skills in autonomous loops
9. Build skill compositions for complex operations

---

## Current Active Skills (2026-04-11)

| Skill | Status | Notes |
|-------|--------|-------|
| `spec-024-cleanup` | 🆕 NEW | Web post-discontinuity cleanup |
| `coolify-access` | ✅ Ready | API auth issues investigated |
| `coolify-deploy-trigger` | ✅ Ready | Deploy via API |
| `snapshot-safe` | ✅ Ready | ZFS snapshots |
| `gitea-access` | ✅ Ready | Gitea Actions API |

---

## Skills That Teach This Workflow

The SPEC-024 cleanup skill (`spec-024-cleanup`) was created as a **meta-skill** — it documents the complete workflow and teaches:

1. **What** needs to be done (24 files, 10 phases)
2. **Why** each phase matters (dependency graph)
3. **How** to execute each phase (commands + verification)
4. **When** to use supporting skills (snapshot-safe, coolify-access, etc.)

**Pattern:** If a complex workflow recurs, create a skill that teaches it end-to-end.

---

## Discovery

To find skills relevant to your current task:

```bash
# Find skills mentioning a keyword
grep -r "keyword" .claude/skills/*/SKILL.md

# List all skill names
ls .claude/skills/ | sed 's|^|.claude/skills/|' | xargs -I{} basename $(dirname {})

# Check for skill that matches current issue
ls .claude/skills/*/SKILL.md | xargs grep -l "your-topic"
```

---

## Skill Matrix (Full)

| Category | Skills |
|----------|--------|
| Operations | `snapshot-safe`, `secrets-audit`, `deploy-validate` |
| CI/CD | `gitea-access`, `coolify-access`, `coolify-deploy-trigger` |
| SPEC-Driven | `spec-024-cleanup`, `pipeline-gen`, `audit-workflow` |
| Code Quality | `code-review`, `security-audit`, `test-generation` |
| Debug/Investigation | `bug-investigation`, `mcp-health`, `repo-scan`, `context-prune` |
| Infrastructure | `cloudflare-terraform`, `self-healing` |
| Creation | `create-skill`, `documentation` |

**Total: 25+ skills available**

---

*This skill was created as part of SPEC-024 cleanup to document the skill ecosystem and how to use it for complex workflows.*