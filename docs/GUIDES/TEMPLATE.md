# GUIDE-TEMPLATE.md — How-to Guide Template

**Status:** ACTIVE
**Template Version:** 1.0
**Created:** 2026-04-10
**Owner:** will

---

## Overview

This template provides the standard structure for all how-to guides in the `/srv/monorepo/docs/GUIDES/` directory. Follow this template exactly when creating new operational guides.

---

## When to Use This Template

Use this template when creating:

- **Operational guides** — Step-by-step instructions for maintaining services
- **Troubleshooting guides** — Problem diagnosis and resolution procedures
- **Maintenance procedures** — Recurring operational tasks
- **Workflow guides** — How to execute multi-step processes

### When NOT to Use This Template

- **Feature specifications** — Use `SPEC-TEMPLATE.md` in `docs/SPECS/`
- **Architecture decisions** — Use `ADR-TEMPLATE.md` in `docs/ADRs/`
- **Reference documentation** — Use `REFERENCE-TEMPLATE.md` in `docs/REFERENCE/`

---

## Template Structure

```markdown
# [Title — Imperative Verb]

**Data:** YYYY-MM-DD
**Prerequisites:** [Prereq-1], [Prereq-2]
**Est. Time:** [duration]

---

## Overview

[Brief description of what this guide accomplishes and when to use it.]

## Prerequisites

Before starting, ensure you have:

- [ ] **[Requirement 1]** — [Brief explanation]
- [ ] **[Requirement 2]** — [Brief explanation]
- [ ] **[Requirement 3]** — [Brief explanation]

### Required Access

- [ ] SSH access to target host
- [ ] Required environment variables configured
- [ ] Necessary permissions (sudo/systemd)

### Related Services

If applicable, list services that must be running:

| Service | Port | Required |
|---------|------|----------|
| [Name] | :[port] | Yes/No |

---

## Step-by-Step Instructions

### Step 1: [Action Name]

[Detailed explanation of what to do and why.]

```bash
# Example command or code block
command --flag argument
```

**Expected output:**
```
example output showing success
```

### Step 2: [Action Name]

[Detailed explanation.]

```bash
# Another example
curl -s http://localhost:PORT/health | jq
```

### Step 3: [Action Name]

[Detailed explanation with caveats.]

**Caution:** [Any safety warnings]

```bash
# Destructive or important commands
sudo systemctl restart service-name
```

---

## Verification Steps

After completing the guide, verify success:

### Health Check

```bash
# Verify service is responding
curl -s http://localhost:PORT/health
```

**Expected:** `{"status":"healthy"}` or similar

### Log Verification

```bash
# Check service logs for errors
journalctl -u SERVICE_NAME -n 50 --no-pager
```

### Functional Test

```bash
# Run a functional test
bash /path/to/test-script.sh
```

**Expected:** [Description of expected outcome]

---

## Common Issues

### Issue 1: [Short Description]

**Symptoms:**
- [Symptom A]
- [Symptom B]

**Diagnosis:**
```bash
# Diagnostic command
command --diagnose
```

**Resolution:**
```bash
# Fix command
fix-command
```

---

### Issue 2: [Short Description]

**Symptoms:**
- [Symptom A]

**Diagnosis:**
```bash
# Diagnostic command
curl -s http://localhost:PORT/status | jq
```

**Resolution:**
```bash
# Restart affected service
sudo systemctl restart SERVICE_NAME
```

---

## Rollback Procedure

If something goes wrong:

```bash
# Stop the failed operation
sudo systemctl stop SERVICE_NAME

# Restore previous state
git stash pop  # or restore from backup
sudo systemctl restart SERVICE_NAME
```

---

## Related Documentation

- [Related Guide Name](./guide-name.md) — [Brief description]
- [Service Documentation](../REFERENCE/service-name.md) — [Brief description]
- [Architecture Decision](../ADRs/ADR-NNN-title.md) — [Brief description]

---

## Changelog

### v1.0 (YYYY-MM-DD)
- Initial version
```

---

## Example: Based on Service Health Check Guide

```markdown
# Service Health Check — Smoke Test

**Data:** 2026-04-10
**Prerequisites:** Docker, curl, jq
**Est. Time:** 5 minutes

---

## Overview

This guide performs a smoke test on critical services, verifying all endpoints and containers are operational. Run this before extended use or after system restart.

## Prerequisites

Before starting, ensure you have:

- [ ] **Docker** — Container runtime
- [ ] **curl** — HTTP client for health checks
- [ ] **jq** — JSON processor
- [ ] **Services running** — LiteLLM, Ollama, Qdrant

### Required Services

| Service | Port | Required |
|---------|------|----------|
| LiteLLM | :4000 | Yes |
| Ollama | :11434 | Yes |
| Qdrant | :6333 | Yes |

---

## Step-by-Step Instructions

### Step 1: Verify Services Are Running

Check all services are listening on their respective ports:

```bash
# Check all ports
ss -tlnp | grep -E ':(4000|11434|6333)'
```

**Expected output:**
```
LISTEN  0.5  127.0.0.1:4000    0.0.0.0:*  users:(("docker-proxy",pid=12345,fd=4))
LISTEN  0.5  127.0.0.1:11434  0.0.0.0:*  users:(("ollama",pid=1122,fd=3))
LISTEN  0.5  127.0.0.1:6333   0.0.0.0:*  users:(("qdrant",pid=6789,fd=4))
```

### Step 2: Health Check All Services

```bash
# Comprehensive health check
for port in 4000 11434 6333; do
  curl -sf http://localhost:$port/health 2>/dev/null && echo ":$port OK" || echo ":$port FAIL"
done
```

**Expected:** All ports report OK

### Step 3: Verify Ollama Models

```bash
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

**Expected output:**
```json
[
  "llama3:latest",
  "qwen2.5vl:7b",
  "nomic-embed-text:latest"
]
```

---

## Verification Steps

### GPU Memory Check

```bash
# Check VRAM usage
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

**Expected:** Memory usage within normal bounds

---

## Common Issues

### Issue 1: Service Not Responding

**Symptoms:**
- Health check fails with connection error
- Port not listening

**Diagnosis:**
```bash
ps aux | grep service_name
ss -tlnp | grep PORT
```

**Resolution:**
```bash
# Restart the service
docker restart container_name
```

---

### Issue 2: LLM Model Not Available

**Symptoms:**
- Model not found error
- Ollama API returns empty model list

**Diagnosis:**
```bash
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

**Resolution:**
```bash
# Pull the required model
ollama pull model-name:latest
```

---

## Rollback Procedure

If the smoke test reveals critical failures:

```bash
# Stop all services
docker stop $(docker ps -q)

# Restore previous state via git
cd /srv/monorepo
git stash
git stash pop

# Restart services
docker compose up -d
```

---

## Related Documentation

- [CODE-REVIEW-GUIDE](./CODE-REVIEW-GUIDE.md) — Code review standards
- [Container Health Check](../OPERATIONS/SKILLS/container-health-check.md) — Health checks

---

## Changelog

### v1.0 (2026-04-10)
- Initial template based on service health check
```

---

## Key Sections Explained

| Section | Purpose | Required |
|---------|---------|----------|
| **Overview** | What this guide accomplishes | Yes |
| **Prerequisites** | What must be in place before starting | Yes |
| **Step-by-Step** | Numbered instructions with commands | Yes |
| **Verification** | How to confirm success | Yes |
| **Common Issues** | Troubleshooting table | Yes |
| **Rollback** | How to undo if something goes wrong | Recommended |
| **Related Docs** | Cross-references to other docs | Yes |

---

## Formatting Rules

1. **Code blocks** — Always specify language for syntax highlighting:
   - `bash` for shell commands
   - `json` for JSON output
   - `yaml` for configuration files
   - `markdown` for markdown examples

2. **Tables** — Use for:
   - Service listings (name, port, status)
   - Issue symptom/cause/resolution mapping
   - Parameter descriptions

3. **Health checks** — Always provide:
   - The curl/command to check
   - Expected output format
   - Example output

4. **File:Line references** — Use format `path:line` not `path line`

---

## Naming Convention

- File names: `kebab-case.md` (e.g., `voice-pipeline-desktop.md`)
- Section headers: Sentence case (e.g., `## Overview`)
- Steps: Imperative verb (e.g., `### Step 1: Verify Services`)

---

## Related Templates

- [SPEC-TEMPLATE.md](../specflow/SPEC-TEMPLATE.md) — Feature specifications
- [ADR-TEMPLATE.md](../ADRs/ADR-TEMPLATE.md) — Architecture decisions
- [REFERENCE-TEMPLATE.md](../REFERENCE/REFERENCE-TEMPLATE.md) — Technical references
