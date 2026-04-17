# Final Docs Structure Verification Report

**Date:** 2026-04-10
**Path:** /srv/monorepo/docs

---

## Final Directory Tree

```
docs/
├── ADRs/
│   ├── README.md
│   └── TEMPLATE.md
├── GUIDES/
│   ├── CANVAS-CURSOR-LOOP.md
│   ├── CODE-REVIEW-GUIDE.md
│   ├── discovery.md
│   ├── PLAN-docs-reorganization-20260408.md
│   ├── README.md
│   ├── voice-pipeline-desktop.md
│   └── voice-pipeline-loop.md
├── REFERENCE/
│   ├── AI-CONTEXT.md
│   ├── ARCHITECTURE-MODELS.md
│   ├── CLI-SHORTCUTS.md
│   ├── README.md
│   ├── TOOLCHAIN.md
│   └── WORKFLOW.md
├── SPECS/
│   ├── README.md
│   ├── SPEC-001-template-fusionado.md
│   ├── SPEC-001-workflow-performatico.md
│   ├── SPEC-002-homelab-monitor-agent.md
│   ├── SPEC-002-homelab-network-refactor.md
│   ├── SPEC-004-kokoro-tts-kit.md
│   ├── SPEC-005-wav2vec2-stt-kit.md
│   ├── SPEC-006-playwright-e2e.md
│   ├── SPEC-007-Hermes Agent-oauth-profiles.md
│   ├── SPEC-009-Hermes Agent-persona-audio-stack.md
│   ├── SPEC-010-Hermes Agent-agents-kit.md
│   ├── SPEC-011-Hermes Agent-agency-reimagined.md
│   ├── SPEC-012-Hermes Agent-update-discoverer.md
│   ├── SPEC-013-CLAUDE-CODE-CLI-INTEGRATION.md
│   ├── SPEC-013-Hermes Agent-ceo-mix-voice-stack.md
│   ├── SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO.md
│   ├── SPEC-014-CURSOR-AI-CICD-PATTERN.md
│   ├── SPEC-014-Hermes Agent-tts-route-fix.md
│   ├── SPEC-015-GITEA-ACTIONS-ENTERPRISE.md
│   ├── SPEC-016-voice-pipeline-cursor-loop.md
│   ├── SPEC-017-voice-api-deploy.md
│   ├── SPEC-018-wav2vec2-deepgram-proxy.md
│   ├── SPEC-019-openwebui-repair.md
│   ├── SPEC-020-openwebui-Hermes Agent-bridge.md
│   ├── SPEC-020-voice-pipeline-humanized-ptbr.md
│   ├── SPEC-021-CLAUDE-CODE-CURSOR-LOOP.md
│   ├── SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md
│   ├── SPEC-100-PIPELINE-BOOTSTRAP.md
│   ├── SPEC-CURSOR-LOOP.md
│   ├── SPEC-INDEX.md
│   ├── SPEC-PERPLEXITY-GITOPS.md
│   ├── SPEC-PLANNING-PIPELINE.md
│   ├── SPEC-README.md
│   ├── SPEC-TEMPLATE.md
│   ├── SPEC-TRANSFORM-MONOREPO.md
│   ├── SPEC-TROCAR-ROUPA.md
│   └── tasks.md
├── archive/
│   ├── APPLICATION-moved-20260409/
│   ├── guides-moved-20260409/
│   ├── logs-moved-20260409/
│   ├── plans-moved-20260409/
│   └── test-results-moved-20260409/
├── CLAUDE.md
├── GOVERNANCE/
├── INCIDENTS/
├── INFRASTRUCTURE/
├── index.md
├── MCPs/
├── OPERATIONS/
│   ├── desktop/
│   └── SKILLS/
├── README.md
├── specflow/
│   ├── ARCHITECTURE-MASTER.md
│   ├── reviews/
│   │   ├── REVIEW-001-Hermes Agent-voice-pipeline.md
│   │   ├── REVIEW-002.md
│   │   ├── REVIEW-GUIDE.md
│   │   └── REVIEW-smoke-tests-20260407.md
│   └── tasks.md
├── TEMPLATES/
└── context/
    ├── AI-CONTEXT.md
    ├── ARCHITECTURE-MODELS.md
    ├── CLI-SHORTCUTS.md
    ├── README.md
    ├── TOOLCHAIN.md
    └── WORKFLOW.md
```

---

## File Counts Per Directory

| Directory | Expected | Actual | Status |
|-----------|----------|--------|--------|
| docs/SPECS/*.md | ~30 | **37** | OK (37 SPECs + 1 README) |
| docs/ADRs/*.md | ~5 | **2** | LOW (needs ADRs) |
| docs/GUIDES/*.md | ~8 | **7** | OK |
| docs/REFERENCE/*.md | ~5 | **6** | OK |
| Root-level *.md | 0 | **0** | OK |

---

## Obsidian Mirror Status

**Location:** `/srv/monorepo/obsidian/`

### Mirror Comparison

| Source | Obsidian Mirror | Status |
|--------|-----------------|--------|
| docs/SPECS | obsidian/SPECS/ | **INCOMPLETE** - Missing `tasks.md` |
| docs/GUIDES | obsidian/GUIDES/ | **EMPTY** - Only has README.md |
| docs/ADRs | obsidian/ADRs/ | **EMPTY** - Only has PLAN-voice-pipeline-desktop-20260410.md |
| docs/REFERENCE | obsidian/REFERENCE/ | **EMPTY** - Only has index.md |

### Additional Obsidian Directories (not in docs/)

| Directory | Content |
|-----------|---------|
| obsidian/adrs/ | claude-resolve.md, README.md |
| obsidian/guides/ | README.md only |
| obsidian/logs/ | gitea-coolify.md, infisical.md, manutencao-continua.md, memoria-claude.md, opencode.md, security-hardening.md, whisper-auto-local.md |
| obsidian/plans/ | homelab.md, Hermes Agent.md |
| obsidian/context/ | hermes-agent-agency.md |

---

## Orphaned Files Found

### In docs/ but not in obsidian/ mirrors:

1. **docs/GUIDES/** (6 files not in obsidian/GUIDES):
   - CANVAS-CURSOR-LOOP.md
   - CODE-REVIEW-GUIDE.md
   - discovery.md
   - PLAN-docs-reorganization-20260408.md
   - voice-pipeline-desktop.md
   - voice-pipeline-loop.md

2. **docs/SPECS/tasks.md** - not in obsidian/SPECS/

3. **docs/ADRs/** files not in obsidian/ADRs/:
   - README.md
   - TEMPLATE.md

4. **docs/REFERENCE/** files not in obsidian/REFERENCE/:
   - AI-CONTEXT.md
   - ARCHITECTURE-MODELS.md
   - CLI-SHORTCUTS.md
   - TOOLCHAIN.md
   - WORKFLOW.md

### In obsidian/ but not in docs/ mirrors:

1. **obsidian/SPECS/ARCHITECTURE-MASTER.md** - in specflow/ not SPECS/
2. **obsidian/SPECS/reviews/** - directory exists in obsidian but not mirrored
3. **obsidian/adrs/claude-resolve.md** - unique to obsidian
4. **obsidian/logs/*.md** (7 files) - unique to obsidian
5. **obsidian/plans/*.md** (2 files) - unique to obsidian

---

## Root Level Check

```
find /srv/monorepo/docs -maxdepth 1 -name "*.md"
```

**Result:** Only `CLAUDE.md`, `index.md`, `README.md` at root - all legitimate project files. No orphaned documentation files.

---

## Recommendations

### 1. CRITICAL: Obsidian Mirrors Are Incomplete

The obsidian/ directory was intended as a mirror of docs/ but is significantly out of sync:

- **GUIDES mirror is empty** - Only contains README.md
- **ADRs mirror is empty** - Only contains unrelated PLAN file
- **REFERENCE mirror is empty** - Only contains index.md
- **SPECS mirror is missing tasks.md**

**Action Required:** Either:
- (A) Populate the obsidian mirrors with the docs/ content, OR
- (B) Clarify that obsidian/ is a separate structure (not a mirror) and update documentation

### 2. LOW: ADRs Directory Needs Content

Only 2 files (README + TEMPLATE) in docs/ADRs/. Consider adding actual architecture decision records.

### 3. INFO: Duplicate Content

- docs/context/ and docs/REFERENCE/ contain identical files (AI-CONTEXT.md, ARCHITECTURE-MODELS.md, CLI-SHORTCUTS.md, TOOLCHAIN.md, WORKFLOW.md, README.md)
- obsidian/specflow/ARCHITECTURE-MASTER.md exists but is in docs/specflow/ not docs/SPECS/

---

## Summary

| Metric | Value |
|--------|-------|
| Total SPEC files | 37 |
| Total GUIDES files | 7 |
| Total ADRs files | 2 |
| Total REFERENCE files | 6 |
| Root-level orphaned docs | 0 |
| Obsidian mirrors synced | PARTIAL |
| Archive directories | 5 |

**Overall Status:** Structure is mostly correct. Primary concern is obsidian/ mirror incompleteness.
