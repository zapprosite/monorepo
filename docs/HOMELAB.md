# HOMELAB.md — Canonical Infrastructure Reference

> **Verificado:** 2026-05-03 | **Versão:** 2.0 (enterprise roadmap ativado) | **Zero placeholder**

---

## Serviços Ativos (21 containers, 35 portas)

| Serviço | Porta | Container | Status |
|---------|-------|-----------|--------|
| HCE API | `:8642` (127) | nativo (python3) | ✅ |
| Qdrant HTTP | `:6333` (127) | `qdrant` | ✅ |
| Qdrant gRPC | `:6334` (127) | `qdrant` | ✅ |
| Ollama | `:11434` | nativo (systemd) | ✅ |
| LiteLLM | `:4018→4000` | `litellm-proxy` | ✅ |
| AI Gateway | `:4002` | `ai-gateway` | ✅ |
| Keycloak | `:8080, :8443` | `keycloak` | ✅ |
| Gitea HTTP | `:3300` (127) | `gitea` | ✅ |
| Gitea SSH | `:2222` (127) | `gitea` | ✅ |
| Coolify | `:8000` (127) | `coolify` | ✅ |
| Coolify Realtime | `:6001-6002` (127) | `coolify-realtime` | ✅ |
| pgAdmin | `:4050` (127) | `pgadmin` | ✅ |
| Grafana | `:3100` (127) | `grafana` | ✅ |
| Prometheus | `:9090` (127) | `prometheus` | ✅ |
| Alertmanager | `:9093` (127) | `alertmanager` | ✅ |
| Redis | `:6379` (127) | `homelab-redis` | ✅ |
| Docker Registry | `:5000` | `registry` | ✅ |
| Edge TTS | `:8012` (127) | `edge-tts` | ✅ |
| OpenWebUI HVAC | `:3000` (interno) | `openwebui-hvac` | ✅ |
| Gitea Runner | — | `gitea-runner` | ✅ |
| Netdata | `:19999` | nativo | ✅ |

## Serviços Desligados/Removidos

| Serviço | Motivo |
|---------|--------|
| Whisper STT (`:8204`) | Substituído por Groq API |
| Hermes MCP (`:8092`) | Nunca deployado |
| Orchestrator JSON-RPC (`:8095`) | Spec-only |
| Vault (`:8200`) | Substituído por Infisical |

---

## Stack Principal

| Layer | Tecnologia |
|-------|------------|
| Monorepo | pnpm + Turbo + Biome |
| API | Fastify + OrchidORM + tRPC (:3000) |
| Web | React 19 + MUI + tRPC (:5173 dev) |
| Orchestrator | TypeScript workflow engine (YAML→exec) |
| Memória | Mem0 + Qdrant (Gen5 NVMe) + Ollama |
| LLM Gateway | LiteLLM → hermes-brain / Claude |
| CI/CD | Gitea Actions (13 workflows) + Coolify |
| Auth | Keycloak OIDC |
| Monitoramento | Prometheus + Grafana + Alertmanager |

---

## Systemd Timers

| Timer | Status |
|-------|--------|
| `hermes-ops-health` (5min) | ✅ |
| `hermes-ops-docker-health` (5min) | ✅ |
| `homelab-health-check` (15min) | ✅ |
| `backup-qdrant` (diário) | ✅ |
| `hermes-backup-snapshot` (diário) | ❌ FAILED |
| `hermes-backup-incremental` (diário) | ❌ FAILED |
| `hermes-backup-qdrant` (diário) | ❌ FAILED |

---

## Cron (`/etc/cron.d/hermes-ops`)

**15/21 scripts existem.** 6 ausentes: `hermes-metrics.sh`, `gpu-monitor.sh`, `zfs-prune-snapshots.sh`, `zfs-incremental-backup.sh`, `scan-chinese-cron.sh`, `hermes-alert-processor.sh`

---

## Diretórios e Discos

```
/srv/monorepo/    ← Source of truth (pnpm monorepo)
/srv/monorepo/services/ ← HCE v2.1 (tree-only, zero state)
/srv/ops/         ← IaC, governance, secrets
/srv/data/        ← Dados persistentes (Coolify, Gitea, etc.)
/tank/qdrant/     ← Qdrant Gen5 NVMe (Crucial T700 4TB)
/tank/backups/    ← Backups (15.6GB)
/tank/docker-data/ ← Docker volumes (239GB)
```

**Disco sistema:** 86% cheio (38GB livre de 274GB)

---

## Modelos Ollama

| Modelo | Uso |
|--------|-----|
| `nomic-embed-text` | Embeddings 768D (Qdrant) |
| `qwen2.5-coder:14b-q6k` | Code generation |
| `qwen2.5vl:3b` | Vision |

---

## Qdrant Collections (6)

| Coleção | Pontos | Status |
|---------|--------|--------|
| `mem0` | 26 | ✅ Mem0 memory |
| `hermes-knowledge` | — | ✅ Knowledge graph |
| `skills` | — | ✅ Agent skills |
| `hvac_manuals_v1` | 442 | ✅ HVAC RAG corpus |
| `will` | 0 | 🟡 Zombie |
| `mem0migrations` | 0 | 🟡 Zombie |

---

## Stack Completa de Compose

```
hce/ → HCE API (:8642) + Qdrant (:6333) (tree-only, zero state)
litellm/             → LiteLLM (:4018)
edge-tts/            → Edge TTS (:8012)
openwebui/           → OpenWebUI HVAC (:3000 interno)
coolify/             → Coolify (:8000) + DB + Redis
gitea/               → Gitea (:3300, :2222)
monitoring/          → Prometheus (:9090) + Grafana (:3100)
```

---

## Service Dependency Map

```
                    ┌──────────────┐
                    │ Cloudflare   │
                    │ Tunnel (×3)  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌──────────┐
        │ Coolify │  │ Gitea   │  │ Keycloak │
        │ :8000   │  │ :3300   │  │ :8080    │
        └────┬────┘  └────┬────┘  └────┬─────┘
             │            │            │
    ┌────────┼────────────┼────────────┼──────────┐
    ▼        ▼            ▼            ▼           ▼
┌───────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐
│Redis  │ │LiteLLM   │ │Qdrant  │ │Ollama   │ │Hermes    │
│:6379  │ │:4000     │ │:6333   │ │:11434   │ │:8642     │
└───┬───┘ └────┬─────┘ └───┬────┘ └────┬────┘ └────┬─────┘
    │          │            │          │            │
    ▼          ▼            ▼          ▼            ▼
┌────────────────────────────────────────────────────────┐
│       PostgreSQL (coolify-db / litellm-db)             │
│       ZFS tank/docker-data (239G)                      │
│       ZFS tank/monorepo (15.8G)                        │
└────────────────────────────────────────────────────────┘
```

**Critical path:** Cloudflare → Coolify → PostgreSQL → (all apps)
**SPOF:** NVMe físico (4TB Gen5). Mitigado: ZFS checksums + scrub automático + backups.
**RTO:** 30min (redeploy containers) | **RPO:** 6h (ZFS snapshots)

---

## SLOs (Service Level Objectives)

| Service | SLO Target | Error Budget (30d) | Probe |
|---------|-----------|---------------------|-------|
| Gitea (`git.zappro.site`) | 99.5% | 3h 36min | `/api/v1/version` |
| Coolify (`coolify.zappro.site`) | 99.0% | 7h 12min | `/api/health` |
| Qdrant | 99.9% | 43min | `/health` |
| Ollama | 99.5% | 3h 36min | `/api/tags` |
| LiteLLM (`llm.zappro.site`) | 99.5% | 3h 36min | `/health` |
| Hermes Gateway | 99.0% | 7h 12min | `/health` |
| Keycloak | 99.5% | 3h 36min | `/health/ready` |
| Edge TTS | 99.0% | 7h 12min | `/health` |

**SLI:** `up{job}` via Prometheus blackbox-exporter / synthetic prober
**Burn rate alerts:** Fast burn (1h budget consumed in 5min) → P1. Slow burn (2% in 1h) → P2.

---

## Image Version Policy (Enterprise)

- **`docs/REFERENCE/VERSIONS.md`** — Manifesto canônico com pinned digests (`@sha256:`)
- **`:latest` / `:nightly` tags são PROIBIDAS** em qualquer compose file
- **Audit diário** 07:00 via `docker-digest-audit.sh` (reporta Telegram se violação)
- **Local builds** (ai-gateway, edge-tts, task-orchestrator) exigem ZFS snapshot antes do build

---

## Governança

- **Secrets:** `/srv/monorepo/.env` (fonte canônica, chmod 600)
- **Versions:** `docs/REFERENCE/VERSIONS.md` (pinned digests)
- **Enterprise spec:** `docs/SPECS/SPEC-210-enterprise-homelab-hardening.md`
- **Segurança:** `/srv/ops/ai-governance/CONTRACT.md`
- **Portas:** `/srv/ops/ai-governance/PORTS.md`
- **Subdomínios:** `/srv/ops/ai-governance/SUBDOMAINS.md`

---

## Env Vault (SRE-Pro)

**Canônico:** `/srv/monorepo/.env` (chmod 600, gitignored)
**Template LLM:** `.env.example` — auto-gerado com `${VAR_NAME}` para secrets
**Vault:** `tank/monorepo@env-vault-*` (ZFS snapshot a cada sync)

```bash
bash scripts/env-vault-sync.sh        # sync .env → .env.example + ZFS snapshot
bash scripts/env-vault-sync.sh --dry-run  # preview changes
```

Todas as apps (api, web, orchestrator) e serviços (hce, ollama) apontam para o canônico via symlink.

---

## Execution Framework

### Nexus (`.nexus/`)
```bash
nexus doctor          # environment health check (9 CLI + 5 services + 5 motor)
nexus quality-gates   # lint + test + secrets audit antes de ship
nexus plan <json>     # SPEC → chunks
nexus next            # execute next chunk
nexus status/review/destroy
```

### Git Commands (`.claude/commands/`)
```bash
/turbo   # commit → push gitea+github → merge main → tag → nova branch
/ship    # review → sync docs → commit → push dual remotes → PR
```

### CI/CD (`.gitea/workflows/`)
```
ci-feature → code-review → deploy-main → rollback
```

### Multi-CLI (Hermes)
```bash
hermes-cli-invoke.sh claude "task"    # Claude Code CLI 2.1.126
hermes-cli-invoke.sh codex "task"     # Codex CLI 0.125.0
hermes-cli-invoke.sh opencode "task"  # OpenCode CLI 1.14.33
```

## Hermes/LiteLLM 05/2026

Hermes usa sempre o LiteLLM como gateway OpenAI-compatible em `http://127.0.0.1:4018/v1`.
O padrão é local primeiro via Ollama, com OpenRouter apenas para fallback ou escalada explícita.

```bash
OPENAI_BASE_URL=http://127.0.0.1:4018/v1
OPENAI_API_KEY=$LITELLM_MASTER_KEY

LITELLM_URL=http://127.0.0.1:4018/v1
LITELLM_OLLAMA_URL=http://host.docker.internal:11434
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
```

Aliases canônicos: `hermes-auto`, `hermes-local-code`, `hermes-vision`, `hermes-embed`, `hermes-cloud-cheap`, `hermes-cloud-pro`, `hermes-cloud-ui`, `hermes-brain`.
