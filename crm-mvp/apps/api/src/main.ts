import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TrpcRouter } from './trpc/trpc.router';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_URL || 'http://localhost:3000' });

  // Apply tRPC middleware
  const trpcRouter = app.get(TrpcRouter);
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  instance.use('/trpc', (req: any, res: any, next: any) => {
    if (req.method === 'GET' || req.method === 'POST') {
      const path = req.query.path || req.url.split('?')[0].replace('/trpc/', '').replace('/trpc', '');

      if (!path || path === '') {
        return res.json({ ok: true, routes: Object.keys(trpcRouter.appRouter._def.procedures || {}) });
      }

      const parts = path.split('.');
      let procedure: any = trpcRouter.appRouter._def.procedures;
      for (const part of parts) {
        procedure = procedure?.[part];
        if (!procedure) break;
      }

      if (!procedure || typeof procedure !== 'function') {
        return res.status(404).json({ error: { message: `Procedure ${path} not found`, code: 'NOT_FOUND' } });
      }

      const input = req.body || req.query.input;
      const caller = trpcRouter.appRouter.createCaller({});
      const callParts = path.split('.');
      let target: any = caller;
      for (const part of callParts.slice(0, -1)) target = target[part];
      const method = callParts[callParts.length - 1];

      Promise.resolve(target[method](input))
        .then((result: any) => res.json({ result: { data: result } }))
        .catch((err: any) => res.status(500).json({ error: { message: err.message, code: 'INTERNAL_SERVER_ERROR' } }));
    } else {
      next();
    }
  });

  const port = parseInt(process.env.API_PORT || '4000', 10);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
