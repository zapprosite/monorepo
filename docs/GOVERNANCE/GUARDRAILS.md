---
version: 1.4
author: Principal Engineer
date: 2026-04-14
---

# GUARDRAILS v1.4 — Infraestrutura Zappro (homelab)

## Versão: 1.4 | 2026-04-14

## Base: 12 DevOps Senior SRE Agents + 3 INCIDENTs (INC-004, INC-005, INC-006)

---

## 🚫 ZONAS PROIBIDAS — LLM NÃO PODE TOCAR

### 1. Coolify (PaaS Controller)

**INC-004 / INC-005 / INC-006 source:** Múltiplos LLMs quebraram coolify ao longo do tempo.

- NUNCA: `curl -fsSL https://coolify.io/install.sh`
- NUNCA: `docker pull coollabsio/coolify:latest`
- NUNCA: editar `/data/coolify/source/docker-compose.prod.yml`
- NUNCA: `coolify update` ou qualquer subcomando de upgrade
- NUNCA: restartar containers `coolify-*` (docker stop/rm/restart) — **NÃO EXISTE restart seguro** em produção sem risco de cascading failure
- NUNCA: editar `/data/coolify/source/` ou `/data/coolify/docker-mounts/`
- NUNCA: deletar volumes Docker do Coolify (`coolify-db`, `coolify-redis`, `coolify-uploads`) — **destruição permanente**
- NUNCA: `docker exec` em containers `coolify-*` para instalar packages, modificar arquivos, ou rodar scripts
- NUNCA: modificar `COOLIFY_DATABASE_URL`, `COOLIFY_REDIS_URL`, ou `.env` interno do Coolify
- NUNCA: `coolify migrate` ou qualquer migração de banco Coolify
- NUNCA: modificar redes Docker `coolify-*-network` ou firewall na porta `:8000`
- VERSÃO PINADA: 4.0.0-beta.470

### 2. Drivers e Kernel

- NUNCA: `apt upgrade` / `apt dist-upgrade` / `do-release-upgrade`
- NUNCA: reinstalar drivers NVIDIA
- NUNCA: `nvidia-container-toolkit update`
- NUNCA: atualizar kernel — **6.17.0-20-generic** — NÃO ATUALIZAR

### 3. ZFS Pool (tank)

**INC-002 source:** OOM matou antigravity, pool era a única salvação.

- NUNCA: `zpool destroy tank` (ou qualquer pool) — **irreversível, perda total de todos os dados**
- NUNCA: `zfs destroy -r` em `tank/*` — elimina snapshots + children + clones recursivamente
- NUNCA: `zpool export -f tank` — corrompe volumes Docker e dados in-use
- NUNCA: `zfs rollback` sem snapshot documentado — destrói chain de snapshots de recovery
- NUNCA: `dd`, `wipefs`, ou qualquer escrita raw block device em devices do pool
- NUNCA: `zpool remove` ou `zpool offline` sem redundância verificada — pool pode ir FAULTED
- NUNCA: `zpool import -f` — importa versão antiga do metadata, revert silencioso
- NUNCA: modificar `zpool.cache` ou `/etc/zfs/` configs manualmente
- **Snapshots:** só criar/listar — NUNCA destruir sem aprovação humana explícita
- **OBRIGATÓRIO antes de qualquer operação ZFS destructive:** `sudo zfs snapshot -r tank@pre-$(date +%Y%m%d%H%M%S)-llm`

### 4. Rede e DNS

**INC-004 source:** Multi-daemon cloudflared quebrou túnel inteiro.

- NUNCA: editar `/etc/cloudflared/*.yml` manualmente — **sempre via Terraform**
- NUNCA: revogar Cloudflare API tokens
- NUNCA: `terraform destroy` (completo)
- NUNCA: `iptables -F`, `iptables -X`, `iptables --flush` — remoção completa de firewall = lockout garantido
- NUNCA: `ufw disable`, `ufw stop`, `systemctl stop ufw` — firewall desabilitado em host headless = pivoting para atacantes
- NUNCA: inserir regras DROP/REJECT sem chain de exception que inclua porta 22 (e 2222)
- NUNCA: modificar `/etc/resolv.conf`, `/etc/resolvconf.conf`, ou `systemd-resolved`
- NUNCA: `ip addr flush dev` ou `ip link set down` em interfaces ativas — perda total de rede
- NUNCA: modificar rotas (`ip route add/del`) sem confirmar que não é a única via de acesso

### 5. Secrets

**INC-004/005/006 all had secret/token exposure risks.**

- NUNCA: print, log, ou expor valores de variáveis de ambiente que contenham secrets
- NUNCA: hardcodar secrets em código, templates, ou arquivos de configuração
- NUNCA: usar Infisical SDK (`InfisicalClient`, `get_secret`) em código de aplicação — **só `.env` via `os.getenv()`**
- NUNCA: fazer commit de `.env` ou qualquer ficheiro contendo secrets
- NUNCA: usar secrets em URLs, headers, ou parâmetros que apareçam em logs
- NUNCA: expor secrets em healthcheck endpoints, metrics Prometheus, ou `docker inspect`
- NUNCA: solicitar o valor de uma secret que já existe no `.env` — ler diretamente do ficheiro
- NUNCA: usar secrets em linhas de comando interativas (`curl -H "Authorization: Bearer $TOKEN"`) — ficam em `.bash_history`

---

## 🚫 CLOUDFLARED / TUNNEL MANAGEMENT

**INC-004 source:** Multi-daemon conflict (HTTP 000 em todos os subdomínios).

1. NUNCA: usar daemon manual cloudflared (`cloudflared tunnel run &`) junto com systemd — **dois daemons = HTTP 000**
2. NUNCA: editar `~/.cloudflared/config.yml` manualmente — **sempre via Terraform**
3. NUNCA: matar processo cloudflared sem verificar se há outros primeiro — `ps aux | grep cloudflared | wc -l` = 1 antes de kill
4. NUNCA: mudar tunnel ingress rules via API sem sincronizar para Terraform em 24h — **drift = outage inevitável**
5. NUNCA: `cloudflared service install` ou `uninstall` sem aprovação explícita
6. NUNCA: re-autenticar (`cloudflared tunnel token`) sem verificar credential file vs Tunnel ID no Terraform
7. NUNCA: alterar `tunnel_name` ou `tunnel_secret` no Terraform sem destruir e recriar o tunnel primeiro
8. NUNCA: ignorar `http_host_header` em virtual-hosted services — **1010 Bad SSL error**

**Verificação obrigatória antes de restart:**

```bash
ps aux | grep cloudflared | grep -v grep | wc -l  # deve ser 1
systemctl is-active cloudflared                   # deve ser "active"
```

---

## 🚫 SYSTEMD / SERVICES

**INC-004 source:** Restart criou segundo daemon sem matar o primeiro.

1. NUNCA: usar daemon manual para serviços críticos — usar **exclusivamente `systemctl`**
2. NUNCA: `systemctl restart` sem matar processos manuais primeiro — `sudo pkill -f <binary> && sleep 2 && systemctl restart <service>`
3. NUNCA: criar ou modificar unit files sem `daemon-reload` — `sudo systemctl daemon-reload` é **obrigatório antes** de qualquer start/restart
4. NUNCA: ter dois unit files diferentes para o mesmo serviço apontando ao mesmo credential/tunnel
5. NUNCA: `systemctl restart` em loop sem investigar causa-root — **máximo 2 restarts em 10min, depois PARAR**
6. NUNCA: `systemctl enable` num unit file que não existe em `/etc/systemd/system/`
7. NUNCA: `kill -9` em processo gerido por systemd — usar `systemctl stop` primeiro; SIGKILL bypassa systemd e causa restart loop
8. NUNCA: `Restart=on-failure` sem `RestartSec` e `StartLimitBurst` — restart imediato sem backoff = CPU spin

**Config mínima para qualquer serviço:**

```ini
Restart=on-failure
RestartSec=10
StartLimitBurst=3
StartLimitIntervalSec=300
```

---

## 🚫 DOCKER CONTAINERS

**INC-005 / INC-006 source:** `network_mode: host` quebrou Prometheus scrape; `localhost` IPv6 quebrou healthcheck.

1. NUNCA: `network_mode: host` num serviço que precisa de rede Docker — usar `pid: host` + `networks: - monitoring`
2. NUNCA: `localhost`, `127.0.0.1`, ou `host.docker.internal` para comunicação inter-container — usar **nome do serviço Docker**
3. NUNCA: `host.docker.internal` como fonte de verdade — DNS frágil, usar container names
4. NUNCA: modificar containers IMMUTABLE sem APPROVAL_MATRIX explícita + snapshot ZFS
   - **Lista:** coolify-\*, cloudflared, prometheus, grafana, loki, alertmanager, coolify-redis
5. NUNCA: `localhost:port` em `ports:` binding — outros containers não alcançam loopback
6. NUNCA: healthcheck sem `start_period` ou com `timeout` incompatível — causa restart loops
7. NUNCA: bind mounts sem `rslave`/`ro` corretamente configurados
8. NUNCA: escrever configuração dinâmica (baseUrl, tokens, api_base) em ficheiros de config — **usar env vars**

**Padrão correto para inter-container:**

```yaml
# ✅ CERTO — nome do serviço Docker
- GF_DATASOURCE_URL: "http://prometheus:9090"
command: ["--api-url=http://wav2vec2:8201"]

# ❌ ERRADO — localhost dentro do container
- GF_SERVER_ROOT_URL: "http://localhost:9090"
```

**Regras obrigatórias de HEALTHCHECK (INC-005 / INC-006):**

- NUNCA: usar `curl` em healthcheck — imagens `prom/node-exporter`, `gotify`, e similares NÃO têm curl
  - ✅ USAR: `wget -qO- http://127.0.0.1:{PORT}/health || exit 1`
  - ❌ ERRADO: `curl -f http://localhost:{PORT}/health`
- NUNCA: `localhost` — resolver para `::1` (IPv6) quando o serviço só escuta em IPv4 → "Connection refused"
  - ✅ USAR: `127.0.0.1` sempre
  - ❌ ERRADO: `http://localhost/health`
- NUNCA: healthcheck sem `start_period` — container fica "unhealthy" durante inicialização → restart loop
  - ✅ OBRIGATÓRIO: `start_period: 15s` (ou maior para apps lentos)
- NUNCA: usar `CMD` para shell commands — usar `CMD-SHELL` para comandos shell
  - ✅ CORRETO: `CMD-SHELL ["wget -qO- http://127.0.0.1:9100/ || exit 1"]`
  - ❌ ERRADO: `CMD ["wget", "--spider", "http://localhost/health"]`
- NUNCA: `--spider` com wget — não valida resposta HTTP, só conecta
  - ✅ CORRETO: `wget -qO- http://127.0.0.1:{PORT}/health || exit 1`
  - ❌ ERRADO: `wget --spider http://localhost/health`

---

## 🚫 NGINX / REVERSE PROXY

**INC-006 source:** `localhost` em healthcheck resolvia IPv6.

1. NUNCA: `localhost` em `proxy_pass` ou `upstream` — pode resolver para `::1` (IPv6)
2. NUNCA: fazer proxy para o próprio nginx — loop infinito garantido
3. NUNCA: portas reservadas sem verificar PORTS.md — proibidas: `:3000`, `:4000`, `:4001`, `:8000`, `:8080`
4. NUNCA: upstream para URL externa sem verificar se existe rota da rede interna
5. NUNCA: `rewrite ... last` dentro de location com `proxy_pass` — usar `break`
6. NUNCA: SSL sem verificar caminho do certificado — `ls /etc/letsencrypt/live/dominio/`
7. NUNCA: remover headers `X-Forwarded-For`, `X-Real-IP`, `Host` — autenticação e logging quebram
8. NUNCA: `nginx -s reload` sem validar config primeiro — **sempre `nginx -t` antes**

**Padrão correto:**

```nginx
# ✅
proxy_pass http://127.0.0.1:3000;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header Host $host;
```

---

## 🚫 TERRAFORM / INFRASTRUCTURE AS CODE

**INC-004 source:** API fast-path criou drift entre Terraform state e Cloudflare.

1. NUNCA: `terraform apply` sem `terraform plan` executado e revisado primeiro
2. NUNCA: `terraform destroy` ou `terraform state rm` sem snapshot do state + aprovação humana
3. NUNCA: `terraform apply` sem `terraform refresh` quando há suspeita de drift
4. NUNCA: modificar Cloudflare DNS, tunnel, ou Access pelo Dashboard — **sempre via Terraform**
5. NUNCA: `terraform import` sem verificar se recurso já existe no state — duplicação de recursos
6. NUNCA: commitar `terraform.tfstate`, `terraform.tfvars`, `*.tfplan` no git
7. NUNCA: API fast-path (`new-subdomain` skill) sem sincronizar para Terraform em 24h

**Fluxo obrigatório:**

```bash
cd /srv/ops/terraform/cloudflare
terraform refresh
terraform plan -out=tfplan
#-review plan
terraform apply tfplan
terraform plan  # deve mostrar 0 diff
```

---

## 🚫 NETWORK / DNS / FIREWALL

**INC-004 source:** cloudflared multi-daemon foi triggered por mudança de rede.

1. NUNCA: `iptables -F` ou `iptables -X` — firewall completo removido = lockout
2. NUNCA: `ufw disable` ou `systemctl stop ufw` em host remoto headless
3. NUNCA: editar `/etc/hosts` sem consultar PORTS.md + SUBDOMAINS.md primeiro
4. NUNCA: alocar porta sem consultar PORTS.md e confirmar `ss -tlnp | grep :PORTA`
   - **Proibidas:** `:3000`, `:4000`, `:4001`, `:8000`, `:8080`
   - **Faixa livre:** 4002–4099
5. NUNCA: Cloudflare API direta sem Terraform — drift de DNS inevitável
6. NUNCA: regras DROP sem exception SSH — lockout garantido na próxima carga
7. NUNCA: modificar `resolv.conf` ou configurações de DNS resolver
8. NUNCA: `ip addr flush` ou `ip link set down` em interfaces ativas

---

## 🚫 SECRETS / CREDENTIALS

**SECRETS-MANDATE.md source:** Infisical SDK hallucinations são proibidas.

1. NUNCA: print, log, ou expor valores de variáveis com secrets — token em log = comprometido para sempre
2. NUNCA: hardcodar secrets em código — `.env` é fonte canónica, nunca outra coisa
3. NUNCA: Infisical SDK em código de aplicação (`apps/`, `packages/`) — **só `os.getenv()` / `process.env`**
4. NUNCA: commit de `.env` — `.gitignore` deve sempre excluir
5. NUNCA: secrets em URLs ou headers que aparecem em logs de requests
6. NUNCA: secrets em healthcheck endpoints, Prometheus metrics, ou `docker inspect`
7. NUNCA: perguntar pelo valor de uma secret que já existe no `.env` — ler diretamente
8. NUNCA: secrets em CLI commands interativas — ficam em `.bash_history` para sempre

---

## 🚫 MONITORING / OBSERVABILITY

**INC-005 / INC-006 source:** node-exporter healthcheck quebrou; monitoramento cego = incidentes desperdiçados.

1. NUNCA: remover ou comentar targets em `prometheus.yml` sem atualizar `alerts.yml` correspondentes
2. NUNCA: modificar `alertmanager.yml` que desabilite `send_resolved` ou remova `alert-webhook`
3. NUNCA: `docker compose down` ou `restart` nos containers core sem justificar no incident log
4. NUNCA: alterar nome da Docker network `monitoring` ou mover para `network_mode: host`
5. NUNCA: editar ficheiros de provisioning Grafana (`datasources`, `dashboards`) sem backup prévio
6. NUNCA: alterar `storage.tsdb.retention.time` ou `storage.tsdb.path` do Prometheus sem snapshot ZFS
7. NUNCA: alterar UUIDs GPU hardcoded nos alertas sem atualizar painéis Grafana correspondentes
8. NUNCA: `docker compose up -d --force-recreate` em produção sem verificar healthchecks antes de sair

---

## 🚫 HEALTHCHECK PATTERNS (INC-005 / INC-006 lessons learned)

### Padrão Correto

```yaml
healthcheck:
  test: ['CMD-SHELL', 'wget -qO- http://127.0.0.1:9100/ || exit 1']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 15s
```

### Exemplos Corretos e Incorretos

| Scenario            | ✅ Correto                                           | ❌ Incorreto                            |
| ------------------- | ---------------------------------------------------- | --------------------------------------- |
| Prometheus exporter | `wget -qO- http://127.0.0.1:9100/ \|\| exit 1`       | `curl -f http://localhost:9100/`        |
| Nginx app           | `wget -qO- http://127.0.0.1:80/health \|\| exit 1`   | `wget --spider http://localhost/health` |
| API service         | `wget -qO- http://127.0.0.1:3000/health \|\| exit 1` | `curl -sf http://localhost:3000/health` |

### Image-Specific Notes

- **`prom/node-exporter`**: não tem `curl` — usar `wget` apenas
- **`gotify/gotify`**: não tem `curl` — usar `wget` apenas
- **`nginx`**: binds em `0.0.0.0` (IPv4), `localhost` resolve para `::1` (IPv6) dentro do container

### Common Mistakes

1. **Missing binary**: `curl` não existe em imagens Alpine/scratch-based
2. **IPv6 resolution**: `localhost` → `::1` quando serviço só escuta em `0.0.0.0` (IPv4)
3. **No start_period**: container marcadas "unhealthy" durante init → restart loop
4. **Wrong test type**: `CMD` para shell command → `CMD-SHELL` é correto
5. **--spider flag**: não valida HTTP response code, só verifica conexão

---

## 🚫 GIT / REMOTE OPERATIONS

**SPEC-026 source:** Git mirror significa que force push destrói dois remotes simultaneamente.

1. NUNCA: `git push --force` em `main` ou `master` — rewrites história em ambos os mirrors (GitHub + Gitea)
2. NUNCA: `git reset --hard` em branch protegido — descarta worktree + corrompe mirror divergence
3. NUNCA: `git push --delete` remote branches — irrecuperável em ambos os mirrors
4. NUNCA: `git clean -fdx` — destruição permanente de todos os untracked files
5. NUNCA: `git remote set-url` ou `git remote add` sem verificar remote atual
6. NUNCA: `git push --no-ff` em branches compartilhados — histórias divergentes
7. NUNCA: `git stash drop` sem confirmar que não é necessário
8. NUNCA: `git submodule add` ou `deinit --all` sem SPEC + aprovação

---

## 🚫 AI / AGENT ORCHESTRATION

**Voice pipeline source:** Hermes Agent é o SRE core; loops autónomos sem gates = caos.

1. NUNCA: modificar ou reiniciar `hermes-agent.service` sem aprovação explícita — voice pipeline depende dele
2. NUNCA: executar `cursor-loop` ou `computer-loop` sem `human-gates` checkpoint definido
3. NUNCA: modificar `memory/MEMORY.md`, `ai-context.md` fora do pipeline documentado — memory corruption silenciosa
4. NUNCA: usar `hermes mcp serve` como bridge MCPO permanente — **não é persistente**, usar Hermes Gateway `:8642`
5. NUNCA: adicionar/remover/modificar cron jobs sem atualizar `hermes.json` E documentar em memory
6. NUNCA: `kill`/`pkill`/`systemctl stop` em processos de agentes durante execução ativa — state corruption
7. NUNCA: modificar skills em `.claude/skills/` ou `.agent/` sem validar dependências — quebra pipeline inteiro
8. NUNCA: `snapshot-safe` ou ZFS em serviço imutável — verificar IMMUTABLE-SERVICES.md antes

---

## ✅ PERMITIDO SEM APROVAÇÃO

- Ler logs, status, inspect
- Restart containers de app (não coolify-\*, não IMMUTABLE)
- Editar código em `/srv/monorepo` e `/home/will/dev`
- Backup, snapshots ZFS (só criar, nunca destruir)
- Atualização de documentação

## ⚠️ REQUER CONFIRMAÇÃO

- Restart de qualquer container IMMUTABLE
- `docker pull` em imagens de infra
- Operações em `/srv/ops/terraform/`
- Operações em `/etc/systemd/system/`
- Modificação de `alertmanager.yml` ou `prometheus.yml`

---

## 🔍 SCAN COMMANDS (verificação rápida)

```bash
# Healthchecks com localhost (INC-006 pattern — localhost → 127.0.0.1)
grep -rn "localhost" /srv/apps/ /srv/monorepo/apps/ --include="docker-compose*.yml" | grep -i healthcheck

# Healthchecks com curl (INC-005 pattern — curl → wget)
grep -rn "curl" /srv/apps/ /srv/monorepo/apps/ --include="docker-compose*.yml" | grep -i healthcheck

# Healthchecks com --spider (INC-006 pattern — --spider não valida HTTP)
grep -rn "wget.*--spider" /srv/apps/ /srv/monorepo/apps/ --include="docker-compose*.yml"

# Healthchecks sem start_period (restart loop risk)
grep -rn "healthcheck" /srv/apps/ /srv/monorepo/apps/ --include="docker-compose*.yml" | grep -v "start_period"

# Secrets hardcoded
grep -rnE "cfut_|ghp_|sk-|AKIA|AIzaSy" /srv/monorepo --include="*.ts" --include="*.py" --include="*.js"

# cloudflared multi-daemon
ps aux | grep cloudflared | grep -v grep | wc -l  # deve ser 1

# Port conflicts
ss -tlnp | grep -E ":3000|:4000|:8000|:8080"

# Terraform drift
cd /srv/ops/terraform/cloudflare && terraform plan

# Git remote integrity
git remote -v
```

---

**Versão:** 1.4 | **Data:** 2026-04-14
**12 DevOps Senior SRE Agents + 3 INCIDENTs (INC-004, INC-005, INC-006)**
**Anterior:** v1.3 (2026-04-14) — INC-005/006 healthcheck hardened
