# API Rules

## Stack
- Fastify + tRPC (internal) + REST/OpenAPI (external)
- Orchid ORM + PostgreSQL
- Zod validation

## DB Rules
- Use DB time for dates (not JS Date)
- No manual migrations: `yarn db g <name>`
- snake_case columns via Orchid ORM
- Descriptive IDs: `userId`, not `id`
- Add indexes for frequent queries

## API Architecture
- tRPC: frontend ↔ backend (type-safe)
- REST/OpenAPI: external APIs (Swagger at /api/documentation)

## OpenAPI Pattern
```typescript
app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
  method: "POST",
  url: "/v1/resource",
  schema: { body: inputZod, response: { 201: responseZod } },
  handler: async (req, reply) => { }
});
```

## Middleware Chain
1. apiKeyAuth (x-api-key + x-team-id)
2. corsValidation (team.allowedDomains)
3. whitelistCheck (IP whitelist)
4. rateLimit (team.rateLimitPerMinute)
5. subscriptionCheck (quota)
6. requestLogger

## Session
- Database-backed via DatabaseSessionStore
- Soft-delete: `markedInvalidAt`
- 7-day expiry

## Adding Features

**New API endpoint:**
1. Define Zod schemas in @connected-repo/zod-schemas
2. Create handler in modules/api-gateway/handlers/
3. Add route in api-gateway.router.ts

**New DB table:**
1. Create in modules/<feature>/tables/<entity>.table.ts
2. Define Zod schemas in @connected-repo/zod-schemas
3. Register in db/db.ts
4. Run `yarn db g <name>` then `yarn db up`

**New tRPC endpoint:**
1. Import schema from @connected-repo/zod-schemas
2. Add to modules/<feature>/<feature>.trpc.ts
3. Register in routers/trpc.router.ts
4. Use protectedProcedure for auth
