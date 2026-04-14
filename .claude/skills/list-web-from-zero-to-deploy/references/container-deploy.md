# Container Deploy — list-web-from-zero-to-deploy

Docker build e deploy steps para web apps estaticas com nginx.

## Build

```bash
docker compose build
```

O Dockerfile usa nginx:alpine com usuario nao-root.

## Deploy

```bash
docker compose up -d
docker compose logs -f
docker compose ps
```

## Verificar Health

```bash
docker inspect --format='{{.State.Health.Status}}' CONTAINER_NAME
```

Esperado: healthy

## Non-Root User

O container usa usuario nginxapp (uid 1001) em vez de root. Isso e importante para security e compatibilidade com Coolify.

## Environment Variables

```yaml
services:
  app-name:
    environment:
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
```

O app usa env.js para injetar secrets (syncados do Infisical para .env).

## Ports

A porta e exposta em 127.0.0.1:PORT:80 — apenas localhost. O acesso externo via Cloudflare Tunnel vai para o IP do container.

## Volumes

```yaml
volumes:
  app-name-cache:
```

Persiste o nginx cache em /var/cache/nginx.

## Runtime Injection

O index.html usa window.__ENV__ para runtime injection do GOOGLE_CLIENT_ID — mais flexivel que build args.