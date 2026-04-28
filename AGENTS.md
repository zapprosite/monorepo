# AGENTS.md - Codex CLI Context

Classification: INTERNAL
Owner: Platform Engineering
Version: 2.2.0
Updated: 2026-04-26

This file is the automatic Codex CLI bootstrap for `/srv/monorepo`. Keep it concise. Put detailed architecture in the referenced docs.

## Mission

`/srv/monorepo` is the homelab control plane and source of truth. Treat symlinked service directories as live service entry points, not disposable copies:

```text
ops/                     -> /srv/ops
hermes-second-brain/     -> /srv/hermes-second-brain (symlink, separate repo)
hermes/                  -> ~/.hermes
fit-tracker/             -> /srv/fit-tracker-v2
hvacr-swarm/             -> /srv/hvacr-swarm
edge-tts/                -> /srv/edge-tts
```

**hermes-second-brain** is a separate git repository with private GitHub mirror.
Agents may read code, docs, skills, and libs. Must not access:
- `.env`, `secrets/`, `data/`, `logs/`, `qdrant_storage/`, `*.db`, `*.sqlite`
See `docs/REFERENCE/NEXUS-SECOND-BRAIN-FLOW.md` for memory integration.

## Read Before Infra Changes

Before changing infrastructure, deployment, ports, domains, service boundaries, or production runtime behavior, read the relevant canonical file:

- `HARDWARE_HIERARCHY.md`
- `ops/HOMELAB.md`
- `ops/ai-governance/PORTS.md`
- `ops/ai-governance/SUBDOMAINS.md`
- `docs/REFERENCE/DEPLOYMENT-BOUNDARIES.md`

## Security & Environment Variables

**BEFORE ANY CODE CHANGE involving tokens, keys, secrets, or credentials:**

- `.env` is the canonical source for all environment variables — never hardcode secrets
- `.env.example` uses `${VAR_NAME}` pattern — code reads via `process.env.VAR_NAME`
- Secrets go in `/srv/ops/secrets/*.env` (600, gitignored)
- Terraform uses `TF_VAR_` prefix via `cloudflare-env-sync.sh`

**Key docs:**
- `docs/CLOUDFLARE_SETUP.md` — Cloudflare credentials architecture
- `.claude/rules/anti-hardcoded-secrets.md` — Anti-hardcode rules
- `.claude/rules/cloudflare-secrets-harden.md` — Cloudflare hardening
- `.claude/agents/cloudflare-security-rules.md` — Agent security rules

**NEVER:** print, echo, or log secret values. Never `cat /srv/ops/secrets/*.env`.

If chat context conflicts with repo docs, repo docs win until verified otherwise.

## Non-Negotiables

- Stateful and critical services stay private in core infra.
- Coolify publishes apps; it does not govern the homelab.
- Hermes, Ollama, and Nexus run bare metal.
- LiteLLM is the single model gateway.
- Qdrant, Postgres, Redis, Gitea, Coolify, and LiteLLM are private/internal unless an approved protected exposure is documented.
- Verify ports, subdomains, tunnel routes, and public endpoints before changing them.
- Preserve user worktree changes; do not revert unrelated edits.

## Nexus

Nexus is the local 7-mode x 7-agent orchestrator.

```bash
.claude/vibe-kit/nexus.sh --status
.claude/vibe-kit/nexus.sh --mode list
.claude/vibe-kit/nexus.sh --mode debug|test|backend|frontend|review|docs|deploy
.claude/vibe-kit/nexus.sh --spec SPEC-NNN --phase plan|review|execute|verify|complete
```

Modes: `debug`, `test`, `backend`, `frontend`, `review`, `docs`, `deploy`.

Workflow phases: `plan`, `review`, `execute`, `verify`, `complete`.

Always check current Nexus status before assuming whether a workflow is active.

## AI Context Sync

On every `/ship`, verify or run AI Context Sync before closing the session:

```bash
scripts/ai-context-sync/ai-context-sync.sh --status
scripts/ai-context-sync/ai-context-sync.sh --dry-run
```

Use full reindex only when intentionally required:

```bash
scripts/ai-context-sync/ai-context-sync.sh --full
```

Sync target: Qdrant collection `monorepo-context` plus Mem0 freshness metadata. Details live in `scripts/ai-context-sync/ship_with_sync.md`.

## Command Intent

- `/spec`: create or update a formal specification.
- `/plan`: plan implementation.
- `/test`: run focused or full test suite.
- `/review`: review code, prioritizing defects and risk.
- `/ship`: verify, sync AI context, and prepare deploy handoff.

## Verification

Use focused checks for small changes. Broaden tests when touching shared contracts, infra, auth, deployment, public endpoints, or production workflows.

Useful quick checks:

```bash
sed -n '1,220p' HARDWARE_HIERARCHY.md
sed -n '1,220p' ops/ai-governance/PORTS.md
sed -n '1,220p' ops/ai-governance/SUBDOMAINS.md
.claude/vibe-kit/nexus.sh --status
```
