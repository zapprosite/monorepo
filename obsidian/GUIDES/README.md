# How-to Guides

This directory contains practical, task-oriented documentation for the homelab-monorepo. Where SPECs define *what* to build and ADRs record *why* behind architectural choices, GUIDEs explain *how* to execute specific operations.

## What's in This Directory

| Guide | Purpose |
|-------|---------|
| `discovery.md` | Service discovery procedures and network exploration |
| `CANVAS-CURSOR-LOOP.md` | Autonomous CI/CD cursor loop workflow |
| `CODE-REVIEW-GUIDE.md` | Standards and procedures for conducting code reviews |
| `voice-pipeline-desktop.md` | Voice pipeline setup and smoke test for Ubuntu desktop |
| `voice-pipeline-loop.md` | Server-side voice pipeline with OpenClaw and LiteLLM |
| `tasks.md` | Task extraction and prioritization from SPECs |
| `TEMPLATE.md` | Template for creating new guides (start here) |
| `PLAN-docs-reorganization-20260408.md` | Plan for restructuring docs/ directory |

## When to Create a GUIDE

Create a GUIDE when you need to document:

- **Operational procedures** — Step-by-step instructions for deploying, configuring, or maintaining services
- **Troubleshooting** — Diagnosis and resolution for known issues
- **Workflows** — How to execute multi-step processes (e.g., code review, voice pipeline smoke test)
- **Maintenance routines** — Recurring tasks like backups, health checks, or log rotation

**Before creating a new guide**, check if the TEMPLATE.md covers your use case and follow its structure exactly.

## GUIDE vs SPEC vs ADR

| Document | Answer | Example |
|----------|--------|---------|
| **SPEC** | What do we need to build? | "OpenClaw needs a local STT proxy that fakes Deepgram API format" |
| **ADR** | Why did we choose this approach? | "Why we use wav2vec2-proxy instead of calling whisper-api directly" |
| **GUIDE** | How do we execute this operation? | "Run the voice pipeline smoke test to verify all services are healthy" |
| **REFERENCE** | What is this component/capability? | Port assignments, API endpoint specs, configuration schemas |

**Rule of thumb:** If the answer is imperative ("how to do X"), it's a GUIDE. If it's declarative ("what X is" or "why X"), it belongs elsewhere.

## Using the Template

Every new guide must use `TEMPLATE.md` as its foundation. Copy the template, then fill in:

1. **Overview** — One paragraph: what this guide accomplishes and when to use it
2. **Prerequisites** — Checkboxes for required access, services, environment variables
3. **Step-by-Step Instructions** — Numbered steps with commands and expected output
4. **Verification Steps** — How to confirm the procedure succeeded
5. **Common Issues** — Table of known problems with diagnosis/resolution
6. **Rollback Procedure** — How to undo if something goes wrong (recommended)
7. **Related Documentation** — Cross-references to other docs

**Required sections:** Overview, Prerequisites, Step-by-Step, Verification, Common Issues.

**Formatting rules from TEMPLATE.md:**

- Code blocks always specify language: `bash`, `json`, `yaml`, `markdown`
- Use tables for service listings and issue mappings
- Health checks must include expected output format
- File references: `path:line` format

**Naming:** `kebab-case.md` (e.g., `voice-pipeline-desktop.md`)

## See Also

- `docs/SPECS/` — Feature specifications
- `docs/ADRs/` — Architecture decision records
- `docs/REFERENCE/` — Technical references
- `docs/CLAUDE.md` — Full docs structure and naming conventions
