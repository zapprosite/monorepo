# SPEC-008 Completion Report

**Date:** 2026-04-29  
**SPEC:** SPEC-008 — ZFS Secondary Disk Enterprise Pattern  
**Workers:** 12 parallel (mclaude -p)

---

## Results by Task

| Task | ID | Status | Finding |
|------|----|--------|---------|
| analyze-zfs-dataset-structure | T001 | ✅ Done | tank/backups(14.9G), tank/docker-data(26.9G), tank/models(6.46G), tank/monorepo(8.81G), tank/qdrant(10.1M) |
| identify-disk-secundario | T002 | ✅ Done | KINGSTON SNV3S1000G 931.5GB, `/dev/nvme1n1` — **é o disco do SO** |
| identify-migration-candidates | T003 | ✅ Done | 679 snapshots em ~/.hermes (6.8MB), audit files, empty brain backups |
| validate-pool-tank-inalterado | T004 | ✅ Done | Pool `tank` validado: 3.62T, ONLINE, nvme0n1, scrub 2026-04-27 — 0 erros |
| confirm-worker-local-filesystem | T005 | ✅ Done | Workers acessam via local filesystem, não SSH |
| create-tank2-pool | T006 | ❌ BLOCKED | `nvme1n1` é disco do SO (root + home + EFI) — não pode ser usado |
| create-tank2-backups-dataset | T007 | ✅ Done (script) | Script em `/srv/monorepo/.claude/brain-refactor/create-tank2-backups-dataset.sh` |
| migrate-backups-data | T008 | ⚠️ Blocked | tank2 não existe — migração não possível |
| configure-snapshot-replication | T009 | ✅ Done (script) | Script em `/srv/monorepo/.claude/brain-refactor/scripts/zfs-replicate-tank2.sh` |
| verify-worker-access | T010 | ✅ Done | `/srv/monorepo` latência 1.76ms, Hermes :8642 → 200, Ollama :11434 → 200 |
| update-architecture-md | T011 | ✅ Done | ARQUITECTURA.md §4 atualizada |
| update-zfs-policy | T012 | ✅ Done | ZFS-POLICY.md atualizado com tank2 |

---

## Critical Finding: Disk Layout

```
nvme0n1 (3.6T) → tank (ZFS pool, full disk)
nvme1n1 (931G) → ROOT OS DISK (não secundário!)
  ├── /          (root filesystem)
  ├── /home      (651G, 13% usado)
  └── EFI        (boot partition)

⚠️ NÃO há disco secundário dedicado para ZFS tank2.
```

**Próximas opções:**
1. **Reparticionar nvme1n1** — reduzir /home (~651G livre) + criar partição ZFS (requer live USB/boot)
2. **Migrar SO para nvme0n1** — mover root para tank (complexo, risco alto)
3. **File-backed pool** — workaround em /tank2 (não é ZFS em disco dedicado)

---

## Created Scripts

| Script | Path | Purpose |
|--------|------|---------|
| create-tank2-backups-dataset.sh | `brain-refactor/create-tank2-backups-dataset.sh` | Cria tank2/backups dataset |
| zfs-replicate-tank2.sh | `brain-refactor/scripts/zfs-replicate-tank2.sh` | Cron replication tank → tank2 |

---

## Pending: tank2 Creation

**Requer aprovação + janela de manutenção** para reparticionar nvme1n1 ou adicionar novo disco dedicado.
