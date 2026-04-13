# MiniMax Research - Quick Start

## Running Research

### Basic Usage

```bash
bash scripts/cursor-loop-research-minimax.sh "your research question"
```

### Error Analysis Example

```bash
bash scripts/cursor-loop-research-minimax.sh "TypeError: Cannot read property 'map' of undefined at transformer.ts:45"
```

### Architecture Research Example

```bash
bash scripts/cursor-loop-research-minimax.sh "Compare the Fastify vs Express patterns in apps/api"
```

## Integration with Cursor Loop

The `cursor-loop-research-minimax.sh` script is designed to integrate with the autonomous cursor loop system:

1. **Called** when `/minimax-research` or `/research` is invoked
2. **Retrieves** MiniMax API token via Infisical SDK
3. **Sends** research query to MiniMax M2.7
4. **Returns** formatted analysis with code references

## Example Output

```
=== MiniMax Research Agent ===
Query: How does the auth middleware work?

Analysis:
- Root cause: Token validation happens in middleware/auth.ts
- Location: apps/api/src/middleware/auth.ts:23
- Pattern: JWT verification using @fastify/jwt
- Related: apps/api/src/routes/auth.ts for token generation
- Suggested: Add rate limiting to prevent brute force

Recommendation: Implement token refresh mechanism
```

## Environment Variables

The script requires:
- `INFISICAL_CLIENT_ID` - Infisical client ID
- `INFISICAL_CLIENT_SECRET` - Infisical client secret
- `INFISICAL_WORKSPACE_ID` - Infisical workspace ID

These are automatically loaded from the monorepo's Infisical configuration.