import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TrpcRouter } from './trpc/trpc.router';
import { EquipamentosService } from './equipamentos/equipamentos.service';

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

// RG HTML renderer
function statusLabel(s: string) {
  const map: Record<string, string> = { ativo: 'Ativo', em_manutencao: 'Em Manutenção', inativo: 'Inativo' };
  return map[s] ?? s;
}
function typeLabel(t: string) {
  const map: Record<string, string> = {
    ar_condicionado: 'Ar Condicionado', refrigerador: 'Refrigerador', freezer: 'Freezer',
    split: 'Split', janela: 'Janela', de_chao: 'De Chão', portatil: 'Portátil', outro: 'Outro',
  };
  return map[t] ?? t;
}
function statusColor(s: string) {
  const map: Record<string, string> = { ativo: '#22c55e', em_manutencao: '#f59e0b', inativo: '#6b7280' };
  return map[s] ?? '#6b7280';
}

function rgHtml(eq: any): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RG — ${eq.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #1e293b; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 640px; width: 100%; overflow: hidden; }
  .header { background: linear-gradient(135deg, #1e3a5f, #2d6a9f); color: #fff; padding: 2rem; display: flex; align-items: center; gap: 1.5rem; }
  .header-icon { width: 64px; height: 64px; background: rgba(255,255,255,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
  .header-text h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
  .header-text p { opacity: 0.8; font-size: 0.875rem; }
  .badge { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.875rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; color: #fff; }
  .body { padding: 2rem; display: flex; flex-direction: column; gap: 0; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; padding: 1rem 0; border-bottom: 1px solid #f1f5f9; }
  .row:last-child { border-bottom: none; }
  .row.full { grid-template-columns: 1fr; }
  .field-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; margin-bottom: 0.25rem; }
  .field-value { font-size: 1rem; font-weight: 500; color: #334155; }
  .field-value.mono { font-family: 'Courier New', monospace; font-size: 0.9rem; }
  .field-value.empty { color: #cbd5e1; font-style: italic; }
  .footer { background: #f8fafc; padding: 1rem 2rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
  .footer span { font-size: 0.75rem; color: #94a3b8; }
  .watermark { position: fixed; bottom: 1.5rem; right: 2rem; font-size: 0.7rem; color: #cbd5e1; font-weight: 600; letter-spacing: 0.05em; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="header-icon">❄️</div>
    <div class="header-text">
      <h1>${eq.name}</h1>
      <p>Registro de Equipamento — ${typeLabel(eq.type)}</p>
    </div>
    <div style="margin-left: auto;">
      <div class="badge" style="background: ${statusColor(eq.status)};">
        ● ${statusLabel(eq.status)}
      </div>
    </div>
  </div>
  <div class="body">
    <div class="row">
      <div>
        <div class="field-label">ID</div>
        <div class="field-value mono">${eq.id}</div>
      </div>
      <div>
        <div class="field-label">Subdomínio</div>
        <div class="field-value mono">${eq.subdomain}</div>
      </div>
    </div>
    <div class="row">
      <div>
        <div class="field-label">Número de Série</div>
        <div class="field-value mono">${eq.serialNumber || '<span class="empty">Não informado</span>'}</div>
      </div>
      <div>
        <div class="field-label">Tipo</div>
        <div class="field-value">${typeLabel(eq.type)}</div>
      </div>
    </div>
    <div class="row">
      <div>
        <div class="field-label">Marca</div>
        <div class="field-value">${eq.brand || '<span class="empty">Não informada</span>'}</div>
      </div>
      <div>
        <div class="field-label">Modelo</div>
        <div class="field-value">${eq.model || '<span class="empty">Não informado</span>'}</div>
      </div>
    </div>
    <div class="row">
      <div>
        <div class="field-label">Data de Instalação</div>
        <div class="field-value">${eq.installationDate || '<span class="empty">Não informada</span>'}</div>
      </div>
      <div>
        <div class="field-label">Criado em</div>
        <div class="field-value">${new Date(eq.createdAt).toLocaleDateString('pt-BR')}</div>
      </div>
    </div>
    ${eq.notes ? `
    <div class="row full">
      <div>
        <div class="field-label">Observações</div>
        <div class="field-value" style="white-space: pre-wrap;">${eq.notes}</div>
      </div>
    </div>` : ''}
  </div>
  <div class="footer">
    <span>CRM HVAC-R · ${new Date().toLocaleDateString('pt-BR')}</span>
    <span>${eq.subdomain}</span>
  </div>
</div>
<div class="watermark">CRM HVAC-R</div>
</body>
</html>`;
}

function rgNotFoundHtml(id: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Equipamento não encontrado</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #1e293b; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 480px; width: 100%; padding: 3rem 2rem; text-align: center; }
  .icon { font-size: 3rem; margin-bottom: 1rem; }
  h1 { font-size: 1.25rem; color: #334155; margin-bottom: 0.5rem; }
  p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; }
  code { background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; color: #64748b; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">🔍</div>
  <h1>Equipamento não encontrado</h1>
  <p>O equipamento com ID <code>${id}</code> não foi localizado.</p>
</div>
</body>
</html>`;
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
  app.enableCors({
    origin: '*',
    methods: 'GET',
    allowedHeaders: '*',
  });

  // Cookie parser middleware
  app.use((req: any, _res: any, next: any) => {
    req.cookies = parseCookies(req.headers?.cookie);
    next();
  });

  // Apply tRPC middleware
  const trpcRouter = app.get(TrpcRouter);
  const equipamentosService = app.get(EquipamentosService);
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

  // Static PDF files — serve /data/os/** at /pdfs/**
  // make-pdf skill saves PDFs to /data/os/<year>/<month>/os-<id>.pdf
  instance.use('/pdfs', (req: any, res: any, next: any) => {
    if (req.method !== 'GET') return next();
    // Strip /pdfs prefix and map to /data
    const filePath = req.path;
    const fs = require('fs');
    const safePath = filePath.replace(/\.\./g, '').replace(/^\//, '');
    const fullPath = `/data/${safePath}`;
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return res.sendFile(fullPath);
    }
    res.status(404).json({ error: 'PDF not found' });
  });

  // Public GET /equip/:id — renders RG HTML
  instance.get('/equip/:id', async (req: any, res: any) => {
    const { id } = req.params;
    try {
      const eq = await equipamentosService.findOne(id);
      if (!eq) return res.status(404).type('text/html').send(rgNotFoundHtml(id));
      res.type('text/html').send(rgHtml(eq));
    } catch (err: any) {
      res.status(500).type('text/html').send(`<html><body><h1>Erro</h1><p>${err.message}</p></body></html>`);
    }
  });

  const port = parseInt(process.env.API_PORT || '4000', 10);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
