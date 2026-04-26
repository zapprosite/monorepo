import { initTRPC } from '@trpc/server';
import { z } from 'zod';

/**
 * tRPC router for the application.
 *
 * Add your routers here and export them as AppRouter.
 *
 * @example
 * ```typescript
 * import { router } from './router';
 *
 * export const appRouter = router({
 *   greeting: greetingRouter,
 * });
 * ```
 */

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Example greeting router.
 */
export const greetingRouter = router({
  greeting: publicProcedure
    .input(z.object({ name: z.string().default('World') }))
    .query(({ input }) => {
      return `Hello, ${input.name}!`;
    }),
});

/**
 * Main application router.
 * Export this as `AppRouter` for use in tRPC clients.
 */
export const appRouter = router({
  greeting: greetingRouter,
});

export type AppRouter = typeof appRouter;
