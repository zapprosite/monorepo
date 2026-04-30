# AGENTS.md - Codex CLI Context

Classification: INTERNAL
Owner: Platform Engineering
Version: 2.3.0
Updated: 2026-04-28

---

## Anti-Hardcoded Secrets — OBRIGATÓRIO LER PRIMEIRO

**Regra:** `docs/OPERATIONS/SECRETS-PATTERNS.md`

**NUNCA exppor valores de variáveis de ambiente com segredos.**

Padrão seguro para verificar se existe:
```bash
test -n "${VARIAVEL:-}" && echo "definida"
```

**O que nunca fazer:**
```bash
echo $API_KEY
printenv | grep SECRET
grep "API_KEY" .env
git diff | grep sk-cp-
```

**Template de vars:** ler `.env.example` (tracked, não tem valores reais).
**Vars reais:** apenas em `/srv/monorepo/.env` (gitignored).

---

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

**Environment variables:** Read `.env.example` to know what variables exist. Real values only in `/srv/monorepo/.env` (gitignored).
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

Nexus is the local 7-mode x 7-agent orchestrator. It operates across three layers:

```
Layer 1 — nexus.sh       # Orchestrator entry point (7 modes x 7 agents = 49 combos)
Layer 2 — vibe-kit.sh     # Infinite loop runner (polls queue, spawns mclaude workers)
Layer 3 — state-manager.py # Cross-CLI atomic state (flock + atomic rename)
```

### Nexus PREVC Workflow

Nexus uses a gated workflow to enforce quality at every phase:

| Phase | Gate | What happens |
|-------|------|--------------|
| **P**lan | Plan approval required | SPEC draft → planner reviews → approved |
| **R**eview | Design review required | Architecture review → approved before coding |
| **E**xecute | Implementation | Developers build, vibe-kit runs parallel workers |
| **V**erify | Smoke tests + checks | Automated verification before merge |
| **C**omplete | Ship checklist | `/ship` sync + commit + PR |

### Core Commands

```bash
# Status and discovery
.claude/vibe-kit/nexus.sh --status
.claude/vibe-kit/nexus.sh --mode list

# Mode selection (7 modes)
nexus.sh --mode debug|test|backend|frontend|review|docs|deploy

# PREVC workflow per SPEC
nexus.sh --spec SPEC-NNN --phase plan|review|execute|verify|complete
```

### vibe-kit.sh

Infinite loop runner for brain-refactor queue. Spawns up to 15 parallel mclaude workers (or `VIBE_PARALLEL` override).

Key env vars:
- `VIBE_WATCH_MODE=true` — use inotifywait immediate wake-up instead of fixed polling
- `VIBE_POLL_INTERVAL=5` — fallback poll interval in seconds
- `VIBE_IDLE_COOLDOWN=180` — exit after N seconds of empty queue
- `VIBE_SNAPSHOT_EVERY=3` — ZFS snapshot every N tasks

### state-manager.py

Cross-CLI atomic state manager. All CLIs (Claude Code, Codex, OpenCode) write here.

```bash
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py get events <type>
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py event <type> key=value ...
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py agent-start <id> --tool Read --cwd /srv/monorepo
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py agent-complete <id> [result]
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py dump
```

Concurrency: `fcntl.flock` on dedicated `.events.lock` + `os.rename` atomic swap. Handles 30+ concurrent writers without data loss.

### Cross-CLI Event System

Daemon layer that bridges CLI activity to vibe-kit:

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code ──[PostToolUse hook]──> settings.json          │
│  Codex CLI   ──[PostToolUse hook]──> hooks.json             │
│  OpenCode    ──[wrapper boot event]──> state.json          │
└──────────────────┬──────────────────────────────────────────┘
                   │ inotifywait filesystem events
                   ▼
         inotify-watch.service (systemd)
         inotify-watch.sh ──writes──> state.json
                   │
                   │ poll (5s)
                   ▼
         trigger-bridge.service (systemd)
         trigger-bridge.sh ──reads──> QUEUE_CHANGE ──> vibe-kit
```

Event types recorded:
- `TOOL_CALL` — tool executed (Read, Write, Edit, Bash...)
- `CLAUDE_ACCESS` — CLAUDE.md or AGENTS.md accessed
- `QUEUE_CHANGE` — queue.json modified
- `OPENCODE_BOOT` — OpenCode CLI started
- `STRESS` — stress test events

Services (systemd user units):
```bash
systemctl --user status inotify-watch.service
systemctl --user status trigger-bridge.service
journalctl --user -u inotify-watch -f
journalctl --user -u trigger-bridge -f
```

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
