# TODO: Traefik + Coolify Diagnostics

## Tarefas Extraídas

### Tarefa 1: Diagnosticar Traefik Routing
**Ficheiro:** `docs/OPERATIONS/SKILLS/traefik-diagnostic.md`
**Status:** pending

Diagnosticar:
- `traefik healthcheck` — Traefik itself healthy?
- Traefik API: `curl http://localhost:8090/api/http/routers` — rotas activas
- `curl -I https://Hermes Agent.191.17.50.123.sslip.io/health` — o que acontece?
- `docker logs coolify-proxy --tail 50 | grep Hermes Agent`

**Critério aceite:** Lista todas as rotas Traefik e confirma se Hermes Agent está lá

---

### Tarefa 2: Criar Skill traefik-health-check.md
**Ficheiro:** `docs/OPERATIONS/SKILLS/traefik-health-check.md`
**Status:** pending

Template baseado em kokoro/wav2vec2/litellm health checks:
- Container coolify-proxy status
- Traefik API routers/services
- Health check de cada rota
- SSL certificate verification
- Log analysis

**Critério aceite:** Diagnóstico completo em 5 minutos

---

### Tarefa 3: Criar Skill traefik-route-tester.md
**Ficheiro:** `docs/OPERATIONS/SKILLS/traefik-route-tester.md`
**Status:** pending

Testa todas as rotas Traefik e guarda JSON:
```json
{"domain": "...", "traefik_route": bool, "backend_reachable": bool, "http_code": int}
```

**Critério aceite:** Script detecta exactamente onde Traefik falha

---

### Tarefa 4: Atualizar smoke test para usar Traefik API
**Ficheiro:** `tasks/smoke-tests/pipeline-Hermes Agent-voice.sh`
**Status:** pending

Mudar 1.2/1.3:
- Antes: `curl localhost:18789/health`
- Depois: `curl http://localhost:8090/api/http/routers | grep Hermes Agent`

**Critério aceite:** Smoke test verifica routing, não só porta directa

---

### Tarefa 5: Snapshot ZFS
**Status:** pending (ANTES de Tarefa 6)
```bash
sudo zfs snapshot -r tank@pre-traefik-fix-$(date +%Y%m%d-%H%M%S)
```

---

### Tarefa 6: Fix Traefik Routing via Coolify UI
**Status:** pending

Via Coolify UI:
1. Hermes Agent → Settings → Add Domain
2. Adicionar: `Hermes Agent.191.17.50.123.sslip.io`
3. Coolify cria router automaticamente

**Critério aceite:** `curl https://Hermes Agent.191.17.50.123.sslip.io/health` → 200

---

## Ordem de Execução

1. **Tarefa 5** (snapshot) ← PRIMEIRO
2. **Tarefa 1** (diagnostic)
3. **Tarefa 2** (skill traefik-health-check)
4. **Tarefa 3** (skill traefik-route-tester)
5. **Tarefa 4** (update smoke test)
6. **Tarefa 6** (fix — requer snapshot primeiro)
7. Verificar tudo funciona
