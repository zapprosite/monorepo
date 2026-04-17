# /rs — Rollback script

## Description

Safe rollback procedures for deployed changes.

## Rollback Order (reverse deploy)

1. `git revert <commit>` — create revert commit
2. Push revert: `git push`
3. If Docker: `docker-compose down && docker-compose rm -f`
4. If Terraform: `cd /srv/ops/terraform && terraform apply -reverse`
5. Verify service health post-rollback

## Docker Rollback

```bash
docker-compose pull && docker-compose up -d
# or specific image:
docker-compose up -d --force-recreate
```

## ZFS Rollback

```bash
sudo zfs list -t snapshot
sudo zfs rollback -r pool/dataset@snapshot
```

## When

- Deploy causes degradation
- Smoke tests FAIL after deploy
- P1/P2 incident declared

## Refs

- `SPEC-023` self-healing runbooks
- `docs/GUIDES/backup-runbook.md`
- `snapshot-safe` skill
