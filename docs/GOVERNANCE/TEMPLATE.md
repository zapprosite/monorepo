# Template Reference

**Purpose:** Standard template for all REFERENCE documents in the monorepo.
**Location:** `/srv/monorepo/docs/REFERENCE/TEMPLATE.md`
**Applies to:** All documents under `docs/REFERENCE/`

---

## Overview

This is the template for all REFERENCE documents. REFERENCE documents are technical, authoritative sources that describe how things work — commands, APIs, schemas, configurations, and toolchains. Unlike GUIDEs (which explain how to accomplish goals), REFERENCE documents explain how things are structured and how to use them.

**When to use a REFERENCE:**
- Describing CLI commands and their options
- Documenting API endpoints, request/response schemas
- Explaining configuration file formats
- Cataloging toolchain commands and environment setup

**When NOT to use a REFERENCE:**
- Step-by-step how-to tasks (use GUIDES instead)
- Architectural decisions and rationale (use ADRs instead)
- Feature specifications (use SPECS instead)

---

## Document Structure

Every REFERENCE document must contain these sections:

```markdown
# <Title>

**Purpose:** One-line description of what this reference covers.
**Location:** File path
**Audience:** Who needs this document (developers, operators, etc.)

---

## Overview

Brief description of the topic. What is it, why does it exist, when should you use it?

## Syntax / Schema

For CLI: command syntax with all options.
For API: endpoint definitions, request/response schemas.
For config: full schema with all keys and their types.

## Options / Parameters

Detailed description of every option/parameter, organized by category.
Use tables for option lists.

## Examples

Real, working examples — not placeholder code.
Show common use cases first, then edge cases.

## Related Documents

Links to related REFERENCE, GUIDE, ADR, and SPEC documents.
```

---

## Section Templates

### Title Section

```markdown
# <Reference Title>

**Purpose:** One-line description of what this reference covers.
**Location:** <file-path>
**Audience:** <target users>
```

### Overview Section

```markdown
## Overview

<purpose paragraph>

<technical context and relationships>

<breadcrumb navigation for related tools>
```

### Syntax/Schema Section

For CLI references, use this format:

```markdown
## Syntax

```bash
<command> [options] <required-arg> [optional-arg]
```

### For API references:

```markdown
## Endpoint

`POST /api/v1/resource`

### Request Schema

```json
{
  "fieldName": {
    "type": "string",
    "required": true,
    "description": "What this field does",
    "example": "example-value"
  }
}
```

### Response Schema

```json
{
  "data": { ... },
  "error": { "code": "string", "message": "string" }
}
```
```

### Options/Parameters Section

```markdown
## Options / Parameters

### Global Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--help` | flag | — | Show help message |
| `--verbose` | flag | false | Enable verbose output |

### Resource Options

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | yes | Resource identifier |
| `--timeout` | number | 30 | Request timeout in seconds |
```

### Examples Section

```markdown
## Examples

### Basic Usage

```bash
command init my-project
```

### With Options

```bash
command build --env production --output ./dist
```

### Error Handling

```bash
command deploy --env staging 2>&1 | tee deploy.log
```
```

### Related Documents Section

```markdown
## Related Documents

- [CLI Shortcuts](./CLI-SHORTCUTS.md) — Slash commands and shell aliases
- [Toolchain](./TOOLCHAIN.md) — Package managers, Turbo, Biome
- [Architecture](../ARCHITECTURE/ARCHITECTURE-MASTER.md) — System design
```

---

## Quick Reference: CLI Reference Format

When documenting CLI commands, use this canonical format:

```markdown
## Command: <name>

### Synopsis

```bash
<command> [subcommand] [options] <args>
```

### Description

<purpose of the command>

### Options

| Short | Long | Type | Default | Description |
|-------|------|------|---------|-------------|
| `-h` | `--help` | flag | — | Show help |
| `-v` | `--verbose` | flag | false | Verbose output |
| `-o` | `--output` | string | stdout | Output file |
| `-t` | `--timeout` | number | 30 | Timeout (seconds) |

### Examples

```bash
# Basic usage
<command> <arg>

# With options
<command> <arg> --output ./result.json

# Piping
<command> <arg> | jq '.data'
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Resource not found |
</```

---

## Quick Reference: API Reference Format

When documenting API endpoints:

```markdown
## POST /api/v1/<resource>

Creates a new resource.

### Request

```json
{
  "name": "string (required)",
  "config": {
    "key": "value"
  }
}
```

### Response

**201 Created**
```json
{
  "id": "res_abc123",
  "name": "string",
  "createdAt": "2026-04-10T12:00:00Z"
}
```

**400 Bad Request**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Field 'name' is required"
  }
}
```

### Example

```bash
curl -X POST https://api.example.com/api/v1/resource \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-resource"}'
```
```

---

## Quality Checklist

Before publishing a REFERENCE document, verify:

- [ ] All commands are actual syntax (no placeholders like `<command>` without real examples)
- [ ] All options have descriptions and defaults
- [ ] All examples are tested and working
- [ ] Related documents links are valid
- [ ] Schema definitions include all required fields
- [ ] Error codes and HTTP status codes are documented
- [ ] Cross-references to other REFERENCE documents are accurate

---

## Related Documents

- [CLI Shortcuts](./CLI-SHORTCUTS.md) — Slash commands and git aliases
- [Toolchain](./TOOLCHAIN.md) — Package managers, Turbo, Biome, scripts
- [Architecture Models](./ARCHITECTURE-MODELS.md) — System architecture patterns
- [AI Context](../MCPs/AI_CONTEXT_MCP.md) — Context management MCP
- [Workflow](../REFERENCE/WORKFLOW.md) — Development workflow reference

---

**Last updated:** 2026-04-10
**Maintainer:** will