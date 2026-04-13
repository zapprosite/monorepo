# DOC-LIBRARIAN SKILL

## Purpose

CEO MIX acts as the librarian of the enterprise documentation system.
This skill teaches how to audit, organize, update, and maintain docs.

## Architecture

```
Source of Truth: /srv/monorepo/docs/
Thin Mirror:     docs/GOVERNANCE/ (read-only stubs)

Read via: MCP monorepo at 10.0.19.50:4006
Write via: git push → Claude Code approval
```

## Layers

| Layer | Docs | Audience |
|---|---|---|
| 0 | CONTRACT, GUARDRAILS, APPROVAL_MATRIX, CHANGE_POLICY | All agents + humans |
| 1 | guide, RUNBOOK, RECOVERY, skills | Operators |
| 2 | NETWORK_MAP, PORTS, SUBDOMAINS, PARTITIONS | Infrastructure |
| 3 | MCPs, TEMPLATES | Integration |
| 4 | guides/, adrs/, ARCHIVE/ | Application dev |

## Functions

### audit_docs(days=30)
Audit documentation freshness. Files not modified in N days are flagged stale.

**Input:** days (default 30)

**Output:**
```
STALE DOCS (>30 days):
- docs/GOVERNANCE/CONTRACT.md: modified 2026-03-27 (11 days ago)
- docs/INFRASTRUCTURE/NETWORK_MAP.md: modified 2026-04-07 (0 days ago) ✅

HEALTHY: 14 docs recent, 2 stale
```

**Steps:**
1. find /srv/monorepo/docs -name "*.md" -mtime +days
2. For each stale doc: note in report
3. Cross-reference with CHANGE_LOG.txt

### audit_infra_state()
Check infrastructure documentation accuracy.

**Checks:**
1. PORTS.md vs ss -tlnp (verify active ports)
2. SUBDOMAINS.md vs terraform state (verify DNS records)
3. NETWORK_MAP.md vs docker network inspect (verify IPs)
4. SERVICE_MAP.md vs docker ps (verify containers)

**Output:**
```
PORTACCORDANCE: 18/20 ports match. DRIFT: :4007 (tts-bridge not in PORTS)
SUBDOMAINS: 10/10 match terraform ✅
CONTAINERS: 28 running, all in SERVICE_MAP ✅
DRIFT DETECTED: 1 item — update PORTS.md
```

### stale_docs_report()
Generate a report of all docs not reviewed in 30+ days.

**Output:**
```
STALE REPORT (2026-04-07):

CRITICAL (>90 days):
- docs/OPERATIONS/guide.md: 2026-03-16 (22 days)
- docs/GOVERNANCE/INCIDENTS.md: 2026-04-04 (3 days) ✅

WARNINGS (30-90 days):
- docs/MCPs/MCP_TOKENS_GUIDE.md: 2026-03-17 (21 days)

ACTION: Review stale docs, update header "last-review" date.
```

### update_change_log(operation, detail)
Append an entry to the change log.

**Input:**
- operation: "CREATE" | "UPDATE" | "DELETE" | "AUDIT"
- detail: human-readable description

**Output:** Confirmation + appends to CHANGE_LOG.txt

**Format:**
```
2026-04-07T08:15:00Z [OPERATION] [AGENT] [DETAIL]
```

### sync_to_monorepo()
Sync OpenClaw workspace docs to monorepo source of truth.

**What syncs:**
- /data/workspace/SOUL.md → docs/OPENCLAW/
- /data/workspace/MEMORY.md → docs/OPENCLAW/
- /data/workspace/architecture/SELF-KNOWLEDGE.md → docs/OPENCLAW/
- /data/workspace/architecture/AGENCY-RULES.md → docs/OPENCLAW/

**Rules:**
- Always cp (never mv) from workspace to monorepo
- Commit with descriptive message
- git push after sync

### check_immutable_flags()
Verify GOVERNANCE docs are properly immutable.

**Output:**
```
IMmutable (chattr +i):
- CONTRACT.md ✅
- GUARDRAILS.md ✅
- APPROVAL_MATRIX.md ✅
- CHANGE_POLICY.md ✅
- RECOVERY.md ✅
- SECRETS_POLICY.md ✅

NOT immutable (⚠️ SHOULD BE):
- INCIDENTS.md — add chattr +i
- DATABASE_GOVERNANCE.md — add chattr +i
```

## Daily Audit Protocol

```
1. audit_infra_state()
   → Report any drift to Mestre
   
2. stale_docs_report(days=30)
   → Flag docs needing review
   
3. If new docs created in workspace:
   → sync_to_monorepo()
   
4. After any infrastructure change:
   → update_change_log("UPDATE", "Changed X in Y")
```

## Response Template for Infra Audits

```
DOC AUDIT — [date]

PORTACCORDANCE: X/Y match ✅/⚠️
  Drift: [list]
  
SUBDOMAINS: X/Y match ✅/⚠️
  Drift: [list]
  
CONTAINERS: X/Y in SERVICE_MAP ✅/⚠️
  Missing: [list]

STALE DOCS: X files >30 days
  [list]

RECOMMENDATIONS:
1. [action 1]
2. [action 2]
```
