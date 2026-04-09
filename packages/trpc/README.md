# @connected-repo/trpc

tRPC routers and client for the monorepo API.

## Usage

```typescript
import { createTRPCClient } from '@connected-repo/trpc/client';

const client = createTRPCClient();

// Query
const greeting = await client.greeting.greeting.query({ name: 'World' });
```
