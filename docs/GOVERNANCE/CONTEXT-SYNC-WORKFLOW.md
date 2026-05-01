# Context Sync Workflow - Ship Phase

## Overview

This workflow handles synchronization of Nexus session artifacts to the Hermes Second Brain during the Ship phase of the PREVC development cycle.

## Purpose

Ship phase sync - export session artifacts to Hermes Second Brain for persistent storage and future retrieval.

## Trigger

- `/ship` command issued by user
- C→Ship phase transition in PREVC workflow

## Operations

### 1. Export Queue Summary

Export the `queue.json` summary to the `claude-code-memory` store for documentation of completed tasks and decisions.

### 2. Export Vibe-Kit Logs Metadata

Export vibe-kit logs metadata (not full logs) to preserve the session execution trace without storing verbose log content.

### 3. Export Artifacts Manifest

Export the complete artifacts manifest generated during the session, including all created, modified, or referenced files.

### 4. Update Session Tags in Qdrant

Update session tags in the Qdrant vector store for semantic search and session retrieval.

## MCP Integration

### dotcontext Harness

Use `mcp__dotcontext__harness` with the `recordArtifact` action to persist session artifacts:

```
recordArtifact({
  name: "<artifact-name>",
  kind: "text|json|file",
  content: "<artifact-content>",
  filePath: "<optional-file-path>"
})
```

### Required Artifacts

The following artifacts should be recorded before ship:
- Queue summary (`queue.json`)
- Artifacts manifest
- Session metadata
- Decision log (if any)

## Health Check

Before initiating sync, verify Hermes API is reachable:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${HERMES_API_KEY}" \
  "https://hermes.zappro.site/api/health"
```

Expected response: `200 OK`

## Fallback Behavior

If Hermes API is unreachable:

1. Log the sync failure with timestamp
2. Queue the sync operation for retry
3. Store artifacts locally in `.context/harness/pending-sync/`
4. Return success to user - sync will complete asynchronously

## Error Handling

| Error | Action |
|-------|--------|
| Hermes unreachable | Queue for retry |
| Artifact export failed | Log error, continue with next artifact |
| Qdrant update failed | Log warning, non-blocking |
| Auth failure | Block sync, alert user |

## Verification

After successful sync:
1. Confirm artifact count matches export list
2. Verify session tags searchable in Qdrant
3. Log ship completion timestamp
