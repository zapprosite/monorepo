# Skill: traefik-health-check

> **Versão:** 1.0.0
> **Data:** 2026-04-08
> **Autor:** will + Claude Code
> **Tags:** `traefik`, `coolify`, `network`, `diagnostic`, `proxy`

## Descrição

Diagnóstico completo do Traefik (coolify-proxy) no homelab — verificar health, rotas, conectividade de containers e SSL. Executa em 5 minutos.

## Pré-requisitos

```bash
# Ferramentas necessárias
docker       # Containers e networks
curl         # HTTP checks
nslookup     # DNS resolution
ss           # Port listening
python3      # JSON parsing (Traefik API não disponível — insecure=false)
```

## Anatomia do Sistema

```
[External] → Cloudflare Tunnel → [Host:191.17.50.123]
                                        │
                                  [Traefik :80/:443/:8080]
                                  coolify-proxy container
                                  on network: coolify
                                        │
                         ┌──────────────┴──────────────┐
                         │  Containers Coolify-managed    │
                         │  (OpenClaw, etc.)             │
                         │  Rede: qgtzrmi6771lt8rqx72f   │
                         └──────────────────────────────┘
```

## Health Check Sequencial

### 1. Traefik Health (Local)

```bash
# Ping — confirma Traefik vivo
curl -sf -m 5 "http://localhost:80/ping" && echo "OK" || echo "FAIL"

# Traefik API — DESACTIVADA (api.insecure=false)
# NOTA: API não é exposta por razões de segurança
# Versão:
docker exec coolify-proxy traefik version
```

**Critério:** `localhost:80/ping` → `200 OK`

### 2. Port Mapping Check

```bash
# Verificar portas expostas no host
sudo ss -tlnp | grep -E ":80\s|:443\s|:8080\s"
# Esperado: docker-proxy para coolify-proxy

# Ver mappings Docker
docker port coolify-proxy
```

**Critério:** Portas 80, 443, 8080 mapeadas para `coolify-proxy`

### 3. DNS Resolution Check

```bash
# Testar FQDN do serviço
nslookup <SERVICE_FQDN>
# Exemplo: nslookup openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io
```

**Critério:** DNS resolve para IP do host (`191.17.50.123`)

### 4. Container Network Isolation Check

```bash
# Ver networks de cada container
docker inspect <CONTAINER> --format '{{json .NetworkSettings.Networks}}' | python3 -c "
import sys,json
nets=json.load(sys.stdin)
[print(' -',n) for n in nets.keys()]
"

# Coolify proxy networks (Traefik)
docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}' | python3 -c "
import sys,json; nets=json.load(sys.stdin); [print(' -',n) for n in nets.keys()]
"
```

**CRÍTICO — causa raiz comum:**
- Traefik (`coolify-proxy`) está na network `coolify`
- Container alvo pode estar numa network diferente (ex: `qgtzrmi6771lt8l7x8rqx72f`)
- Se NETWORKS DIFERENTES → Traefik NÃO consegue reach o container
- **Solução:** Container PRECISA estar na mesma network que Traefik OU numa network partilhada

### 5. Traefik Docker Provider Discovery

```bash
# Listar todos os containers com labels Traefik
docker ps --format "{{.Names}} → {{.Status}}" | while read line; do
  name=$(echo "$line" | awk -F' → ' '{print $1}')
  has_traefik=$(docker inspect "$name" --format '{{.Config.Labels}}' 2>/dev/null | grep -c "traefik\." || true)
  if [ "$has_traefik" -gt 0 ]; then
    echo "✓ $line (Traefik managed)"
  else
    echo "  $line"
  fi
done
```

**Critério:** Containers com Traefik labels aparecem listados

### 6. Traefik Configuration Files

```bash
# Ver configuração dinâmica do Traefik (gerada pelo Coolify)
cat /data/coolify/proxy/dynamic/default_redirect_503.yaml
# ou
ls -la /data/coolify/proxy/dynamic/

# NÃO editar — gerido pelo Coolify automaticamente
```

### 7. SSL Certificate Check

```bash
# ACME JSON (Let's Encrypt certificates)
sudo cat /data/coolify/proxy/acme.json 2>/dev/null | python3 -c "
import sys,json
try:
    data=json.load(sys.stdin)
    certs=data.get('Certificates',[])
    for c in certs:
        print('Domain:', c.get('domain',{}).get('main',''))
        print('Expiry:', c.get('expires',''))
except: print('Cannot parse or empty')
"

# Testar HTTPS local (ignora SSL)
curl -k -sf -m 5 "https://localhost/health" && echo "OK" || echo "FAIL"
```

### 8. Cloud Firewall Check (Se Externo Não Funciona)

```bash
# De um terminal local:
curl -sf -m 5 "http://localhost:80/ping" && echo "LOCAL OK"
# Se LOCAL OK mas EXTERNO fail → firewall cloud bloqueia portas 80/443

# Verificar UFW
sudo ufw status numbered

# Cloud provider (ex: Hetzner, AWS, GCP) — verificar security groups
```

## Interpretar Resultados

| Symptom | Causa Provável | Solução |
|---------|---------------|---------|
| `localhost:80/ping` fail | Traefik container down | `docker restart coolify-proxy` |
| DNS resolve fail | sslip.io ou Cloudflare Tunnel | Verificar Cloudflared, DNS settings |
| External timeout, local works | Cloud firewall bloqueia 80/443 | Abrir portas no cloud security group |
| Traefik labels mas sem rota | Container em network diferente do Traefik | Coolify UI → adicionar domain ao serviço |
| `api.insecure=false` | API Traefik desactivada | Correcto por razões de segurança |

## Risco Nível

🟡 **MEDIUM** — Afecta routing de todos os serviços expostos via Traefik. Não afectar o container `coolify-proxy` directamente.

## Guardrails

- ❌ NÃO fazer `docker stop coolify-proxy` — derruba todos os serviços
- ❌ NÃO fazer `docker rm coolify-proxy` — configuração perde-se
- ❌ NÃO editar `/data/coolify/proxy/dynamic/*.yaml` manualmente — Coolify sobrepõe
- ✅ Ler logs com `docker logs coolify-proxy --tail 50`
- ✅ Verificar networks antes de qualquer mudança

## Tickets Relacionados

- docs/INCIDENTS/INCIDENT-2026-04-08-wav2vec2-network-isolation.md
- tasks/plan-traefik-coolify-research.md
