---
archived: true
superseded_by: SPEC-023-unified-monitoring-self-healing.md
see_also: [SPEC-023-unified-monitoring-self-healing.md, SPEC-024-UNIFIED-CLAUDE-AGENT-MONOREPO.md]
---

> **ARCHIVED** — This specification has been superseded by [SPEC-023-unified-monitoring-self-healing.md](./SPEC-023-unified-monitoring-self-healing.md) and is kept for historical reference only.

# SPEC-013: Claude Code CLI Integration

**Date:** 2026-04-08
**Status:** Research Complete
**Scope:** Claude Code CLI (claude.ai/code) command discovery, skills loading, and enterprise patterns

---

## 1. Overview

Claude Code CLI is Anthropic's official terminal-based AI coding assistant. It operates through several integrated subsystems for command execution, skill loading, and project context management.

---

## 2. Command Discovery and Loading

### 2.1 Slash Command Locations

Claude Code discovers slash commands from three locations, scanned in priority order:

| Priority | Location | Scope | Label in `/help` |
|----------|----------|-------|------------------|
| 1 | Built-in commands | Global | (built-in) |
| 2 | `~/.claude/commands/` | User-level | (user) |
| 3 | `.claude/commands/` | Project-level | (project) |
| 4 | Plugin commands (`plugins/*/commands/`) | Plugin | (plugin:name) |

**Discovery Mechanism:** All `.md` files in these directories are automatically discovered and loaded at startup. No manual registration required.

### 2.2 Command File Format

Commands are Markdown files with YAML frontmatter:

```markdown
---
description: Brief description of the command
argument-hint: [arg1] [arg2]
allowed-tools: Read, Bash(git:*)
model: sonnet
disable-model-invocation: true  # Optional, for interactive workflows
---

Command prompt content with:
- Arguments: $1, $2, or $ARGUMENTS
- Files: @path/to/file
- Bash: !`command here`
```

### 2.3 Command Precedence

When multiple commands share the same name:
1. Built-in commands take highest priority
2. Project-level commands override user-level
3. Plugin commands are namespace-qualified (e.g., `/build` from plugin `ci` shows as `/ci:build`)

---

## 3. Skills System

### 3.1 Skills Locations

Skills are domain-specific knowledge modules loaded contextually:

| Location | Scope | Format |
|----------|-------|--------|
| `~/.claude/skills/` | User-level | `SKILL.md` per skill |
| `.claude/skills/` | Project-level | `SKILL.md` per skill |
| `~/.claude/agent-skills/skills/` | Installed plugin skills | Symlinked or packaged |

**Symlink Pattern:** Project-level skills often symlink to user-level for reusability:
```
.claude/skills/spec-driven-development -> ~/.claude/agent-skills/skills/spec-driven-development
```

### 3.2 Skill File Format

```markdown
---
name: Skill Name
description: When to use this skill
version: 1.0.0
---

Skill instructions and guidance content...
```

### 3.3 Skill Loading Protocol

```
User Request → Skill Description Match → Load SKILL.md
                                            ↓
                                    Read references/ (if exists)
                                            ↓
                                    Read scripts/ (if exists)
```

Skills are NOT invoked directly via slash commands. They are loaded automatically when their description matches the current task context, or explicitly referenced by name in a command/agent.

---

## 4. Rules System

### 4.1 Rules Locations

| Location | Scope | Purpose |
|---------|-------|---------|
| `~/.claude/rules/` | User-level | Global rule definitions |
| `.claude/rules/` | Project-level | Project-specific governance |

### 4.2 Rule File Format (Hookify Rules)

```markdown
---
name: warn-dangerous-rm
enabled: true
event: bash
pattern: rm\s+-rf
action: warn
---

Warning: Dangerous rm command detected.
Please verify the path is correct before proceeding.
```

### 4.3 Hooks (Event-Driven Automation)

Hooks execute scripts on specific events:

| Location | Purpose |
|----------|---------|
| `~/.claude/hooks/` | User-level hook scripts |
| `.claude/hooks/` | Project-level hook scripts |
| `*/hooks/` | Plugin-level hooks |

**Hook Types:**
- `PreToolUse-*` - Executes before a tool is used
- `Stop-*` - Executes when session ends
- `SessionStart` - Executes when session begins

**Example Hook:** `PreToolUse-Bash-validate.bash` validates Bash commands against dangerous patterns.

---

## 5. Project-Level vs User-Level Configuration

### 5.1 User-Level (`~/.claude/`)

```
~/.claude/
├── commands/           # User's personal slash commands
├── skills/            # User's personal skills
├── rules/             # User's global rules
├── hooks/             # User's global hooks
├── agents/            # User's custom agents
├── settings.json      # Global settings (model, permissions, env)
├── settings.local.json # Local MCP server overrides
├── CLAUDE.md          # User's global instructions
├── mcp-servers.json   # MCP server configurations
├── projects/          # Project-specific session state
│   └── -srv-monorepo/ # Per-project memory and history
└── agent-skills/      # Installed skill packages
    ├── skills/        # Skill modules
    └── .claude/
        └── commands/  # Commands from skill packages
```

### 5.2 Project-Level (`.claude/` in repo)

```
.claude/
├── CLAUDE.md          # Project instructions (read at session start)
├── commands/          # Project-specific slash commands
├── skills/            # Project-specific skills (often symlinks)
├── rules/             # Project governance rules
├── hooks/             # Project-specific hooks
├── agents/            # Project-specific agents
├── workflows/         # Workflow definitions
├── tools/             # Custom tool definitions
└── scheduled_tasks.json # Cron-like task scheduling
```

### 5.3 Settings Precedence

Settings are merged with this precedence (highest first):
1. Project-level `.claude/` settings
2. User-level `~/.claude/` settings
3. Built-in defaults

**Key settings files:**
- `~/.claude/settings.json` - Global configuration
- `~/.claude/settings.local.json` - Local overrides (MCP servers)
- Project-level `CLAUDE.md` - Project instructions read at startup

---

## 6. `.agent/` Workflows Integration

### 6.1 Antigravity Kit Structure

The `.agent/` directory (Antigravity Kit) is a separate capability expansion toolkit:

```
.agent/
├── ARCHITECTURE.md     # System documentation
├── agents/            # Specialist AI personas (20 agents)
├── skills/            # Domain knowledge modules (36 skills)
├── workflows/         # Slash command procedures (11 workflows)
├── rules/             # Global rules
└── scripts/           # Master validation scripts
```

### 6.2 `.agent/workflows/` vs `.claude/commands/`

| Aspect | `.agent/workflows/` | `.claude/commands/` |
|--------|---------------------|---------------------|
| **Purpose** | Complex multi-step workflows | Single-purpose commands |
| **Format** | Markdown with step-by-step procedures | Markdown with frontmatter |
| **Invocation** | Via `/scaffold`, `/feature`, `/ship`, etc. | Via `/command-name` directly |
| **Skills Used** | References multiple skills | Single command |
| **Agents** | Can launch specialist agents | Direct execution |

**Example Workflows in `.agent/workflows/`:**
- `scaffold.md` - New project scaffolding
- `git-feature.md` - Feature branch workflow
- `git-ship.md` - Commit + PR workflow
- `git-turbo.md` - Turbo mode (commit + merge + tag + new branch)
- `code-review-workflow.md` - Systematic code review

### 6.3 Integration Points

**From `.claude/commands/` to `.agent/workflows/`:**

Project-level commands in `.claude/commands/` invoke `.agent/workflows/` procedures:

```markdown
---
description: Scaffold a new feature
---

Use the workflow in `.agent/workflows/git-feature.md`:
1. Create feature branch from main
2. Implement feature following spec
3. Run tests and lint
4. Create PR
```

**Skill References:**

Skills from `.agent/skills/` are referenced in workflows and loaded contextually:

```markdown
## Skills Available
| Skill | When to Use |
|-------|-------------|
| `bug-investigation` | Bug fix reviews |
| `test-generation` | Verifying test coverage |
```

---

## 7. MCP Servers Integration

### 7.1 MCP Configuration Locations

| Location | Purpose |
|----------|---------|
| `~/.claude/mcp-servers.json` | Global MCP server registry |
| `~/.claude/settings.local.json` | Enabled MCP servers per installation |
| `.mcp.json` | Plugin-specific MCP configuration |
| `plugins/*/.mcp.json` | Plugin-bundled MCP configs |

### 7.2 MCP Server Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["./mcp-server/build/index.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

---

## 8. Agent System

### 8.1 Agent Locations

| Location | Scope |
|----------|-------|
| `~/.claude/agents/` | User-level custom agents |
| `.claude/agents/` | Project-level agents |
| `.agent/agents/` | Specialist agents (Antigravity Kit) |
| `plugins/*/agents/` | Plugin-provided agents |

### 8.2 Agent Invocation

Agents are invoked using the `Task` tool from within commands or workflows:

```markdown
---
description: Deep analysis using plugin agent
argument-hint: [file-path]
---

Initiate deep code analysis of @$1 using the code-analyzer agent.
```

---

## 9. Key Research Findings

### 9.1 Command Discovery is Automatic

- All `.md` files in `commands/` directories are auto-discovered
- No manifest or registration required
- Commands appear in `/help` with their source label

### 9.2 Skills vs Commands

- **Commands** (`/foo`): Executable slash commands invoked directly
- **Skills**: Contextual knowledge modules loaded automatically or on-demand
- Skills are NOT invoked via slash commands (except via wrapper commands)

### 9.3 Project-Level Override

- Project-level `.claude/` takes precedence over user-level `~/.claude/`
- `CLAUDE.md` in project root is read at every session start
- Rules in `.claude/rules/` override global rules

### 9.4 Antigravity Kit is Optional

- `.agent/` is a separate toolkit, NOT part of Claude Code itself
- Its workflows are invoked via wrapper commands in `.claude/commands/`
- Skills from `.agent/skills/` are symlinked or loaded explicitly

### 9.5 Hooks are Event-Sourced

- Hooks trigger on specific events (PreToolUse, SessionStart, Stop)
- Multiple hooks can chain on the same event
- Hook scripts are bash scripts that receive tool context as arguments

---

## 10. File Path Reference

### User-Level (Home)
```
/home/will/.claude/
├── commands/                    # User slash commands
│   ├── context-optimizer.md
│   ├── deploy-check.md
│   ├── executive-ceo.md
│   ├── modo-dormir.md
│   ├── repo-onboard.md
│   └── security-audit.md
├── skills/                       # User skills (21 directories)
│   ├── auto-orchestrate/
│   ├── browser-dev/
│   ├── context7-mcp/
│   ├── coolify-*/
│   ├── img/
│   ├── openclaw-oauth-profiles/
│   ├── pipeline-orchestrate/
│   ├── researcher/
│   ├── universal-*/
│   └── workflow-performatico/
├── rules/                        # User rules
│   ├── agent-skills.rules
│   └── context7.md
├── hooks/                        # User hooks
│   ├── PreToolUse-Bash-validate.bash
│   ├── PreToolUse-Edit-validate.bash
│   ├── Stop-modo-dormir.bash
│   └── Stop-session-log.bash
├── agents/                       # User agents
│   ├── context-optimizer.md
│   ├── deploy-check.md
│   ├── executive-ceo.md
│   ├── modo-dormir.md
│   ├── repo-onboard.md
│   └── security-audit.md
├── agent-skills/                 # Installed skill package
│   ├── .claude/
│   │   └── commands/            # Package commands (symlinks)
│   ├── skills/                   # Package skills (22 directories)
│   └── agents/
├── settings.json                 # Global settings
├── settings.local.json           # Local overrides
├── mcp-servers.json             # MCP registry
├── CLAUDE.md                    # Global user instructions
└── projects/                    # Per-project state
    └── -srv-monorepo/           # Monorepo project state
```

### Project-Level (Monorepo)
```
/srv/monorepo/.claude/
├── CLAUDE.md                    # Project instructions
├── commands/                    # Project commands (16 files)
│   ├── code-review.md
│   ├── commit.md
│   ├── dv.md
│   ├── feature.md
│   ├── hg.md
│   ├── img.md
│   ├── next-task.md
│   ├── pg.md
│   ├── plan.md
│   ├── rs.md
│   ├── scaffold.md
│   ├── sec.md
│   ├── ship.md
│   ├── ss.md
│   ├── turbo.md
│   └── update-docs.md
├── skills/                      # Project skills (symlinks + local)
│   ├── api-design/
│   ├── bug-investigation/
│   ├── browser-dev/
│   ├── code-review/
│   ├── commit-message/
│   ├── context-prune/
│   ├── cost-reducer/
│   ├── create-skill/
│   ├── customer-support/
│   ├── deploy-validate/
│   ├── documentation/
│   ├── feature-breakdown/
│   ├── frontend-design/
│   ├── human-gates/
│   ├── know-me/
│   ├── mcp-health/
│   ├── n8n/
│   ├── pipeline-gen/
│   ├── pr-review/
│   ├── refactoring/
│   ├── repo-scan/
│   ├── researcher/
│   ├── scalability/
│   ├── secrets-audit/
│   ├── security/
│   ├── security-audit/
│   ├── self-healing/
│   ├── smoke-test-gen/
│   ├── snapshot-safe/
│   ├── spec-driven-development -> (symlink)
│   ├── test-generation/
│   ├── testsprite/
│   └── trigger-dev/
├── rules/                        # Project rules
│   ├── backend.md
│   ├── openclaw-audio-governance.md
│   ├── REVIEW-SKILLS.md
│   └── search.md
├── hooks/                        # Project hooks
├── agents/                       # Project agents
├── workflows/                    # Local workflows
│   └── examples/
└── scheduled_tasks.json          # Cron scheduling

/srv/monorepo/.agent/             # Antigravity Kit
├── ARCHITECTURE.md
├── agents/                       # 20 specialist agents
├── skills/                        # 36 skills
├── workflows/                     # 11 workflows
│   ├── api-design/
│   ├── bug-investigation/
│   ├── code-review/
│   ├── code-review-workflow.md
│   ├── commit-message/
│   ├── debug.md
│   ├── documentation/
│   ├── feature-breakdown/
│   ├── git-feature.md
│   ├── git-mirror-gitea-github.md
│   ├── git-ship.md
│   ├── git-turbo.md
│   ├── GIT-WORKFLOWS.md
│   ├── pr-review/
│   ├── refactoring/
│   ├── scaffold.md
│   ├── security-audit/
│   ├── sincronizar-tudo.md
│   ├── test-generation/
│   └── ui-ux-pro-max.md
├── rules/
└── scripts/
```

---

## 11. Sources

- [Claude Code Plugin System](https://github.com/anthropics/claude-code/blob/main/plugins/README.md)
- [Command Development](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/command-development/SKILL.md)
- [Plugin Structure](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/plugin-structure/SKILL.md)
- [Command File Format](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/command-development/README.md)
- [Hook Development Patterns](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/hook-development/references/patterns.md)
- [MCP Integration](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/mcp-integration/SKILL.md)
- [Agent Development](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/agent-development/references/agent-creation-system-prompt.md)
