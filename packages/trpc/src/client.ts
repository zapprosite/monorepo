import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server.js';

/**
 * Creates a tRPC client configured for the monorepo API.
 *
 * @example
 * ```typescript
 * import { createTRPCClient } from '@connected-repo/trpc/client';
 *
 * const client = createTRPCProxyClient<AppRouter>({
 *   links: [httpBatchLink({ url: '/api' })],
 * });
 * ```
 */
export function createTRPCClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: process.env.API_URL || 'http://localhost:3000/api',
      }),
    ],
  });
}

export type { AppRouter } from './server.js';
