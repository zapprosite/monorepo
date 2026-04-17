---
name: SPEC-AUDIT-FIXES-PHASE2
description: Phase 2 audit fixes — GOVERNANCE paths, PORTS.md, SERVICE_MAP.md, memory files, OPERATIONS skills, ADRs README, VERSION-LOCK.md
status: PROPOSED
priority: critical
author: Principal Engineer
date: 2026-04-12
specRef: SPEC-HOMELAB-GOVERNANCE-DEFINITIVO.md, SPEC-AUDIT-FIXES-2026-04-12.md
---

# SPEC-AUDIT-FIXES-PHASE2 — Docs Audit Phase 2

## Objective

Aplicar os fixes de auditoria identificados pelos 12 agentes (Phase 1 = SPEC conflicts/path/frontmatter, committed in `0188baa8`). Phase 2 cobre os findings restantes críticos/altos que impedem merge to main.

---

## Context — Findings por Categoria

### CRITICAL (must fix before merge to main)

| #   | Finding                                                                                                  | Agent                | Files                              |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------- |
| C1  | `/srv/ops/ai-governance/*.md` referenced everywhere but don't exist — actual files in `docs/GOVERNANCE/` | GOVERNANCE audit     | 18+ files in docs/GOVERNANCE/      |
| C2  | `llava` still listed as vision model (deprecated 2026-04-09, replaced by `qwen2.5-vl`)                   | GOVERNANCE audit     | PINNED-SERVICES.md, GUARDRAILS.md  |
| C3  | PORTS.md outdated — 6+ ports missing (8202, 3457, 8050/8051, 9080), wrong entries                        | INFRASTRUCTURE audit | docs/INFRASTRUCTURE/PORTS.md       |
| C4  | SERVICE_MAP.md references removed stacks (supabase, caprover, voice old stack)                           | INFRASTRUCTURE audit | docs/INFRASTRUCTURE/SERVICE_MAP.md |

### HIGH

| #   | Finding                                                                                                 | Agent               | Files                                               |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------- |
| H1  | Memory `homelab-estado.md` heavily outdated — references SPEC-023 that doesn't exist, stale model names | Memory audit        | memory/homelab-estado.md                            |
| H2  | Memory `ai-context.md` contains false paths (`/srv/ops/ai-governance/SYSTEM_STATE.md`, `docs/context/`) | Memory audit        | memory/ai-context.md                                |
| H3  | Memory `voice-pipeline-08-04-2026.md` stale (MiniMax M2.1 vs M2.7, whisper vs wav2vec2)                 | Memory audit        | memory/voice-pipeline-08-04-2026.md                 |
| H4  | HOMELAB-SURVIVAL-GUIDE.md describes old voice stack (speaches:8010, chatterbox:8011)                    | OPERATIONS audit    | docs/OPERATIONS/HOMELAB-SURVIVAL-GUIDE.md           |
| H5  | `wav2vec2-proxy:8203` in hermes-agent-audio-governance.md but absent from newer docs                        | GOVERNANCE audit    | docs/GOVERNANCE/.rules/hermes-agent-audio-governance.md |
| H6  | hermes-agent-audio-governance.md references `docs/specflow/SPEC-009-...` (non-existent path)                | rules vs docs audit | .claude/rules/hermes-agent-audio-governance.md          |

### MEDIUM

| #   | Finding                                                                                     | Agent            | Files                                 |
| --- | ------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------- |
| M1  | ADRs README.md claims 22 ADRs but only 3 files exist                                        | ADRs audit       | docs/ADRs/README.md                   |
| M2  | VERSION-LOCK.md referenced everywhere but doesn't exist                                     | REFERENCE audit  | root: VERSION-LOCK.md                 |
| M3  | OPERATIONS skills missing: docker-autoheal, node-exporter HEALTHCHECK, loki HEALTHCHECK     | OPERATIONS audit | docs/OPERATIONS/SKILLS/               |
| M4  | `llava` vision model also in ARCHITECTURE-MODELS.md (LiteLLM endpoint wrong too)            | REFERENCE audit  | docs/REFERENCE/ARCHITECTURE-MODELS.md |
| M5  | Memory `hermes-agent-agents-kit.md` references stale gemma2 instead of llama3-portuguese-tomcat | Memory audit     | memory/hermes-agent-agents-kit.md         |

---

## Technical Approach

### Strategy: Parallel TaskMaster execution

1. **10 agents in parallel** via `/cursor-loop` — each handles a cluster of related fixes
2. **No human gates** — autonomous until all tests PASS
3. **Verification first** — each task has clear exit criteria
4. **Commit per cluster** — batch related changes, stage → commit → push

### Cluster 1: GOVERNANCE Path Fix (C1)

```
Files: docs/GOVERNANCE/{CONTRACT,QUICK_START,PINNED-SERVICES,ANTI-FRAGILITY,GUARDRAILS,CHANGE_POLICY,INCIDENTS,APPROVAL_MATRIX,DOCUMENTATION_MAP,MASTER-PASSWORD-PROCEDURE,DATABASE_GOVERNANCE,DUPLICATE-SERVICES-RULE,RECOVERY}.md

Fix: sed 's|/srv/ops/ai-governance/|../GOVERNANCE/|g' (or appropriate relative path)
Also: .claude/CLAUDE.md references /srv/ops/ai-governance/ — fix to docs/GOVERNANCE/

Exit: grep -r "/srv/ops/ai-governance/" docs/ → 0 results
```

### Cluster 2: Vision Model Fix (C2, M4)

```
Files: docs/GOVERNANCE/PINNED-SERVICES.md, docs/GOVERNANCE/GUARDRAILS.md, docs/REFERENCE/ARCHITECTURE-MODELS.md

Fix: Remove "llava" from vision models, ensure "qwen2.5-vl" via LiteLLM is the only vision model
Also fix ARCHITECTURE-MODELS.md LiteLLM endpoint (:4000 not api.zappro.site)

Exit: grep -r "llava" docs/GOVERNANCE/ → 0 results
```

### Cluster 3: PORTS.md + SERVICE_MAP.md (C3, C4)

```
Files: docs/INFRASTRUCTURE/PORTS.md, docs/INFRASTRUCTURE/SERVICE_MAP.md

Fix PORTS.md: Add 8202 (wav2vec2 host), 3457 (hermes-agent-mcp-wrapper), 8050 (gotify), 8051 (alert-sender), 9080 (promtail). Fix wrong entries (8201 host mapping, 4003 nginx, 4007 tts-bridge)

Fix SERVICE_MAP.md: Remove supabase/caprover/old voice references. Update n8n (now in Coolify), Hermes Agent vision (qwen2.5-vl), tts-bridge (UP on 8013 not REMOVED)

Exit: PORTS.md lists all active ports; SERVICE_MAP.md reflects current state
```

### Cluster 4: Memory Files (H1, H2, H3, H5)

```
Files: memory/homelab-estado.md, memory/ai-context.md, memory/voice-pipeline-08-04-2026.md, memory/Hermes Agent-agents-kit.md

Fix homelab-estado.md: DELETE or heavily annotate as superseded by SPEC-AUDIT-HOMELAB-2026-04-12.md
Fix ai-context.md: Update paths to reference docs/GOVERNANCE/, docs/SPECS/
Fix voice-pipeline-08-04-2026.md: Annotate as superseded by voice-pipeline-desktop-10-04-2026.md
Fix hermes-agent-agents-kit.md: Update gemma2 → Gemma4-12b-it

Exit: Memory files don't reference non-existent paths; no stale SPEC references
```

### Cluster 5: OPERATIONS Skills (H4)

```
Files: docs/OPERATIONS/HOMELAB-SURVIVAL-GUIDE.md, docs/OPERATIONS/RUNBOOK.md

Fix: Rewrite VOICE STACK section — current is wav2vec2 :8201 + Kokoro :8880 via TTS Bridge :8013 + wav2vec2-deepgram-proxy :8203. Old (speaches:8010, chatterbox:8011) no longer exists.

Exit: HOMELAB-SURVIVAL-GUIDE.md voice stack matches SPEC-009 canonical stack
```

### Cluster 6: ADRs README (M1)

```
Files: docs/ADRs/README.md

Fix: Rewrite README to accurately reflect 3 ADRs (ADR-TEMPLATE.md, TEMPLATE.md, README.md). Remove false "22 ADRs" claim.

Exit: README.md accurately describes existing files
```

### Cluster 7: VERSION-LOCK.md (M2)

```
Files: VERSION-LOCK.md (create at repo root)

Content:
- Turbo: 2.9.6
- pnpm: 9.0.x (locked)
- Node: (current version)
- Claude Code: 2.1.89

Exit: cat VERSION-LOCK.md shows pinned versions
```

### Cluster 8: Hermes Agent-audio-governance.md fixes (H5, H6)

```
Files: docs/GOVERNANCE/.rules/hermes-agent-audio-governance.md, .claude/rules/hermes-agent-audio-governance.md

Fix: docs/specflow/SPEC-009 → docs/SPECS/SPEC-009
Clarify wav2vec2-proxy:8203 role (Deepgram proxy pattern per SPEC-018)

Exit: All SPEC-009 references valid; wav2vec2-proxy documented
```

### Cluster 9: OPERATIONS missing skills (M3)

```
Files: docs/OPERATIONS/SKILLS/{docker-autoheal,node-exporter,loki,voice-pipeline-watchdog}.md (create)

docker-autoheal.md: Config for docker-autoheal sidecar, rate limit 3/hour, log path
node-exporter.md: HEALTHCHECK fix for P0 item (Prometheus shows DOWN)
loki.md: HEALTHCHECK fix for P0 item
voice-pipeline-watchdog.md: Document tasks/smoke-tests/voice-pipeline-loop.sh watchdog

Exit: Skills exist and match SPEC-023 Part 3 specs
```

### Cluster 10: Verify and commit

```
Verification checks:
- grep -r "/srv/ops/ai-governance/" docs/ → 0
- grep -r "llava" docs/GOVERNANCE/ → 0
- grep -r "llava" docs/REFERENCE/ → 0
- test -f VERSION-LOCK.md && cat VERSION-LOCK.md | grep -q "2.9.6"
- grep -q "wav2vec2 :8201" docs/OPERATIONS/HOMELAB-SURVIVAL-GUIDE.md
- grep -q "qwen2.5-vl" docs/GOVERNANCE/PINNED-SERVICES.md

Stage: git add -A (excluding logs/)
Commit: "docs: AUDIT-FIXES phase 2 — GOVERNANCE paths, PORTS, memory, OPERATIONS"
Push: git push --force-with-lease origin feature/homelab-seguro-e-estavel-pt2
```

---

## Dependencies

- Phase 1 commit: `0188baa8` (must be merged or in same branch)
- No external dependencies

---

## Success Criteria

1. `grep -r "/srv/ops/ai-governance/" docs/` → 0 results
2. `grep -r "llava" docs/GOVERNANCE/` → 0 results
3. PORTS.md lists: 8201, 8202, 8203, 3457, 8013, 8050, 8051, 9080
4. VERSION-LOCK.md exists with Turbo 2.9.6, pnpm 9.0.x
5. HOMELAB-SURVIVAL-GUIDE.md voice stack matches SPEC-009
6. Memory files accurate vs current docs state
7. All 10 verification checks PASS
8. Branch pushed, ready for PR merge

---

## Non-Goals

- Not modifying service configurations (Docker, ZFS, etc.)
- Not changing SPEC-HOMELAB-GOVERNANCE-DEFINITIVO.md content
- Not creating new SPECs (only fixing existing docs)

---

## Open Questions

| #    | Question                                                                                                     | Resolution                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| OQ-1 | Should `/srv/ops/ai-governance/` be created as symlinks to `docs/GOVERNANCE/` or just update all references? | Update references to relative paths — simpler, no symlink breakage risk          |
| OQ-2 | wav2vec2-proxy:8203 — is this still operational?                                                             | Check if container is running. If yes, document. If no, remove reference.        |
| OQ-3 | ADRs — should we recreate the 22 missing ADRs or just fix README to reflect reality?                         | Fix README to reflect reality — recreating 22 ADRs is out of scope for audit fix |
