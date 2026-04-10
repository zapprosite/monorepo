# HVAC-R WhatsApp Swarm

Multi-agent swarm para atendimento técnico HVAC-R via WhatsApp.

## Status

**Phase:** SPEC Draft (8 SPECs created)

## Architecture

- Go 1.23+ goroutines
- Redis 7 (task board + state)
- Qdrant 1.13 (vector search)
- Gemini 2.5 Flash (LLM)
- WhatsApp Cloud API

## SPECs

| # | Title | Status |
|---|-------|--------|
| SPEC-001 | Core Swarm Architecture | DRAFT |
| SPEC-002 | Redis Task Board | DRAFT |
| SPEC-003 | Memory Layers | DRAFT |
| SPEC-004 | WhatsApp Integration | DRAFT |
| SPEC-005 | RAG Pipeline | DRAFT |
| SPEC-006 | Billing & Stripe | DRAFT |
| SPEC-007 | Deployment | DRAFT |
| SPEC-008 | All Agents | DRAFT |

## Quick Start

```bash
make dev   # Development
make build # Build binary
make test  # Run tests
```

## Reference

See \`REFERENCE-blueprint.md\` for full architecture (2306 lines).
