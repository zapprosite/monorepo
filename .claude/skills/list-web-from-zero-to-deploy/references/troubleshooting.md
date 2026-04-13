# Troubleshooting — list-web-from-zero-to-deploy

Erros comuns e solucoes para web apps com OAuth, nginx e tunnel.

## Connection Refused

### Sintoma
```
curl: (7) Failed to connect to SUBDOMAIN.zappro.site port 443: Connection refused
```

### Causas Possiveis

1. **IP errado em variables.tf**
   - Verificar IP do container:
     ```bash
     docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' CONTAINER_NAME
     ```
   - Corrigir url em variables.tf: `http://10.0.X.X:PORT`

2. **Container nao esta rodando**
   ```bash
   docker compose ps
   docker compose up -d
   ```

3. **Porta errada no compose**
   - Verificar mapping: `127.0.0.1:PORT:80`
   - Verificar que PORT bate com o terraform

4. **Tunnel nao propagou**
   - Aguardar 1-2 min apos terraform apply
   - Verificar: `curl -sfI https://SUBDOMAIN.zappro.site`

## Nginx 404

### Sintoma
```
404 Not Found no browser
```

### Causas

1. **try_files configurado incorretamente**
   - nginx.conf deve ter:
     ```nginx
     location = /auth/callback {
         try_files /auth-callback.html =404;
     }
     ```

2. **Arquivo auth-callback.html nao existe no container**
   - Verificar que o arquivo esta no build context
   - Verificar Dockerfile: `COPY --chown=nginxapp:nginxapp . /usr/share/nginx/html/`

3. **SPA fallback nao funciona**
   - Verificar: `try_files $uri $uri/ /index.html;`

## OAuth 302 Loop

### Sintoma
Browser entra em loop de redirects no callback.

### Causas

1. **Session key mismatch**
   - index.html usa `list_web_session`
   - auth-callback.html usa `app_session`
   - Corrigir para usar mesmo sessionKey em ambos

2. **Callback nao processa code**
   - Verificar que auth-callback.html recebe `?code=`
   - Verificar console do browser para erros

## Session Nao Persiste

### Sintoma
Apos login, session nao e encontrada ao recarregar.

### Causas

1. **localStorage inacessivel**
   - Verificar que nao ha erro de cross-origin
   - Verificar console do browser

2. **Session exp expired**
   - Verificar que exp esta no futuro
   - Log: `Date.now() / 1000 > session.exp`

3. **Session key diferente**
   - Verificar mesmo sessionKey em index.html e auth-callback.html

## Healthcheck Failing

### Sintoma
```
docker inspect --format='{{.State.Health.Status}}' CONTAINER_NAME
# unhealthy
```

### Causas

1. **nginx nao iniciou**
   ```bash
   docker compose logs
   ```

2. **wget retorno diferente de 0**
   - healthcheck: `CMD wget --no-verbose --tries=1 --spider http://localhost/`
   - Testar manualmente: `wget --no-verbose --tries=1 --spider http://localhost/`

3. **Porta 80 nao respondendo dentro do container**
   ```bash
   docker exec CONTAINER_NAME wget --no-verbose --tries=1 --spider http://localhost/
   ```

## GOOGLE_CLIENT_ID Placeholder

### Sintoma
App mostra "GOOGLE_CLIENT_ID nao configurado"

### Causas

1. **window.__ENV__.GOOGLE_CLIENT_ID nao definido**
   - Inject via environment ou build args
   - Em dev: usar client ID real temporario

2. **Placeholder ainda no codigo**
   - Substituir PLACEHOLDER_CLIENT_ID por valor real do Infisical

## Terraform Apply Fails

### Sintoma
```
Error: Invalid value for variable
```

### Causas

1. **url nao e string valida**
   - Verificar formato: `"http://10.0.X.X:PORT"`

2. **subdomain ja existe**
   - Verificar se nome ja esta em uso em var.services
   - Escolher nome diferente

## Permissions Error

### Sintoma
```
nginx: [alert] could not open error log file
```

### Causas

1. **Cache directory nao existe**
   - Dockerfile cria: `/var/cache/nginx/client_temp`
   - Verificar que user nginxapp tem acesso

2. **Volume permissions**
   - Verificar que volume existe: `docker volume inspect app-name-cache`