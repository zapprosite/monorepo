#!/usr/bin/env bash
# =============================================================================
# Bootstrap MVP CRM Serviços — Fase 1: Infraestrutura
# SPEC-001 / PLAN-001 / pipeline.json
# =============================================================================
set -euo pipefail

PROJECT_ROOT="/srv/monorepo"
CRM_DIR="$PROJECT_ROOT/crm-mvp"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "═══════════════════════════════════════════════════════════════"
echo "  Bootstrap MVP CRM Serviços — Fase 1: Infraestrutura"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── Verificações prévias ─────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "ERRO: Node.js não instalado"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "AVISO: Docker não encontrado (containers não serão iniciados)"; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "AVISO: Node.js >= 20 recomendado (detectado: $(node -v))"
fi

# ── Limpar/criar diretório ───────────────────────────────────────────────────
if [ -d "$CRM_DIR" ]; then
  echo "[1/6] Diretório crm-mvp existe. Removendo para bootstrap limpo..."
  rm -rf "$CRM_DIR"
fi

mkdir -p "$CRM_DIR"
cd "$CRM_DIR"

# ── 1. Estrutura Nx Monorepo ─────────────────────────────────────────────────
echo "[1/6] Criando estrutura Nx monorepo..."

# package.json raiz
cat > package.json <<'EOF'
{
  "name": "crm-mvp",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "nx run-many -t dev -p api web",
    "build": "nx run-many -t build -p api web",
    "test": "nx run-many -t test -p api web",
    "lint": "nx run-many -t lint -p api web",
    "db:migrate": "cd apps/api && npx typeorm migration:run -d src/data-source.ts",
    "db:seed": "cd apps/api && npx ts-node src/db/seed.ts"
  },
  "devDependencies": {
    "@nx/nest": "^20.0.0",
    "@nx/react": "^20.0.0",
    "@nx/vite": "^20.0.0",
    "@nx/js": "^20.0.0",
    "nx": "^20.0.0",
    "typescript": "^5.6.0"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
EOF

# nx.json
cat > nx.json <<'EOF'
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": ["{workspaceRoot}/tsconfig.base.json"],
    "production": ["default"]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "dev": {
      "dependsOn": ["^build"]
    }
  }
}
EOF

# tsconfig.base.json
cat > tsconfig.base.json <<'EOF'
{
  "compileOnSave": false,
  "compilerOptions": {
    "rootDir": ".",
    "sourceMap": true,
    "declaration": false,
    "moduleResolution": "bundler",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@crm-mvp/ui": ["packages/ui/src/index.ts"],
      "@crm-mvp/trpc": ["packages/trpc/src/index.ts"],
      "@crm-mvp/schemas": ["packages/zod-schemas/src/index.ts"]
    }
  },
  "exclude": ["node_modules", "tmp"]
}
EOF

# .gitignore
cat > .gitignore <<'EOF'
node_modules
dist
.tmp
.env
*.log
.DS_Store
coverage
.vscode/*
!.vscode/extensions.json
.idea
EOF

mkdir -p apps packages

# ── 2. App API (NestJS) ──────────────────────────────────────────────────────
echo "[2/6] Scaffold app API (NestJS)..."

mkdir -p apps/api/src/{auth,trpc,entities,dashboard,leads,clients,schedule,contracts,reminders,db}
mkdir -p apps/api/test

cat > apps/api/project.json <<'EOF'
{
  "name": "api",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/api/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@nx/nest:build",
      "options": {
        "outputPath": "dist/apps/api"
      }
    },
    "serve": {
      "executor": "@nx/nest:serve",
      "options": {
        "port": 4000
      }
    },
    "test": {
      "executor": "@nx/jest:jest"
    }
  }
}
EOF

cat > apps/api/package.json <<'EOF'
{
  "name": "@crm-mvp/api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "nx build",
    "dev": "nx serve",
    "test": "nx test"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "@trpc/server": "^11.0.0",
    "zod": "^3.23.0",
    "typeorm": "^0.3.20",
    "pg": "^8.12.0",
    "ioredis": "^5.4.0",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/config": "^3.2.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/testing": "^10.0.0",
    "@types/node": "^20.0.0",
    "@types/passport-google-oauth20": "^2.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.6.0"
  }
}
EOF

cat > apps/api/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/apps/api",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

cat > apps/api/src/main.ts <<'EOF'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_URL || 'http://localhost:3000' });
  await app.listen(process.env.API_PORT || 4000);
  console.log(`API running on http://localhost:${process.env.API_PORT || 4000}`);
}
bootstrap();
EOF

cat > apps/api/src/app.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { TrpcModule } from './trpc/trpc.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'crm',
      password: process.env.DB_PASSWORD || 'crm',
      database: process.env.DB_NAME || 'crm_mvp',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    TrpcModule,
  ],
})
export class AppModule {}
EOF

# ── 3. App Web (React + Vite) ────────────────────────────────────────────────
echo "[3/6] Scaffold app Web (React 19 + Vite)..."

mkdir -p apps/web/src/{pages,modules/{auth,leads,clients,schedule,contracts,reminders},components,utils,hooks,styles}
mkdir -p apps/web/public

cat > apps/web/project.json <<'EOF'
{
  "name": "web",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/web/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "options": {
        "outputPath": "dist/apps/web"
      }
    },
    "dev": {
      "executor": "@nx/vite:dev-server",
      "options": {
        "port": 3000
      }
    },
    "test": {
      "executor": "@nx/vite:test"
    }
  }
}
EOF

cat > apps/web/package.json <<'EOF'
{
  "name": "@crm-mvp/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "nx build",
    "dev": "nx dev",
    "test": "nx test"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "zod": "^3.23.0",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
EOF

cat > apps/web/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/apps/web",
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

cat > apps/web/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, host: true },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
EOF

cat > apps/web/index.html <<'EOF'
<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CRM MVP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
EOF

cat > apps/web/src/main.tsx <<'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from './utils/trpc';
import App from './App';
import './styles/globals.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);
EOF

cat > apps/web/src/App.tsx <<'EOF'
import { Routes, Route } from 'react-router-dom';
import LoginPage from './modules/auth/Login.page';
import DashboardPage from './pages/Dashboard.page';

function App() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/" element={<DashboardPage />} />
    </Routes>
  );
}

export default App;
EOF

# ── 4. Tailwind CSS — Dark Mode + Verde Ácido ────────────────────────────────
echo "[4/6] Configurando Tailwind CSS (dark mode + verde ácido)..."

cat > apps/web/tailwind.config.js <<'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A0A0F',
        'bg-secondary': '#12121A',
        'bg-tertiary': '#1A1A25',
        'accent': '#39FF14',
        'accent-dim': '#2ECC71',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0B0',
        'text-muted': '#6B6B7B',
        'danger': '#FF4757',
        'warning': '#FFA502',
        'info': '#1E90FF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'kpi': ['48px', { lineHeight: '1.1', fontWeight: '700' }],
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'input': '8px',
      },
      boxShadow: {
        'glow': '0 0 12px rgba(57, 255, 20, 0.3)',
        'glow-lg': '0 0 24px rgba(57, 255, 20, 0.4)',
      },
    },
  },
  plugins: [],
};
EOF

cat > apps/web/postcss.config.js <<'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF

cat > apps/web/src/styles/globals.css <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html.dark {
    background-color: #0A0A0F;
    color: #FFFFFF;
  }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  .btn-primary {
    @apply bg-accent text-black font-semibold px-4 py-2 rounded-button border border-accent/30;
    @apply hover:shadow-glow transition-all duration-200;
  }
  .btn-outline {
    @apply bg-transparent text-accent font-semibold px-4 py-2 rounded-button border border-accent/30;
    @apply hover:bg-accent/10 transition-all duration-200;
  }
  .card {
    @apply bg-bg-secondary rounded-card border border-white/5 p-6;
  }
  .input {
    @apply bg-bg-tertiary rounded-input border border-white/10 px-4 py-2 text-text-primary;
    @apply focus:border-accent focus:outline-none transition-colors;
    @apply placeholder:text-text-muted;
  }
}
EOF

# ── 5. tRPC Setup ────────────────────────────────────────────────────────────
echo "[5/6] Configurando tRPC (server + client)..."

mkdir -p packages/trpc/src

cat > packages/trpc/package.json <<'EOF'
{
  "name": "@crm-mvp/trpc",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0",
    "zod": "^3.23.0"
  }
}
EOF

cat > packages/trpc/src/index.ts <<'EOF'
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
EOF

# Server router
mkdir -p apps/api/src/trpc
cat > apps/api/src/trpc/trpc.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { TrpcRouter } from './trpc.router';

@Module({
  providers: [TrpcRouter],
  exports: [TrpcRouter],
})
export class TrpcModule {}
EOF

cat > apps/api/src/trpc/trpc.router.ts <<'EOF'
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
EOF

# Client
cat > apps/web/src/utils/trpc.ts <<'EOF'
import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '@crm-mvp/trpc';

export const trpc = createTRPCReact<AppRouter>();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers: () => {
        const devUser = sessionStorage.getItem('dev_user');
        return devUser ? { 'X-Dev-User': devUser } : {};
      },
    }),
  ],
});
EOF

# ── 6. Auth — OAuth2 + Dev Bypass ────────────────────────────────────────────
echo "[6/6] Setup Auth (OAuth2 Google + Dev Bypass)..."

mkdir -p apps/api/src/auth

cat > apps/api/src/auth/auth.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';

@Module({
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
EOF

cat > apps/api/src/auth/auth.service.ts <<'EOF'
import { Injectable } from '@nestjs/common';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

@Injectable()
export class AuthService {
  private readonly devUsers: Record<string, User> = {
    'dev@crm.local': {
      id: 'dev-001',
      email: 'dev@crm.local',
      name: 'Dev User',
    },
  };

  async validateDevUser(email: string): Promise<User | null> {
    return this.devUsers[email] || null;
  }

  async getSessionInfo(userId: string): Promise<User | null> {
    return Object.values(this.devUsers).find(u => u.id === userId) || null;
  }
}
EOF

cat > apps/api/src/auth/dev-auth.middleware.ts <<'EOF'
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

export interface RequestWithUser extends Request {
  user?: { id: string; email: string; name: string };
}

@Injectable()
export class DevAuthMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    const devUserHeader = req.headers['x-dev-user'] as string;
    if (devUserHeader) {
      const user = await this.authService.validateDevUser(devUserHeader);
      if (user) {
        req.user = user;
      }
    }
    next();
  }
}
EOF

# Login page
cat > apps/web/src/modules/auth/Login.page.tsx <<'EOF'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('dev@crm.local');

  const handleDevLogin = () => {
    sessionStorage.setItem('dev_user', email);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="card w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">CRM MVP</h1>
          <p className="text-text-secondary mt-2">Login de desenvolvimento</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Email dev</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
            />
          </div>

          <button onClick={handleDevLogin} className="btn-primary w-full">
            Entrar como Dev
          </button>
        </div>

        <p className="text-xs text-text-muted text-center">
          OAuth2 Google será implementado na Fase 2
        </p>
      </div>
    </div>
  );
}
EOF

# Dashboard placeholder
cat > apps/web/src/pages/Dashboard.page.tsx <<'EOF'
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-text-secondary mt-4">Bem-vindo ao CRM MVP!</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="card">
          <p className="text-text-muted text-sm">Clientes</p>
          <p className="text-kpi text-accent mt-2">0</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">Leads Ativos</p>
          <p className="text-kpi text-accent mt-2">0</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">Contratos</p>
          <p className="text-kpi text-accent mt-2">0</p>
        </div>
      </div>
    </div>
  );
}
EOF

# ── 7. Docker Compose ────────────────────────────────────────────────────────
echo "[Extra] Configurando Docker Compose..."

cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: crm-postgres
    environment:
      POSTGRES_DB: crm_mvp
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: ${DB_PASSWORD:-crm}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crm -d crm_mvp"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: crm-redis
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: crm-api
    environment:
      NODE_ENV: production
      API_PORT: 4000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: crm
      DB_PASSWORD: ${DB_PASSWORD:-crm}
      DB_NAME: crm_mvp
      REDIS_URL: redis://redis:6379
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: crm-web
    environment:
      VITE_API_URL: http://localhost:4000
    ports:
      - "3000:3000"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
EOF

# Dockerfiles
mkdir -p apps/api apps/web

cat > apps/api/Dockerfile <<'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm nx build api

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist/apps/api ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 4000
CMD ["node", "dist/main.js"]
EOF

cat > apps/web/Dockerfile <<'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm nx build web

FROM nginx:alpine
COPY --from=builder /app/dist/apps/web /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
EOF

mkdir -p apps/web
cat > apps/web/nginx.conf <<'EOF'
server {
  listen 3000;
  server_name localhost;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /trpc {
    proxy_pass http://api:4000/trpc;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
EOF

# ── 8. Variáveis de ambiente ─────────────────────────────────────────────────
cat > .env.example <<'EOF'
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=crm
DB_PASSWORD=crm
DB_NAME=crm_mvp

# Redis
REDIS_URL=redis://localhost:6379

# API
API_PORT=4000
NODE_ENV=development

# Web
VITE_API_URL=http://localhost:4000
WEB_URL=http://localhost:3000

# OAuth2 Google (opcional na Fase 1)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
EOF

# ── 9. README inicial ────────────────────────────────────────────────────────
cat > README.md <<'EOF'
# CRM MVP — Serviços Técnicos

Dark mode + verde ácido. Stack: React 19 + NestJS + tRPC + PostgreSQL + Redis.

## Quick Start

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir banco de dados
docker compose up -d postgres redis

# 3. Copiar env
cp .env.example .env

# 4. Rodar migrations (quando existirem)
pnpm db:migrate

# 5. Dev mode
pnpm dev
```

## Estrutura

```
apps/
  api/    — NestJS + tRPC + TypeORM
  web/    — React 19 + Vite + Tailwind
packages/
  trpc/   — Tipos e router compartilhados
```

## Fases

- [x] Fase 1: Infraestrutura (este commit)
- [ ] Fase 2: Banco de dados
- [ ] Fase 3: UI Components
- [ ] Fase 4: Módulos Core
- [ ] Fase 5: Testes + Deploy
EOF

# ── Finalização ──────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Bootstrap Fase 1 COMPLETO"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Estrutura criada em: $CRM_DIR"
echo ""
tree -L 2 "$CRM_DIR" 2>/dev/null || find "$CRM_DIR" -maxdepth 2 -type d | sort
echo ""
echo "Próximo passo: pnpm install && pnpm dev"
echo ""
