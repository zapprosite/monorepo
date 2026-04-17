# Plan: Traefik + Coolify Diagnostics — Resolver de Vez

**Data:** 08/04/2026
**Autor:** will + Claude Code (pesquisa multi-agente)
**Status:** RESEARCH COMPLETE — aguardando aprovação

---

## Situação Actual

```
Smoke Test 1.2/1.3 — Hermes Agent via Traefik FQDN
  localhost:18789  → NÃO listening (Upstream gateway interno do container)
  localhost:8080  → listening (nginx/Coolify proxy) → curl retorna HTTP 000
  sslip.io FQDN  → connection refused/timeout
  Container      → Up (healthy) ✅
  LiteLLM/STT    → 100% ✅
  TTS/Vision/LLM → 100% ✅
```

**Root Cause identificados:**
1. Hermes Agent não expõe porta 18789 para o host (Coolify networking)
2. Traefik não tem rota configurada para `Hermes Agent.191.17.50.123.sslip.io`
3. Porta 8080 no host é o nginx do Coolify, não o Hermes Agent directamente
4. Cloudflared Tunnel funciona mas não routing para Traefik interno

---

## Pesquisa Cruzada — 4 Agentes

### Agente 1: Coolify + Traefik Docs
- ✅ Traefik é proxy default do Coolify (ports 80/443/8080)
- ✅ Health checks configurados via Dockerfile ou UI
- ✅ Wildcard SSL via Let's Encrypt DNS challenge (Cloudflare)
- ✅ Port 80/443 necessárias para Let's Encrypt
- ✅ Traefik dashboard: `https://<DOMAIN>/dashboard/#/`
- ✅ **Key:** "Gateway timeout 504/502 → fix network isolation, adjust proxy timeouts"
- ⚠️ Coolify docs com problemas de URL (múltiplos 404/403)

### Agente 2: Ubuntu Desktop + Docker Networking
- ✅ Docker bridge containers NÃO conseguem TCP para serviços native host process
- ✅ Containers no mesmo bridge network consegue (mesmo subnet IP)
- ✅ ICMP (ping) funciona, TCP specific ports fail para native host services
- ✅ Solução: containerizar todos os serviços
- ✅ Docker embedded DNS (127.0.0.11) para resolução entre containers
- ✅ `host-gateway` para aceder ao host gateway IP

### Agente 3: Hermes Agent Health Check Issue
- ✅ Container Hermes Agent healthy
- ✅ Direct ports (localhost:8080) working for other containers
- ✅ Problema é especificamente Traefik routing não configurado
- ✅ sslip.io DNS funciona mas routing não chega ao container

### Agente 4: Skills e Ferramentas
- ✅ `docker-health-watcher` existe — detecta restart loops
- ✅ `container-self-healer` existe — restart containers
- ✅ `self-healing` skill existe — auto-cria skills para problemas recorrentes
- ❌ **NENHUMA skill Traefik específica** — gap identificado!
- ✅ Traefik CLI `traefik healthcheck` existe

---

## Problema Real Desvendado

```
[User/smoke test]
    │
    ▼
Cloudflared Tunnel (ok ✅)
    │
    ▼
Traefik (:80/:443) ←————— PROBLEMA: não tem rota para Hermes Agent.191.17.50.123.sslip.io
    │
    ▼ (mas deveria routear para)
Hermes Agent Container (Coolify internal network)
```

O FQDN `Hermes Agent-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io` é gerado pelo Coolify/sslip.io, mas o Traefik não sabe routear este domínio para o container Hermes Agent.

O Traefik no Coolify só routeia para containers que ele gerencia (atraves do Docker provider `coolify-proxy`).

---

## Tarefas

### Tarefa 1: Diagnosticar Traefik Routing (Read-only)

**Ficheiro:** `docs/OPERATIONS/SKILLS/traefik-diagnostic.md` (NOVO)

Diagnosticar:
1. `traefik healthcheck` — Traefik itself healthy?
2. Traefik API: `curl http://localhost:8090/api/http/routers` — rotas activas
3. Traefik Docker provider: containers geridos por Traefik
4. `curl -I https://Hermes Agent.191.17.50.123.sslip.io/health` — o que acontece?
5. Verificar logs: `docker logs coolify-proxy --tail 50 | grep Hermes Agent`

**Critério aceite:** Consegues listar todas as rotas Traefik e confirmar se Hermes Agent está lá

---

### Tarefa 2: Criar Skill traefik-health-check.md

**Ficheiro:** `docs/OPERATIONS/SKILLS/traefik-health-check.md` (NOVO)

Baseado nos templates existentes (kokoro, wav2vec2, litellm):
- Container coolify-proxy status
- Traefik API routers/services
- Health check de cada rota
- Verificar SSL certificates
- Log analysis

**Critério aceite:** Skill cobre diagnóstico completo de Traefik em 5 minutos

---

### Tarefa 3: Criar Skill traefik-route-tester.md

**Ficheiro:** `docs/OPERATIONS/SKILLS/traefik-route-tester.md` (NOVO)

Testar todas as rotas Traefik:
```bash
# Para cada FQDN/subdomínio:
curl -sf -m 5 "https://$DOMAIN/health" | grep -q "ok\|OK\|healthy"
```
Guardar resultado em JSON:
```json
{
  "domain": "Hermes Agent.191.17.50.123.sslip.io",
  "traefik_route": true/false,
  "backend_reachable": true/false,
  "http_code": 200/502/504/000
}
```

**Critério aceite:** Script testa todas as rotas e detecta exactamente onde Traefik falha

---

### Tarefa 4: Atualizar smoke test para usar Traefik API (não curl directo)

**Ficheiro:** `tasks/smoke-tests/pipeline-Hermes Agent-voice.sh`

Mudar secção 1.2/1.3:
- Antes: `curl localhost:18789/health` (direct port)
- Depois: `curl http://localhost:8090/api/http/routers | grep Hermes Agent`
- Verificar se router existe E backend está healthy

**Alternativa:** Usar `traefik healthcheck` CLI

**Critério aceite:** Smoke test verifica Traefik routing, não só porta directa

---

### Tarefa 5: Snapshot ZFS antes de qualquer mudança

**Ficheiro:** executado manualmente
```bash
sudo zfs snapshot -r tank@pre-traefik-fix-$(date +%Y%m%d-%H%M%S)
```

**Critério aceite:** Snapshot existe antes de Tarefa 6+

---

### Tarefa 6: Fix — Adicionar Hermes Agent FQDN ao Traefik (se possível via Coolify)

**Método:** Via Coolify UI — expor Hermes Agent com subdomain configurado

Se Coolify gere Traefik dinamicamente:
1. No Coolify UI → Hermes Agent → Settings → Add Domain
2. Adicionar: `Hermes Agent.191.17.50.123.sslip.io`
3. Coolify automaticamente cria router no Traefik

**Critério aceite:** `curl -sf https://Hermes Agent.191.17.50.123.sslip.io/health` retorna 200

---

### Tarefa 7: Atualizar /plan e /todo com novas tasks

**Ficheiro:** `tasks/plan.md` + `tasks/todo.md`

Após resolver definitivamente, documentar:
- O que funcionou
- O que não funcionou
- Prevention checklist

---

## NÃO FAZER (Guardrails)

- ❌ NÃO modificar `/etc/hosts` — é temporário
- ❌ NÃO fazer `docker stop coolify-proxy` — vai derrubar todos os serviços
- ❌ NÃO mudar portas do Traefik (80/443) — afecta todos os sites
- ❌ NÃO usar `traefik --api.insecure=true` — expõe dashboard publicamente

---

## Dependências

```
Tarefa 1 (diagnostic) → Tarefa 2 (skill) → Tarefa 3 (route tester)
                                                      ↓
Tarefa 4 (smoke test update) ← Tarefa 6 (fix)
        ↓
Tarefa 5 (snapshot ZFS) ← ANTES de Tarefa 6
        ↓
Tarefa 7 (update plan)
```

---

## Verificação Final

Depois de tudo:
```bash
# Deve retornar 200
curl -sf -m 10 "https://Hermes Agent.191.17.50.123.sslip.io/health"

# Traefik API deve mostrar router
curl -s http://localhost:8090/api/http/routers | python3 -c "
import sys,json
routers = json.load(sys.stdin)
for r in routers:
    if 'Hermes Agent' in r.get('name','').lower():
        print('Router found:', r.get('name'), '| Status:', r.get('status'))
"

# Smoke test 1.2/1.3 devem passar
LITELLM_KEY=... MINIMAX_API_KEY=... bash tasks/smoke-tests/pipeline-Hermes Agent-voice.sh
```
