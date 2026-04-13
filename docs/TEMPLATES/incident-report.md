---
name: incident-report
description: Template for incident reports with RCA and postmortem
status: PROPOSED
priority: critical
author: will-zappro
date: YYYY-MM-DD
specRef: GOVERNANCE/INCIDENTS.md
---

# Incident Report Template

**Incident ID:** [AUTO-YYYYMMDD-NNNNN]
**Status:** Open / Resolved

## Executive Summary
[1-2 sentence summary of what happened]

## Details
- **Date/Time Started:** YYYY-MM-DD HH:MM UTC
- **Date/Time Detected:** YYYY-MM-DD HH:MM UTC
- **Date/Time Resolved:** YYYY-MM-DD HH:MM UTC
- **Duration:** XX minutes
- **Severity:** Critical / High / Medium / Low

## Affected Components
- [ ] Qdrant
- [ ] n8n
- [ ] PostgreSQL
- [ ] Docker
- [ ] ZFS
- [ ] Network
- [ ] Other: ________

## Symptoms
[What did users/monitoring observe?]

## Immediate Actions Taken
[Describe first 30 minutes of response]

## Root Cause Analysis
[Why did this happen?]

## Recovery Steps
1. [Action 1]
2. [Action 2]
3. [Action 3]

## Verification
[How do we know it's fixed?]

## Impact Assessment
- **User Impact:** [What couldn't work?]
- **Data Lost:** Yes / No [if yes: what and how much]
- **Services Affected:** [List with duration of each]

## Prevention Action Items
- [ ] Action 1
- [ ] Action 2
- [ ] Action 3

## Responsible Party
- **Reported by:** [Name]
- **Investigation lead:** [Name]
- **Approval:** [Name]

---

## Postmortem (After incident resolved)

### What went well
-

### What didn't go well
-

### What will we do differently next time
-

### Changes to documentation
- GUARDRAILS.md updated: [ ]
- CHANGE_POLICY.md updated: [ ]
- RUNBOOK.md updated: [ ]
- RECOVERY.md updated: [ ]

---

**Date Closed:** YYYY-MM-DD
**Lessons Learned:** [Brief summary of key takeaways]
