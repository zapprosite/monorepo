# Legacy Prune Manifest

Classification: INTERNAL
Owner: Platform Engineering
Status: executed
Updated: 2026-05-01

This manifest records direct prune actions. No `.bak`, `.backup`, or archive
copies were created.

## Deleted

| Path | Scope | Reason |
|---|---|---|
| `/srv/archive` | filesystem | root legacy project archive removed |
| `/home/will/Desktop/hermes-second-brain` | filesystem | duplicate Desktop copy removed |
| `/srv/ops/scripts/archive` | filesystem | legacy script archive removed |
| `/srv/ops/terraform/cloudflare/legacy` | filesystem | deprecated Terraform copy removed |
| `/srv/ops/terraform/cloudflare/terraform.tfstate.backup` | filesystem | backup artifact removed from active Terraform directory |
| `docs/GOVERNANCE/.rules/voice-kit-protect.md.ARCHIVED` | monorepo | archived rule removed |
| `docs/GOVERNANCE/.rules/wav2vec2-stt-protect.md.ARCHIVED` | monorepo | archived rule removed |
| `docs/index.md` | monorepo | stale knowledge-base index superseded by `docs/GOVERNANCE/INDEX.md` |
| `scripts/prune-docs.sh` | monorepo | old script moved files into `docs/archive`; archive strategy removed |
| `docs/GOVERNANCE/SKILLS/archive/` | monorepo | empty archive directory removed |
| `docs/HOMELAB-OPS.md` | monorepo | stale broad operations manual superseded by canonical governance docs |
| `docs/API_GATEWAY_ARCHITECTURE.md` | monorepo | stale architecture snapshot superseded by `SERVICE_CATALOG.md`, `PORTS.md`, and `SUBDOMAINS.md` |

## Kept

| Path/pattern | Reason |
|---|---|
| `scripts/nexus-legacy-detector.sh` | active detector vocabulary; not legacy payload |
| `scripts/nexus-cron-legacy.sh` | detector orchestration vocabulary; review separately before deleting |
| `/srv/backups`, `/srv/backup`, `/srv/ops/backups` | operational backups, not legacy payload |
| `/srv/hermes-second-brain` | separate dirty git repository; requires its own prune cycle |
