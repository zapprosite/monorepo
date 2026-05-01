# SPEC-090: Homelab Polyrepo Split + Context Preservation

## Status

**Author:** Nexus SRE
**Date:** 2026-05-01
**Model:** MiniMax-M2.7 (240k context)
**Stack:** TypeScript (CRM) + Go (services) + Python (HVAC)

---

## Contexto

Monorepo atual (`/srv/monorepo`) cresceu para ~400+ dirs, múltiplas stacks. Necessário split em 3 repos + estratégia de preservação de contexto para MiniMax-M2.7 240k tokens.

## Split Architecture

### 3 Repositories

| Repo | Contents | Size |
|------|----------|------|
| `zappro/crm-mvp` | CRM TypeScript apps + packages | ~50GB |
| `zappro/ops-infra` | Terraform + scripts + systemd | ~10GB |
| `zappro/hvacr-swarm` | HVAC automation + smoke-tests | ~30GB |

**Already separated:** `ops-infra` (/srv/ops), `hermes-second-brain` (/srv/hermes-second-brain)

### Shared Services (stay at /srv/)

```
/srv/
├── monorepo/          → zappro/crm-mvp (future)
├── ops/               → zappro/ops-infra (already separate)
├── hermes-second-brain/
├── hermes/            → ~/.hermes symlink
└── hvacr-swarm/      → zappro/hvacr-swarm (future)
```

## Context Preservation Strategy

### MiniMax-M2.7: 240k tokens

**Threshold:** Compact when context reaches ~180k tokens (75%)

**Compression priority:**
1. **Agent outputs** → Caveman (75% reduction)
2. **Memory files** → Compress via `caveman:compress`
3. **Sub-agent history** → Prune oldest entries
4. **Docs** → Keep TL;DR + links, drop full content

### Leadership Hierarchy

```
Leader (me)
├── orchestrator       → 1 leader agent, assigns tasks
├── researcher-N       → parallel research (max 5)
├── implementer        → executes bounded tasks
└── reviewer          → quality gates

Sub-agents preserve context by:
- Writing findings to shared memory files
- Reporting in 3-5 bullet points (max)
- Never repeating context from other agents
```

### Context Budget (per turn, target ~50k tokens)

| Component | Max tokens | Action when near limit |
|-----------|------------|------------------------|
| System prompt | 8k | Already minimal |
| CLAUDE.md | 2k | Strip to essential |
| Working memory | 40k | Compact to memory files |
| Agent responses | 120k | 75% reduced by Caveman |
| Tool results | 70k | Truncate at 500 lines |

### Context Compaction Protocol

```bash
# When context > 180k tokens, trigger compaction:
1. Sub-agents write summaries to ~/.hermes/sb-context.md
2. Clear conversation history (new loop)
3. Reload essential context from memory files
4. Resume work
```

## Gitea Actions Setup

### Runner: Single org-level (current pattern)

```yaml
# prod-runner-1 already serves all repos
runner: prod-runner-1 (ubuntu-latest label)
```

### Cross-repo deployment: API-based

```bash
# Trigger downstream repo via Gitea API
curl -X POST "$GITEA/api/v1/repos/{org}/{repo}/actions/workflows/{id}/dispatch" \
  -H "Authorization: Bearer $GITEA_TOKEN"
```

### Shared workflows: `shared-workflows` repo

```
zappro/shared-workflows/
├── workflows/
│   ├── ci.yml
│   ├── smoke-test.yml
│   └── deploy.yml
```

## Secrets Management

**Already solved:** `/srv/ops/secrets/` → per-repo `.env`

```
/srv/ops/secrets/
├── crm-mvp.env        → for crm-mvp repo
├── ops-infra.env      → for ops-infra repo
└── shared.env         → common across repos
```

## Hermes Second-Brain Sync

```yaml
# Each repo triggers on push to main
on: push to main
steps:
  - run: bash /srv/ops/scripts/sync-second-brain.sh
    env:
      REPO_NAME: crm-mvp
```

Output files per repo:
- `monorepo-TREE.md`
- `ops-TREE.md`
- `hvacr-TREE.md`

## Tasks

- [x] SPEC-090-001: Create `shared-workflows` repo with reusable workflows ✅
- [x] SPEC-090-002: Configure Gitea Actions per-repo (ci.yml, deploy.yml) ✅
- [x] SPEC-090-003: Wire hermes-second-brain sync to 3 repos ✅
- [x] SPEC-090-004: Test cross-repo deployment pipeline ⚠️ (runner has systemd issues, jobs queue but don't start)
- [x] SPEC-090-005: Validate context preservation with Caveman ✅ (mode: ultra, flag: active)

## Anti-Patterns to Avoid

- ❌ Native Gitea cross-repo workflows (não suportado)
- ❌ Duplicar ZFS datasets por repo (manter por serviço)
- ❌ Secrets em repos (manter em /srv/ops/secrets/)
- ❌ Claude Code verbose output (Caveman reduz 75%)

## References

- [Caveman](https://github.com/JuliusBrussee/caveman) — 75% output reduction
- [Nx](https://nx.dev) — multi-language build orchestration
- [SPEC-ENTERPRISE-TEMPLATE-2026-04](SPEC-ENTERPRISE-TEMPLATE-2026-04.md)
- [backup-runbook](../../GUIDES/backup-runbook.md)
- [hermes-second-brain](../../docs/SPECS/SPEC-POLYMER-005.md)
