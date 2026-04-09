---
description: Cria uma nova branch de feature com nome criativo, verificações de segurança e setup de upstream.
---

# /feature — Git Feature Workflow

> Create a new feature branch with creative name + upstream setup.

## Path
`/srv/monorepo`

## Pattern

### Pre-flight
1. Check uncommitted changes: `git status --short`
   - If dirty, show warning but continue.

### Create Branch
2. Generate name in format `[adjective]-[noun]` with senior technical personality:
   - High quality: `quantum-dispatch`, `iron-codex`, `silent-reactor`, `stellar-pivot`,
     `neon-sentinel`, `async-oracle`, `void-prism`, `rust-signal`, `chrome-vector`
   - Avoid: generic names (`feature-1`, `test-branch`, `fix-bug`)
3. Create and checkout:
   ```bash
   git checkout -b feature/[generated-name]
   ```
4. Setup upstream immediately:
   ```bash
   git push -u origin feature/[generated-name]
   ```

### Inform
5. Show summary:
   - Branch created: `feature/[generated-name]`
   - Remote configured: `origin`
   - Next steps:
     - Implement the feature
     - Use `git add -A` to include new files (`.gitignore` protects secrets)
     - Execute `/ship` when ready to open PR

## Always Do
- Use creative, technical names (not `feature-1`, `test-branch`)
- Configure upstream immediately
- Check `git status --short` before creating

## Never Do
- Generic branch names
- Commit directly to `main`/`master`

## Shortcut
```bash
# Quick feature branch
git checkout -b feature/[adjective-noun] && git push -u origin feature/[adjective-noun]
```
