# REVIEW-002: Commits Audit 9b58a41..HEAD

**Date:** 2026-04-08
**Reviewer:** code-reviewer agent
**Commits Reviewed:** 26 commits since 9b58a41

---

## Summary

Reviewed 26 commits across apps/perplexity-agent, apps/openclaw, CI/CD workflows, and documentation. Overall quality is good with a few issues that should be addressed.

**Critical Issues Found:** 1
**Important Issues Found:** 2
**Suggestions Found:** 3

---

## Findings by Axis

### Correctness

| Severity | Location | Issue |
|----------|----------|-------|
| Important | `apps/perplexity-agent/config.py:93-96` | Duplicate variable assignments (CHROME_PROFILE_PATH, STREAMLIT_PORT defined twice) |

**Details:**
The file defines `CHROME_PROFILE_PATH` at lines 79-82 and again at lines 93-96. Similarly `STREAMLIT_PORT` is defined at lines 85-86 and 97-98. The second definitions silently shadow the first.

**Fix:** Remove the duplicate definitions at lines 93-98.

---

### Security

| Severity | Location | Issue |
|----------|----------|-------|
| Critical | `apps/perplexity-agent/agent/browser_agent.py:15-31` | Dynamic code execution with f-string interpolation — potential injection if secret_key is untrusted |

**Details:**
The `_get_infisical_secret` function builds a Python script using f-strings that interpolate `secret_key` directly into the script code. While `secret_key` currently comes from controlled code, this pattern is dangerous if `secret_key` ever contains user input or comes from an untrusted source.

**Current:**
```python
script = f"""
from infisical_sdk import InfisicalSDKClient
...
for s in secrets.secrets:
    if s.secret_key == '{secret_key}':
        print(s.secret_value)
"""
```

**Recommended:**
```python
script = f"""
from infisical_sdk import InfisicalSDKClient
...
for s in secrets.secrets:
    if s.secret_key == ''' + repr(secret_key) + ''':
        print(s.secret_value)
"""
```

Or better, use the Infisical SDK directly in-process rather than subprocess with shell code.

---

### Architecture

| Severity | Location | Issue |
|----------|----------|-------|
| Suggestion | `apps/perplexity-agent/config.py` | Config initialization at module load time (line 68: `MINIMAX_TOKEN = get_minimax_token()`) creates hard startup dependency |

**Details:**
Calling `get_minimax_token()` at module import time means the application will fail to start if Infisical is unavailable, even if MINIMAX_TOKEN is never used. This is a tight coupling issue.

**Recommendation:** Consider lazy initialization or deferring to when the token is actually needed.

---

### Performance

| Severity | Location | Issue |
|----------|----------|-------|
| Suggestion | `apps/perplexity-agent/components/oauth_personas.py:56-66` | Inefficient OAuth token lookup — iterates all secrets |

**Details:**
The `_fetch_infisical_secret` function fetches ALL secrets from Infisical and then filters in Python. This is O(n) where n is total secrets in vault, not O(1).

**Recommendation:** Use Infisical SDK's `get_secret()` method instead of `list_secrets()` for direct secret retrieval.

---

### Readability

| Severity | Location | Issue |
|----------|----------|-------|
| Suggestion | `.github/workflows/deploy-perplexity-agent.yml` | Python inline scripts in workflow could be extracted to separate script file |

**Details:**
Multiple Python one-liners and inline scripts in the GitHub Actions workflow make debugging harder. Consider moving to a `scripts/` directory.

---

## Commits Reviewed

| Commit | Description | Files | Assessment |
|--------|-------------|-------|------------|
| 62cb125 | Sync pending changes | docs, tasks | OK |
| a9f266b | OpenClaw Agents Kit + TTS Bridge | docs, skills | OK |
| 3396923 | OpenClaw OAuth login guide | docs | OK |
| 5035dec | Apply code review fixes | docker-compose.gitea-runner.yml | OK |
| 57ee9cd | Consolidate SPEC-007, gitea runner incident | SPEC, incidents | OK |
| 60172e9 | Add act_runner setup for Gitea Actions | docker-compose, config | OK |
| 8cdb759 | GitHub Actions deploy to Coolify | .github/workflows | OK |
| 8046784 | OAuth persona manager | app.py, components | See findings |
| ceb6455 | Fix python3 path | config.py | OK |
| efa81f8 | wav2vec2 containerization incident | docs | OK |
| 9bfb39e | Docker deployment files | Dockerfile, docker-compose | OK |
| efa1c7f | Simplify to single LLM | browser_agent.py | OK |
| c91ccc9 | Update fallback model reference | browser_agent.py | OK |
| 3da9623 | OpenRouter GPT-4o-mini primary | browser_agent.py | OK |
| d6e5ca4 | Perplexity agent setup + browser-use | app.py, config.py, agent/ | OK |

---

## Action Items

- [ ] **[Critical]** Fix dynamic code execution in `browser_agent.py:15-31` - use repr() or direct SDK
- [ ] **[Important]** Remove duplicate variable assignments in `config.py:93-98`
- [ ] **[Important]** Consider lazy initialization for `MINIMAX_TOKEN` in `config.py`
- [ ] **[Suggestion]** Use Infisical SDK `get_secret()` directly instead of list + filter
- [ ] **[Suggestion]** Extract inline Python from workflow files to `scripts/`

---

## Decision

**REQUEST_CHANGES** — Critical security issue in browser_agent.py must be fixed before these changes are deployed.

---

## Related Documents

- [CODE-REVIEW-GUIDE.md](../specflow/CODE-REVIEW-GUIDE.md) - Review standards
- [code-review-workflow.md](../../.agent/workflows/code-review-workflow.md) - How to run reviews
- [REVIEW-SKILLS.md](../../.claude/rules/REVIEW-SKILLS.md) - Review skills reference
