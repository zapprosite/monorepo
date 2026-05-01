import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TrpcRouter } from './trpc/trpc.router';

// Simple cookie parser without extra dependency
function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  header.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    if (name && rest.length > 0) cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
  });
  return cookies;
}

// Minimal JSON body parser for raw Express middleware
function jsonBodyParser(req: any, res: any, next: any) {
  if (req.method !== 'POST' || req.headers['content-type']?.indexOf('application/json') === -1) {
    return next();
  }
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk: string) => { data += chunk; });
  req.on('end', () => {
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch {
      req.body = {};
    }
    next();
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3080',
    credentials: true,
  });

  // Cookie parser middleware
  app.use((req: any, _res: any, next: any) => {
    req.cookies = parseCookies(req.headers?.cookie);
    next();
  });

  // Apply tRPC middleware
  const trpcRouter = app.get(TrpcRouter);
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  instance.use('/trpc', jsonBodyParser, (req: any, res: any, next: any) => {
    if (req.method === 'GET' || req.method === 'POST') {
      // Support both GET ?path=...&input=... and POST { path, input }
      const path = req.body?.path || req.query.path || req.url.split('?')[0].replace(/^\/trpc\/?/, '').replace(/^\//, '');

      if (!path || path === '') {
        return res.json({ ok: true, routes: Object.keys(trpcRouter.appRouter._def.procedures || {}) });
      }

      const input = req.body?.input ?? req.body ?? req.query.input;
      const caller = trpcRouter.appRouter.createCaller({});
      const callParts = path.split('.');
      let target: any = caller;
      for (const part of callParts.slice(0, -1)) {
        target = target?.[part];
        if (!target) break;
      }
      const method = callParts[callParts.length - 1];

      if (!target || typeof target[method] !== 'function') {
        return res.status(404).json({ error: { message: `Procedure ${path} not found`, code: 'NOT_FOUND' } });
      }

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
