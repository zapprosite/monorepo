# INCIDENT-2026-04-08: Gitea Actions Runner — Workflows Não Executavam

**Data:** 2026-04-08
**Severidade:** 🟡 MEDIUM
**Tipo:** CI/CD / Gitea Actions
**Status:** ✅ RESOLVIDO

---

## Sumário

Gitea Actions estava configurado no servidor mas **sem runners** — workflows existiam mas não executavam. O runner `act_runner` não estava deployado.

---

## Root Cause

1. **Runner não deployado** — `act_runner` (agente que executa jobs) nunca foi iniciado
2. **Token expirado** — Registration token era temporário e precisava ser gerado manualmente
3. **Docker socket conflicts** — Runner usava bridge network, conflituava com Docker socket
4. **DNS resolution failed** — `host.docker.internal` não resolvia dentro do container
5. **Workflow incompatível** — `$GITHUB_ENV` não funciona no Gitea Actions

---

## Timeline

| Hora | Evento |
|------|--------|
| 08/04 08:00 | Gitea Actions criado com workflows |
| 08/04 XX:XX | Runner token gerado |
| 08/04 XX:XX | docker-compose.gitea-runner.yml criado |
| 08/04 XX:XX | Runner deployado com `network_mode: host` |
| 08/04 XX:XX | `prod-runner-1` online no Gitea |
| 08/04 XX:XX | Workflow executando (falha por falta de secrets) |

---

## Fixes Implementados

### docker-compose.gitea-runner.yml

```yaml
services:
  gitea-runner:
    image: docker.io/gitea/act_runner:nightly
    container_name: gitea-runner
    restart: unless-stopped
    environment:
      CONFIG_FILE: /config.yaml
      GITEA_INSTANCE_URL: http://10.0.1.1:3300
      GITEA_RUNNER_REGISTRATION_TOKEN: ${GITEA_RUNNER_REGISTRATION_TOKEN}
      GITEA_RUNNER_NAME: prod-runner-1
      GITEA_RUNNER_LABELS: ubuntu-latest
    volumes:
      - ./runner/config.yaml:/config.yaml
      - ./runner/data:/data
      - /var/run/docker.sock:/var/run/docker.sock
    network_mode: host
```

### runner/config.yaml

```yaml
runner:
  capacity: 2
  timeout: 3h
  labels:
    - "ubuntu-latest:docker://docker.gitea.com/runner-images:ubuntu-latest"
    - "ubuntu-22.04:docker://docker.gitea.com/runner-images:ubuntu-22.04"

cache:
  enabled: true
  dir: /data/actcache

container:
  network: "gitea"
  privileged: true
  force_pull: true
```

### Workflow Fix ($GITHUB_ENV → ::set-env)

```yaml
# Antes (GitHub):
echo "app_uuid=$APP_UUID" >> $GITHUB_ENV

# Depois (Gitea):
echo "::set-env name=app_uuid::$APP_UUID"
```

---

## Problemas Resolvidos

| Problema | Solução |
|----------|---------|
| Runner não registra | Usar `network_mode: host` para evitar conflitos |
| DNS host.docker.internal | Usar IP direto `10.0.1.1` (docker bridge) |
| $GITHUB_ENV não funciona | Usar `::set-env` command |
| Token expirado | Gerar novo em `/admin/actions/runners` |

---

## Estado Atual

- ✅ Runner `prod-runner-1` online e idle
- ✅ Workflow trigger funciona (push para `apps/perplexity-agent/**`)
- ✅ Workflow executa (falha por falta de secrets Coolify)
- ⚠️ Secrets `COOLIFY_URL` e `COOLIFY_API_KEY` não configurados no repo Gitea

---

## Prevenção

### Antes de criar workflow Gitea Actions

- [ ] Gerar registration token em `/admin/actions/runners`
- [ ] Deployar runner com `docker compose`
- [ ] Verificar runner online em `/admin/actions/runners`
- [ ] Testar workflow com push real (não só commit)
- [ ] Configurar secrets no repositório Gitea

### Secrets obrigatórios para workflows Coolify

```
COOLIFY_URL=https://coolify.zappro.site
COOLIFY_API_KEY=<token>
```

---

**Registrado:** 2026-04-08
**Autor:** will + Claude Code (auto-orchestration)
**Revisão:** 2026-05-08
