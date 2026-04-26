# Security Review — 2026-04-26

**Agent:** security-reviewer
**Scope:** apps/api, apps/ai-gateway, scripts/, vibe-kit/, AGENTS.md, CLAUDE.md
**Rate Limit:** 500 RPM

---

## Findings

### CRITICAL

1. **[C-01] Dev auth bypass expõe sessão no ambiente production** — `apps/api/src/trpc.ts:17-26`
   - `extractDevUser()` lê header `X-Dev-User` e cria sessão sem validação
   - `isDev` flag pode ser setada via `NODE_ENV=development` em produção
   - **Risk:** Se deployed com `isDev=true`, qualquer pessoa pode definir `X-Dev-User: admin@zappro.site` e obter acesso
   - **Fix:** Verificar que `isDev` só é `true` quando `NODE_ENV === 'development'` E `process.env.ALLOWED_DEV_IPS` inclui o IP do cliente

2. **[C-02] CORS `origin: true` em ai-gateway permite qualquer origem** — `apps/ai-gateway/src/index.ts:23`
   - `await app.register(cors, { origin: true });` permite CORS de qualquer domínio
   - **Risk:** CSRF attacks, consumo não autorizado da API por domínios maliciosos
   - **Fix:** Usar whitelist de origens permitidas via `process.env.ALLOWED_ORIGINS`

### HIGH

3. **[H-01] Rate limiter em memória não funciona em multi-server** — `apps/api/src/modules/api-gateway/middleware/teamRateLimit.middleware.ts:6`
   - `new Map<string, RateLimiterMemory>()` guarda estado em memória local
   - **Risk:** Em load-balanced setup, cada server tem limite independente — bypass fácil
   - **Fix:** Usar `RateLimiterRedis` com Redis partilhado

4. **[H-02] Rate limiter ai-gateway inexistente** — `apps/ai-gateway/src/routes/chat.ts`
   - Não existe rate limiting no ai-gateway (LiteLLM proxy facade)
   - **Risk:** Bypass do rate limit da API através do gateway
   - **Fix:** Adicionar `rate-limiter-flexible` com Redis backend

5. **[H-03] `dev-user-placeholder` userId em bypass** — `apps/api/src/middlewares/dev-auth-bypass.ts:60,68`
   - `userId: "dev-user-placeholder"` — qualquer bypass получит userId fictício
   - **Risk:** IDOR se código confiar neste userId para authorization
   - **Fix:** Em dev, usar userId de um dev user real da DB ou invalidar completamente

6. **[H-04] Health endpoint sem autenticação em ai-gateway** — `apps/ai-gateway/src/index.ts:37`
   - `/health` é público mas pode expor métricas internas
   - **Risk:** Information disclosure em produção
   - **Fix:** Retornar apenas `{ status: 'ok' }` sem detalhes de serviço

### MEDIUM

7. **[M-01] Preflight CORS sem validação de API key** — `apps/api/src/modules/api-gateway/middleware/corsValidation.middleware.ts:17-34`
   - OPTIONS requests não validam API key, apenas teamId existe
   - **Risk:** Team enumeration via preflight requests
   - **Fix:** Manter como está (optimização legítima), mas logging de preflights

8. **[M-02] IP whitelist usa `request.ip` que pode ser spoofed** — `apps/api/src/utils/request-metadata.utils.ts:30`
   - `return request.ip || "unknown"` — se não houver proxy, usa IP direto
   - **Risk:** Se aplicacao estar atras de proxy mal configurado, IP real pode ser bypassed
   - **Fix:** Asegurar que `trustProxy` está configurado corretamente no Fastify

9. **[M-03] PT-BR filter sem timeout fallback no cache** — `apps/ai-gateway/src/middleware/ptbr-filter.ts:12`
   - `PTBR_MODEL` sem fallback — se não setado, API vai falhar silenciosamente
   - **Risk:** Prod deploy sem `PTBR_FILTER_MODEL` causa falhas em cascata
   - **Fix:** Fail-fast startup check como em `ai-gateway/src/middleware/auth.ts:11-14`

10. **[M-04] Audio transcription não valida tamanho do ficheiro** — `apps/ai-gateway/src/routes/audio-transcriptions.ts:148-160`
    - `body.length === 0` check existe, mas não hay limite máximo
    - **Risk:** DoS via upload de ficheiros massivos
    - **Fix:** Adicionar `bodyLimit` no Fastify e validar `fileBytes.length < MAX_AUDIO_SIZE`

11. **[M-05] Device fingerprint fraco para sessão** — `apps/api/src/utils/request-metadata.utils.ts:67-112`
    - Fingerprint usa headers que podem ser spoofados (User-Agent, sec-ch-ua)
    - **Risk:** Session hijacking se attacker conhecer headers do victim
    - **Fix:** Considerar adicionar fatores adicionais (canvas fingerprint, WebGL)

### LOW

12. **[L-01] `use-uuid` não verificado em tRPC inputs** — `apps/api/src/modules/*/`
    - Alguns inputs usam `z.string()` em vez de `z.uuid()` para IDs
    - **Risk:** Data access se UUIDs puderem ser enumerados
    - **Fix:** Usar UUID validation com Zod

13. **[L-02] Logs podem conter PII** — `apps/api/src/modules/api-gateway/handlers/save_journal_entry.handler.ts:51-59`
    - `request.log.info({ prompt, content, ... })` pode logging conteúdo sensível
    - **Fix:** Sanitizar logs ou usar structured logging com PII redaction

---

## OWASP Top 10 Checklist

| ID | Category | Status |
|----|----------|--------|
| A01 | Injection | ✅ Pass — ORM parameterised queries |
| A02 | Broken Auth | ⚠️ Partial — dev bypass risco |
| A03 | XSS | ✅ Pass — API não renderiza HTML |
| A04 | IDOR | ⚠️ Partial — UUID enumeration possível |
| A05 | Security Misconfig | ⚠️ Partial — CORS permissivo |
| A06 | Vulnerable Components | ✅ Pass — dependências auditadas |
| A07 | Auth Failures | ✅ Pass — rate limiting existe |
| A08 | Data Integrity | ✅ Pass — timestamps, validação |
| A09 | SSRF | ✅ Pass — sem fetch dinâmico de URLs |
| A10 | Logging Failures | ⚠️ Partial — PII em logs |

**OWASP Compliance: 70%**

---

## Summary

```
CRITICAL:  2
HIGH:      4
MEDIUM:    5
LOW:       2
TOTAL:     13
```

## Top Recommendations

1. **C-01 + C-02:** Fix dev auth bypass — maior risco de produção
2. **H-01 + H-02:** Implementar rate limiting com Redis backend
3. **H-04:** Proteger `/health` endpoint do ai-gateway
4. **M-03:** Adicionar fail-fast para `PTBR_FILTER_MODEL`

---

*Report generated by security-reviewer agent — 2026-04-26*
