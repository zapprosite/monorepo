# Smoke Test — list-web-from-zero-to-deploy

Verification checklist apos deploy de uma web app.

## HTTP 200 Check

```bash
curl -sfI https://SUBDOMAIN.zappro.site
```

Esperado: HTTP 200 ou 302 (redirect). Nao "Connection refused".

## OAuth Callback Check

```bash
curl -sfI https://SUBDOMAIN.zappro.site/auth/callback
```

Esperado: HTTP 200 (nginx serve auth-callback.html).

## Session Persists

1. Abrir https://SUBDOMAIN.zappro.site no browser
2. Clicar "Entrar com Google"
3. Fazer login
4. Verificar que session persiste ao recarregar pagina
5. Verificar que logout funciona

## Container Health

```bash
docker inspect --format='{{.State.Health.Status}}' CONTAINER_NAME
```

Esperado: healthy

## Logs Check

```bash
docker compose logs --tail=20
```

Verificar que nao ha erros de nginx ou healthcheck failures.

## No Connection Refused

```bash
curl -v https://SUBDOMAIN.zappro.site 2>&1 | grep -E "(Connection refused|HTTP/|Connected)"
```

Conexao deve mostrar HTTP, nao "Connection refused".

## Content Check

```bash
curl -sf https://SUBDOMAIN.zappro.site | grep -o "<title>.*</title>"
```

Esperado: title correto da app.

## Checklist Final

- [ ] curl -sfI https://SUBDOMAIN.zappro.site → 200 ou 302
- [ ] curl -sfI https://SUBDOMAIN.zappro.site/auth/callback → 200
- [ ] Container health: healthy
- [ ] OAuth flow: login funciona
- [ ] Session persiste apos reload
- [ ] Logout funciona
- [ ] Logs sem erros