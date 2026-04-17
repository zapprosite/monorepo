# RESEARCH-11: Git Workflow Automation

**Agent:** RESEARCH-11
**Focus:** Git workflow automation — commit patterns, PR creation via Gitea API, dual remote mirror, branch strategy
**Date:** 2026-04-17
**Status:** COMPLETE

---

## 1. Key Findings (April 2026 Best Practices)

### Current Setup

- **Dual remotes:** `gitea` (ssh://git@127.0.0.1:2222/will-zappro/monorepo.git) + `origin` (git@github.com:zapprosite/monorepo.git)
- **Credentials in .env:** `GITEA_TOKEN`, `GITHUB_TOKEN`, `GITEA_INSTANCE_URL`
- **Existing scripts:** `scripts/mirror-push.sh` — full dual push with SSH verification
- **Existing workflows:** `/turbo`, `/ship`, `/mirror` commands documented
- **Branch convention:** `feature/xxx-yyy` format (enforced by pre-push hook)

### Commit Patterns (Already Documented)

| Pattern   | Format                                                      | Example                      |
| --------- | ----------------------------------------------------------- | ---------------------------- |
| Commit    | `type(scope): description`                                  | `feat(api): add JWT refresh` |
| Co-author | `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` | Required                     |
| Merge     | `chore: merge [branch] → main`                              | `--no-ff` merge              |

### Gitea API PR Creation

```bash
# Via .env token
curl -X POST "https://git.zappro.site/api/v1/repos/will-zappro/monorepo/pulls" \
  -H "Authorization: Bearer $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"feat: description","head":"feature-branch","base":"main","body":"## Summary\n- changes"}'
```

### Branch Protection

- Never push `main`/`master` directly — always via PR
- Use `--force-with-lease` (never `--force`)
- Feature branches: `feature/xxx-yyy` format

---

## 2. Specific Recommendations for CLAUDE.md/AGENTS.md

### ADD to CLAUDE.md — Git Workflow Section

```
## Git Workflow (Dual Mirror)

### Remotes
- `gitea`: ssh://git@127.0.0.1:2222/will-zappro/monorepo.git
- `origin`: git@github.com:zapprosite/monorepo.git

### Credentials (from .env)
- `GITEA_TOKEN` — Gitea API access
- `GITHUB_TOKEN` — GitHub API access
- `GITEA_INSTANCE_URL` — https://git.zappro.site

### Commands
| Command | Use |
|---------|-----|
| `/ship` | Commit + push + GitHub PR |
| `/turbo` | Commit + merge main + tag + new branch |
| `/mirror` | Push to both gitea + origin |

### Always
- `--force-with-lease` (never `--force`)
- Semantic commits: `type(scope): description`
- Co-author: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
```

### ADD to AGENTS.md — 14-Agent Git Coordination

```
### Git Coordination (Agent 11)
- Push to dual remotes: gitea + origin
- Create PRs via Gitea API using GITEA_TOKEN from .env
- Verify SSH before push: `ssh -o BatchMode=yes git@127.0.0.1 -p 2222 echo OK`
- Branch enforcement: `feature/xxx-yyy` format
```

---

## 3. Code/Examples

### Gitea PR Creation (Full Pattern)

```bash
# 1. Get token from .env
GITEA_TOKEN="${GITEA_TOKEN}"

# 2. Create PR
BRANCH=$(git branch --show-current)
TITLE="feat(api): add user endpoints"

curl -s -X POST "https://git.zappro.site/api/v1/repos/will-zappro/monorepo/pulls" \
  -H "Authorization: Bearer $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg title "$TITLE" \
    --arg head "$BRANCH" \
    --arg body "## Summary\n- new feature\n\n## Test plan\n- [ ] smoke test" \
    '{title: $title, head: $head, base: "main", body: $body}')"
```

### Mirror Push with Verification

```bash
# Verify SSH first
ssh -o BatchMode=yes -o ConnectTimeout=5 git@127.0.0.1 -p 2222 echo "OK"

# Push to both
git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD
```

### Branch Name Validation (Pre-push Hook)

```bash
# .git/hooks/pre-push
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ ! "$BRANCH" =~ ^feature/[a-z]+-[a-z]+$ ]] && [[ "$BRANCH" != "main" ]]; then
    echo "Branch name must be feature/xxx-yyy format"
    exit 1
fi
```

---

## 4. Add/Update/Delete

### ADD to CLAUDE.md

- [ ] Git workflow section with dual remote config
- [ ] Credentials from .env (GITEA_TOKEN, GITHUB_TOKEN)
- [ ] Command reference table (/ship, /turbo, /mirror)
- [ ] Anti-hardcoded: no hardcoded tokens in scripts

### ADD to AGENTS.md

- [ ] Agent 11 responsibilities: git coordination
- [ ] Dual push pattern: gitea + origin
- [ ] Gitea API PR creation via .env token

### ADD as New Workflow

- [ ] `.claude/workflows/git-branch-policy.md` — branch naming + pre-push validation

### UPDATE Existing

- [ ] `scripts/mirror-push.sh` — add .env token sourcing for API calls
- [ ] `.claude/skills/gitea-access/SKILL.md` — update to use GITEA_TOKEN from .env (not Infisical)

### DELETE (Deprecated)

- [ ] References to Infisical for git credentials (legacy, pruned)

---

## 5. Cron Jobs (Git-related)

| Job            | Schedule      | Purpose               |
| -------------- | ------------- | --------------------- |
| `mirror-sync`  | `0 */6 * * *` | Sync remotes every 6h |
| `branch-audit` | `0 4 * * *`   | Check stale branches  |

---

## 6. Security Notes

- GITEA_TOKEN and GITHUB_TOKEN must NEVER be hardcoded
- Always use .env as canonical source via process.env.GITEA_TOKEN
- --force-with-lease prevents accidental overwrites
- SSH key must be loaded (ssh-add) before mirror push
- Gitea token scope: repo + workflow minimum
