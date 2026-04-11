# SPEC-024: Web Post-Discontinuity Architecture Cleanup — Todo

**Created:** 2026-04-10
**Plan:** `tasks/plan-spec024.md`
**Phases:** 10 (P0–P9)

---

## Phase 0 — ZFS Snapshot (Safety Checkpoint)
- [ ] **P0-T01** Create pre-cleanup ZFS snapshot `rpool/data@spec024-pre-cleanup-2026-04-10`

## Phase 1 — Coolify API Authentication Investigation
- [ ] **P1-T01** Diagnose Coolify API authentication failure
- [ ] **P1-T02** Update Coolify API key in Gitea Secrets if needed
- [ ] **P1-T03** Verify GitHub Actions Coolify secrets are current

## Phase 2 — Deploy perplexity-agent with New Volume Mounts
- [ ] **P2-T01** Trigger Coolify deploy for perplexity-agent with new volume mounts
- [ ] **P2-T02** Verify Infisical token accessible inside container
- [ ] **P2-T03** Verify browser-use operational with MiniMax M2.7

## Phase 3 — CI/CD HEALTH_URL Cleanup
- [ ] **P3-T01** Update `.github/workflows/deploy-perplexity-agent.yml` HEALTH_URL → `localhost:4004`
- [ ] **P3-T02** Update `.gitea/workflows/deploy-perplexity-agent.yml` HEALTH_URL → `localhost:4004`
- [ ] **P3-T03** Update `.github/workflows/rollback.yml` HEALTH_URL
- [ ] **P3-T04** Update `.gitea/workflows/rollback.yml` HEALTH_URL
- [ ] **P3-T05** Update `.gitea/workflows/voice-proxy-deploy.yml` HEALTH_URL

## Phase 4 — CI/CD Deploy Target Remapping
- [ ] **P4-T01** Update `.gitea/workflows/deploy-main.yml` — remove `web.zappro.site` references
- [ ] **P4-T02** Update `.github/workflows/deploy-main.yml` — remove `web.zappro.site` references

## Phase 5 — Documentation Updates
- [ ] **P5-T01** Update `docs/OPERATIONS/guide.md`
- [ ] **P5-T02** Update `docs/OPERATIONS/SKILLS/openclaw-oauth-login.md`
- [ ] **P5-T03** Update `.context/docs/architecture.md`
- [ ] **P5-T04** Update `SPEC.md`
- [ ] **P5-T05** Update `smoke-tests/smoke-bridge-stack-e2e.sh`

## Phase 6 — Terraform Verification + Skill Update
- [ ] **P6-T01** Verify Terraform `web` service entry (`localhost:4004`)
- [ ] **P6-T02** Update `.claude/skills/cloudflare-terraform/SKILL.md` services table
- [ ] **P6-T03** Run `terraform plan` — verify no stale resources

## Phase 7 — Archive apps/web
- [ ] **P7-T01** Move `apps/web` → `archive/apps-web-20260410/`
- [ ] **P7-T02** Create `apps/web.archive` marker file
- [ ] **P7-T03** Remove `apps/web` from workspace config (`pnpm-workspace.yaml`, `turbo.json`)

## Phase 8 — SPECs Cleanup
- [ ] **P8-T01** Update SPEC-007 (OpenClaw OAuth Profiles) — remove all `web.zappro.site` references
- [ ] **P8-T02** Update SPEC-PERPLEXITY-GITOPS — remove all `web.zappro.site` references
- [ ] **P8-T03** Update SPEC-013 (Unified Claude Agent Monorepo) — remove all `web.zappro.site` references
- [ ] **P8-T04** Update SPEC-015 (Gitea Actions Enterprise) — remove all `web.zappro.site` references
- [ ] **P8-T05** Update incident docs (`CONSOLIDATED-PREVENTION-PLAN.md`, `INCIDENT-2026-04-08-*.md`)
- [ ] **P8-T06** Sync updated docs to obsidian mirror

## Phase 9 — Final Smoke Test + Acceptance Verification
- [ ] **P9-T01** Verify perplexity-agent health endpoint → HTTP 200
- [ ] **P9-T02** Verify Coolify API is authenticated → returns app list
- [ ] **P9-T03** Verify zero broken workflow references → count = 0
- [ ] **P9-T04** Verify Terraform state → `web` resource correct
- [ ] **P9-T05** Verify apps/web is archived → `ls` returns ENOENT
- [ ] **P9-T06** Full Gitea Action smoke test → deploy-perplexity-agent workflow succeeds

---

## Checkpoints

| Checkpoint | Phase | Criteria |
|-----------|-------|----------|
| CP-0 | P0 | ZFS snapshot exists |
| CP-1 | P1 | Coolify API returns 200 |
| CP-2 | P2 | Container healthy + secrets mounted |
| CP-3 | P3 | All CI/CD HEALTH_URLs updated |
| CP-4 | P4 | All CI/CD deploy references fixed |
| CP-5 | P5 | Documentation updated |
| CP-6 | P6 | Terraform plan clean |
| CP-7 | P7 | apps/web archived |
| CP-8 | P8 | SPECs updated |
| CP-9 | P9 | All acceptance criteria green |

---

## Dependency Graph (summary)

```
P0 ────── snapshot
           │
    ┌──────┴──────┐
    │             │
P1─┤             P2
    │             │
    └──────┬──────┘
           │
         P3 ──► P4 ──► P5 ──► P8
                              │
                         ┌────┴────┐
                         │         │
                       P6        P7
                          \       /
                            \   /
                            P9
```

## Quick Command Reference

```bash
# Snapshot (Phase 0 — host)
sudo zfs snapshot -r rpool/data@spec024-pre-cleanup-2026-04-10

# Coolify API test (Phase 1)
curl -s http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer $(cat /srv/ops/secrets/coolify-api-key.secret)"

# Health check (Phase 2/9)
curl -s -o /dev/null -w "%{http_code}" http://localhost:4004/_stcore/health

# Count remaining references (Phase 3/4)
grep -r "web.zappro.site" .github/workflows/ .gitea/workflows/ 2>/dev/null | wc -l

# Terraform plan (Phase 6 — host)
cd /srv/ops/terraform/cloudflare && terraform plan

# Archive apps/web (Phase 7 — host)
mv /srv/monorepo/apps/web /srv/monorepo/archive/apps-web-20260410
```
