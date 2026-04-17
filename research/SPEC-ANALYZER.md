# SPEC-ANALYZER Research Report — SPEC-066

**Date:** 2026-04-17
**Research Focus:** `/researcher` skill + researcher duplication
**Author:** SPEC-ANALYZER agent

---

## 1. Key Findings

### 1.1 Researcher Skill — Two Versions Are Fundamentally Different

| Location | Type | Technology | Network | Infisical | PROIBIDO? |
|----------|------|------------|---------|-----------|-----------|
| `~/.claude/skills/researcher/` | Python script + SKILL.md | Tavily API via `requests` | ✅ Yes | ✅ Yes (hardcoded token) | **YES** |
| `/srv/monorepo/.claude/skills/researcher/` | SKILL.md only | Local read-only exploration | ❌ No | ❌ No | ❌ Clean |

**Global `researcher.py` (CRITICAL ISSUES):**
- Hardcoded Infisical token: `st.799590ae-d36f-4e64-b940-aea0fb85cad8.6e0c269870bb4b5e004e3ed6ab3a1fe1.c9872f2b30bc650e7b27c851df04b0ad`
- Uses `infisical_sdk` SDK — **PROIBIDO** per anti-hardcoded-secrets rules
- Hardcoded `TAVILY_API_KEY` via Infisical vault
- Functionality: Tavily web search formatted as markdown
- **VERDICT: DELETE — violates zero-hardcode mandate and uses pruned Infisical SDK**

**Monorepo `researcher` SKILL.md:**
- Read-only repository exploration using only `Read`, `Grep`, `Bash`
- No network access, no external APIs, no credentials
- Purpose: code archaeology, architecture discovery, symbol location
- **VERDICT: KEEP — SOTA local-only researcher**

### 1.2 Nested `.claude/.claude/` — Log Artifact Only

```
.claude/.claude/skills/orchestrator/logs/*.log  (28 log files)
```

- No skills, no actual content — purely orchestrator execution logs
- **VERDICT: DELETE recursively** (safe — logs only)

### 1.3 Orchestrator "Duplication" — SPEC-066 May Be Inaccurate

The SPEC claims `orchestrator` exists in BOTH global and monorepo with different versions. **Reality:**

- `~/.claude/skills/` — NO `orchestrator` skill directory found
- `/srv/monorepo/.claude/skills/orchestrator/` — EXISTS (active, version 1.0.0)
- However, global has `auto-orchestrate` and `pipeline-orchestrate` which serve similar auto-orchestration purposes but are NOT the 14-agent orchestrator

**Possible confusion source:** SPEC-066 may have conflated `auto-orchestrate` + `pipeline-orchestrate` with the actual `orchestrator` skill. The 14-agent orchestrator only exists in monorepo.

### 1.4 Duplicate Skills — Confirmed Deletions

| Skill | Location | Reason to Delete |
|-------|----------|-----------------|
| `gitea-coolify-deploy` | global | Duplicate of `gitea-access` + `coolify-deploy-trigger` combined |
| `pipeline-orchestrate` | global | Redundant; `orchestrator` in monorepo is the SOTA 14-agent version |
| `openclaw-oauth-profiles` | global | OpenClaw deprecated/pruned per SPEC-051 |
| `voice` | global | Hermes voice pipeline is SOTA |
| `researcher` (Python/Tavily) | global | PROIBIDO: Infisical SDK + hardcoded token + Tavily |
| `researcher` | monorepo | **KEEP** — local-only SOTA researcher |
| `cloudflare-terraform` | monorepo | Replaced by `cloudflare-tunnel-enterprise` |

---

## 2. Recommendations

### 2.1 AGENTS.md Updates

No changes needed to AGENTS.md for researcher — the agent definition already routes to the correct monorepo `researcher.md` (`.claude/agents/researcher.md`).

However, the global `researcher` SKILL.md uses `minimax/MiniMax-M2.7` model — this references `minimax` which is PROIBIDO per SPEC-066. Update the global skill SKILL.md frontmatter to remove any `minimax` model references if the skill is kept.

### 2.2 CLAUDE.md — Add Researcher Skill Validation

The anti-hardcoded-secrets rules already block Infisical SDK. Add explicit mention of researcher skill validation:

```
### Researcher Skill
- Global `~/.claude/skills/researcher/` (Tavily/Infisical) = DELETE
- Monorepo `.claude/agents/researcher.md` = KEEP (local-only)
- Never use global researcher.py — it uses prohibited Infisical SDK
```

### 2.3 What to Delete

```bash
# DELETE — nested backup artifact (logs only)
rm -rf /srv/monorepo/.claude/.claude/

# DELETE — PROIBIDO: Infisical SDK + hardcoded token
rm -rf ~/.claude/skills/researcher/

# DELETE — OpenClaw deprecated
rm -rf ~/.claude/skills/openclaw-oauth-profiles/

# DELETE — superseded by cloudflare-tunnel-enterprise
rm -rf /srv/monorepo/.claude/skills/cloudflare-terraform/

# DELETE — redundant with orchestrator (monorepo)
rm -rf ~/.claude/skills/pipeline-orchestrate/

# DELETE — Hermes SOTA
rm -rf ~/.claude/skills/voice/

# DELETE — duplicate (gitea-access is sufficient)
rm -rf ~/.claude/skills/gitea-coolify-deploy/

# DELETE — monorepo copy is redundant (use global version)
rm -rf /srv/monorepo/.claude/skills/researcher/
```

### 2.4 What to Keep

| Skill | Location | Reason |
|-------|----------|--------|
| `orchestrator` | monorepo | Only orchestrator (14-agent) |
| `researcher` | monorepo `agents/researcher.md` | Local-only, clean |
| `auto-orchestrate` | global | Memory sync, not duplicate |
| `cloudflare-tunnel-enterprise` | monorepo | SOTA terraform |
| `gitea-access` | monorepo | Primary Gitea integration |
| `coolify-deploy-trigger` | global | Standalone Coolify deploy |
| `coolify-sre` | monorepo | Lighter monorepo version |

---

## 3. April 2026 Best Practices for Agent/Skill Architecture

1. **Zero network by default** — researcher agents should use only read-only local tools unless explicitly required
2. **No external API SDKs in skills** — all API calls via `process.env` env vars, no SDK imports
3. **Single source per capability** — never have 2 skills with overlapping functionality and different implementations
4. **Skills = markdown prompts, not scripts** — executable scripts in skills violate the skill paradigm and create maintenance burden
5. **Symlinks for shared commands** — `~/.claude/commands/` uses symlinks to agent-skills correctly; don't copy

---

## 4. Summary

| Action | Count |
|--------|-------|
| DELETE nested `.claude/.claude/` | 1 |
| DELETE global skills | 6 (`researcher`, `openclaw-oauth-profiles`, `pipeline-orchestrate`, `voice`, `gitea-coolify-deploy`) |
| DELETE monorepo skills | 2 (`researcher`, `cloudflare-terraform`) |
| KEEP (no change needed) | orchestrator, auto-orchestrate, gitea-access, cloudflare-tunnel-enterprise |

**Net result:** 9 deletions, 0 additions, ~5min of tech debt removed.

**SPEC-066 accuracy note:** The "orchestrator in both" claim appears to be inaccurate — orchestrator only exists in monorepo. The confusion likely comes from `auto-orchestrate` + `pipeline-orchestrate` in global being misidentified as orchestrator variants.
