# Secrets Cleanup Runbook

**Problem:** GitHub Secret Scanning blocks pushes when hardcoded secrets are found in commit history.

**Symptoms:**
```
remote: error: GH013: Repository rule violations found
Push cannot contain secrets
```

---

## Solution: History Rewrite

### Step 1: Identify the Bad Commit

```bash
git log --oneline | grep -E "secret|keys|openclaw|token"
```

### Step 2: Find Last Good Commit

```bash
git log --oneline
# Identify commit BEFORE the one with secrets
```

### Step 3: Create Clean Branch

```bash
# Create new branch from last good commit
git checkout -b main-clean <GOOD_COMMIT_SHA>

# Cherry-pick good commits (skip bad ones)
git cherry-pick <GOOD_COMMIT_1>
git cherry-pick <GOOD_COMMIT_2>
# ... only the ones without secrets
```

### Step 4: Force Push

```bash
# Push to GitHub
git push origin main-clean:main --force

# Push to Gitea
git push gitea main-clean:main --force
```

### Step 5: Verify

```bash
git log --oneline -5
git status
```

---

## Alternative: Revert (if conflict-free)

```bash
# Stash changes first
git stash

# Revert the bad commit
git revert --no-commit <BAD_COMMIT_SHA>
git commit -m "revert: remove commit with hardcoded secrets"

# Push
git push origin main
```

---

## Prevention

### 1. Never Hardcode Secrets

**WRONG:**
```bash
CLOUDFLARE_API_TOKEN=cfut_real_token_here
```

**RIGHT:**
```bash
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
```

### 2. Use .env.example as Canonical

All environment variables should reference `.env.example`:

```markdown
See `.env.example` for all required variables.
```

### 3. Pre-Push Scan

Before pushing, scan for secrets:

```bash
# Scan for common patterns
grep -rn "sk-\|cfk_\|cfut_\|ghp_" . --include="*.md" --include="*.sh"
```

### 4. GitHub Secret Scanning Allowlist

If secrets are false positives (test keys), allow via:
```
https://github.com/OWNER/REPO/settings/security_analysis
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `git checkout -b clean <sha>` | Create clean branch |
| `git cherry-pick <sha>` | Pick specific commit |
| `git push --force` | Rewrite remote history |
| `git stash` | Save working changes temporarily |

---

## Files Updated in This Cleanup

| File | Change |
|-------|--------|
| `.gitignore` | Comprehensive enterprise ignore |
| `docs/ARCHITECTURE.md` | MY_KEY → ${MY_API_KEY} |
| `docs/GOVERNANCE/README.md` | API keys → ${VAR} |
| `docs/NEXUS-SRE-GUIDE.md` | cfk_/cfut_ → ${VAR} |
| `.claude/skills/cloudflare-ai/SKILL.md` | Real tokens → placeholders |

---

## Related

- [`.env.example`](../.env.example) — Canonical env variables
- [NEXUS-SRE-GUIDE.md](./NEXUS-SRE-GUIDE.md) — SRE automation
