# Governanca — Indice Central

**Host:** homelab
**Ambito:** /srv/monorepo/docs/GOVERNANCE/
**Autoridade:** Platform Governance

---

## Indice de Documentos

| Documento                                        | Proposito                                                                                                             | Quando Ler                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [CONTRACT.md](./CONTRACT.md)                     | Contrato operacional entre operadores humanos e agentes AI. Principios inegociaveis.                                  | Antes de qualquer mudanca estrutural. Obrigatorio antes de ops ZFS, Docker, rede.       |
| [GUARDRAILS.md](./GUARDRAILS.md)                 | Regras de proibido/permitido para infraestrutura. Propoe o que nao fazer.                                             | Antes de tocar em Coolify, ZFS, cloudflared, Docker, Terraform.                         |
| [APPROVAL_MATRIX.md](./APPROVAL_MATRIX.md)       | Tabela de decisoes: SAFE/requisita aprovacao/FORBIDDEN por categoria de operacao.                                     | Quando duvidas se pode executar uma operacao. Consulta rapida.                          |
| [IMMUTABLE-SERVICES.md](./IMMUTABLE-SERVICES.md) | Servicos que nunca podem ser alterados — nem com MASTER_PASSWORD.                                                     | Antes de propor qualquer mudanca em servicos de infraestrutura core.                    |
| [PINNED-SERVICES.md](./PINNED-SERVICES.md)       | Servicos estaveis que requerem MASTER_PASSWORD + snapshot ZFS para alterar. Inclui registry completo com smoke tests. | Antes de modificar qualquer servico PINNED (Kokoro, wav2vec2, Hermes Agent, LiteLLM, etc.). |
| [SECRETS-MANDATE.md](./SECRETS-MANDATE.md)       | Regra de que .env e fonte canonica de secrets. Proibe Infisical SDK em codigo de aplicacao.                           | Antes de trabalhar com secrets, .env, ou autenticacao em apps/packages.                 |
| [EXCEPTIONS.md](./EXCEPTIONS.md)                 | Lista de excecoes documentadas a politica de secrets. Approvals e datas de expiracao.                                 | Quando ha necessidade legitima de desvio do SECRETS-MANDATE.                            |
| [LANGUAGE-STANDARDS.md](./LANGUAGE-STANDARDS.md) | Standards de linguagem: PT-BR para documentacao, EN para codigo.                                                      | Antes de escrever docs ou commit messages.                                              |
| [ALERTING-POLICY.md](./ALERTING-POLICY.md)       | Politica de alertas P1-P4, escalacao, runbooks RB-01 a RB-04, canais de notificacao.                                  | Quando houver incidente ou quando configurar alertas.                                   |

---

## Resumo das Regras de Governanca

### Principios Fundamentais

| Regra                                        | Documento             | Descricao                                                                                                     |
| -------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **/srv/data e sacrossanto**                  | CONTRACT.md           | Nunca deletar, truncar ou corromper nada em /srv/data/postgres, /srv/data/qdrant, /srv/data/n8n, /srv/backups |
| **Snapshot antes de mudanca**                | CONTRACT.md           | Toda mudanca estrutural (ZFS, Docker, /etc) requer snapshot ZFS antes                                         |
| **.env e fonte canonica**                    | SECRETS-MANDATE.md    | Todas as secrets via .env. Nunca Infisical SDK em codigo de aplicacao                                         |
| **Servicos IMMUTABLE nunca mudam**           | IMMUTABLE-SERVICES.md | coolify-proxy, cloudflared, coolify-db, prometheus, grafana, loki, alertmanager, n8n sao permanentes          |
| **Servicos PINNED requerem MASTER_PASSWORD** | PINNED-SERVICES.md    | Kokoro, wav2vec2, Hermes Agent, LiteLLM, etc. requerem unlock + snapshot antes de modificar                       |
| **Coolify nunca e tocado**                   | GUARDRAILS.md         | Sem restart, upgrade, docker pull, exec em containers coolify-\*. Versao pinada em 4.0.0-beta.470             |
| **cloudflared via Terraform**                | GUARDRAILS.md         | Nunca editar config.yml manualmente. Sempre terraform apply apos mudanca de tunnel                            |
| **Portas proibidas**                         | GUARDRAILS.md         | :3000, :4000, :4001, :8000, :8080 reservadas. Verificar PORTS.md antes de usar                                |
| **Revisar APPROVAL_MATRIX antes de ops**     | APPROVAL_MATRIX.md    | SAFE = executar livremente. APPROVAL = pedir confirmacao. FORBIDDEN = nunca                                   |

### Zonas Proibidas (Nunca Tocar)

| Zona                             | Porque                                              | Fonte              |
| -------------------------------- | --------------------------------------------------- | ------------------ |
| `/srv/data/*`                    | Dados persistentes — perda irrecuperavel            | CONTRACT.md        |
| coolify-\* containers            | Multiplos INC-004/005/006 de LLMs quebrando Coolify | GUARDRAILS.md      |
| ZFS pool `tank` destroy/rollback | Perda total de todos os dados                       | GUARDRAILS.md      |
| `/etc/cloudflared/*.yml` manual  | Sempre via Terraform, drift = outage                | GUARDRAILS.md      |
| Infisical SDK em apps/packages   | Proibido — s .env via os.getenv()                   | SECRETS-MANDATE.md |
| `.env` commitado                 | Rejeicao automatica                                 | SECRETS-MANDATE.md |
| Firewall sem SSH rule            | Lockout garantido                                   | GUARDRAILS.md      |

### Fluxo de Mudanca Estrutural

```
1. Verificar APPROVAL_MATRIX (SAFE / APPROVAL / FORBIDDEN)
2. Se APPROVAL: pedir confirmacao explicita ao humano
3. Snapshot ZFS: sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-descricao
4. Executar mudanca
5. Validar com runbook commands
6. Atualizar INCIDENTS.md se algo quebrar
7. Se PINNED: unlock com /srv/ops/scripts/unlock-config.sh + re-lock apos
```

### Rede e Portas

| Ficheiro       | Proposito                               | Quando Ler                         |
| -------------- | --------------------------------------- | ---------------------------------- |
| PORTS.md       | Tabela de alocacao de portas            | Antes de usar qualquer porta       |
| SUBDOMAINS.md  | Subdominios activos e Cloudflare Tunnel | Antes de adicionar subdominio      |
| NETWORK_MAP.md | Estado actual completo da rede          | Antes de qualquer operacao de rede |

### Alertas e Incidentes

| Sev         | Tempo            | Notificacao                | Exemplo                               |
| ----------- | ---------------- | -------------------------- | ------------------------------------- |
| P1 CRITICAL | Imediato         | Telegram @will + broadcast | Servico down, risco de perda de dados |
| P2 HIGH     | 5 min            | Telegram @will             | Performance degradada, outage parcial |
| P3 MEDIUM   | 15 min           | Gotify P3                  | Restart loops, health mismatches      |
| P4 LOW      | Proximo dia util | Grafana apenas             | Info, warnings de recursos            |

---

## Hierarquia de Documentos

```
CONTRACT.md (Contrato operacional)
    ├── GUARDRAILS.md (Proibido/Permitido)
    │   └── APPROVAL_MATRIX.md (Tabela de decisoes)
    ├── IMMUTABLE-SERVICES.md (Dual-layer: IMMUTABLE)
    └── PINNED-SERVICES.md (Dual-layer: PINNED + unlock procedure)
        └── SECRETS-MANDATE.md (Canonical .env)
            └── EXCEPTIONS.md (Desvios documentados)
        └── ALERTING-POLICY.md (P1-P4 + runbooks)
    └── LANGUAGE-STANDARDS.md (PT-BR docs / EN code)
```

---

## Quick Reference — Antes de Qualquer Operacao

### Read-only (SAFE)

```
docker ps | docker logs | curl localhost:PORT/health | zpool status | zfs list
```

### Snapshot Obrigatorio

```
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-descricao
```

### Verificar se Servico e PINNED/IMMUTABLE

```
# IMMUTABLE — nunca mudar
grep -q "coolify-proxy|cloudflared|coolify-db|prometheus|grafana|loki|alertmanager|n8n" <<< "$SERVICE" && echo "IMMUTABLE"

# PINNED — requer MASTER_PASSWORD
grep -q "kokoro|wav2vec2|Hermes Agent|litellm" <<< "$SERVICE" && echo "PINNED"
```

### Verificar Portas

```
ss -tlnp | grep :PORTA  # antes de usar
grep -E ":3000|:4000|:4001|:8000|:8080" /srv/ops/ai-governance/PORTS.md
```

### Secrets — Canonical Pattern

```
# Python
from dotenv import load_dotenv; load_dotenv()
api_key = os.getenv("MINIMAX_API_KEY")

# Node.js
import 'dotenv/config'
const apiKey = process.env.MINIMAX_API_KEY
```

---

## Historico de Revisoes

| Versao | Data       | Autor              | Mudancas                                               |
| ------ | ---------- | ------------------ | ------------------------------------------------------ |
| 1.0    | 2026-04-12 | Principal Engineer | Indice inicial (legacy)                                |
| 2.0    | 2026-04-14 | Claude Code        | Indice centralizado com sumario de regras e hierarquia |

---

**Autoridade:** Platform Governance
**Proxima revisao:** 2026-05-14
