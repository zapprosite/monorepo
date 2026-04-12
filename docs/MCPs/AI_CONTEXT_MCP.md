# MCP: ai-context-sync (2026-03-16)

**Purpose:** Sincroniza documentação de arquitetura entre Desktop (control hub), Governance, e Memory context

**Status:** ✅ Operational
**Deployment:** 2026-03-16 17:15 UTC
**Snapshot:** `tank@pre-20260316-ai-context-mcp` (rollback available)

---

## 📐 Architecture

### Source → Targets Flow
```
/home/will/Desktop/SYSTEM_ARCHITECTURE.md (control hub)
  ↓
~/.claude/mcps/ai-context-sync/sync.sh (MCP executor)
  ↓
  ├→ docs/GOVERNANCE/SYSTEM_STATE.md (source of truth)
  └→ ~/.claude/projects/-home-will/memory/system_state.md (memory context)
```

### Partitions Covered
- **Desktop (/home/will/Desktop):** Control hub + Tutorial
- **Governance (/srv/ops/ai-governance):** Source of truth
- **Memory (~/.claude/projects):** Persistent context for future sessions

---

## 🔄 Integration Points

### Skill Integration
File: `~/Desktop/maintain-system-documentation.sh`
Trigger: Called automatically after documentation update
Flow:
1. Skill collects system state (services, disk, ZFS)
2. Updates SYSTEM_ARCHITECTURE.md on Desktop
3. **Calls MCP ai-context-sync** ← NEW
4. Syncs to all targets
5. Logs completion

### Manual Trigger
```bash
~/.claude/mcps/ai-context-sync/sync.sh
```

---

## 📋 Sync Verification

**Last Sync:** 2026-03-16 20:15:47 UTC

```
Source:  /home/will/Desktop/SYSTEM_ARCHITECTURE.md (13KB)
Target1: /srv/ops/ai-governance/SYSTEM_STATE.md ✅
Target2: ~/.claude/projects/.../system_state.md ✅
Log:     /srv/ops/ai-governance/logs/ai-context-sync.log
```

---

## 🛡️ Security & Compliance

✅ No /srv/data access (production data protected)
✅ No destructive operations
✅ Read-only on governance structure
✅ Write-only in safe zones (/home/will, /srv/ops logs)
✅ Snapshot before deployment taken
✅ Governance rules maintained (CONTRACT.md, GUARDRAILS.md)

---

## 📅 Recommended Schedule

- **Frequency:** Weekly or post-infrastructure-changes
- **Trigger:** Manual via skill or MCP
- **Monitoring:** Check `/srv/ops/ai-governance/logs/ai-context-sync.log`
- **Validation:** Verify file timestamps match across targets

---

## 🔧 Configuration Files

**MCP Definition:**
```
~/.claude/mcps/ai-context-sync/manifest.json
```

**Sync Script:**
```
~/.claude/mcps/ai-context-sync/sync.sh
```

**Skill Integration Point:**
```
~/Desktop/maintain-system-documentation.sh (lines ~522-535)
```

---

## 🚀 Next Steps

1. Run skill weekly: `bash ~/Desktop/maintain-system-documentation.sh`
2. Monitor logs: `tail -f /srv/ops/ai-governance/logs/ai-context-sync.log`
3. Review synced docs:
   - Desktop: `~/Desktop/SYSTEM_ARCHITECTURE.md`
   - Governance: `docs/GOVERNANCE/SYSTEM_STATE.md`
   - Memory: `~/.claude/projects/-home-will/memory/system_state.md`

---

**Deployed by:** Claude Code
**Snapshot:** tank@pre-20260316-ai-context-mcp
**Rollback:** `sudo zfs rollback -r tank@pre-20260316-ai-context-mcp` (if needed)
