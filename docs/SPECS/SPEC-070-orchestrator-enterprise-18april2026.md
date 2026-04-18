# ORCHESTRATOR ENTERPRISE — SPEC COMPLETA
**Data:** 18/04/2026
**Versão:** 2.0 (refactor completo pós-antigravity)
**Objetivo:** Documentação técnica integral do sistema de 14 agentes + pipeline enterprise
**Aviso:** Claude Code CLI vai refazer esta spec — aqui estão TODOS os detalhes para reconstrução

---

## 1. VISION & OVERVIEW

Sistema de orchestrator que executa `SPEC → pipeline → 14 agentes → PR` de forma totalmente automatizada via filesystem (sem mensageria, tudo em arquivos JSON de estado).

**Stack:**
- pnpm workspaces + Turbo 2.9.6
- Claude Code CLI como agente principal
- Gitea Actions para CI/CD
- Biome para lint
- Antigravity Kit (`.agent/`) para skills
- `/execute` como skill-that-calls-skills (meta-skill)

---

## 2. O WORKFLOW `/execute` COMPLETO

### 2.1 Sequência de Execução

```
/execute "descrição da tarefa"
  │
  ├─► /spec "descrição"           # Cria SPEC.md em docs/SPECS/SPEC-NNN.md
  │                                 # Gera acceptance criteria, filedeltas
  │
  ├─► /pg (pipeline generate)     # Cria tasks/pipeline.json
  │                                 # Define 14 agentes, dependências,
  │                                 # BLOCKERS, gates
  │
  └─► 14 AGENTES em paralelo       # Executam concurrently
        │
        ├─► SPEC-ANALYZER          # Analisa SPEC, extrai AC + filedeltas
        ├─► ARCHITECT              # Revê arch, flags issues no Gitea
        ├─► CODER-1                # Backend (Fastify/tRPC)
        ├─► CODER-2                # Frontend (React/MUI)
        ├─► TESTER                 # Testes e2e/unit
        ├─► SMOKE                  # Smoke tests
        ├─► SECURITY               # Audit OWASP + secrets scan
        ├─► DOCS                   # Atualiza docs
        ├─► TYPES                  # pnpm tsc (inline)
        ├─► LINT                   # pnpm lint (inline)
        ├─► SECRETS                # scan hardcoded secrets
        ├─► GIT                    # git commit
        ├─► REVIEWER               # code review final
        └─► SHIPPER                # Bloqueado até os 13 terminarem
                                     # Cria PR no Gitea via API
```

### 2.2 Scripts Principais

**`orchestrator/scripts/run-agents.sh`** — Spawn dos 14 agentes
**`orchestrator/scripts/agent-wrapper.sh`** — Wrapper individual por agente
**`orchestrator/scripts/wait-for-completion.sh`** — Poll até todos completarem

---

## 3. OS 14 AGENTES — TABELA COMPLETA

| # | Agent         | Type   | Responsabilidade                            | Critical | Blocker PR |
|---|--------------|--------|---------------------------------------------|----------|------------|
| 1 | SPEC-ANALYZER | claude | Analisa SPEC.md, extrai AC e filedeltas     | NO       | NO         |
| 2 | ARCHITECT     | claude | Revê arquitetura e filedeltas, flags issues | NO       | NO         |
| 3 | CODER-1       | claude | Backend (Fastify/tRPC)                      | YES      | YES        |
| 4 | CODER-2       | claude | Frontend (React/MUI)                        | YES      | YES        |
| 5 | TESTER        | claude | Testes (Vitest/Jest)                        | NO       | WARN       |
| 6 | SMOKE         | claude | Gera smoke tests                            | NO       | WARN       |
| 7 | SECURITY      | claude | Audit OWASP Top 10 + secrets scan           | NO       | WARN       |
| 8 | DOCS          | claude | Atualiza documentação                        | NO       | WARN       |
| 9 | TYPES         | inline | `pnpm tsc --noEmit`                         | NO       | CI         |
|10 | LINT          | inline | `pnpm lint` (Biome)                        | NO       | CI         |
|11 | SECRETS       | claude | Scan hardcoded secrets                      | NO       | CI         |
|12 | GIT           | claude | Commits com Conventional Commits            | NO       | WARN       |
|13 | REVIEWER      | claude | Code review final                            | NO       | WARN       |
|14 | SHIPPER       | claude | Cria PR no Gitea (bloqueado pelos 13)       | YES      | YES        |

### 3.1 Agent State File (JSON)

Cada agente escreve seu estado em:
`tasks/agent-states/{AGENT}.json`

```json
{
  "agent": "CODER-1",
  "spec": "SPEC-042",
  "pipeline": "pipeline-20260418-001",
  "status": "running",
  "started": "2026-04-18T10:00:00.000Z",
  "finished": null,
  "exit_code": null,
  "log": ".claude/skills/orchestrator/logs/CODER-1.log",
  "error": null,
  "files_changed": []
}
```

**Status possíveis:** `pending` → `running` → `completed` | `failed`

**Campos finais quando completo:**
```json
{
  "status": "completed",
  "finished": "2026-04-18T10:15:00.000Z",
  "exit_code": 0,
  "files_changed": ["src/api/users.ts", "src/api/posts.ts"]
}
```

### 3.2 Error Handling Matriz

| Agente          | On Failure         | Ação do SHIPPER                    |
| --------------- | ------------------ | ---------------------------------- |
| CODER-1,2       | CRITICAL = YES     | BLOCK PR completamente             |
| TESTER,SMOKE    | Critical = NO      | WARN + proceed                     |
| SECURITY        | Critical = NO      | WARN + proceed                     |
| TYPES, LINT     | Critical = NO      | CI catches (não bloqueia agentes) |
| SECRETS         | Critical = NO      | CI catches                         |
| GIT             | Critical = NO      | WARN + proceed                     |
| REVIEWER        | Critical = NO      | WARN + proceed                     |
| SHIPPER         | —                  | N/A (é o final)                    |

### 3.3 SHIPPER Pattern (detalhado)

1. **Poll** `tasks/agent-states/*.json` a cada 5s
2. **Aguarda** todos os 13 agentes (exceto ele mesmo)
3. **Verifica** critical agents (CODER-1, CODER-2):
   - Se qualquer um falhou → cria issue no Gitea (não PR) + notifica
   - Se todos OK → cria PR
4. **Verifica** non-critical agents:
   - Se falhou → WARNING no output do PR
   - Se todos OK → PR limpo
5. **Cria PR** via Gitea API (`/api/v1/repos/{owner}/{repo}/pulls`)
6. **Escreve** `tasks/delivery/{PR_NUMBER}.json` com metadados

---

## 4. COORDENAÇÃO VIA FILESYSTEM

### 4.1 Estrutura de Diretórios

```
srv/monorepo/
├── tasks/
│   ├── agent-states/           # JSON state files por agente
│   │   ├── SPEC-ANALYZER.json
│   │   ├── ARCHITECT.json
│   │   ├── CODER-1.json
│   │   ├── CODER-2.json
│   │   ├── TESTER.json
│   │   ├── SMOKE.json
│   │   ├── SECURITY.json
│   │   ├── DOCS.json
│   │   ├── TYPES.json
│   │   ├── LINT.json
│   │   ├── SECRETS.json
│   │   ├── GIT.json
│   │   ├── REVIEWER.json
│   │   └── SHIPPER.json
│   ├── pipeline.json           # Pipeline gerado por /pg
│   ├── delivery/               # PR metadata após SHIPPER
│   │   └── {PR_NUMBER}.json
│   └── logs/                   # Log files (referenciados nos JSON)
├── docs/SPECS/                 # SPECs geradas por /spec
│   └── SPEC-NNN.md
└── .claude/skills/orchestrator/logs/
    ├── SPEC-ANALYZER.log
    ├── ARCHITECT.log
    ├── ...
    └── SHIPPER.log
```

### 4.2 Pipeline JSON Schema

`tasks/pipeline.json` é gerado pelo `/pg`:

```json
{
  "pipeline_id": "pipeline-20260418-001",
  "spec": "SPEC-042",
  "created": "2026-04-18T10:00:00.000Z",
  "agents": [
    {
      "name": "CODER-1",
      "type": "claude",
      "prompt": "Implementar endpoints REST para Users...",
      "depends_on": ["SPEC-ANALYZER"],
      "critical": true,
      "blocker": true,
      "files": ["src/api/users.ts", "src/api/posts.ts"],
      "skills": ["fastify-best-practices"]
    },
    {
      "name": "CODER-2",
      "type": "claude",
      "prompt": "Criar UI de Users com React...",
      "depends_on": ["SPEC-ANALYZER"],
      "critical": true,
      "blocker": true,
      "files": ["src/ui/users/*"]
    },
    {
      "name": "SHIPPER",
      "type": "claude",
      "prompt": "Criar PR...",
      "depends_on": ["CODER-1", "CODER-2", "TESTER", "SECURITY", "DOCS", "GIT", "REVIEWER", "TYPES", "LINT", "SECRETS"],
      "critical": true,
      "blocker": true,
      "wait_for": ["CODER-1", "CODER-2", "TESTER", "SMOKE", "SECURITY", "DOCS", "GIT", "REVIEWER", "TYPES", "LINT", "SECRETS"]
    }
  ]
}
```

---

## 5. META-SKILLS / SKILL-THAT-CALLS-SKILLS

### 5.1 `/execute` como Meta-Skill

```yaml
---
name: execute
type: meta-skill
trigger: /execute
skills_called:
  - /spec
  - /pg
  - run-agents
deprecated: false
version: "2.0"
created: 2026-04-18
---
```

### 5.2 `/ship` como Meta-Skill

```yaml
---
name: ship
type: meta-skill
trigger: /ship
skills_called:
  - sync-docs
  - git-commit
  - git-push
  - create-pr
deprecated: false
---
```

---

## 6. NETWORK & PORT GOVERNANCE

### 6.1 Stack de Rede Completo

```
INTERNET
  └─► Cloudflare (proxy)
        └─► cloudflared (tunnel)
              └─► TRAEFIK (80/443/8080) [Coolify Proxy]
                    └─► UFW (host firewall)
                          └─► SERVICES
```

**IMPORTANTE:** NUNCA fazer port forwarding direto bypassando Traefik.

### 6.2 UFW — Regras Consolidadas

- `default INPUT DROP`
- Portas autorizadas: 22, 80, 443, 8080 (Cloudflare), 8000 (Coolify via Cloudflare)
- SSH: apenas por key, password desabilitado
- NUNCA abrir 2222 (Gitea SSH) sem aprovação explícita

### 6.3 Traefik (Coolify Proxy)

- Todas as requisições públicas passam por Traefik
- Ingress via Cloudflare Zero Trust Tunnel
- Respeitar priority de rotas

### 6.4 Portas Reservadas (NUNCA usar para dev)

| Porta  | Serviço                          | Status     |
|--------|----------------------------------|------------|
| :3000  | Open WebUI proxy                 | RESERVED   |
| :4000  | LiteLLM production               | RESERVED   |
| :4001  | Hermes Agent Bot                 | RESERVED   |
| :4002  | ai-gateway OpenAI compat         | RESERVED   |
| :4003  | Ollama                           | RESERVED   |
| :5173  | Vite dev server                  | DEV ONLY   |
| :8000  | Coolify PaaS                     | RESERVED   |
| :8080  | Open WebUI (Coolify managed)     | RESERVED   |
| :8642  | Hermes Gateway                   | RESERVED   |
| :6333  | Qdrant vector DB                 | RESERVED   |

### 6.5 Faixa Livre para Dev

- `:4002–:4099` — microservices dev (livre para uso)
- `:5173` — Vite frontend dev (livre)

### 6.6 Adicionar Nova Porta — Checklist

1. `ss -tlnp | grep :PORTA` — confirmar que está livre
2. Adicionar entrada em `docs/INFRASTRUCTURE/PORTS.md`
3. Se pública:
   - Adicionar em `docs/INFRASTRUCTURE/SUBDOMAINS.md`
   - `cd /srv/ops/terraform/cloudflare && terraform apply`
   - Verificar cloudflared logs após restart
4. Se firewall: `sudo ufw allow PORT/tcp`

### 6.7 Adicionar Subdomínio — Checklist

1. Verificar se porta já está em `PORTS.md`
2. Adicionar entrada em `SUBDOMAINS.md`
3. `cd /srv/ops/terraform/cloudflare && terraform apply`
4. Verificar cloudflared logs após restart

### 6.8 Proibições (NUNCA FAZER)

- ❌ Bypassing Traefik com port forwarding direto
- ❌ Abrir portas sem verificar `PORTS.md`
- ❌ Adicionar subdomínio sem Terraform + cloudflared
- ❌ Desativar UFW ou `ufw disable`
- ❌ Usar portas reservadas para dev
- ❌ Commitar sem atualizar `PORTS.md` + `SUBDOMAINS.md`

---

## 7. REGRA ANTI-HARDCODED (CRÍTICA)

**Data:** 2026-04-15 (atualizada)
**Última violação:** SPEC-048 (rejeitada por token hardcoded)

### Regra Fundamental

```ts
// ✅ CORRETO — sempre via process.env
const STT_URL = process.env.STT_DIRECT_URL ?? 'http://localhost:8202';
const GW_KEY = process.env.AI_GATEWAY_FACADE_KEY ?? '';
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.3';

// ❌ PROIBIDO — rejeição imediata
const STT_URL = 'http://localhost:8202';
const API_KEY = 'sk-abc123...';
```

### Fonte Canónica

- **Secrets/Keys:** `.env` (NÃO `.env.local`, NÃO Infisical SDK)
- **Infisical foi PRUNED em 2026-04-13** — não usar
- **Não commitiar `.env`** — adicionar a `.gitignore`

### Documentos de Referência

- `.claude/rules/anti-hardcoded-env.md`
- `.claude/rules/anti-hardcoded-secrets.md`

---

## 8. GOVERNANCE — DOCUMENTOS OBRIGATÓRIOS

**ANTES de qualquer ação neste repositório, TODO LLM DEVE ler:**

| Documento | Prioridade | Porquê |
|-----------|------------|--------|
| `docs/GOVERNANCE/SECRETS-MANDATE.md` | CRÍTICO | Zero tolerance hardcoded, ban automático |
| `docs/GOVERNANCE/GUARDRAILS.md` | CRÍTICO | Operações proibidas, voice pipeline imutável |
| `docs/GOVERNANCE/APPROVAL_MATRIX.md` | CRÍTICO | "Posso fazer isto?" — tabela de aprovações |
| `docs/GOVERNANCE/CHANGE_POLICY.md` | ALTA | Snapshot + checklist preflight |
| `docs/GOVERNANCE/IMMUTABLE-SERVICES.md` | CRÍTICO | Serviços que nunca se tocam |
| `docs/GOVERNANCE/PINNED-SERVICES.md` | CRÍTICO | Versões bloqueadas |
| `docs/INFRASTRUCTURE/PORTS.md` | CRÍTICA | Portas reservadas e livres |
| `docs/INFRASTRUCTURE/SUBDOMAINS.md` | CRÍTICA | Subdomínios e DNS |

### Serviços Imutáveis (NUNCA modificar)

- `coolify-proxy` (Traefik)
- `prometheus`
- `cloudflared`
- `ufw` (firewall)

### Serviços Pinned (não atualizar sem aprovação)

- Node.js versão
- pnpm versão (9.0.x)
- Turbo versão (2.9.6)

---

## 9. VERSION LOCK

| Dependência | Versão | Bloqueada em |
|-------------|--------|--------------|
| Turbo | 2.9.6 | `packageManager` em `package.json` |
| pnpm | 9.0.x | `packageManager` |
| Node.js | LTS | `.nvmrc` |
| Biome | latest | `package.json` deps |

---

## 10. BRANCH CONVENTIONS

- Formato: `feature/xxx-yyy`, `fix/xxx-yyy`, `docs/xxx-yyy`
- Criar branch a partir de `main`
- PR deve ter referência à SPEC (ex: `feat: implement user API (SPEC-042)`)

---

## 11. CONVENTIONAL COMMITS

```
feat: nova funcionalidade
fix: correção de bug
docs: documentação
style: formatação (sem mudança de lógica)
refactor: refatoração
perf: melhoria de performance
test: testes
chore: manutenção
security: segurança
```

---

## 12. ARQUITETURA DE AGENTS (Hermes CLI)

### 12.1 Ficheiros Principais

```
hermes-agent/
├── run_agent.py              # AIAgent class — conversation loop
├── model_tools.py            # Tool orchestration + _discover_tools()
├── toolsets.py               # Toolset definitions
├── cli.py                    # HermesCLI class
├── hermes_state.py           # SessionDB (SQLite, FTS5)
├── agent/
│   ├── prompt_builder.py     # System prompt assembly
│   ├── context_compressor.py # Auto context compression
│   ├── prompt_caching.py     # Anthropic prompt caching
│   ├── auxiliary_client.py   # Auxiliary LLM (vision, summarization)
│   ├── model_metadata.py     # Context lengths, token estimation
│   ├── models_dev.py         # models.dev registry
│   ├── display.py            # KawaiiSpinner, tool preview
│   ├── skill_commands.py     # Skill slash commands
│   └── trajectory.py         # Trajectory saving
├── hermes_cli/
│   ├── main.py               # Entry point — todos subcomandos
│   ├── config.py             # DEFAULT_CONFIG + OPTIONAL_ENV_VARS
│   ├── commands.py           # Slash command registry
│   ├── callbacks.py          # Terminal callbacks
│   ├── setup.py              # Setup wizard interativo
│   ├── skin_engine.py        # Skin/theme engine (data-driven)
│   ├── skills_config.py      # Skills por plataforma
│   ├── tools_config.py       # Tools por plataforma
│   ├── skills_hub.py         # /skills hub
│   ├── models.py             # Model catalog
│   ├── model_switch.py       # /model switch
│   └── auth.py               # Provider credentials
├── tools/
│   ├── registry.py           # Central registry (no deps)
│   ├── terminal_tool.py      # Terminal orchestration
│   ├── process_registry.py   # Background processes
│   ├── file_tools.py         # File read/write/search
│   ├── web_tools.py          # Web search + extract
│   ├── browser_tool.py       # Browser automation
│   ├── code_execution_tool.py # Code sandbox
│   ├── delegate_tool.py      # Subagent delegation
│   ├── mcp_tool.py           # MCP client (~1050 lines)
│   └── environments/         # Terminal backends
├── gateway/
│   ├── run.py                 # Main loop + slash commands
│   ├── session.py            # SessionStore
│   └── platforms/            # Adapters (telegram, discord, slack...)
└── cron/
    ├── jobs.py
    └── scheduler.py
```

### 12.2 Adicionar Nova Tool

**3 ficheiros a modificar:**

1. **Criar `tools/nova_tool.py`:**
```python
import json, os
from tools.registry import registry

def check_requirements() -> bool:
    return bool(os.getenv("NOVA_API_KEY"))

def nova_tool(param: str, task_id: str = None) -> str:
    return json.dumps({"success": True, "data": "..."})

registry.register(
    name="nova_tool",
    toolset="example",
    schema={
        "name": "nova_tool",
        "description": "...",
        "parameters": {...}
    },
    handler=lambda args, **kw: nova_tool(
        param=args.get("param", ""),
        task_id=kw.get("task_id")
    ),
    check_fn=check_requirements,
    requires_env=["NOVA_API_KEY"],
)
```

2. **Adicionar import** em `model_tools.py` → `_discover_tools()`

3. **Adicionar a `toolsets.py`** → `_HERMES_CORE_TOOLS` ou nova toolset

### 12.3 Adicionar Slash Command

**3+1 ficheiros:**

1. `hermes_cli/commands.py` → adicionar `CommandDef`:
```python
CommandDef("mycommand", "Descrição", "Session",
           aliases=("mc",), args_hint="[arg]")
```

2. `cli.py` → `process_command()`:
```python
elif canonical == "mycommand":
    self._handle_mycommand(cmd_original)
```

3. `gateway/run.py` → se disponível no gateway:
```python
if canonical == "mycommand":
    return await self._handle_mycommand(event)
```

4. Para config persistente: `save_config_value()`

### 12.4 Profile System

- Base: `Path.home() / ".hermes"`
- Ativo: `HERMES_HOME` env var (setado por `-p profile`)
- Perfis: `~/.hermes/profiles/{profile}/`
- **Usar `get_hermes_home()`** — NUNCA hardcoded `~/.hermes`

---

## 13. SKIN/THEME ENGINE

**Data-driven — sem código para adicionar novo skin.**

```
hermes_cli/skin_engine.py    # SkinConfig + built-in skins
~/.hermes/skins/*.yaml        # User skins (drop-in)
```

**Built-in skins:** `default` (gold/kawaii), `ares` (crimson), `mono`, `slate`

**Keys personalizáveis:**
- `colors.banner_border`, `colors.banner_title`, etc.
- `spinner.thinking_faces`, `spinner.thinking_verbs`, `spinner.wings`
- `tool_prefix`, `tool_emojis`
- `branding.agent_name`, `branding.welcome`, `branding.response_label`, `branding.prompt_symbol`

---

## 14. PADRÃO ENTERPRISE RECOMENDADO — 18/04/2026

### 14.1 Stack Enterprise

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Monorepo | pnpm workspaces + Turbo | 2.9.6 |
| Runtime | Node.js LTS | latest |
| Backend | Fastify + tRPC | latest |
| Frontend | React + MUI | latest |
| Database | PostgreSQL + Drizzle ORM | latest |
| Auth | JWT + refresh tokens | — |
| Lint | Biome | latest |
| Tests | Vitest + Playwright | latest |
| CI/CD | Gitea Actions | latest |
| Infra | Coolify + Traefik + UFW | — |
| Secrets | `.env` (única fonte) | — |
| Monitoring | Prometheus + Grafana | — |
| Agents | Claude Code CLI (14 agentes) | — |

### 14.2 Workflow Enterprise Completo

```
1. /spec "descrição"              # Product Manager + AI
   → docs/SPECS/SPEC-NNN.md
   → Acceptance criteria
   → Filedeltas

2. /pg                             # Pipeline Generator
   → tasks/pipeline.json
   → 14 agentes configurados
   → Dependências + gates

3. run-agents.sh                  # Spawn 14 agentes
   → parallel execution
   → filesystem coordination
   → agent-state tracking

4. CI Pipeline (Gitea Actions)
   → pnpm tsc --noEmit
   → pnpm lint
   → pnpm test
   → Security audit
   → Secrets scan

5. SHIPPER                        # Criar PR
   → Verifica agent-states
   → Se blocker failed → Issue (não PR)
   → Se OK → PR com description completo
   → Tags: `SPEC-NNN`, `approved`
```

### 14.3 PR Description Template

```markdown
## Spec
- **SPEC:** [SPEC-NNN](link)
- **Pipeline:** [pipeline-YYYYMMDD-NNN](link)

## Summary
Breve descrição do que foi implementado.

## Changes
Lista de ficheiros alterados.

## Testing
- [ ] Unit tests passaram
- [ ] Smoke tests passaram
- [ ] Lint passou
- [ ] Types validaram

## Acceptance Criteria
- [ ] Critério 1
- [ ] Critério 2

## Notes
Avisos, limitações, dependências.

## Agent Report
| Agent | Status | Files |
|-------|--------|-------|
| CODER-1 | ✅ | files... |
| CODER-2 | ✅ | files... |
| TESTER | ⚠️ WARN | ... |
```

### 14.4 Anti-Patterns Proibidos

| Anti-Pattern | Correto |
|-------------|---------|
| Hardcoded URLs | `process.env.URL` |
| Hardcoded API Keys | `.env` |
| Inline secrets | Env var ou `.env` |
| Bypass Traefik | Sempre via Traefik |
| Portas reservadas | Usar faixa `:4002-4099` |
| `ufw disable` | UFW sempre ativo |
| Sem snapshot antes de mudar | Sempre snapshot antes |
| Sem atualizar PORTS.md | Atualizar sempre |

---

## 15. RESUMO — COMANDOS ESSENCIAIS

| Comando | Descrição |
|---------|-----------|
| `/spec <desc>` | Gerar SPEC.md |
| `/pg` | Gerar pipeline.json |
| `/execute <desc>` | Workflow completo SPEC→PR |
| `/ship` | sync + commit + push + PR |
| `/turbo` | commit + push + merge + tag + new branch |
| `/se` | Secrets audit |
| `/rr` | Code review |
| `/skin <nome>` | Trocar tema CLI |

---

## 16. CAMINHOS DOS ARQUIVOS (ABSOLUTOS)

```
/srv/monorepo/docs/SPECS/SPEC-070-orchestrator-enterprise-18april2026.md  # ESTE ARQUIVO
/srv/monorepo/tasks/agent-states/*.json
/srv/monorepo/tasks/pipeline.json
/srv/monorepo/tasks/delivery/*.json
/srv/monorepo/.claude/skills/orchestrator/logs/*.log
/srv/monorepo/docs/INFRASTRUCTURE/PORTS.md
/srv/monorepo/docs/INFRASTRUCTURE/SUBDOMAINS.md
/srv/monorepo/docs/GOVERNANCE/SECRETS-MANDATE.md
/srv/monorepo/docs/GOVERNANCE/GUARDRAILS.md
/srv/monorepo/docs/GOVERNANCE/APPROVAL_MATRIX.md
/srv/monorepo/docs/GOVERNANCE/CHANGE_POLICY.md
/srv/monorepo/docs/GOVERNANCE/IMMUTABLE-SERVICES.md
/srv/monorepo/docs/GOVERNANCE/PINNED-SERVICES.md
```

---

**FIM DA SPEC — Claude Code CLI pode agora reconstruir a spec formal.**
