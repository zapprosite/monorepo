# CLAUDE.md — Monorepo Agent Instructions

> **⚠️ READ FIRST:** See `HARDWARE_HIERARCHY.md` for complete infrastructure map
>
> **Project:** Homelab Monorepo | **Status:** Production
> **Model:** hermes-brain | **Context:** 100K tokens
> **Updated:** 2026-04-26

---

## 🏠 Homelab Structure — Mínimo Viável (2 Gateways)

This monorepo is the **SINGLE SOURCE OF TRUTH**:

```
/srv/monorepo/                    ← YOU ARE HERE
│
├── apps/
│   ├── ai-gateway/             # Voice Gateway :4002 (TTS + STT)
│   ├── api/                    # Fastify + tRPC backend
│   └── perplexity-agent/       # Browser automation (via LiteLLM)
│
├── config/
│   └── litellm/
│       └── config.yaml         # hermes-* aliases (Ollama + OpenRouter)
│
├── docs/                        # Enterprise Documentation
│   ├── INFRASTRUCTURE/         # Architecture, ports, services
│   └── SPECS/                  # Feature specs
│
└── scripts/                     # SRE + Health checks
```

**2 Gateways Only:**
- **LiteLLM :4018/v1** — text, code, instruction, embedding (hermes-*)
- **Voice Gateway :4002** — TTS (Edge-tts :8012) + STT (Groq cloud)

---

## 🎯 Project Overview — Mínimo Viável

This monorepo powers **zappro.site** — self-hosted AI platform.

**Stack (poda agressiva):**
- **LiteLLM :4018/v1** — Gateway canônico LLM (text, code, instruction, embedding)
- **Voice Gateway :4002** — TTS (Edge) + STT (Groq cloud)
- **Qdrant :6333** — Vector DB
- **Gitea :3300** — Git + CI/CD
- **Coolify :8000** — PaaS deploys

---

## 🔗 Quick Reference

| Command | Purpose |
|---------|---------|
| `cat HARDWARE_HIERARCHY.md` | **START HERE** — Full infrastructure map |
| `cat ops/HOMELAB.md` | Source of truth for homelab |
| `cat ops/ai-governance/PORTS.md` | Port governance |
| `cat ops/ai-governance/CONTRACT.md` | Security rules |
| `nexus.sh --status` | Nexus framework status |
| `nexus.sh --mode debug` | List debug agents |

---

## ⚡ Quick Commands

```bash
# Development
pnpm dev              # All apps
pnpm build            # Production build
pnpm tsc --noEmit     # Type check

# Nexus Health
nexus-investigate.sh all 3
nexus-legacy-detector.sh full /srv/monorepo

# Linting
pnpm lint
biome check .
```

---

## 🔐 Security Rules

**⚠️ Authoritative security rules:** `/srv/ops/ai-governance/CONTRACT.md` and `GUARDRAILS.md`

### ✅ Safe (No Approval Needed)
- Read-only operations (logs, status, inspection)
- Backups and snapshots
- Documentation updates
- Application development in `/srv/monorepo`

### ⚠️ Requires Approval
- Service restart/stop/start
- Package installation/upgrade
- ZFS operations
- Firewall changes
- Network modifications

### ❌ Forbidden
- Disk wipe operations
- Delete `/srv/data`, `/srv/backups`
- ZFS pool destruction
- Exposing ports without updating PORTS.md + SUBDOMAINS.md

### Environment Variables & Secrets

**ANTI-HARDCODING:** All code reads from environment variables. Never hardcode secrets.

| Pattern | Example |
|---|---|
| Code reads | `process.env.OPEN_AI_KEY` |
| Template | `.env.example` with `${VAR_NAME}` |
| Secrets | `/srv/ops/secrets/*.env` (600) |
| Terraform | `TF_VAR_*` via `cloudflare-env-sync.sh` |

**Documentation:**
- `docs/CLOUDFLARE_SETUP.md` — Cloudflare credentials architecture
- `.claude/rules/anti-hardcoded-secrets.md` — Anti-hardcode rules
- `.claude/rules/cloudflare-secrets-harden.md` — Cloudflare hardening
- `.claude/agents/cloudflare-security-rules.md` — Agent security rules

**NEVER:** `echo $TOKEN`, `cat /srv/ops/secrets/*.env`, `grep TOKEN .env`

**If secrets leaked:** see `docs/SECRETS-CLEANUP.md`

---

## 📊 Status Indicators

- ✅ Healthy/Complete
- ⚠️ Warning/Needs attention
- ❌ Error/Failed
- 🔄 In progress

**Last updated:** 2026-04-26
**Owner:** Platform Engineering
