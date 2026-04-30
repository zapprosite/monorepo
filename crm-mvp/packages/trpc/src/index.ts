import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Tipos compartilhados
export type AppRouter = typeof appRouter;

// Placeholder — será expandido pelos routers de cada módulo
const appRouter = router({
  health: publicProcedure.query(() => ({ status: 'ok', time: new Date().toISOString() })),
});

export { appRouter };
