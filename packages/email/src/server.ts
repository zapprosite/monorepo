import { initTRPC } from '@trpc/server';

const t = initTRPC.create();

export const appRouter = t.router({
	health: t.procedure.query(() => ({ status: 'ok' })),
});

export type AppRouter = typeof appRouter;
