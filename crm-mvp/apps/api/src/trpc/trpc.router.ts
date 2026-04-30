import { Injectable } from '@nestjs/common';
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();

@Injectable()
export class TrpcRouter {
  appRouter = t.router({
    health: t.procedure.query(() => ({ status: 'ok', time: new Date().toISOString() })),
  });

  async applyMiddleware(app: any) {
    // tRPC + NestJS adapter será implementado na Fase 4
    app.get('/trpc/health', (req: any, res: any) => {
      res.json({ status: 'ok' });
    });
  }
}
