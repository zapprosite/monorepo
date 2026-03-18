---
type: doc
name: security
description: Security policies, authentication, secrets management, and compliance requirements
category: security
generated: 2026-03-16
updated: 2026-03-17
status: active
scaffoldVersion: "2.0.0"
---
## Security & Compliance Notes

## Autenticação

**Google OAuth2 + Database Sessions:**
- Usuário autentica via Google OAuth2 (Authorization Code Flow)
- Após callback, sessão é criada e persistida no PostgreSQL (não em memória)
- Sessões expiram em **7 dias** (`markedInvalidAt` para soft-delete)
- Logout gera novo session ID via `session.regenerate()` — invalida a sessão anterior no banco

**Estado de autenticação:**
```
hasSession: false            → não autenticado
hasSession: true, !userId    → OAuth OK, ainda não registrado
hasSession: true, userId     → autenticado e registrado (acesso pleno)
```

**Session security middleware** (`sessionSecurity.middleware.ts`):
- Valida device fingerprint + IP
- Modo `MODERATE` em procedures normais; modo `STRICT` em `sensitiveProcedure`
- Ação `block` → TRPCError `FORBIDDEN` + logout implícito

## Autorização

| Procedure Type | Requisito |
|----------------|-----------|
| `publicProcedure` | Nenhum — acessível sem autenticação |
| `protectedProcedure` | `ctx.user.userId` presente → `UNAUTHORIZED` se ausente |
| `sensitiveProcedure` | `protectedProcedure` + session security `STRICT` |

**API Gateway** (rotas externas `/api/v1/*`):
- `x-api-key` + `x-team-id` headers obrigatórios
- API key validada contra hash scrypt no banco — nunca comparada em plaintext
- Origin validado contra `team.allowedDomains` (CORS por equipe)
- IP validado contra `team.allowedIps` (whitelist por equipe)
- Rate limit por equipe via `team.rateLimitPerMinute`

## Rate Limiting

| Camada | Limite | Middleware |
|--------|--------|-----------|
| Global (Fastify) | 2 req/s, burst 5/10s em produção | `@fastify/rate-limit` |
| tRPC `moderateRateLimit` | 20 req/min, burst 5/2min por IP | `rate-limiter-flexible` |
| tRPC `strictRateLimit` | 5 req/min, burst 2/5min por IP | `rate-limiter-flexible` |
| `404` handler | Rate mais restrito | Fastify hook |
| API Gateway por equipe | `team.rateLimitPerMinute` | `teamRateLimitHook` |

## Gerenciamento de Secrets

**Variáveis de ambiente obrigatórias** (definidas via `env.config.ts` + Zod):

| Variável | Uso | Mínimo |
|----------|-----|--------|
| `SESSION_SECRET` | Assinar cookies de sessão | 32 chars |
| `INTERNAL_API_SECRET` | Autenticar rotas internas (`/internal/*`) | 32 chars |
| `GOOGLE_CLIENT_ID` | OAuth2 app ID | — |
| `GOOGLE_CLIENT_SECRET` | OAuth2 app secret | — |
| `DB_PASSWORD` | Acesso ao PostgreSQL | — |

**Regras:**
- Nunca commitar `.env` — use `.env.example` como template
- API keys armazenadas como hash scrypt (nunca plaintext)
- `subscriptionAlertWebhookBearerToken` omitido de responses via `.omit()` no schema Zod
- `apiSecretHash` omitido de responses via `.omit()` no schema Zod

## CORS

- **Global:** `fastify-cors` permite todas as origens (necessário para Swagger UI)
- **Por equipe:** `corsValidationHook` valida `Origin` contra `team.allowedDomains`
- Preflight `OPTIONS` é tratado explicitamente pela chain de middleware
- tRPC não usa CORS separado — servido pelo mesmo Fastify

## Dados Sensíveis

| Dado | Proteção |
|------|---------|
| Senhas / API keys | Hashed (scrypt) — nunca armazenadas em plaintext |
| Session tokens | DB-backed + HTTP-only cookie |
| Device fingerprint | Armazenado para detecção de anomalias, não para tracking |
| Dados de pagamento | Não processados internamente — delegados a gateway externo |
| Logs de API | Armazenados sem payload completo (somente status/IP/timestamp) |

## Proteção de Rotas Internas

- `POST /internal/process-webhooks` exige header `Authorization: Bearer $INTERNAL_API_SECRET`
- Sem esse header → `401 Unauthorized`
- Rota não é exposta via Swagger UI (prefixo `/internal/`)

## Observações de Compliance

- Licença: **AGPL-3.0-only** — modificações devem ser open source se o software for servido
- Sessões com device fingerprint estão sujeitas a políticas de privacidade (LGPD/GDPR se aplicável)
- Logs de request não armazenam payload completo — apenas metadados

## Related Resources

- [architecture.md](./architecture.md)
- [data-flow.md](./data-flow.md)
