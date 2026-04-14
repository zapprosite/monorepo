# AGENTS.md — Monorepo Command Center

> **Data:** 2026-04-13
> **Authority:** Claude Code CLI + Gitea Actions + Antigravity Kit (.agent/)
> **Stack:** pnpm workspaces + Turbo pipeline + Biome lint + Playwright E2E

---

## ⚠️ OBRIGATÓRIO PARA TODOS OS LLMs — LEIA PRIMEIRO

Antes de qualquer ação neste repositório, TODO LLM **DEVE** ler:

| Documento | Porquê | Prioridade |
|-----------|--------|------------|
| **[docs/GOVERNANCE/SECRETS-MANDATE.md](../../docs/GOVERNANCE/SECRETS-MANDATE.md)** | **Zero tolerance** — Infisical SDK mandatory. Tokens hardcoded = rejeição imediata. Alucinação de tokens = banido. | 🔴 CRÍTICO |
| **[docs/GOVERNANCE/GUARDRAILS.md](../../docs/GOVERNANCE/GUARDRAILS.md)** | Operações proibidas,anti-fragilidade, audio stack imutável | 🔴 CRÍTICO |
| **[docs/GOVERNANCE/APPROVAL_MATRIX.md](../../docs/GOVERNANCE/APPROVAL_MATRIX.md)** | "Posso fazer isto?" — tabela de aprovações por operação | 🔴 CRÍTICO |
| **[docs/GOVERNANCE/CHANGE_POLICY.md](../../docs/GOVERNANCE/CHANGE_POLICY.md)** | Snapshot antes de mudanças + checklist preflight | 🟡 ALTA |
| **[docs/GOVERNANCE/IMMUTABLE-SERVICES.md](../../docs/GOVERNANCE/IMMUTABLE-SERVICES.md)** | Serviços que nunca se tocam (coolify-proxy, prometheus, cloudflared...) | 🔴 CRÍTICO |
| **[docs/GOVERNANCE/PINNED-SERVICES.md](../../docs/GOVERNANCE/PINNED-SERVICES.md)** | Stack de voz: Kokoro/wav2vec2/OpenClaw — só estes, só assim | 🔴 CRÍTICO |
| **[docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md](../../docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md)** | Port registry, auto-heal whitelist — portas reservadas | 🟡 ALTA |
| **[docs/GOVERNANCE/INCIDENTS.md](../../docs/GOVERNANCE/INCIDENTS.md)** | Severity levels, incident response checklist | 🔴 CRÍTICO |
| **[docs/GOVERNANCE/RECOVERY.md](../../docs/GOVERNANCE/RECOVERY.md)** | ZFS rollback/DB restore step-by-step | 🔴 CRÍTICO |
| **[docs/GOVERNANCE/ANTI-FRAGILITY.md](../../docs/GOVERNANCE/ANTI-FRAGILITY.md)** | O que NÃO fazer — antipatterns, serviços pinned | 🔴 CRÍTICO |
| **[docs/GOVERNANCE/CONTRACT.md](../../docs/GOVERNANCE/CONTRACT.md)** | Princípios inegociáveis (dados sacrossantos, snapshot mandatory) | 🟡 ALTA |
| **[docs/SPECS/SPEC-009-openclaw-persona-audio-stack.md](../../docs/SPECS/SPEC-009-openclaw-persona-audio-stack.md)** | Audio stack imutável — STT/TTS/LLM canonical | 🔴 CRÍTICO |
| **[docs/SPECS/SPEC-HOMELAB-GOVERNANCE-DEFINITIVO.md](../../docs/SPECS/SPEC-HOMELAB-GOVERNANCE-DEFINITIVO.md)** | Datacenter enterprise governance framework | 🔴 CRÍTICO |
| **[docs/GOVERNANCE/master-password-procedure.md](../../docs/GOVERNANCE/MASTER-PASSWORD-PROCEDURE.md)** | Credential handling procedure | 🟡 ALTA |
| **[docs/GOVERNANCE/DATABASE_GOVERNANCE.md](../../docs/GOVERNANCE/DATABASE_GOVERNANCE.md)** | Protected schemas, destructive-operation rules | 🟡 ALTA |
| **[docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md](../../docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md)** | Anti-patterns AP-1 a AP-4 (Docker TCP, host-as-backend, DNS) | 🔴 CRÍTICO |
| **[docs/GUIDES/INFISICAL-SDK-PATTERN.md](../../docs/GUIDES/INFISICAL-SDK-PATTERN.md)** | Como usar Infisical SDK (Python/JS/Bash) | 🟡 ALTA |
| **[docs/GUIDES/CODE-REVIEW-GUIDE.md](../../docs/GUIDES/CODE-REVIEW-GUIDE.md)** | 5-axis review framework | 🟡 ALTA |
| **[docs/GOVERNANCE/SECRETS_POLICY.md](../../docs/GOVERNANCE/SECRETS_POLICY.md)** | Secrets policy complementar | 🟡 ALTA |
| **[.claude/CLAUDE.md](../../.claude/CLAUDE.md)** | Regras Claude Code, git mirror, version lock | 🟡 ALTA |
| **[.claude/rules/openclaw-audio-governance.md](../../.claude/rules/openclaw-audio-governance.md)** | Audio stack imutável — ZERO TOLERANCE | 🔴 CRÍTICO |
| **[.claude/rules/anti-hardcoded-secrets.md](../../.claude/rules/anti-hardcoded-secrets.md)** | Anti-hardcoded secrets pattern | 🔴 CRÍTICO |

### TL;DR (para LLMs com pressa)

```
SEcrets → .env como fonte canónica — Infisical SDK só em scripts de infra
Immutable/Pinned Services → NUNCA tocar
Audio Stack (SPEC-009) → só Kokoro:TTS Bridge:wav2vec2:MiniMax-M2.7
Anti-patterns (AP-1/2/3) → Docker TCP bridge, host-as-backend, localhost testing
Não sabe? → PERGUNTE ANTES DE FAZER
Hardcoded Values → USAR VARIÁVEIS DE AMBIENTE — nunca hardcodar URLs, IPs, portas, tokens

ANTES DE QUALQUER AÇÃO: verificar .env → .claude/skills/ → AGENTS.md → .claude/CLAUDE.md
```

**Sem ler estes documentos, não faça NADA.**

---

## ⚠️ IMPORTANT FOR ALL LLMs — READ FIRST

Before any work in this repository, EVERY LLM **MUST** read:

| Document | Why | Priority |
|---------|-----|----------|
| **[docs/GOVERNANCE/SECRETS-MANDATE.md](../../docs/GOVERNANCE/SECRETS-MANDATE.md)** | **Zero tolerance** — Infisical SDK only. Hardcoded tokens = instant rejection. Token hallucination = banned. | 🔴 CRITICAL |
| **[docs/GOVERNANCE/GUARDRAILS.md](../../docs/GOVERNANCE/GUARDRAILS.md)** | Forbidden ops, anti-fragility, immutable audio stack | 🔴 CRITICAL |
| **[docs/GOVERNANCE/APPROVAL_MATRIX.md](../../docs/GOVERNANCE/APPROVAL_MATRIX.md)** | "Can I do this?" — approval table by operation type | 🔴 CRITICAL |
| **[docs/GOVERNANCE/IMMUTABLE-SERVICES.md](../../docs/GOVERNANCE/IMMUTABLE-SERVICES.md)** | Services that are never touched (coolify-proxy, prometheus, cloudflared...) | 🔴 CRITICAL |
| **[docs/GOVERNANCE/PINNED-SERVICES.md](../../docs/GOVERNANCE/PINNED-SERVICES.md)** | Voice stack: Kokoro/wav2vec2/OpenClaw — only these, only this way | 🔴 CRITICAL |
| **[docs/GOVERNANCE/INCIDENTS.md](../../docs/GOVERNANCE/INCIDENTS.md)** | Severity levels, incident response checklist | 🔴 CRITICAL |
| **[docs/GOVERNANCE/RECOVERY.md](../../docs/GOVERNANCE/RECOVERY.md)** | ZFS rollback/DB restore step-by-step | 🔴 CRITICAL |
| **[docs/GOVERNANCE/ANTI-FRAGILITY.md](../../docs/GOVERNANCE/ANTI-FRAGILITY.md)** | What NOT to do — antipatterns, pinned services | 🔴 CRITICAL |
| **[docs/SPECS/SPEC-009-openclaw-persona-audio-stack.md](../../docs/SPECS/SPEC-009-openclaw-persona-audio-stack.md)** | Immutable audio stack — STT/TTS/LLM canonical | 🔴 CRITICAL |
| **[.claude/rules/openclaw-audio-governance.md](../../.claude/rules/openclaw-audio-governance.md)** | ZERO TOLERANCE — Kokoro voices (pm_santa/pf_dora ONLY), STT/TTS rules | 🔴 CRITICAL |
| **[docs/SPECS/SPEC-HOMELAB-GOVERNANCE-DEFINITIVO.md](../../docs/SPECS/SPEC-HOMELAB-GOVERNANCE-DEFINITIVO.md)** | Datacenter enterprise governance framework | 🔴 CRITICAL |
| **[docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md](../../docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md)** | Anti-patterns AP-1 to AP-4 (Docker TCP, host-as-backend, DNS) | 🔴 CRITICAL |
| **[docs/GOVERNANCE/CHANGE_POLICY.md](../../docs/GOVERNANCE/CHANGE_POLICY.md)** | Snapshot before changes + preflight checklist | 🟡 HIGH |
| **[docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md](../../docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md)** | Port registry, auto-heal whitelist, reserved ports | 🟡 HIGH |
| **[docs/GOVERNANCE/MASTER-PASSWORD-PROCEDURE.md](../../docs/GOVERNANCE/MASTER-PASSWORD-PROCEDURE.md)** | Credential handling procedure | 🟡 HIGH |
| **[docs/GOVERNANCE/DATABASE_GOVERNANCE.md](../../docs/GOVERNANCE/DATABASE_GOVERNANCE.md)** | Protected schemas, destructive-operation rules | 🟡 HIGH |
| **[docs/REFERENCE/ARCHITECTURE-MASTER.md](../../docs/REFERENCE/ARCHITECTURE-MASTER.md)** | Full monorepo structure, CI/CD, directory layout | 🟡 HIGH |
| **[docs/GUIDES/INFISICAL-SDK-PATTERN.md](../../docs/GUIDES/INFISICAL-SDK-PATTERN.md)** | How to use Infisical SDK (Python/JS/Bash) | 🟡 HIGH |
| **[docs/GUIDES/CODE-REVIEW-GUIDE.md](../../docs/GUIDES/CODE-REVIEW-GUIDE.md)** | 5-axis review framework | 🟡 HIGH |
| **[docs/REFERENCE/TOOLCHAIN.md](../../docs/REFERENCE/TOOLCHAIN.md)** | pnpm, turbo, biome, git, docker, zfs commands | 🟡 HIGH |
| **[.claude/CLAUDE.md](../../.claude/CLAUDE.md)** | Claude Code rules, git mirror, version lock | 🟡 HIGH |

### TL;DR (for LLMs in a hurry)

```
Secrets → Infisical SDK ONLY — no hallucination
Immutable/Pinned Services → NEVER touch
Audio Stack (SPEC-009) → only Kokoro:TTS Bridge:wav2vec2:MiniMax-M2.7
Anti-patterns (AP-1/2/3) → Docker TCP bridge, host-as-backend, localhost testing
Don't know? → ASK BEFORE DOING
Hardcoded Values → USE ENVIRONMENT VARIABLES — never hardcode URLs, IPs, ports, tokens
```

**Without reading these documents, do NOTHING.**

---

## Arquitectura Unified (09/04/2026)

```
┌─────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE CLI                          │
│  (Orchestrator principal — tokens infinitos, 20 agents)     │
├─────────────────────────────────────────────────────────────┤
│  .claude/commands/    .claude/skills/    .claude/workflows/│
│  → 33 slash commands  → 33 skills         → 7 workflows     │
├─────────────────────────────────────────────────────────────┤
│                    TURBO PIPELINE                           │
│  turbo.json defines build/lint/test pipeline                │
│  pnpm workspaces (apps/, packages/)                         │
├─────────────────────────────────────────────────────────────┤
│  .gitea/workflows/        .agent/                          │
│  → 4 Gitea Actions       → 18 specialist agents             │
│  → ci-feature            → 20 workflows (Antigravity Kit)  │
│  → code-review                                           │
│  → deploy-main                                          │
│  → rollback                                              │
├─────────────────────────────────────────────────────────────┤
│  scripts/          smoke-tests/        docs/SPECS/         │
│  → health-check    → E2E (Playwright) → 15+ SPECs        │
│  → deploy          → smoke-chat        → tasks.md          │
│  → backup           → smoke-openclaw    → reviews/          │
│  → restore          → +more                                   │
│  → mirror-push                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Tool Stack (Raiz)

| Ficheiro | Tool | Uso |
|----------|------|-----|
| `turbo.json` | Turbo | Pipeline de build/test/lint |
| `biome.json` | Biome | Lint + Format (substitui ESLint+Prettier) |
| `yarn.lock` | Yarn Berry | Package manager c/ workspaces | ⚠️ DEPRECATED — use pnpm. Todos os comandos de build usam pnpm (ver Build Commands) |
| `pnpm-workspace.yaml` | pnpm | Workspace definition |
| `package.json` | Node.js | Scripts e dependências |
| `docker-compose.yml` | Docker | Containers de desenvolvimento |

---

## Apps & Packages

| App/Package | Tipo | Stack | Notas |
|-------------|------|-------|-------|
| `apps/list-web` | Web | Static HTML+JS | Google OAuth, tools list |
| `apps/api` | API | Fastify + OrchidORM + tRPC | PostgreSQL |
| `apps/web` | Web | React 19 + MUI + tRPC | — |
| `apps/orchestrator` | Agent | Node.js + tRPC + YAML | Human gates |
| `apps/perplexity-agent` | Agent | Python + Streamlit + LangChain | Browser automation |
| `apps/todo-web` | Web | Static HTML+JS + Google OAuth 2.0 + PKCE | nginx:alpine, container: todo-web |
| `packages/ui-mui` | UI Lib | React + Material UI | → frontend |
| `packages/zod-schemas` | Schemas | TypeScript + Zod | → backend, frontend, orchestrator |
| `packages/typescript-config` | Config | TypeScript | Dev tooling |

---

## 🌐 Creating New Subdomains + OAuth

### Quick Decision: Which Method?

| Situation | Method | Time |
|-----------|--------|------|
| MVP / quick test / prototyping | Direct OAuth (no CF Access) | ~10 min |
| Production / team / security critical | CF Access Zero Trust | ~20 min |
| Internal tool / single developer | Direct OAuth | ~10 min |
| Multi-user / company dashboard | CF Access | ~20 min |

### Method 1: Direct OAuth (MVP Fast Path)

For quick prototyping — Google OAuth handled in the app JS, no Cloudflare Access.

#### Step 0: FIRST — Print OAuth URI for user (BEFORE writing any code)

```bash
echo "Add to Google Cloud Console → OAuth Client → Authorized Redirect URIs:"
echo "https://SUBDOMAIN.zappro.site/auth/callback"
echo ""
echo "Add to Authorized JavaScript Origins:"
echo "https://SUBDOMAIN.zappro.site"
```

#### Steps:
1. Print OAuth URIs → wait for user to configure Google Console
2. Create subdomain via Cloudflare API (fast, ~30s):
   ```bash
   /srv/ops/scripts/create-subdomain.sh SUBDOMAIN http://localhost:PORT
   ```
3. Generate app files (HTML + nginx + Dockerfile)
4. Deploy: `docker compose up -d`
5. Smoke test: `curl -sk https://SUBDOMAIN.zappro.site`
6. Update SUBDOMAINS.md + PORTS.md

#### Skills:
- `/new-subdomain` — create subdomain via Cloudflare API
- `/oauth-google-direct` — OAuth in app JS
- `/prd-to-deploy` — full orchestrator (one-shot)

### Method 2: CF Access Zero Trust (V2 Production)

Google OAuth handled by Cloudflare Edge — app receives pre-authenticated requests.

#### Step 0: FIRST — Print TWO URIs for user

```bash
echo "STEP 1 — Google Cloud Console:"
echo "  Redirect URI: https://TEAM_DOMAIN/cdn-cgi/access/callback"
echo ""
echo "STEP 2 — Cloudflare Zero Trust Dashboard:"
echo "  one.dash.cloudflare.com → Settings → Authentication → Add Google IdP"
```

#### Steps:
1. Print both URIs → wait for user to configure both
2. Create subdomain via Terraform (add to variables.tf → terraform apply)
3. Add CF Access application + policy to access.tf → terraform apply
4. Deploy app (no OAuth code needed!)
5. Test: request should require Google login

#### Skills:
- `/cloudflare-terraform` — Terraform-based subdomain + CF Access
- `/oauth-google-cloudflare` — CF Access setup guide

### Scripts Available

| Script | Purpose |
|--------|---------|
| `/srv/ops/scripts/create-subdomain.sh` | Create subdomain via Cloudflare API (fast) |
| `/srv/ops/scripts/setup-oauth.sh` | Print OAuth URIs + generate config |

### One-Shot Flow: PRD → Deploy

```
Human: /prd-to-deploy "I want X app"
  → Step 0: Print OAuth URIs immediately
  → Generate SPEC
  → Create subdomain
  → ⏸️ Wait for user OAuth config
  → Generate files
  → Deploy + smoke test
  → Update docs
  → ✅ Done
```

See: `/prd-to-deploy` skill + SPEC-035-one-shot-prd-to-deploy.md

---

## Slash Commands (`.claude/commands/`)

| Comando | Ficheiro |链 | Uso |
|---------|----------|-------|-----|
| `/pg` | `pg.md` | SPEC → pipeline.json | Gerar tasks de SPECs |
| `/plan` | `plan.md` | SPEC → tasks | Planear implementação |
| `/rr` | `rr.md` | Commits → REVIEW | Code review report |
| `/se` | `se.md` | Scan secrets | Secrets audit |
| `/sec` | `sec.md` | Security scan | Auditoria OWASP |
| `/feature` | `feature.md` | git-feature workflow | Nova branch feature |
| `/ship` | `ship.md` | Pre-launch checklist | Deploy checklist |
| `/turbo` | `turbo.md` | Commit+merge+tag+branch | Git turbo workflow |
| `/code-review` | `code-review.md` | Commits → 5-axis review | Full review |
| `/scaffold` | `scaffold.md` | Template → novo modulo | Scaffold projeto |
| `/img` | `vision-local.md` | Ollama Qwen2.5-VL | Análise de imagem |
| `/codegen` | `codegen.md` | Zod schema → tRPC router | MiniMax code generation |
| `/msec` | `msec.md` | Security audit pre-commit | MiniMax semantic security |
| `/dm` | `dm.md` | API ref, PORTS, SUBDOMAINS | MiniMax doc maintenance |
| `/bug-triage` | `bug-triage.md` | Docker crash, tunnel DOWN | MiniMax bug triage |
| `/bcaffold` | `bcaffold.md` | Zod schema → Fastify+tRPC | MiniMax backend scaffold |
| `/migrate` | `migrate.md` | OrchidORM migration | MiniMax DB migration |
| `/trpc` | `trpc.md` | Add tRPC router | MiniMax router composition |
| `/infra-gen` | `infra-gen.md` | Docker/TF/Prometheus/Gitea | MiniMax infra generation |
| `/mxr` | `mxr.md` | PR review long-context | MiniMax holistic review |
| `/md` | `md.md` | Modo dormir: escaneia SPECs pendentes e gera pipeline | pasta: monorepo |

---

## Skills (`.claude/skills/`)

**33 skills locais + 10 MiniMax-enhanced skills (SPEC-034)**:

| Skill | Propósito | Trigger |
|-------|-----------|---------|
| `bug-investigation` | Debug sistemático | `/bug` |
| `test-generation` | Gerar testes | `/test` |
| `code-review` | Review 5-axis | `/review` |
| `refactoring` | Cleanup code smells | `/refactor` |
| `documentation` | Gerar docs | `/docs` |
| `security-audit` | OWASP top 10 | `/sec` |
| `pipeline-gen` | SPEC → pipeline.json | `/pg` |
| `smoke-test-gen` | SPEC → smoke tests | `/st` |
| `secrets-audit` | Scan hardcoded secrets | `/se` |
| `human-gates` | Identificar blockers | `/hg` |
| `spec-driven-development` | Spec → plan → implement | `/spec` |
| `context-prune` | Limpar contexto | — |
| `deploy-validate` | Pre-deploy check | — |
| `mcp-health` | Health MCP servers | — |
| `repo-scan` | Scan tasks pendentes | `/rs` |
| `self-healing` | Auto-heal loop | — |
| `snapshot-safe` | ZFS safe operations | — |
| `cost-reducer` | Optimizar custos | — |
| `browser-dev` | Browser automation | — |
| `researcher` | Web research (MiniMax M2.1) | — |
| `minimax-research` | Deep code/error analysis (MiniMax M2.1) | `/minimax-research` |
| `minimax-code-gen` | tRPC router from Zod schema | `/codegen` |
| `minimax-security-audit` | OWASP + Infisical SDK enforcement | `/msec` |
| `doc-maintenance` | Docs sync: API ref, PORTS, SUBDOMAINS | `/dm` |
| `minimax-debugger` | Docker crash + tunnel + 529 triage | `/bug-triage` |
| `backend-scaffold` | Fastify + tRPC from Zod schema | `/bcaffold` |
| `db-migration` | OrchidORM migration + rollback | `/migrate` |
| `trpc-compose` | Add new tRPC router | `/trpc` |
| `infra-from-spec` | Infrastructure from natural language | `/infra-gen` |
| `review-minimax` | Holistic PR review (1M context) | `/mxr` |

---

## Scripts (`scripts/`)

| Script | Função | CI/CD |
|--------|--------|-------|
| `health-check.sh` | Docker, ZFS, disk, git | Pre-deploy |
| `deploy.sh` | Validation + ZFS snapshot + push | Deploy main |
| `backup.sh` | Git bundle + 7-backup rotation | Cron |
| `restore.sh <name>` | Restore from named backup | DR |
| `mirror-push.sh` | Push Gitea + GitHub | Feature branches |
| `sync-env.js` | .env → workspaces | Pre-build |

---

## Smoke Tests (`smoke-tests/`)

| Teste | Service | Método |
|-------|---------|--------|
| `smoke-chat-zappro-site.sh` | chat.zappro.site | curl + redirect |
| `smoke-chat-zappro-site-e2e.sh` | chat.zappro.site | Playwright E2E OAuth |
| `playwright-chat-e2e.mjs` | chat.zappro.site | Playwright full chain |
| `pipeline-openclaw-voice.sh` | OpenClaw voice | curl health |

---

## Gitea Actions (`.gitea/workflows/`)

| Workflow | Trigger | Chain |
|---------|---------|-------|
| `ci-feature.yml` | Push branch | lint → build → test |
| `code-review.yml` | PR | 5 gates: lint + test + security + AI review + human |
| `deploy-main.yml` | Merge main | build → human gate → Coolify deploy |
| `rollback.yml` | Manual dispatch | Coolify rollback + audit |
| `deploy-perplexity-agent.yml` | Push | Coolify API deploy |

---

## Antigravity Kit (`.agent/`)

18 agents especializados + 20 workflows, 10 skills:

### Agentes
`architect-specialist`, `backend-specialist`, `bug-fixer`, `code-reviewer`, `database-specialist`, `debugger`, `devops-specialist`, `documentation-writer`, `feature-developer`, `frontend-specialist`, `mobile-specialist`, `module-architect`, `orchestrator`, `performance-optimizer`, `refactoring-specialist`, `security-auditor`, `executive-ceo`, `context-optimizer`

### Workflows
`api-design`, `bug-investigation`, `code-review`, `commit-message`, `debug`, `documentation`, `feature-breakdown`, `git-feature`, `git-mirror-gitea-github`, `git-ship`, `git-turbo`, `pr-review`, `refactoring`, `security-audit`, `sincronizar-tudo`, `test-generation`, `ui-ux-pro-max`, +more

### Integration
`.claude/` → `.agent/` (automatic search via `search.md` rules)
`.agent/rules/` → Included in context

---

## MiniMax LLM Integration (SPEC-034)

**Modelo:** MiniMax M2.7 (1M token context window)
**API:** `https://api.minimax.io/anthropic/v1`
**Skills:** 10 novos skills para code gen, security, docs, debugging, backend scaffold, infra generation, e code review

Ver `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` para pesquisa completa de 14 domains.

**Quick wins com MiniMax:**
- `/codegen contract` — gera tRPC router completo de Zod schema (~30min → 5min)
- `/msec` — security audit semantic (OWASP + Infisical SDK pattern)
- `/dm ports` — detecta drift entre ss -tlnp e PORTS.md automaticamente
- `/bug-triage` — diagnostica Docker crash loops e tunnel DOWN com contexto de 1M tokens
- `/mxr` — holistic PR review (30+ files analisados juntos)

---

## Spec-Driven Development (`docs/specflow/`)

```
SPEC-TEMPLATE.md → SPEC-*.md → tasks.md → pipeline.json
                                        → smoke-tests/
                                        → REVIEW-*.md
```

| SPEC | Tópico |
|------|--------|
| SPEC-007 | OpenClaw OAuth profiles |
| SPEC-009 | OpenClaw persona audio stack |
| SPEC-013 | Unified Claude Agent Monorepo |
| SPEC-014 | Cursor AI CI/CD Pattern |
| SPEC-015 | Gitea Actions Enterprise |
| SPEC-034 | MiniMax LLM use cases (10 new skills) |
| SPEC-035 | MiniMax Research replacement — Tavily → M2.1 |

---

## CI/CD Loop (Cursor AI Pattern — 09/04/2026)

```
PUSH → Gitea Actions (ci-feature)
       ↓
    lint + build + test
       ↓
    PR → code-review workflow
          ↓
       5 gates: lint | test | security | AI review | human
          ↓
       Merge → deploy-main workflow
                ↓
             Human gate (approve)
                ↓
             Coolify deploy
                ↓
             Smoke tests E2E
                ↓
             PASS → done
             FAIL → rollback workflow
```

**AI Self-Fix Loop (a implementar):**
```
AI review finds issue → AI fixes → re-commit → re-review
```

---

## Turbo Pipeline (`turbo.json`)

```json
{
  "pipeline": {
    "build":    { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test":     { "dependsOn": ["build"],  "outputs": ["coverage/**"] },
    "lint":     { "outputs": [] },
    "typecheck": { "outputs": [] }
  }
}
```

**Comandos:**
```bash
turbo run build          # Build all packages
turbo run build --filter=backend   # Build specific
turbo run test          # Test all
turbo run lint          # Biome lint
```

---

## Biome (`biome.json`)

```bash
biome ci .              # Check (CI mode)
biome format --write .  # Format
biome lint --write .    # Fix linting
```

---

## Build Commands

```bash
# Install
pnpm install

# Build (turbo)
pnpm build              # turbo run build
pnpm build --filter=apps/backend

# Test
pnpm test              # turbo run test
pnpm test --filter=apps/frontend -- --coverage

# Lint (biome)
pnpm lint              # biome ci .

# Dev
pnpm dev               # turbo run dev
pnpm dev --filter=apps/frontend

# Type check
pnpm typecheck         # turbo run typecheck
```

---

## Secrets (Infisical)

**Project ID:** `e42657ef-98b2-4b9c-9a04-46c093bd6d37`
**Service Token:** `/srv/ops/secrets/infisical.service-token`

```bash
# Fetch secret
python3 - << 'EOF'
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(
    token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    host='http://127.0.0.1:8200'
)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == 'MY_SECRET':
        print(s.secret_value)
EOF
```

---

## Gitea + GitHub Remotes

| Remote | URL | Uso |
|--------|-----|-----|
| `origin` | `git@github.com:zapprosite/monorepo.git` | GitHub mirror |
| `gitea` | `ssh://git@127.0.0.1:2222/will-zappro/monorepo.git` | Gitea primary |

```bash
# Push to both
git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD
```

---

## Cron Jobs (Auto-Orchestration)

| Job | Cron | Função |
|-----|------|--------|
| `614f0574` | `*/30 * * * *` | Sync docs → memory |
| `modo-dormir-daily` | `0 3 * * *` | SPEC → pipeline |
| `code-review-daily` | `0 4 * * *` | Code review commits |
| `test-coverage-daily` | `0 5 * * *` | Test coverage |
| `secrets-audit-daily` | `0 6 * * *` | Secrets scan |
| `mcp-health-daily` | `0 8 * * *` | MCP server health |
| `d201999d` | `*/5 * * * *` | Auto-healer (Coolify) |
| `95c72b71` | `3 */15 * * *` | Resource monitor |
| `minimax-doc-sync-daily` | `0 7 * * *` | MiniMax: PORTS.md + SUBDOMAINS.md vs live → SERVICE_STATE.md |
| `minimax-bug-triage-daily` | `0 9 * * *` | MiniMax: health-check.log → proactive anomaly report |

---

## Ops Infrastructure Tools (Tunnel, Health, Auto-Heal)

**Critical scripts** for tunnel management, health monitoring, and homelab operations.
These are NOT in the monorepo — they're in `/srv/ops/` and `/srv/monorepo/tasks/`.

### Tunnel Health (SPEC-032)

| Script | Purpose | Cron |
|--------|---------|------|
| `/srv/ops/scripts/smoke-tunnel.sh` | Curl all 13 subdomains, report DOWN | `*/30 * * * *` |
| `/srv/ops/scripts/tunnel-autoheal.sh` | Restart cloudflared if DOWN >5min, ZFS snapshot | on-demand |
| `/srv/ops/scripts/validate-ingress.sh` | Verify ingress rules → reachable IPs (nc check) | on-demand |
| `/srv/ops/scripts/gotify-alert.sh` | Alert helper → POST `localhost:8050/gotify` | — |
| `/srv/ops/scripts/pre-commit-subdomain-check.sh` | Validate new subdomain entries in variables.tf | pre-commit hook |

**Usage:**
```bash
# Smoke test all subdomains
bash /srv/ops/scripts/smoke-tunnel.sh

# Validate tunnel ingress rules
bash /srv/ops/scripts/validate-ingress.sh

# Auto-heal (rate-limited, ZFS snapshot first)
bash /srv/ops/scripts/tunnel-autoheal.sh

# Alert test
bash /srv/ops/scripts/gotify-alert.sh "Tunnel Test" "Smoke test passed 13/13"
```

### Backup & Recovery

| Script | Purpose |
|--------|---------|
| `/srv/ops/scripts/backup-zfs-snapshot.sh` | ZFS snapshot of tank pool |
| `/srv/ops/scripts/restore-zfs-snapshot.sh` | Restore from named ZFS snapshot |
| `/srv/ops/scripts/backup-qdrant.sh` | Qdrant vector DB backup |
| `/srv/ops/scripts/backup-postgres.sh` | Postgres backup (n8n, gitea dbs) |
| `/srv/ops/scripts/zfs-snapshot-prune.sh` | Prune ZFS snapshots >7 days |

### Homelab Monitoring

| Script | Purpose |
|--------|---------|
| `/srv/ops/scripts/homelab-health-check.sh` | Full health: Docker, ZFS, disk, services |
| `/srv/ops/scripts/homelab-gemma-monitor.sh` | GPU + memory monitoring |
| `/srv/ops/scripts/ollama-healthcheck.sh` | Ollama LLM status |
| `/srv/monorepo/tasks/smoke-tests/pipeline-openclaw-voice.sh` | Voice pipeline smoke test |

### Ops Infrastructure

| Script | Purpose |
|--------|---------|
| `/srv/ops/scripts/mirror-sync.sh` | Push to Gitea + GitHub remotes |
| `/srv/ops/scripts/audit-branches.sh` | Audit stale branches |
| `/srv/ops/scripts/cleanup-branches.sh` | Remove stale branches (needs approval) |
| `/srv/ops/terraform/cloudflare/variables.tf` | Cloudflare Tunnel ingress rules |

### Skills (`.claude/skills/`)

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `list-web-from-zero-to-deploy` | `/new-list-web` | Create list-web app zero→deploy |
| `repo-scan` | `/rs` | Scan tasks in SPEC/TODO/TASKMASTER formats |
| `security-audit` | `/sec` | OWASP top 10 vulnerability scan |

---

## Quick Reference

```bash
# Health check
bash scripts/health-check.sh

# Deploy com snapshot
bash scripts/deploy.sh --snapshot

# Mirror push
bash scripts/mirror-push.sh

# Smoke test
bash smoke-tests/smoke-chat-zappro-site.sh

# E2E test
node smoke-tests/playwright-chat-e2e.mjs chat.zappro.site

# Turb build
yarn build

# Biome lint
yarn lint

# Sync env
node scripts/sync-env.js

# AI-CONTEXT sync (OBRIGATÓRIO após cada feature)
bash /home/will/.claude/mcps/ai-context-sync/sync.sh
```

---

## AI-CONTEXT Sync (SPEC-027)

**⚠️ OBRIGATÓRIO após cada feature/PR merge**

Após fazer commit + push de qualquer feature, **SEMPRE** executar:
```bash
bash /home/will/.claude/mcps/ai-context-sync/sync.sh
```

**Porquê:** Mantém o memory dos agentes atualizado. Sem sync, o próximo agente não tem contexto das mudanças.

**O que sincroniza:**
- `docs/GOVERNANCE/` → `memory/` (regras imutáveis)
- `docs/SPECS/` → `memory/` (specs atualizadas)
- `docs/SKILLS/` → `memory/skills/`
- `.context/docs/` → `memory/` (contexto auto-gerado)

**Docs rígidos que exigem sync após mudança:**
- `VERSION-LOCK.md` — versões pinned (inclui voice pipeline desktop)
- `AGENTS.md` — regras de agentes
- `docs/GOVERNANCE/*` — governance do homelab
- `docs/SPECS/SPEC-*.md` — especificações
- `docs/OPERATIONS/SKILLS/*.md` — skills de operação
- `docs/OPERATIONS/SKILLS/voice-pipeline-desktop.md` — Ctrl+Shift+C shortcut

**Verificação:**
```bash
cat /home/will/.claude/mcps/ai-context-sync/manifest.json | jq '.last_sync'
```

---

## Git Workflow (SPEC-026)

### Mirror Sync

Before any merge:
```bash
bash /srv/ops/scripts/mirror-sync.sh
```

### Audit

Weekly branch audit:
```bash
bash /srv/ops/scripts/audit-branches.sh
```

### Tag Policy

See `docs/GOVERNANCE/TAG-POLICY.md`

| Format | Use |
|--------|-----|
| vMAJOR.MINOR.PATCH | Releases |
| phase/N-name | Process milestones |
| feat/NAME | Feature flags |

### Never

- ❌ Push directly to main
- ❌ Date-based tags (v20260412...)
- ❌ Non-feature branch names (feat/* only)

## MiniMax Quick Reference (SPEC-034)

```bash
# Code generation — tRPC router from Zod schema
/codegen contract

# Semantic security audit pre-commit (OWASP + Infisical SDK)
/msec

# Documentation maintenance — API ref, PORTS, SUBDOMAINS
/dm api-ref      # Update TRPC-API.md from routers
/dm ports        # ss -tlnp vs PORTS.md drift
/dm subdomains   # curl health vs SUBDOMAINS.md

# Bug triage — Docker crash, tunnel DOWN, 529 errors
/bug-triage

# Backend scaffold — Fastify + tRPC from Zod
/bcaffold contract packages/zod-schemas/src/contract.zod.ts

# DB migration — OrchidORM migration + rollback
/migrate contract

# Add tRPC router to monorepo
/trpc myRouter

# Infrastructure generation — Docker, Terraform, Prometheus, Gitea
/infra-gen terraform subdomain chat http://10.0.5.2:8080
/infra-gen prometheus alerts loki
/infra-gen gitea workflow deploy-prd push

# Holistic PR review (1M token context)
/mxr 42
/mxr --commit abc123
```

**Crons MiniMax:**
```bash
# 07h — PORTS.md + SUBDOMAINS.md vs live system → SERVICE_STATE.md
0 7 * * * /srv/monorepo/.claude/skills/doc-maintenance/sync.sh

# 08h — Proactive anomaly report from health-check.log
0 8 * * * /srv/monorepo/.claude/skills/minimax-debugger/triage.sh
```

---

## Research Agent (SPEC-035 — COMPLETED)

** Tavily API replaced with MiniMax M2.1 for research (2026-04-13)**

The `/minimax-research` skill uses MiniMax LLM instead of Tavily web search:

| Aspect | Tavily (DEPRECATED) | MiniMax M2.1 (ACTIVE) |
|--------|---------------------|------------------------|
| Method | Web search API | LLM inference |
| Context | URLs + snippets | Full error/code analysis |
| Key | `TAVILY_API_KEY` | `MINIMAX_API_KEY` |
| Source | Orphaned vault secret | Infisical SDK |
| Use case | General web research | Deep code/error analysis |

### Skill

Trigger: `/minimax-research <query>`

For error analysis, architecture research, or code investigation. See `.claude/skills/minimax-research/SKILL.md`.

### Script

`scripts/cursor-loop-research-minimax.sh` — Research agent using MiniMax LLM:

```bash
# Usage
bash scripts/cursor-loop-research-minimax.sh "<topic or error message>"
```

- **Auth:** `MINIMAX_API_KEY` fetched via Infisical SDK (fallback to env var)
- **Endpoint:** `https://api.minimax.io/anthropic/v1/messages` (same pattern as voice pipeline)
- **Model:** MiniMax-M2.1 (200k+ context, fast inference)

### Cron Jobs

| Job | Schedule | Function |
|-----|----------|----------|
| `minimax-doc-sync-daily` | `0 7 * * *` | MiniMax: PORTS.md + SUBDOMAINS.md vs live → SERVICE_STATE.md |
| `minimax-bug-triage-daily` | `0 9 * * *` | MiniMax: health-check.log → proactive anomaly report |

### Migration (SPEC-035)

| Step | Status |
|------|--------|
| cursor-loop-research.sh updated | ✅ COMPLETED |
| MINIMAX_API_KEY via Infisical SDK | ✅ COMPLETED |
| TAVILY_API_KEY removed from vault | ✅ COMPLETED |
| minimax-research skill created | ✅ COMPLETED |

See `docs/SPECS/SPEC-035-minimax-research-replacement.md` for full details.

---

## Encoding and Localization Guidance

**Regra:** Docs e UI em PT-BR. Código (variáveis, funções, classes, commits) em EN.

### Antes de qualquer alteração de texto user-facing

1. Verificar que o arquivo alvo usa UTF-8
2. Confirmar que acentos portugueses renderizam corretamente
3. Se o arquivo já exibe mojibake ou acentos quebrados — corrigir o encoding ANTES de introduzir novo texto

### Escopo de verificação obrigatória

Aplicar este check antes de editar:
- Labels, títulos, descrições, tooltips
- Tabs e linhas de tabela
- Mensagens de validação
- Empty states
- Conteúdo exportado user-facing
- Documentação gerada automaticamente

### Verificação final para mudanças em PT-BR

Após qualquer alteração de texto em português, confirmar que os seguintes termos
(e similares) estão renderizando corretamente:

- Projeção
- Receita Líquida
- Lucro Bruto
- Configuração, Ação, Descrição, Número

Estender essa verificação a exports e docs gerados quando a mudança
introduz ou atualiza texto em português.

### Padrão do repositório

| Camada | Idioma |
|--------|--------|
| Código-fonte (vars, funções, classes, types) | 🇺🇸 English |
| Commits e branch names | 🇺🇸 English |
| Comentários técnicos inline | 🇺🇸 English |
| Docs (CLAUDE.md, AGENTS.md, ADRs, runbooks) | 🇧🇷 PT-BR |
| UI / texto user-facing | 🇧🇷 PT-BR (UTF-8) |
| Mensagens de erro user-facing | 🇧🇷 PT-BR (UTF-8) |
| Logs internos de sistema | 🇺🇸 English |

---

## 🔄 End-of-Session Sync Pattern (OBRIGATÓRIO)

**Aplica-se a:** TODO e QUALQUER trabalho feito no monorepo — SEMPRE no final de cada sessão.

### Comandos Canónicos

| Comando | Uso | Docs sync | Tag | PR |
|---------|-----|-----------|-----|-----|
| `/ship` | Fim de sessão completo | ✅ | ❌ | ❌ |
| `/turbo` | Feature pronta (quick ship) | ❌ | ✅ | ❌ |

### Workflow `/ship`

```
SYNC DOCS → COMMIT → PUSH BOTH → MERGE MAIN → NEW BRANCH
```

### Workflow `/turbo`

```
COMMIT → PUSH BOTH → MERGE MAIN → TAG → NEW BRANCH
```

### Branch Naming (pre-push hook)

- **Formato:** `feature/xxx-yyy` (primeiro segmento = letras, não números)
- **Exemplos:** `feature/quantum-helix-done` ✅ | `feature/1776082911-done` ❌
- **Excepções:** `main` e `master` têm bypass automático

### Porquê

- **Docs → Memory:** ai-context-sync mantém docs e memory alinhados
- **Both remotes:** Gitea (internal) + GitHub (public) = mirror
- **Merge main:** Evita divergência entre os dois remotes
- **Random branch:** Cada sessão = feature branch isolada, nunca main diretamente

### Scripts

| Script | Uso |
|--------|-----|
| `~/.claude/mcps/ai-context-sync/sync.sh` | Sincroniza docs → memory |
| `/srv/ops/scripts/mirror-sync.sh` | Sincroniza git mirrors |
| `/srv/ops/scripts/cleanup-sessions.sh` | Limpa sessões Claude Code velhas |
| `/ship` skill | End-of-session sync pattern completo |
| `/turbo` command | Quick feature ship com tag |

### NÃO FAÇA

- ❌ Commitar diretamente em `main`
- ❌ Push para apenas um remote (origin OU gitea)
- ❌ Pular o sync de docs → memory (usa `/ship`)
- ❌ Criar branch com nome fixo (sempre random suffix)
- ❌ Branch names com primeiro segmento só números (e.g. `feature/12345-x`)

### Pre-Push Hook Fix (13/04/2026)

O hook `.git/hooks/pre-push` agora permite `main`/`master` sem bloquear. Mantém o formato `feature/xxx-yyy` para todas as outras branches.

### Autoridade

QUANDO TERMINAR O WORK — este pattern é **SEMPRE** executado. Não é opcional.
