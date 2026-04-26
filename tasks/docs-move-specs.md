# Task T03: Move SPEC files from docs/specflow/ to docs/SPECS/

## Status: Completed

## Files Moved (27 files via git mv)

| # | Source | Destination |
|---|--------|-------------|
| 1 | docs/specflow/SPEC-001-template-fusionado.md | docs/SPECS/SPEC-001-template-fusionado.md |
| 2 | docs/specflow/SPEC-001-workflow-performatico.md | docs/SPECS/SPEC-001-workflow-performatico.md |
| 3 | docs/specflow/SPEC-002-homelab-monitor-agent.md | docs/SPECS/SPEC-002-homelab-monitor-agent.md |
| 4 | docs/specflow/SPEC-002-homelab-network-refactor.md | docs/SPECS/SPEC-002-homelab-network-refactor.md |
| 5 | docs/specflow/SPEC-004-kokoro-tts-kit.md | docs/SPECS/SPEC-004-kokoro-tts-kit.md |
| 6 | docs/specflow/SPEC-005-wav2vec2-stt-kit.md | docs/SPECS/SPEC-005-wav2vec2-stt-kit.md |
| 7 | docs/specflow/SPEC-006-playwright-e2e.md | docs/SPECS/SPEC-006-playwright-e2e.md |
| 8 | docs/specflow/SPEC-007-openclaw-oauth-profiles.md | docs/SPECS/SPEC-007-openclaw-oauth-profiles.md |
| 9 | docs/specflow/SPEC-009-openclaw-persona-audio-stack.md | docs/SPECS/SPEC-009-openclaw-persona-audio-stack.md |
| 10 | docs/specflow/SPEC-010-openclaw-agents-kit.md | docs/SPECS/SPEC-010-openclaw-agents-kit.md |
| 11 | docs/specflow/SPEC-011-openclaw-agency-reimagined.md | docs/SPECS/SPEC-011-openclaw-agency-reimagined.md |
| 12 | docs/specflow/SPEC-012-openclaw-update-discoverer.md | docs/SPECS/SPEC-012-openclaw-update-discoverer.md |
| 13 | docs/specflow/SPEC-013-CLAUDE-CODE-CLI-INTEGRATION.md | docs/SPECS/SPEC-013-CLAUDE-CODE-CLI-INTEGRATION.md |
| 14 | docs/specflow/SPEC-013-openclaw-ceo-mix-voice-stack.md | docs/SPECS/SPEC-013-openclaw-ceo-mix-voice-stack.md |
| 15 | docs/specflow/SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO.md | docs/SPECS/SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO.md |
| 16 | docs/specflow/SPEC-014-CURSOR-AI-CICD-PATTERN.md | docs/SPECS/SPEC-014-CURSOR-AI-CICD-PATTERN.md |
| 17 | docs/specflow/SPEC-014-openclaw-tts-route-fix.md | docs/SPECS/SPEC-014-openclaw-tts-route-fix.md |
| 18 | docs/specflow/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md | docs/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md |
| 19 | docs/specflow/SPEC-016-voice-pipeline-cursor-loop.md | docs/SPECS/SPEC-016-voice-pipeline-cursor-loop.md |
| 20 | docs/specflow/SPEC-017-voice-api-deploy.md | docs/SPECS/SPEC-017-voice-api-deploy.md |
| 21 | docs/specflow/SPEC-018-wav2vec2-deepgram-proxy.md | docs/SPECS/SPEC-018-wav2vec2-deepgram-proxy.md |
| 22 | docs/specflow/SPEC-019-openwebui-repair.md | docs/SPECS/SPEC-019-openwebui-repair.md |
| 23 | docs/specflow/SPEC-020-openwebui-openclaw-bridge.md | docs/SPECS/SPEC-020-openwebui-openclaw-bridge.md |
| 24 | docs/specflow/SPEC-021-CLAUDE-CODE-CURSOR-LOOP.md | docs/SPECS/SPEC-021-CLAUDE-CODE-CURSOR-LOOP.md |
| 25 | docs/specflow/SPEC-100-PIPELINE-BOOTSTRAP.md | docs/SPECS/SPEC-100-PIPELINE-BOOTSTRAP.md |

## Files Excluded (per criteria)

| File | Reason |
|------|--------|
| SPEC-INDEX.md | Excluded |
| SPEC-TEMPLATE.md | Excluded |
| SPEC-README.md | Excluded |
| SPEC-*-TEMPLATE.md | Excluded pattern |
| ARCHITECTURE-MASTER.md | Excluded |
| discovery.md | Excluded |
| CANVAS-*.md | Excluded pattern |
| CODE-REVIEW-*.md | Excluded pattern |
| *loop*.md | Excluded pattern |
| PLAN-*.md | Excluded pattern |
| tasks.md | Excluded |

## Files Not Under Version Control (skipped)

| File | Note |
|------|------|
| SPEC-020-voice-pipeline-humanized-ptbr.md | Not tracked in git |
| SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md | Not tracked in git |

## Remaining in docs/specflow/

| File | Status |
|------|--------|
| ARCHITECTURE-MASTER.md | Untouched (excluded) |
| tasks.md | Untouched (excluded) |

## Verification

```bash
git -C /srv/monorepo status --short | grep "docs/SPECS/"
```

---

Executed: 2026-04-10
