import { createTRPCClient, TRPCClientConfig } from '@trpc/client';
import type { AppRouter } from './server.js';

/**
 * Creates a tRPC client configured for the monorepo API.
 *
 * @example
 * ```typescript
 * import { createTRPCClient } from '@connected-repo/trpc/client';
 *
 * const client = createTRPCClient({
 *   prefix: 'api',
 * });
 *
 * const result = await client.greeting.query({ name: 'World' });
 * ```
 */
export function createTRPCClient(config?: Partial<TRPCClientConfig>) {
  return createTRPCClient<AppRouter>({
    prefix: 'api',
    ...config,
  });
}

export type { AppRouter } from './server.js';
