# Skill: /flow-next:monorepo-audit

## Purpose
Audit /srv/monorepo current state and generate a markdown report with:
- CORE vs TOOL vs ARCHIVE classification
- Last git activity per directory
- Health status of Nexus, Hermes, Mem0
- Available disk space
- Active processes

## Commands

### 1. Directory Classification
```bash
cd /srv/monorepo && ls -la
```

| Directory | Classification | Notes |
|-----------|----------------|-------|
| apps/ | CORE | Primary applications (ai-gateway, api, CRM, web, etc.) |
| packages/ | CORE | Shared packages (ui, zod-schemas) |
| mcps/ | TOOL | MCP servers (mcp-memory, mcp-postgres) |
| docker/ | TOOL | Docker Compose configurations |
| .claude/ | TOOL | Claude Code config, skills, vibe-kit |
| docs/ | TOOL | Documentation |
| scripts/ | TOOL | Automation scripts |
| smoke-tests/ | TOOL | Test suite |
| runner/ | TOOL | CI/CD runner config |
| grafana/ | TOOL | Monitoring dashboards |
| archive/ | ARCHIVE | Time-stamped research and tasks |
| node_modules/ | IGNORE | Dependencies |

### 2. Git Activity (last 30 days)
```bash
cd /srv/monorepo && git log --since="30 days ago" --format="%h %ad %s" --name-only | head -100
```

### 3. Last Commit Per Directory
```bash
cd /srv/monorepo && for dir in */; do last=$(git log -1 --format="%ad" -- "$dir" 2>/dev/null || echo "never"); echo "$dir | $last"; done 2>/dev/null | sort
```

### 4. Disk Space
```bash
df -h /srv /
```

### 5. Active Processes
```bash
ps aux | grep -E "nexus|hermes|mem0|mem0-server" | grep -v grep
```

### 6. Hermes Health
```bash
pgrep -a hermes || echo "hermes not running"
curl -s http://localhost:8000/health 2>/dev/null || echo "hermes health endpoint not accessible"
```

### 7. Mem0 Health
```bash
pgrep -a mem0 || echo "mem0 not running"
```

## Output Format

```markdown
# Monorepo Audit Report

**Date:** YYYY-MM-DD HH:MM

## Directory Classification

| Directory | Status | Last Git Activity | Classification |
|-----------|--------|-------------------|----------------|
| apps/ | ACTIVE | YYYY-MM-DD | CORE |
| ... | ... | ... | ... |

## Health Status

### Hermes Gateway
- **Status:** RUNNING / STOPPED
- **PID:** XXXXX
- **Uptime:** X hours
- **Endpoint:** http://localhost:8000

### Mem0
- **Status:** RUNNING / STOPPED
- **PID:** N/A

### Nexus Framework
- **Status:** NOT DEPLOYED (framework, not a service)
- **Version:** 7×7=49 agents

## Disk Space

| Filesystem | Size | Used | Available | Use% |
|-----------|------|------|-----------|------|
| / | XXXG | XXXG | XXXG | XX% |

## Active Processes

| Process | PID | Status | Memory |
|---------|-----|--------|--------|
| hermes-agent | XXXXX | Running | X.X% |
| ... | ... | ... | ... |

## Recent Git Activity (30 days)

| Commit | Date | Message |
|--------|------|---------|
| XXXXXXX | YYYY-MM-DD | feat: ... |
| ... | ... | ... |
```

## Execution

Run all commands, collect outputs, and format into the markdown report above.