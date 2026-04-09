# Git Workflows — Consolidated Reference

> **Path:** `/srv/monorepo`
> **Remotes:** `origin` (GitHub), `gitea` (local Gitea @ `ssh://git@127.0.0.1:2222`)
> **Always use:** `git add -A` + `.gitignore` for secrets protection
> **Always use:** `--force-with-lease` (never `--force`)
> **Always include:** `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## Quick Reference Table

| Scenario | Command | Workflow |
|----------|---------|----------|
| Ship a completed feature | `/ship` | [git-ship](#git-ship) |
| Quick commit without PR | `/sync` | [sincronizar-tudo](#sincronizar-tudo) |
| Create new feature branch | `/feature` | [git-feature](#git-feature) |
| Turbo: commit + merge + tag + new branch | `/turbo` | [git-turbo](#git-turbo) |
| Mirror push to Gitea + GitHub | `/mirror` | [git-mirror](#git-mirror) |

---

## git-ship

**When:** Feature complete, ready to PR. Staging + semantic commit + push + GitHub PR.

```
/ship
```

### Pattern
1. Diagnose: `git branch --show-current`, `git status --short`, `git diff --stat HEAD`
2. Stage: `git add -A`
3. Analyze staged diff → detect type (`feat`/`fix`/`chore`/`refactor`/`docs`/`test`) + scope (from paths)
4. Commit: `git commit -m "[type(scope)]: [specific description]\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`
5. Push: `git push --force-with-lease origin HEAD`
6. Create PR: `gh pr create --title "[commit]" --body "## Summary\n- [changes]\n\n## Test plan\n- [ ] Smoke test\n- [ ] CI passing" --base main`

### Always Do
- Interrupt if on `main`/`master`
- Check `git status --short` before staging
- Use `.gitignore` as real protection against `.env`/secrets/build artifacts

### Never Do
- `--force` (use `--force-with-lease`)
- Generic commit messages

---

## git-turbo

**When:** Hurry. Commit + merge to main + tag + new feature branch in one flow.

```
/turbo
```

### Pattern
1. Stage: `git add -A`
2. Commit: `chore([scope]): [creative verb]-[noun]` (e.g., `chore(core): patch signal-router`)
3. Push current branch: `git push --force-with-lease origin HEAD`
4. Merge in main: `git checkout main && git pull origin main && git merge --no-ff [branch] -m "chore: merge [branch] → main" && git push origin main`
5. Tag: `git tag -a v0.N.N-[codename] -m "release: [tag]"` + `git push origin [tag]`
6. New branch: `git checkout -b feature/[adjective-noun]` + `git push -u origin feature/[name]`

### Quick Reference
| Action | Command |
|--------|---------|
| Commit | `chore([scope]): [description]` |
| Merge | `git merge --no-ff [branch] -m "chore: merge [branch] → main"` |
| Tag | `v0.N.N-[codename]` |
| New branch | `feature/[adjective-noun]` |

### Always Do
- Use `--force-with-lease`
- Wait for CI before turbo-ing

### Never Do
- Turbo on `main` directly
- Skip CI verification

---

## git-feature

**When:** Start new feature. Create branch with creative name + upstream setup.

```
/feature
```

### Pattern
1. Check: `git status --short` (warn if dirty)
2. Generate name: `[adjective]-[noun]` (e.g., `quantum-dispatch`, `iron-codex`, `async-oracle`)
3. Create: `git checkout -b feature/[name]`
4. Setup: `git push -u origin feature/[name]`

### Always Do
- Use creative, technical names (not `feature-1`, `test-branch`)
- Configure upstream immediately

### Never Do
- Generic branch names

---

## git-mirror

**When:** Push to both Gitea and GitHub simultaneously.

```
/mirror
```

### Pattern
1. Verify remotes: `git remote -v`
2. Verify SSH: `ssh -o BatchMode=yes -o ConnectTimeout=5 git@127.0.0.1 -p 2222 echo "OK"`
3. Push both: `git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD`
4. Optional PRs: Gitea via API, GitHub via `gh pr create`

### Alias
```bash
alias gpush='git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD'
alias gstatus='git remote -v && ssh -o BatchMode=yes -o ConnectTimeout=3 git@127.0.0.1 -p 2222 echo "Gitea SSH: OK" 2>/dev/null || echo "Gitea SSH: FAIL"'
```

### Always Do
- Use `--force-with-lease`
- Verify SSH before pushing

### Never Do
- Mirror `main`/`master` directly
- Use `--force`

---

## sincronizar-tudo

**When:** Quick sync without PR. Stage + semantic commit + push.

```
/sync
```

### Pattern
1. Check: `git status --short` → if clean, "nothing to sync" and exit
2. Stage: `git add -A`
3. Analyze staged diff → detect type + scope
4. Commit: `git commit -m "[type(scope)]: [specific description]\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`
5. Push: `git push --force-with-lease origin HEAD`
6. Show: branch + commit hash

### Always Do
- Check status before staging
- Use specific commit messages (not generic)

### Never Do
- `--force` (use `--force-with-lease`)

---

## Shared Conventions

### Semantic Commit Format
```
[type(scope)]: [description]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### Type Prefixes
| Type | When to Use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, tooling, deps |
| `refactor` | Code restructure (no behavior change) |
| `docs` | Documentation only |
| `test` | Tests only |

### Scope Detection
| Path | Scope |
|------|-------|
| `apps/api/` | `(api)` |
| `apps/frontend/` | `(web)` |
| `packages/ui/` | `(ui)` |
| Multiple packages | omit scope |

### Branch Naming
| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/[adjective-noun]` | `feature/quantum-dispatch` |
| Turbo-generated | `feature/[adjective-noun]` | `feature/dark-runtime` |

### Tag Format
```
v0.[major].[minor]-[codename]
# e.g., v0.9.1-phantom, v0.7.3-nebula
```

### Safety Rules
1. **Never use `--force`** — always `--force-with-lease`
2. **Never commit directly to `main`/`master`**
3. **Always verify `.gitignore`** protects secrets/`.env`/build artifacts
4. **Always include Co-Authored-By** in commits
5. **Never mirror `main` directly** — use PR flow
