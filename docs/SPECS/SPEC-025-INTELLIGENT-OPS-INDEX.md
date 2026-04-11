# SPEC-025 — Intelligent Operations Index + Memory Sync + Guide-to-Skill

**Status:** SPEC
**Date:** 2026-04-11
**Author:** will
**Type:** SPEC

---

## Objective

Criar uma **camada de operações inteligente** que conecta:
- SPEC-driven development → autonomous loop
- Skill index → decision tree → fast skill lookup
- Memory sync ↔ obsidian (bidirectional)
- 15 new operator guides → invokable skills
- Agent sees what's available and can query quickly

**Foco operacional:**
```
SPEC → /cursor-loop → Gitea → Coolify → Terraform → Grafana + Auto-Healer
```

**Problema atual:**
- 15 operator guides created (333KB) but NOT invokable as skills
- No skill index mapping operations → skills
- Memory sync is one-way (docs → memory), not bidirectional
- Agent doesn't know what skills exist or when to use them
- No quick decision mechanism for "what do I use for X?"

---

## Tech Stack

| Component | Technology | Location |
|-----------|------------|----------|
| Skill Index | Markdown + JSON | `.claude/skill-index.md` + `.claude/skill-index.json` |
| Memory Sync | ai-context MCP + scripts | `scripts/memory-sync.sh` |
| Guide→Skill | Metadata + symlinks | `.claude/skills/` + `docs/OPERATIONS/SKILLS/` |
| Agent Panel | Markdown rendered | `.claude/AGENT-PANEL.md` |
| Decision Tree | Markdown + JSON | `.claude/decision-tree.md` |

---

## Architecture

### 1. Skill Index System

**`.claude/skill-index.md`** — Human-readable index
**`.claude/skill-index.json`** — Machine-readable index for agents

```json
{
  "skills": [
    {
      "name": "coolify-deploy",
      "alias": ["deploy", "coolify", "app deploy"],
      "type": "skill",
      "location": ".claude/skills/coolify-deploy-trigger/SKILL.md",
      "guide_location": "docs/OPERATIONS/SKILLS/coolify-api-guide.md",
      "operations": ["deploy application", "trigger deployment", "list apps"],
      "endpoint": "coolify.zappro.site",
      "auth": "COOLIFY_API_KEY (Infisical)",
      "quality": "production",
      "last_verified": "2026-04-11"
    }
  ],
  "categories": {
    "deploy": ["coolify-deploy", "docker-deploy", "terraform-apply"],
    "monitor": ["grafana", "prometheus", "loki", "auto-healer"],
    "secret": ["infisical-get", "infisical-set", "infisical-update"],
    "infra": ["terraform", "cloudflare", "docker"],
    "voice": ["openclaw-audio", "wav2vec2", "kokoro-tts"]
  }
}
```

**Decision Tree** — `.claude/decision-tree.md`

```markdown
## "What do I use for X?"

### I need to DEPLOY something
→ Is it a Docker container?
  → YES: Use `coolify-deploy` skill
  → NO: Use `terraform-apply` skill

### I need to ADD/UPDATE a SECRET
→ Use `infisical-sdk` guide
→ Key patterns: getSecret, updateSecret, CreateSecretOptions

### I need to MONITOR something
→ Health check: Use `monitoring-health-check` skill
→ Logs: Use `loki-guide` + LogQL
→ Metrics: Use `prometheus-guide` + PromQL
→ Alert: Use `alerting-guide` + AlertManager

### I need to FIX a failing SERVICE
→ Use `auto-healer-guide`
→ Commands: /heal status, /heal restart <container>

### I need to AUDIT docs/skills
→ Use `doc-librarian` skill
```

### 2. Guide → Skill Conversion

Each guide in `docs/OPERATIONS/SKILLS/*.md` gets metadata:

```markdown
---
name: coolify-api-guide
type: operator-guide
category: deploy
invokable_as_skill: true
skill_alias: [coolify, coolify-api, deploy-coolify]
last_updated: 2026-04-11
quality: production
dependencies:
  - COOLIFY_API_KEY (Infisical: e42657ef-98b2-4b9c-9a04-46c093bd6d37/dev/)
  - COOLIFY_URL (http://127.0.0.1:8200 or https://coolify.zappro.site)
endpoints:
  - https://coolify.zappro.site/api/v1/applications
  - https://coolify.zappro.site/api/v1/services
---
```

**Symlink**: `.claude/skills/coolify-api-guide.md` → `docs/OPERATIONS/SKILLS/coolify-api-guide.md`

### 3. Memory Sync Intelligence

**Current state**: docs → memory (one-way via ai-context-sync)

**Target state**: Bidirectional with intelligence

```
docs/SPECS/SPEC-*.md ──[change]──→ memory/ ──[query]──→ Agent
                                          ↑
memory/ ──[sync]──→ obsidian/ ◄───[manual]─── docs/
```

**`scripts/memory-sync.sh`**:
```bash
#!/bin/bash
# Bidirectional sync with intelligence

# 1. Push docs changes → memory
ai-context-sync push

# 2. Pull memory changes → docs (ONLY for memory-generated content)
# Check: does memory have content NOT in docs?
# If yes: sync back, flag for review

# 3. Update skill-index.json from .claude/skills/
# Any new skill → auto-add to index

# 4. Verify obsidian mirror is clean
rsync --dry-run docs/SPECS/ obsidian/SPECS/
```

### 4. Agent Panel

**`.claude/AGENT-PANEL.md`** — Rendered panel agent sees:

```markdown
# Agent Operations Panel

## Quick Access
| Operation | Skill | Command |
|-----------|-------|---------|
| Deploy to Coolify | coolify-deploy | `/coolify` or use skill |
| Check health | monitoring-health-check | `/health` |
| Heal service | auto-healer | `/heal status` |
| Add secret | infisical-sdk | Use SDK pattern |
| View logs | loki-guide | LogQL queries |
| Get metrics | prometheus-guide | PromQL queries |

## Active Monitoring
- **Grafana**: https://monitor.zappro.site
- **Prometheus**: :9090
- **Loki**: :3101
- **AlertManager**: :9093

## Skill Categories
- 🔴 CRITICAL: infisical-sdk, coolify-deploy, auto-healer
- 🟡 INFRA: terraform, cloudflare, docker, zfs
- 🔵 VOICE: openclaw-audio, wav2vec2, tts-bridge, litellm
- 🟢 DEV: spec, code-review, test-generation, refactoring

## Decision Tree
[See .claude/decision-tree.md]
```

---

## Implementation Phases

### Phase A: Skill Index (Priority: CRITICAL)

**Tasks:**
- [ ] Create `.claude/skill-index.json` with all 15 new operator guides
- [ ] Create `.claude/skill-index.md` (human-readable)
- [ ] Create `.claude/decision-tree.md`
- [ ] Add metadata frontmatter to each operator guide
- [ ] Create symlinks `.claude/skills/*.md` → `docs/OPERATIONS/SKILLS/*.md`
- [ ] Update AGENTS.md to reference skill-index

### Phase B: Memory Sync Intelligence (Priority: HIGH)

**Tasks:**
- [ ] Audit current memory state vs docs reality
- [ ] Create `scripts/memory-sync.sh` (bidirectional)
- [ ] Add memory refresh trigger to cron (every 6h)
- [ ] Verify obsidian mirror is clean
- [ ] Update ai-context-sync if needed

### Phase C: Agent Panel (Priority: HIGH)

**Tasks:**
- [ ] Create `.claude/AGENT-PANEL.md`
- [ ] Integrate panel into CLAUDE.md startup message
- [ ] Add skill lookup to /spec workflow
- [ ] Add "what skill for X?" decision support

### Phase D: Guide Quality Verification (Priority: MEDIUM)

**Tasks:**
- [ ] Verify all 15 guides have working code examples
- [ ] Test each guide's examples actually work
- [ ] Fix any outdated patterns
- [ ] Add quick-reference cards to each guide

### Phase E: Cursor Loop Integration (Priority: HIGH)

**Tasks:**
- [ ] Integrate skill-index into cursor-loop leader
- [ ] Add skill lookup to /cursor-loop command
- [ ] Verify loop can find right skill for each step

---

## Files Affected

| File | Action |
|------|--------|
| `.claude/skill-index.json` | CREATE |
| `.claude/skill-index.md` | CREATE |
| `.claude/decision-tree.md` | CREATE |
| `.claude/AGENT-PANEL.md` | CREATE |
| `docs/OPERATIONS/SKILLS/*.md` | UPDATE (add metadata) |
| `.claude/skills/*.md` | CREATE (symlinks) |
| `scripts/memory-sync.sh` | CREATE |
| `.claude/AGENTS.md` | UPDATE |
| `.claude/CLAUDE.md` | UPDATE |

---

## Dependencies

- SPEC-024 (monitoring + auto-healer implementation)
- SPEC-CURSOR-LOOP (autonomous loop)
- SPEC-100 (pipeline bootstrap)

---

## Success Criteria

1. Agent can answer "what skill for X?" in < 5 seconds
2. All 15 operator guides are invokable as skills
3. Memory syncs bidirectionally without drift
4. Skill index auto-updates when new guides added
5. Decision tree covers 90% of common operations
