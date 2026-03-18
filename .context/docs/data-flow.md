---
type: doc
name: data-flow
description: How data moves through the system and external integrations
category: data-flow
generated: 2026-03-16
updated: 2026-03-17
status: active
scaffoldVersion: "2.0.0"
---
## Data Flow & Integrations

## Fluxo tRPC (Frontend ↔ Backend)

Toda comunicação interna usa tRPC via HTTP POST para `/trpc/*`:

```
Browser (React 19)
  └── trpc.client.ts (TanStack Query)
        └── HTTP POST /trpc/[procedure]
              └── Fastify :4000
                    ├── Session check (@fastify/session → PostgreSQL sessions table)
                    ├── isAuthenticated middleware (ctx.user.userId)
                    ├── centralTrpcErrorMiddleware
                    └── tRPC procedure
                          └── Orchid ORM → PostgreSQL :5432
```

**Ciclo de vida de uma mutation tRPC:**
1. Frontend chama `trpc.[module].[procedure].mutate(input)`
2. TanStack Query serializa input e faz POST para `/trpc/[module].[procedure]`
3. Fastify valida sessão via `@fastify/session` (banco de dados)
4. Middleware `isAuthenticated` verifica `ctx.user.userId`
5. Procedure executa lógica de negócio via Orchid ORM
6. Resultado retorna como JSON; TanStack Query atualiza cache

## Fluxo REST/API Gateway (Clientes Externos)

Produtos externos acessam via `GET/POST /api/v1/*`:

```
External Client
  └── REST /api/v1/[endpoint]
        └── Fastify :4000
              └── API Gateway middleware chain (em ordem):
                    1. apiKeyAuthHook      — valida x-api-key + x-team-id → attach team
                    2. corsValidationHook  — valida origin vs team.allowedDomains
                    3. whitelistCheckHook  — valida IP vs team.allowedIps
                    4. teamRateLimitHook   — enforça team.rateLimitPerMinute
                    5. subscriptionCheckHook — verifica quota ativa
                    6. requestLoggerHook   — loga em api_product_request_logs
                          └── Handler → Orchid ORM → PostgreSQL
```

## Fluxo OAuth2 (Autenticação)

```
Browser
  └── GET /oauth2/google
        └── Redirect → Google OAuth2
              └── Callback → /oauth2/callback
                    ├── Troca code por tokens Google
                    ├── setSession(request, { email, name, displayPicture, userId })
                    │     ├── Persiste em PostgreSQL (sessions table)
                    │     └── Captura IP, user agent, device fingerprint
                    └── Redirect → frontend (isRegistered ? dashboard : register)
```

**Estados de sessão:**
- `hasSession: false` → usuário não autenticado
- `hasSession: true, isRegistered: false` → OAuth OK, mas sem `userId` (novo usuário)
- `hasSession: true, isRegistered: true` → autenticado e registrado

## Fluxo de Webhook (Async)

```
subscriptionCheckHook detecta 90% de quota
  └── Enfileira em webhook_call_queue (status: Pending)
        └── Cron → POST /internal/process-webhooks (INTERNAL_API_SECRET)
              └── Lê até 50 webhooks Pending
                    ├── POST team.webhookUrl (Bearer token auth)
                    │     ├── Sucesso → status: Sent
                    │     └── Falha → retry exponencial (máx 3 tentativas)
                    └── status: Failed após 3 erros
```

## Módulos e Dependências

| Módulo | Tabelas | Dependências |
|--------|---------|--------------|
| `auth` | `sessions` | `@fastify/session`, Google OAuth2 |
| `users` | `users` | `auth` (userId da sessão) |
| `teams` | `teams`, `team_members` | `users` |
| `subscriptions` | `subscriptions` | `teams`, `enums.zod` (API_PRODUCTS) |
| `journal-entries` | `journal_entries` | `users` (authorUserId) |
| `api-gateway` | `api_product_request_logs`, `webhook_call_queue` | `teams`, `subscriptions` |

## Integrações Externas

| Serviço | Propósito | Auth | Retry |
|---------|-----------|------|-------|
| Google OAuth2 | Autenticação de usuários | OAuth2 Authorization Code | N/A — redirecionamento |
| PostgreSQL :5432 | Banco principal | Credenciais via env vars | Gerenciado pelo Orchid ORM |
| Webhooks de clientes | Alertas de quota (90%) | Bearer token por equipe | Exponencial, máx 3x |

## Observabilidade

- **Health check:** `GET /health` → `{ status: "ok" }`
- **Logs de requisição:** cada chamada à API externa é persistida em `api_product_request_logs` com status, IP, timestamp
- **Session metadata:** IP, user agent, browser, OS, device fingerprint por sessão
- **OpenTelemetry:** integrado no backend (ver `DEPLOYMENT.md`)
- **Swagger UI:** `GET /api/documentation` — documentação live das rotas externas

## Related Resources

- [architecture.md](./architecture.md)
- [security.md](./security.md)
