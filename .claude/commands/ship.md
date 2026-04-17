# /ship — End-of-session sync pattern

## Description

Pre-launch checklist + production deploy preparation.

## Actions

1. Run `/review` — verify no hardcoded secrets
2. Sync docs → memory: `bash scripts/sync-memory.sh`
3. Commit: `git add` + `git commit`
4. Push dual remotes (Gitea + GitHub)
5. Create PR if needed

## When

- End of session before marking done
- Pre-deploy validation

## Refs

- `AGENTS.md` ship workflow
- `.claude/rules/REVIEW-SKILLS.md`
