# Skill: MiniMax Research Agent

**name:** minimax-research
**description:** Research agent using MiniMax LLM for monorepo code/error analysis
**trigger:** /minimax-research or /research

## Overview

This skill leverages MiniMax M2.7 LLM via the `cursor-loop-research-minimax.sh` script to perform deep code analysis, error investigation, and architectural research within the monorepo.

## Usage

### Basic Research Query

```
/minimax-research How does the auth middleware work in apps/api?
```

### Error Analysis

```
/minimax-research TypeError: Cannot read property 'map' of undefined at transformer.ts:45
```

### Architecture Research

```
/minimax-research Compare the Fastify vs Express patterns in the backend
```

## Running Research

### Via CLI Script

```bash
bash scripts/cursor-loop-research-minimax.sh "your research question or error message"
```

### Via Cursor Loop Integration

The script integrates with the cursor loop system:
1. When running `/minimax-research`, it calls `cursor-loop-research-minimax.sh`
2. The script retrieves the MiniMax API token from Infisical
3. Executes the research query against MiniMax M2.7
4. Returns formatted analysis

## Infisical SDK Pattern

The script uses Infisical SDK to securely retrieve the MiniMax API token:

```typescript
import { InfisicalClient } from '@infisical/sdk';

async function getMinimaxToken(): Promise<string> {
  const client = new InfisicalClient({
    clientId: process.env.INFISICAL_CLIENT_ID,
    clientSecret: process.env.INFISICAL_CLIENT_SECRET,
  });

  const secret = await client.getSecret({
    workspaceId: process.env.INFISICAL_WORKSPACE_ID,
    environment: 'production',
    secretPath: '/',
    secretName: 'MINIMAX_API_TOKEN',
  });

  return secret.secretValue;
}
```

## Models

| Model | Use Case | Speed |
|-------|----------|-------|
| MiniMax-M2.7 | Deep research, complex analysis | Default |
| MiniMax-M2.1 | Quick lookups, simpler tasks | Fast |

## Output

The research agent returns:
- Root cause analysis (for errors)
- Code location references
- Suggested fixes
- Related patterns in codebase