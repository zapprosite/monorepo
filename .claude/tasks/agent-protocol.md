# Agent Communication Protocol

## Message Format

```json
{
  "id": "MSG-20260417-001",
  "from": "CODER-1",
  "to": "ARCHITECT",
  "type": "request",
  "subject": "auth-pattern",
  "body": "JWT or session cookies?",
  "timestamp": "2026-04-17T14:00:00Z"
}
```

## Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `status` | Any→Any | Stage transition notification |
| `request` | Any→Any | Information or approval request |
| `response` | Any→Any | Reply to request |
| `blocker` | Any→Orchestrator | Something blocking progress |
| `completion` | Any→Orchestrator | Task finished |

## Shared State Files

```
.decisions/{id}.json         — Architectural decisions
.messages/{agent-id}/        — Per-agent message inbox
tasks/agent-states/{agent}.json — Per-agent state
tasks/blockers.json           — Active blockers
```

## Workflow

1. Agent sends message to recipient via filesystem
2. Recipient polls inbox and processes message
3. Response written back to sender's inbox
4. Orchestrator monitors all agent-states/

## Message Inbox Pattern

```bash
# Write message
echo '{"from":"CODER-1","type":"completion",...}' > .messages/ORCHESTRATOR/inbox/MSG-001.json

# Poll for messages
ls .messages/{agent-id}/inbox/

# Process and respond
rm .messages/{agent-id}/inbox/MSG-001.json
```
