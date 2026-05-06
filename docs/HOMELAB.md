# HOMELAB.md — Canonical Infrastructure Reference

> **Verificado:** 2026-05-06 | **Versão:** 2.1 | **Infra real auditada**

---

## Hardware Canônico do Host

Este é o inventário real do host principal do homelab. Quando houver conflito entre docs antigas e runtime, esta seção vence até nova auditoria.

| Componente | Valor canônico |
|-----------|-----------------|
| Host | `will-zappro` |
| OS | Ubuntu Desktop `24.04.4 LTS` |
| Kernel | Linux `6.17.0-22-generic` |
| Placa-mãe | ASUS `TUF GAMING X670E-PLUS` |
| CPU | AMD Ryzen 9 `7900X` 12-Core / 24 threads |
| RAM | `32 GiB` DDR5 |
| GPU dGPU | NVIDIA GeForce RTX `4090` `24 GB` |
| GPU iGPU | AMD Raphael (`amdgpu`) |
| Disco do SO | KINGSTON `SNV3S1000G` `1 TB` |
| Disco de dados | Crucial `T700` `4 TB` Gen5 |
| Storage de `/srv` | ZFS pool `tank/*` no Crucial T700 |

## Regras de Hardware

- O vídeo do desktop deve usar a iGPU/onboard sempre que possível.
- A RTX 4090 deve ficar reservada para `llama.cpp / llama-server`.
- `nomic-embed-cpu` deve rodar sem VRAM (`-ngl 0`).
- Antes de qualquer mudança destrutiva em `/srv`, criar snapshot ZFS.
- Se o hardware físico mudar, atualizar esta seção, `docs/HARDWARE_HIERARCHY.md` e `/srv/homelab-context` na mesma janela operacional.

## Perfil Operacional Atual

| Recurso | Padrão atual |
|---------|--------------|
| GPU principal de inferência | `llama-server :8001` |
| Embedding | `llama-server :8002` CPU-only |
| Gateway LLM | LiteLLM `:4018` |
| Banco vetorial | Qdrant `:6333` |
| Publicação/admin | Gitea `:3300`, Coolify `:8000` |

## Repositórios Reais em `/srv`

O homelab não é só o `monorepo`. Estes são os repositórios Git ativos encontrados em `/srv` na auditoria de `2026-05-06`.

| Repo | Caminho | Papel |
|------|---------|-------|
| `monorepo` | `/srv/monorepo` | Control plane principal, apps, gateway e docs |
| `homelab-context` | `/srv/homelab-context` | Contexto global compartilhado do homelab |
| `nexus` | `/srv/nexus` | Router/orquestração local-first para CLIs e automações |
| `ops` | `/srv/ops` | Infra as Code, governança, stacks e utilitários SRE |
| `hvac-pipeline` | `/srv/hvac-pipeline` | Pipeline HVAC/RAG e utilitários do domínio |

### Regra prática

- `monorepo` continua sendo o control plane principal.
- `homelab-context` é a fonte de contexto compartilhado entre agentes.
- `ops` guarda governança e operação de infraestrutura.
- `nexus` é um repo próprio e não deve ser tratado como submódulo mental do monorepo.
- `hvac-pipeline` é um repo separado de domínio, mesmo quando parte do runtime conversa com serviços do monorepo.

---

## Serviços Ativos (runtime atual)

| Serviço | Porta | Container | Status |
|---------|-------|-----------|--------|
| Qdrant HTTP | `:6333` (127) | `qdrant` | ✅ |
| Qdrant gRPC | `:6334` (127) | `qdrant` | ✅ |
| Llama.cpp main | `:8001` | nativo (systemd) | ✅ |
| Llama.cpp embed | `:8002` | nativo (systemd) | ✅ |
| LiteLLM | `:4018→4000` | `litellm-proxy` | ✅ |
| AI Gateway | `:4002` | `zappro-ai-gateway` | ✅ |
| Keycloak | `:8080, :8443` | `keycloak` | ✅ |
| Gitea HTTP | `:3300` (127) | `zappro-gitea` | ✅ |
| Gitea SSH | `:2222` (127) | `zappro-gitea` | ✅ |
| Coolify | `:8000` (127) | `coolify` | ✅ |
| Coolify Realtime | `:6001-6002` (127) | `coolify-realtime` | ✅ |
| pgAdmin | `:4050` (127) | `zappro-pgadmin` | ✅ |
| Grafana | `:3100` (127) | `grafana` | ✅ |
| Prometheus | `:9090` (127) | `prometheus` | ✅ |
| Alertmanager | `:9093` (127) | `alertmanager` | ✅ |
| Redis | `:6379` (127) | `zappro-redis` | ✅ |
| Docker Registry | `:5000` | `registry` | ✅ |
| Edge TTS | `:8012` (127) | `zappro-edge-tts` | ✅ |
| OpenWebUI HVAC | `:3000` (interno) | `openwebui-hvac` | ✅ |
| Gitea Runner | — | `gitea-runner` | ✅ |
| Netdata | `:19999` | nativo | ✅ |

## Fora do Estado Canônico

| Serviço | Motivo |
|---------|--------|
| `litellm-proxy` | Funcional, mas healthcheck do container está `unhealthy` |
| `diun` | Restart loop |
| `hermes-backup-qdrant.service` | Falho |
| `hermes-backup-incremental.service` | Falho |
| `hermes-ops-health.service` | Falho |

---

## Stack Principal

| Layer | Tecnologia |
|-------|------------|
| Monorepo | pnpm + Turbo + Biome |
| API | Fastify + OrchidORM + tRPC (:3000) |
| Web | React 19 + MUI + tRPC (:5173 dev) |
| Orchestrator | TypeScript workflow engine (YAML→exec) |
| Memória | Qdrant (Gen5 NVMe) + llama.cpp embed CPU |
| LLM Runtime | llama.cpp / llama-server (`:8001`, `:8002`) |
| LLM Gateway | LiteLLM `:4018` → `hermes-*` / `nexus-*` |
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
/srv/homelab-context/ ← Contexto global compartilhado do homelab
/srv/nexus/       ← Router/orquestração local-first
/srv/ops/         ← IaC, governança, secrets
/srv/hvac-pipeline/ ← Pipeline HVAC/RAG de domínio
/srv/monorepo/services/ ← HCE v2.1 (tree-only, zero state)
/srv/data/        ← Dados persistentes (Coolify, Gitea, etc.)
/tank/qdrant/     ← Qdrant Gen5 NVMe (Crucial T700 4TB)
/tank/backups/    ← Backups (15.6GB)
/tank/docker-data/ ← Docker volumes (239GB)
```

**Disco sistema:** verificar via auditoria mais recente em `/srv/audits/`

## Modelos Canônicos

| Modelo | Runtime | Uso |
|--------|---------|-----|
| `Qwen3.6-27B-UD-Q4_K_XL` | llama.cpp GPU | code/chat local principal |
| `nomic-embed-text-v1.5.Q4_K_M` | llama.cpp CPU | embeddings 768D |

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
│Redis  │ │LiteLLM   │ │Qdrant  │ │Gitea    │ │Coolify   │
│:6379  │ │:4000     │ │:6333   │ │:3300    │ │:8000     │
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
**SPOF:** NVMe físico (4TB Gen5). Mitigado: ZFS checksums + scrub automático.
**RTO:** 30min (redeploy containers) | **RPO:** 6h (ZFS snapshots)

---

## SLOs (Service Level Objectives)

| Service | SLO Target | Error Budget (30d) | Probe |
|---------|-----------|---------------------|-------|
| Gitea (`git.zappro.site`) | 99.5% | 3h 36min | `/api/v1/version` |
| Coolify (`coolify.zappro.site`) | 99.0% | 7h 12min | `/api/health` |
| Qdrant | 99.9% | 43min | `/health` |
| LiteLLM (`llm.zappro.site`) | 99.5% | 3h 36min | `/v1/models` |
| Keycloak | 99.5% | 3h 36min | `/health/ready` |
| Edge TTS | 99.0% | 7h 12min | `/health` |

**SLI:** `up{job}` via Prometheus blackbox-exporter / synthetic prober
**Burn rate alerts:** Fast burn (1h budget consumed in 5min) → P1. Slow burn (2% in 1h) → P2.

---

## Image Version Policy (Enterprise)

- **`docs/REFERENCE/VERSIONS.md`** — Manifesto canônico com pinned digests (`@sha256:`)
- **`:latest` / `:nightly` tags são PROIBIDAS** em qualquer compose file
- **Audit diário** 07:00 via `docker-digest-audit.sh` (reporta Telegram se violação)
- **Local builds** (ai-gateway, edge-tts, hermes-orchestrator) exigem ZFS snapshot antes do build

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

Todas as apps e serviços canônicos apontam para o runtime atual documentado aqui.

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
O padrão é local primeiro via `llama.cpp`, com OpenRouter apenas para fallback ou escalada explícita.

```bash
OPENAI_BASE_URL=http://127.0.0.1:4018/v1
OPENAI_API_KEY=$LITELLM_MASTER_KEY

LITELLM_URL=http://127.0.0.1:4018/v1
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
```

Aliases canônicos em uso: `hermes-code`, `hermes-auto`, `hermes-embed`, `nexus-local-code`, `nexus-auto`, `nexus-embed`, `hermes-cloud-cheap`, `hermes-cloud-pro`, `nexus-cloud-cheap`, `nexus-cloud-pro`.
