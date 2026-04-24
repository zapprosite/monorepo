# VERSION-LOCK — Infrastructure Reference

> **Canonical source:** `VERSION-LOCK.md` (root of monorepo)

Single source of truth for all pinned tool versions. Generated and validated by the SPEC-071-V1 pipeline.

## Quick Reference

| Tool | Pinned Version | Check Command |
|------|---------------|---------------|
| Turbo | 2.9.6 | `pnpm exec turbo --version` |
| pnpm | 9.0.x | `pnpm --version` |
| Claude Code CLI | 2.1.89 | `claude --version` |
| TypeScript | ^5.7.3 | `cat apps/*/package.json \| grep typescript` |
| Biome | ^2.3.0 | `cat apps/ai-gateway/package.json \| grep biome` |
| Kokoro FastAPI | v0.2.2 | `docker images \| grep ` |

## Scripts

```bash
# Detect drift vs VERSION-LOCK.md
bash scripts/versions-check.sh

# Update VERSION-LOCK.md to match actual versions
bash scripts/versions-update.sh [--dry-run]

# CI: fail if drift detected
bash scripts/versions-check.sh || exit 1
```

## CI Integration

The drift check runs in `pr-check.yml` on every pull request:

```yaml
- name: Version drift check
  run: bash scripts/versions-check.sh
```

If drift is detected, the PR check fails and requires `scripts/versions-update.sh` to be run before merging.

## Update Policy

1. Make the actual version change (e.g., `pnpm add -D typescript@5.8.0`)
2. Run `bash scripts/versions-update.sh` to sync VERSION-LOCK.md
3. Commit both changes together

## Drift Severity

| Tool | Severity | Notes |
|------|----------|-------|
| Turbo | CRITICAL | Build system changes without approval |
| pnpm | HIGH | Lock file format changes |
| Claude Code CLI | MEDIUM | Agent behavior may vary |
| TypeScript | MEDIUM | Type compatibility |
| Biome | LOW | Formatting changes |
| Kokoro | HIGH | TTS voice quality |
