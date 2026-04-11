# INTELLIGENT SKILL INDEX SYSTEM
## Design Document v1.0
**Author:** Systems Architect
**Date:** 2026-04-11
**Status:** Design Proposal

---

## Executive Summary

This document designs an **Intelligent Skill Index System** for `/srv/monorepo` that enables:
- Skill discovery via problem/solution mapping
- Autonomous skill invocation based on context
- Memory-synchronized skill availability
- Unified dashboard for agent skill queries

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Skill Inventory (as of 2026-04-11)

| Source | Count | Format | Location |
|--------|-------|--------|----------|
| Local Skills | 34 | SKILL.md (YAML frontmatter) | `.claude/skills/` |
| Antigravity Kit Skills | 10 | SKILL.md | `.agent/skills/` |
| Operations Guides | 47 | Markdown + Shell | `docs/OPERATIONS/SKILLS/` |
| Cursor Loop Agents | 24 | Markdown | `.claude/agents/` |
| Slash Commands | 11 | Markdown | `.claude/commands/` |

### 1.2 Existing Skill Metadata Format

```yaml
# .claude/skills/<skill>/SKILL.md
---
name: skill-name
description: One-line description
trigger: /slash-command (optional)
phases: [E, V] (optional)
---
# Skill Title

## Overview
## Context
## Commands
## Examples
## Related Skills
```

### 1.3 Operations Guide Format

```markdown
# docs/OPERATIONS/SKILLS/<guide>.md
---
skill: guide-name
description: What this guide does
tags: [tag1, tag2]
runtime: Agent or human operator
---
# Guide Title

## Procedure
## Commands
## Output Format
## Common Issues
```

### 1.4 Invocation Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| Slash command | `/bug`, `/se`, `/review` | Manual agent invocation |
| Skill tool | `Skill(skill="bug-investigation")` | Autonomous loop |
| Direct reference | "Use the coolify-access skill" | Conversation context |
| Agent chain | `cursor-loop-leader` → `cursor-loop-ship` | Autonomous workflow |

### 1.5 Gap Analysis

| Issue | Description |
|-------|-------------|
| **Discoverability** | No central index - skills scattered across 4 directories |
| **Problem→Skill mapping** | No clear path from "I have X problem" to "use skill Y" |
| **Guide→Skill conversion** | Operations guides not invokable as skills |
| **Memory sync** | Skills not synchronized to memory index |
| **Context awareness** | No system to suggest skills based on current state |

---

## 2. SKILL INDEX SYSTEM DESIGN

### 2.1 Index File Format

**Location:** `/srv/monorepo/.claude/skill-index.json` (machine-readable)

**Schema:**

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-04-11T00:00:00Z",
  "skills": {
    "<skill-id>": {
      "name": "Human-readable name",
      "description": "One-line description",
      "category": "code-quality|operations|ci-cd|infrastructure|spec-workflow|investigation",
      "tags": ["debugging", "systematic", "root-cause"],
      "source": ".claude/skills|.agent/skills|docs/OPERATIONS/SKILLS",
      "path": "relative/path/to/SKILL.md",
      "trigger": "/slash-command or null",
      "phases": ["E", "V", "R", "B", "S"] or null,
      "autonomous": true,
      "risk": "low|medium|high",
      "problems": [
        {
          "query": "how to debug X",
          "weight": 0.9
        }
      ],
      "requires": ["skill-id"] or null,
      "relatedSkills": ["skill-id"] or null,
      "outputs": ["review-report", "test-cases"] or null
    }
  },
  "categories": {
    "code-quality": {
      "description": "Code review, testing, security",
      "skills": ["skill-id"]
    }
  },
  "problems": {
    "<problem-id>": {
      "query": "my code has a bug",
      "matchedSkills": [
        {
          "skillId": "bug-investigation",
          "confidence": 0.95,
          "reason": "Systematic bug investigation"
        }
      ]
    }
  }
}
```

### 2.2 Skill Metadata Fields (Enhanced)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | kebab-case unique identifier |
| `name` | string | Yes | Human-readable name |
| `description` | string | Yes | One-line description (max 120 chars) |
| `category` | enum | Yes | Primary category |
| `subcategory` | string | No | Secondary classification |
| `tags` | string[] | Yes | Searchable tags |
| `source` | path | Yes | Where skill is defined |
| `path` | path | Yes | Relative path to skill file |
| `trigger` | string | No | Slash command (e.g., "/bug") |
| `phases` | string[] | No | AGENTS.md phase association [E,V,R,B,S] |
| `autonomous` | boolean | Yes | Can run in autonomous loop |
| `risk` | enum | Yes | low/medium/high/critical |
| `problems` | Problem[] | No | Problem→skill mapping |
| `requires` | string[] | No | Skills that must run first |
| `relatedSkills` | string[] | No | Skills often used together |
| `outputs` | string[] | No | What this skill produces |
| `runtime` | enum | No | agent/human/both |
| `estimatedTime` | string | No | "5 min", "30 min" |
| `examples` | Example[] | No | Usage examples |

### 2.3 Complete Skill Index (Initial Population)

```json
{
  "skills": {
    "bug-investigation": {
      "name": "Bug Investigation",
      "description": "Systematic bug investigation and root cause analysis",
      "category": "investigation",
      "tags": ["debug", "bug", "root-cause", "systematic"],
      "source": ".claude/skills/bug-investigation",
      "path": ".claude/skills/bug-investigation/SKILL.md",
      "trigger": "/bug",
      "phases": ["E", "V"],
      "autonomous": true,
      "risk": "low",
      "problems": [
        {"query": "how to find the root cause of a bug", "weight": 0.95},
        {"query": "debug crashing application", "weight": 0.9},
        {"query": "investigate error in logs", "weight": 0.85}
      ],
      "outputs": ["root-cause-analysis", "fix-recommendation"],
      "relatedSkills": ["systematic-debugging", "code-review"]
    },
    "secrets-audit": {
      "name": "Secrets Audit",
      "description": "Scan code for exposed secrets before git push",
      "category": "operations",
      "tags": ["security", "secrets", "audit", "pre-commit"],
      "source": ".claude/skills/secrets-audit",
      "path": ".claude/skills/secrets-audit/SKILL.md",
      "trigger": "/se",
      "autonomous": true,
      "risk": "critical",
      "problems": [
        {"query": "check for api keys in code", "weight": 0.98},
        {"query": "scan for hardcoded secrets", "weight": 0.95},
        {"query": "before git push security check", "weight": 0.9}
      ],
      "outputs": ["audit-report", "secret_locations"],
      "requires": null,
      "relatedSkills": ["security-audit", "snapshot-safe"]
    },
    "code-review": {
      "name": "Code Review",
      "description": "Review code quality, patterns, and best practices",
      "category": "code-quality",
      "tags": ["review", "quality", "patterns", "best-practices"],
      "source": ".claude/skills/code-review",
      "path": ".claude/skills/code-review/SKILL.md",
      "trigger": "/review",
      "phases": ["R", "V"],
      "autonomous": true,
      "risk": "low",
      "problems": [
        {"query": "review code before merge", "weight": 0.95},
        {"query": "check code quality", "weight": 0.9},
        {"query": "what issues exist in this code", "weight": 0.85}
      ],
      "outputs": ["review-report", "issue-list"],
      "relatedSkills": ["bug-investigation", "test-generation"]
    },
    "test-generation": {
      "name": "Test Generation",
      "description": "Generate comprehensive test cases for code",
      "category": "code-quality",
      "tags": ["testing", "tdd", "test-cases", "coverage"],
      "source": ".claude/skills/test-generation",
      "path": ".claude/skills/test-generation/SKILL.md",
      "trigger": "/test",
      "phases": ["E", "B"],
      "autonomous": true,
      "risk": "low",
      "problems": [
        {"query": "write tests for this function", "weight": 0.95},
        {"query": "increase test coverage", "weight": 0.9},
        {"query": "generate unit tests", "weight": 0.9}
      ],
      "outputs": ["test-files", "coverage-report"],
      "relatedSkills": ["code-review", "smoke-test-gen"]
    },
    "security-audit": {
      "name": "Security Audit",
      "description": "Security review checklist for code and infrastructure",
      "category": "code-quality",
      "tags": ["security", "owasp", "audit", "vulnerabilities"],
      "source": ".claude/skills/security-audit",
      "path": ".claude/skills/security-audit/SKILL.md",
      "trigger": "/sec",
      "autonomous": true,
      "risk": "high",
      "problems": [
        {"query": "security check for new endpoint", "weight": 0.95},
        {"query": "audit for sql injection", "weight": 0.9},
        {"query": "review authentication code", "weight": 0.9}
      ],
      "outputs": ["security-report", "vulnerability-list"],
      "relatedSkills": ["secrets-audit", "code-review"]
    },
    "pipeline-gen": {
      "name": "Pipeline Generator",
      "description": "Generate tasks/pipeline.json from SPEC",
      "category": "spec-workflow",
      "tags": ["spec", "pipeline", "tasks", "spec-driven"],
      "source": ".claude/skills/pipeline-gen",
      "path": ".claude/skills/pipeline-gen/SKILL.md",
      "trigger": "/pg",
      "phases": ["P"],
      "autonomous": true,
      "risk": "medium",
      "problems": [
        {"query": "generate tasks from spec", "weight": 0.98},
        {"query": "create pipeline from specification", "weight": 0.95},
        {"query": "turn spec into tasks", "weight": 0.9}
      ],
      "outputs": ["pipeline.json", "tasks.md"],
      "requires": ["spec-driven-development"],
      "relatedSkills": ["spec-driven-development"]
    },
    "spec-driven-development": {
      "name": "Spec-Driven Development",
      "description": "Spec → plan → implement workflow",
      "category": "spec-workflow",
      "tags": ["spec", "spec-driven", "planning", "design"],
      "source": ".claude/skills/spec-driven-development",
      "path": ".claude/skills/spec-driven-development/SKILL.md",
      "trigger": "/spec",
      "phases": ["R", "P"],
      "autonomous": true,
      "risk": "medium",
      "problems": [
        {"query": "start a new feature", "weight": 0.95},
        {"query": "write specification before coding", "weight": 0.9},
        {"query": "plan implementation from requirements", "weight": 0.9}
      ],
      "outputs": ["SPEC-*.md", "tasks.md"],
      "relatedSkills": ["pipeline-gen", "feature-breakdown"]
    },
    "coolify-access": {
      "name": "Coolify Access",
      "description": "Coolify API integration — deploy services, manage docker-compose",
      "category": "ci-cd",
      "tags": ["coolify", "deploy", "docker", "api"],
      "source": ".claude/skills/coolify-access",
      "path": ".claude/skills/coolify-access/SKILL.md",
      "autonomous": true,
      "risk": "high",
      "problems": [
        {"query": "deploy to coolify via api", "weight": 0.95},
        {"query": "restart service in coolify", "weight": 0.9},
        {"query": "manage docker compose on coolify", "weight": 0.9}
      ],
      "outputs": ["deploy-status", "container-logs"],
      "requires": ["snapshot-safe"],
      "relatedSkills": ["coolify-deploy-trigger", "deploy-validate"]
    },
    "gitea-access": {
      "name": "Gitea Access",
      "description": "Gitea API — list repos, trigger workflows, check CI status",
      "category": "ci-cd",
      "tags": ["gitea", "ci-cd", "workflows", "api"],
      "source": ".claude/skills/gitea-access",
      "path": ".claude/skills/gitea-access/SKILL.md",
      "autonomous": true,
      "risk": "medium",
      "problems": [
        {"query": "trigger gitea workflow", "weight": 0.95},
        {"query": "check ci status", "weight": 0.9},
        {"query": "create pull request", "weight": 0.85}
      ],
      "outputs": ["workflow-status", "pr-url"],
      "relatedSkills": ["coolify-access", "code-review"]
    },
    "snapshot-safe": {
      "name": "Snapshot Safe",
      "description": "ZFS snapshot with checklist before destructive changes",
      "category": "operations",
      "tags": ["zfs", "snapshot", "backup", "destructive"],
      "source": ".claude/skills/snapshot-safe",
      "path": ".claude/skills/snapshot-safe/SKILL.md",
      "autonomous": false,
      "risk": "critical",
      "runtime": "human",
      "problems": [
        {"query": "snapshot before cleanup", "weight": 0.98},
        {"query": "backup before destructive operation", "weight": 0.95},
        {"query": "rollback capability check", "weight": 0.9}
      ],
      "outputs": ["snapshot-created", "rollback-command"],
      "relatedSkills": ["secrets-audit"]
    },
    "human-gates": {
      "name": "Human Gates",
      "description": "Identify blockers that require human approval",
      "category": "spec-workflow",
      "tags": ["blockers", "approval", "human-gate", "spec"],
      "source": ".claude/skills/human-gates",
      "path": ".claude/skills/human-gates/SKILL.md",
      "trigger": "/hg",
      "autonomous": true,
      "risk": "low",
      "problems": [
        {"query": "what requires human approval", "weight": 0.95},
        {"query": "identify blockers in pipeline", "weight": 0.9},
        {"query": "human gate check", "weight": 0.9}
      ],
      "outputs": ["blocker-list", "approval-needed"],
      "relatedSkills": ["pipeline-gen"]
    },
    "mcp-health": {
      "name": "MCP Health",
      "description": "Diagnose all MCP servers status",
      "category": "operations",
      "tags": ["mcp", "health", "diagnostic", "tools"],
      "source": ".claude/skills/mcp-health",
      "path": ".claude/skills/mcp-health/SKILL.md",
      "autonomous": true,
      "risk": "low",
      "problems": [
        {"query": "check if mcp servers are working", "weight": 0.98},
        {"query": "diagnose tool failures", "weight": 0.9},
        {"query": "mcp server status", "weight": 0.95}
      ],
      "outputs": ["health-report", "mcp-status-list"],
      "relatedSkills": ["repo-scan"]
    },
    "self-healing": {
      "name": "Self-Healing",
      "description": "Auto-heal loop for containers and services",
      "category": "operations",
      "tags": ["healing", "auto-restart", "container", "monitoring"],
      "source": "docs/OPERATIONS/SKILLS/self-healing.sh",
      "path": "docs/OPERATIONS/SKILLS/self-healing.sh",
      "autonomous": true,
      "risk": "medium",
      "problems": [
        {"query": "container keeps restarting", "weight": 0.9},
        {"query": "service is down", "weight": 0.85},
        {"query": "auto heal docker containers", "weight": 0.95}
      ],
      "outputs": ["heal-report", "restart-log"],
      "relatedSkills": ["incident-runbook"]
    },
    "incident-runbook": {
      "name": "Incident Runbook",
      "description": "Structured incident response for homelab",
      "category": "operations",
      "tags": ["incident", "triage", "homelab", "traefik", "docker"],
      "source": "docs/OPERATIONS/SKILLS/incident-runbook.md",
      "path": "docs/OPERATIONS/SKILLS/incident-runbook.md",
      "runtime": "agent",
      "autonomous": true,
      "risk": "high",
      "problems": [
        {"query": "site is down", "weight": 0.98},
        {"query": "502 error troubleshooting", "weight": 0.9},
        {"query": "container network isolation", "weight": 0.85}
      ],
      "outputs": ["incident-report", "fix-applied"],
      "relatedSkills": ["self-healing", "verify-network"]
    },
    "ai-stress-test": {
      "name": "AI Stack Stress Test",
      "description": "Stress test AI Router + Ollama + OpenRouter + LiteLLM",
      "category": "operations",
      "tags": ["ai", "stress-test", "ollama", "litellm", "openrouter"],
      "source": "docs/OPERATIONS/SKILLS/ai-stress-test.md",
      "path": "docs/OPERATIONS/SKILLS/ai-stress-test.md",
      "runtime": "agent",
      "autonomous": true,
      "risk": "medium",
      "problems": [
        {"query": "validate ai stack health", "weight": 0.9},
        {"query": "check rate limits", "weight": 0.85},
        {"query": "stress test ai routing", "weight": 0.9}
      ],
      "outputs": ["stress-test-report", "vram-usage"],
      "relatedSkills": ["litellm-health-check", "ollama-health-check"]
    },
    "cloudflare-terraform": {
      "name": "Cloudflare Terraform",
      "description": "Terraform + Cloudflare Zero Trust Tunnel management",
      "category": "infrastructure",
      "tags": ["cloudflare", "terraform", "dns", "tunnel", "subdomain"],
      "source": ".claude/skills/cloudflare-terraform",
      "path": ".claude/skills/cloudflare-terraform/SKILL.md",
      "autonomous": false,
      "risk": "high",
      "requires": ["network-governance-check"],
      "problems": [
        {"query": "add new subdomain", "weight": 0.95},
        {"query": "configure cloudflare tunnel", "weight": 0.9},
        {"query": "dns management", "weight": 0.85}
      ],
      "outputs": ["terraform-plan", "dns-config"],
      "relatedSkills": ["network-ports-guide"]
    }
  },
  "categories": {
    "code-quality": {
      "description": "Code review, testing, security auditing",
      "skills": ["code-review", "test-generation", "security-audit", "secrets-audit"]
    },
    "ci-cd": {
      "description": "Continuous integration and deployment",
      "skills": ["coolify-access", "gitea-access", "coolify-deploy-trigger", "deploy-validate"]
    },
    "operations": {
      "description": "Homelab operations, monitoring, healing",
      "skills": ["self-healing", "incident-runbook", "snapshot-safe", "mcp-health", "ai-stress-test"]
    },
    "spec-workflow": {
      "description": "Spec-driven development workflow",
      "skills": ["spec-driven-development", "pipeline-gen", "human-gates", "feature-breakdown"]
    },
    "investigation": {
      "description": "Debugging and root cause analysis",
      "skills": ["bug-investigation", "systematic-debugging", "repo-scan"]
    },
    "infrastructure": {
      "description": "Infrastructure management",
      "skills": ["cloudflare-terraform", "zfs-guide", "network-ports-guide"]
    }
  }
}
```

### 2.4 Problem→Skill Decision Tree

```
"I need to..."
│
├─ DEBUG/INVESTIGATE
│  ├─ "find a bug" → bug-investigation
│  ├─ "debug systematically" → systematic-debugging
│  └─ "check what's broken" → incident-runbook
│
├─ BEFORE PUSH
│  ├─ "scan for secrets" → secrets-audit (CRITICAL)
│  └─ "security check" → security-audit
│
├─ CODE QUALITY
│  ├─ "review code" → code-review
│  ├─ "write tests" → test-generation
│  └─ "generate smoke tests" → smoke-test-gen
│
├─ SPEC WORKFLOW
│  ├─ "start new feature" → spec-driven-development
│  ├─ "turn spec into tasks" → pipeline-gen
│  └─ "identify blockers" → human-gates
│
├─ DEPLOY/CI-CD
│  ├─ "deploy to coolify" → coolify-access
│  ├─ "trigger gitea workflow" → gitea-access
│  ├─ "validate deploy" → deploy-validate
│  └─ "snapshot before deploy" → snapshot-safe (REQUIRED)
│
├─ OPERATIONS
│  ├─ "heal container" → self-healing
│  ├─ "handle incident" → incident-runbook
│  ├─ "check MCP health" → mcp-health
│  ├─ "stress test AI stack" → ai-stress-test
│  └─ "ZFS operation" → snapshot-safe (REQUIRED)
│
└─ INFRASTRUCTURE
   ├─ "add subdomain" → cloudflare-terraform
   └─ "manage network" → network-ports-guide
```

---

## 3. SKILL CONVERSION SYSTEM

### 3.1 Converting Operations Guides to Invokable Skills

**Conversion Pipeline:**

```
docs/OPERATIONS/SKILLS/<guide>.md
         │
         ▼
    ┌─────────────┐
    │  Converter  │
    └─────────────┘
         │
         ▼
    ┌─────────────────────────┐
    │  Extract Metadata        │
    │  - name, description     │
    │  - tags, category        │
    │  - problems addressed    │
    └─────────────────────────┘
         │
         ▼
    ┌─────────────────────────┐
    │  Generate SKILL.md      │
    │  - YAML frontmatter     │
    │  - Link to original      │
    │  - Invocation wrapper    │
    └─────────────────────────┘
         │
         ▼
    ┌─────────────────────────┐
    │  Register in Index      │
    │  - skill-index.json      │
    │  - Update lastUpdated    │
    └─────────────────────────┘
```

### 3.2 Conversion Template

**For each guide in `docs/OPERATIONS/SKILLS/`:**

```markdown
# Generated SKILL.md from operations guide
---
name: ai-stress-test
description: Stress test AI Router + Ollama + OpenRouter + LiteLLM
category: operations
tags: [ai, stress-test, ollama, litellm, openrouter, monitoring]
source: docs/OPERATIONS/SKILLS/ai-stress-test.md
path: docs/OPERATIONS/SKILLS/ai-stress-test.md
autonomous: true
risk: medium
runtime: agent
problems:
  - {query: "validate ai stack health", weight: 0.9}
  - {query: "check rate limits", weight: 0.85}
  - {query: "stress test ai routing", weight: 0.9}
relatedSkills:
  - litellm-health-check
  - ollama-health-check
---

# AI Stack Stress Test

> **WARNING:** This skill was converted from `docs/OPERATIONS/SKILLS/ai-stress-test.md`.
> The original guide is the source of truth.

## Quick Invoke

```bash
bash docs/OPERATIONS/SKILLS/ai-stress-test.md
```

## Full Guide

[Link to original guide content]
```

### 3.3 Skill Invocation Patterns

| Invocation Type | Syntax | Use Case |
|----------------|--------|----------|
| **Slash Command** | `/bug`, `/se`, `/review` | Manual agent invocation |
| **Skill Tool** | `Skill(skill="bug-investigation")` | Autonomous loop |
| **Direct Reference** | "Use the coolify-access skill" | Conversation context |
| **Chain Composition** | Skill → Skill → Skill | Complex workflows |
| **Agent Delegation** | `cursor-loop-leader` | Autonomous CI/CD |

### 3.4 Discovery System

```bash
# Find skills for a problem
cat .claude/skill-index.json | jq '.skills[] | select(.problems[].query | contains("find a bug"))'

# List all skills by category
cat .claude/skill-index.json | jq '.categories'

# Get skill by trigger
cat .claude/skill-index.json | jq '.skills[] | select(.trigger == "/bug")'
```

---

## 4. MEMORY SYNC INTELLIGENCE

### 4.1 Sync Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MEMORY INDEX                            │
│              ~/.claude/projects/-srv-monorepo/              │
│                     memory/MEMORY.md                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Sync Trigger
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  SKILL INDEX SYNC                           │
│                  .claude/skill-index.json                    │
│                                                               │
│  Events that trigger sync:                                    │
│  - Skill creation/modification (via hook)                    │
│  - Operations guide added/modified                           │
│  - cron job: ai-context-sync (every 30 min)                 │
│  - Manual: /sync command                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Bidirectional
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   OBSIDIAN VAULT                            │
│                  docs/obsidian/                              │
│                                                               │
│  Sync targets:                                               │
│  - Skill catalog → obsidian/skills/                          │
│  - Decision trees → obsidian/decision-trees/                 │
│  - Category indexes → obsidian/indexes/                      │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Memory Sync Protocol

```bash
#!/bin/bash
# sync-skill-index.sh
# Called by ai-context-sync cron or manual invocation

SKILL_INDEX=".claude/skill-index.json"
OBSIDIAN_VAULT="docs/obsidian/skills"

# 1. Parse skill-index.json
# 2. Generate Obsidian notes for each skill
# 3. Generate category index
# 4. Generate problem→skill decision tree
# 5. Update MEMORY.md skill section

generate_skill_note() {
  local skill_id="$1"
  local skill_data=$(jq ".skills.$skill_id" "$SKILL_INDEX")

  local name=$(echo "$skill_data" | jq -r '.name')
  local description=$(echo "$skill_data" | jq -r '.description')
  local category=$(echo "$skill_data" | jq -r '.category')
  local tags=$(echo "$skill_data" | jq -r '.tags | join(", ")')
  local trigger=$(echo "$skill_data" | jq -r '.trigger // empty')
  local problems=$(echo "$skill_data" | jq -r '.problems[].query // empty' | tr '\n' '; ')

  cat <<EOF
---
skill_id: $skill_id
name: $name
category: $category
tags: [$tags]
trigger: $trigger
---

# $name

$description

## Problems This Solves
$problems

## Source
\`\`\`
$(jq ".skills.$skill_id.path" "$SKILL_INDEX")
\`\`\`

## Related Skills
$(jq -r ".skills.$skill_id.relatedSkills[]? // empty" "$SKILL_INDEX" | sed 's/^/- [[\.&]]/')

---
*Auto-generated from skill-index.json*
EOF
}

# Main sync loop
for skill_id in $(jq -r '.skills | keys[]' "$SKILL_INDEX"); do
  generate_skill_note "$skill_id" > "$OBSIDIAN_VAULT/$skill_id.md"
done

# Generate category index
jq -r '.categories | to_entries[] | "- [[" + .key + "]] - " + .value.description' "$SKILL_INDEX" \
  > "$OBSIDIAN_VAULT INDEX/categories.md"

echo "Skill index synced to Obsidian"
```

### 4.3 Agent Skill Availability Communication

```markdown
# In MEMORY.md - Skill Section

## Available Skills (2026-04-11)

### Critical Operations (Always Available)
| Skill | Use | Trigger |
|-------|-----|---------|
| secrets-audit | Scan for hardcoded secrets | /se |
| snapshot-safe | ZFS snapshot before destructive | — |
| incident-runbook | Handle homelab outages | — |

### Code Quality
| Skill | Use | Trigger |
|-------|-----|---------|
| code-review | 5-axis code review | /review |
| test-generation | Generate test cases | /test |
| security-audit | OWASP top 10 | /sec |
| bug-investigation | Root cause analysis | /bug |

### SPEC Workflow
| Skill | Use | Trigger |
|-------|-----|---------|
| spec-driven-development | Spec → implement | /spec |
| pipeline-gen | SPEC → pipeline.json | /pg |
| human-gates | Identify blockers | /hg |

### CI/CD & Deploy
| Skill | Use |
|-------|-----|
| coolify-access | Coolify API integration |
| gitea-access | Gitea Actions API |
| deploy-validate | Pre-deploy health check |

### Operations
| Skill | Use |
|-------|-----|
| self-healing | Auto-heal containers |
| mcp-health | MCP server diagnostics |
| ai-stress-test | AI stack validation |

---

## 5. DASHBOARD / INDEX PANEL

### 5.1 Agent Query Interface

When an agent asks "what's available?" or "what can I use for X?", present:

```markdown
# Skill Index Dashboard

## Quick Access

### 🔴 Critical (Run Before Any Destructive Action)
- **secrets-audit** — Scan code for secrets (`/se`)
- **snapshot-safe** — ZFS snapshot before changes

### 🟡 SPEC-Driven Development
- **spec-driven-development** — Start feature with spec (`/spec`)
- **pipeline-gen** — Generate tasks from SPEC (`/pg`)
- **human-gates** — Identify blockers (`/hg`)

### 🔵 Code Quality
- **code-review** — 5-axis review (`/review`)
- **test-generation** — Generate tests (`/test`)
- **security-audit** — Security checklist (`/sec`)
- **bug-investigation** — Debug (`/bug`)

### 🟢 CI/CD & Deploy
- **coolify-access** — Deploy via Coolify API
- **gitea-access** — Manage Gitea workflows
- **deploy-validate** — Pre-deploy check

### 🔷 Operations
- **self-healing** — Auto-heal containers
- **incident-runbook** — Handle outages
- **mcp-health** — Diagnose MCPs
- **ai-stress-test** — Validate AI stack

---

## Decision Tree: What Skill Do I Use?

```
START: What do you need to do?
│
├─ I found a bug
│  └─ → bug-investigation (/bug)
│
├─ I'm about to git push
│  └─ → secrets-audit (/se) [REQUIRED]
│
├─ I need to deploy something
│  ├─ → snapshot-safe [REQUIRED FIRST]
│  ├─ → coolify-access
│  └─ → deploy-validate
│
├─ I want to review code
│  ├─ → code-review (/review)
│  ├─ → security-audit (/sec)
│  └─ → test-generation (/test)
│
├─ I'm starting a new feature
│  ├─ → spec-driven-development (/spec)
│  ├─ → pipeline-gen (/pg)
│  └─ → feature-breakdown
│
├─ Something is broken/down
│  ├─ → incident-runbook (if site down)
│  ├─ → self-healing (if container issue)
│  └─ → mcp-health (if tool issue)
│
└─ I need to add infrastructure
   ├─ → cloudflare-terraform (subdomains/DNS)
   └─ → network-ports-guide (port management)
```

### 5.2 Skill Quick Reference Cards

```markdown
## Skill: bug-investigation

**What it does:** Systematic 4-phase bug investigation
**When to use:** Bug fix PRs, crash reports, error investigation
**Risk:** Low
**Trigger:** /bug
**Autonomous:** Yes

**The 4 Phases:**
1. Reproduce — Get exact error reproduction
2. Isolate — Narrow to root cause file/line
3. Understand — Explain why bug occurs
4. Fix — Propose solution

**Example output:**
```
## Bug Investigation Report
**Bug:** N+1 query in /api/users
**Root cause:** Missing eager loading
**File:** apps/api/src/users/repository.ts:45
**Fix:** Add .include('projects') to query
```
```

---

## 6. AUTONOMOUS LOOP INTEGRATION

### 6.1 Cursor Loop Skill Routing

```
CURSOR-LOOP-LEADER
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    SKILL INDEX LOOKUP                         │
│                                                                │
│  Based on currentState → Determine required skills:           │
│                                                                │
│  IDLE → pipeline-gen (get next task)                           │
│  RESEARCH → researcher (web search)                            │
│  SPEC → spec-driven-development                                 │
│  PLAN → feature-breakdown, human-gates                         │
│  BUILD → code-review, test-generation                          │
│  TEST_FAILED → bug-investigation, systematic-debugging         │
│  READY_TO_SHIP → secrets-audit, deploy-validate, gitea-access │
│  BLOCKED_HUMAN → human-gates                                   │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    SKILL EXECUTION                            │
│                                                                │
│  Skills are invoked via Skill() tool or slash commands:        │
│                                                                │
│  Skill(skill="secrets-audit")                                 │
│  Skill(skill="coolify-access")                                 │
│  Skill(skill="deploy-validate")                                │
│                                                                │
│  Results fed back to leader for next decision                  │
└───────────────────────────────────────────────────────────────┘
```

### 6.2 Skill Chain Patterns

**Pattern 1: Deploy Pipeline**
```javascript
// deploy-pipeline.js
const skills = [
  { skill: 'snapshot-safe', required: true },
  { skill: 'secrets-audit', required: true },
  { skill: 'gitea-access', required: false },
  { skill: 'coolify-access', required: true },
  { skill: 'deploy-validate', required: true },
  { skill: 'smoke-test-gen', required: false }
];

async function runDeployPipeline() {
  for (const { skill, required } of skills) {
    if (required || confirm(`Run ${skill}?`)) {
      await Skill(skill);
    }
  }
}
```

**Pattern 2: SPEC Execution**
```javascript
// spec-execution.js
const specSkills = [
  { phase: 'SPEC', skill: 'spec-driven-development' },
  { phase: 'PLAN', skill: 'pipeline-gen' },
  { phase: 'TASKS', skill: 'feature-breakdown' },
  { phase: 'BLOCKERS', skill: 'human-gates' }
];
```

### 6.3 Integration with SPEC Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                         /spec                                    │
│                    (spec-driven-development)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SPEC.md created                              │
│                    docs/SPECS/SPEC-XXX.md                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         /pg                                     │
│                      (pipeline-gen)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    pipeline.json                                │
│                    tasks.md                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CURSOR-LOOP-LEADER                             │
│                                                                │
│  For each task:                                                │
│  - BUILD → code-review, test-generation                        │
│  - TEST → smoke-test-gen                                       │
│  - SHIP → secrets-audit, deploy-validate, gitea-access         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1: Skill Index Foundation (Day 1)
- [ ] Create `.claude/skill-index.json` with all 34 local skills
- [ ] Add Antigravity Kit skills to index
- [ ] Convert top 10 operations guides to skills
- [ ] Create `sync-skill-index.sh` script
- [ ] Add skill-index generation to ai-context-sync cron

### Phase 2: Discovery System (Day 2)
- [ ] Create `.claude/commands/skill-index.md` (slash command)
- [ ] Implement problem→skill matching algorithm
- [ ] Create skill decision tree markdown
- [ ] Add skill suggestions to AGENTS.md

### Phase 3: Memory Integration (Day 3)
- [ ] Sync skill catalog to Obsidian vault
- [ ] Update MEMORY.md with skill section
- [ ] Create bidirectional sync (Obsidian → skill-index)
- [ ] Add skill availability to bootstrap effect

### Phase 4: Autonomous Loop Integration (Day 4)
- [ ] Update cursor-loop-leader to use skill index
- [ ] Create skill chain compositions
- [ ] Add skill routing to SPEC execution
- [ ] Document skill patterns in AGENTS.md

### Phase 5: Dashboard & Polish (Day 5)
- [ ] Create skill dashboard markdown
- [ ] Add quick reference cards
- [ ] Generate skill invocation examples
- [ ] Create this-index-design.md documentation

---

## 8. FILES TO CREATE

| File | Purpose |
|------|---------|
| `.claude/skill-index.json` | Machine-readable skill index |
| `.claude/skill-index.md` | Human-readable skill catalog |
| `.claude/commands/skill-index.md` | Slash command to view skills |
| `scripts/sync-skill-index.sh` | Sync skills to Obsidian |
| `scripts/generate-skill-cards.sh` | Generate quick reference cards |
| `docs/obsidian/skills/*.md` | Generated skill notes |
| `docs/obsidian/indexes/skills-category.md` | Category index |

---

## 9. METADATA SCHEMA SUMMARY

```json
{
  "// Skill ID": "kebab-case unique identifier",
  "// Name": "Human-readable name (max 60 chars)",
  "// Description": "One-line description (max 120 chars)",
  "// Category": "code-quality|operations|ci-cd|infrastructure|spec-workflow|investigation",
  "// Tags": ["searchable", "tags", "for", "discovery"],
  "// Source": "Original location of skill definition",
  "// Path": "Relative path to skill file",
  "// Trigger": "Slash command (e.g., '/bug') or null",
  "// Phases": "AGENTS.md phase association or null",
  "// Autonomous": "Can run in autonomous loop (boolean)",
  "// Risk": "low|medium|high|critical",
  "// Runtime": "agent|human|both (default: both)",
  "// Problems": [{"query": "how to phrase user need", "weight": 0.0-1.0}]",
  "// Requires": ["skill-id"] or null (skills that must run first)",
  "// RelatedSkills": ["skill-id"] or null (skills used together)",
  "// Outputs": ["what this skill produces"] or null
}
```

---

## 10. APPENDIX: EXTERNAL SKILL SOURCES

### Antigravity Kit (`.agent/skills/`)

| Skill | Category | Description |
|-------|----------|-------------|
| systematic-debugging | investigation | 4-phase debugging methodology |
| api-patterns | code-quality | REST API design patterns |
| architecture | infrastructure | System architecture patterns |
| clean-code | code-quality | Code cleanliness principles |
| database-design | infrastructure | Database schema design |
| frontend-design | code-quality | UI/UX best practices |
| nextjs-react-expert | code-quality | Next.js + React patterns |
| nodejs-best-practices | code-quality | Node.js patterns |
| port-governance | infrastructure | Port allocation management |
| behavioral-modes | spec-workflow | Agent behavior patterns |

### Operations Guides (47 files in `docs/OPERATIONS/SKILLS/`)

Key guides that should become invokable skills:
- `ai-stress-test.md` — AI stack validation
- `incident-runbook.md` — Incident response
- `self-healing.sh` — Container auto-heal
- `container-health-check.md` — Container diagnostics
- `coolify-api-guide.md` — Coolify API usage
- `cloudflare-guide.md` — Cloudflare management
- `grafana-guide.md` — Grafana dashboards
- `litellm-guide.md` — LiteLLM configuration
- `zfs-guide.md` — ZFS operations
- `docker-guide.md` — Docker best practices

---

*Design document created: 2026-04-11*
*Next step: Implement Phase 1 (Skill Index Foundation)*
