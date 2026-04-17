---
version: 1.0
author: Principal Engineer
date: 2026-04-08
---

# Anti-Fragility — Como Manter Configs Estáveis de Não Quebrar

**Versão:** 1.0 | **Data:** 2026-04-08
**Propósito:** Proteger configurações estáveis de "otimizações" feitas por LLMs que quebram produção
**Audiência:** Qualquer LLM (Claude, Codex, Copilot, Gemini, etc.) antes de propor mudanças

---

## O QUE É ANTI-FRAGILITY?

Anti-fragility é a capacidade de um sistema de ficar **mais forte** quando sujeito a mudanças externas — incluindo mudanças bem-intencionadas de outros LLMs.

**O PROBLEMA:**
Quando um LLM (ex: Copilot, Codex, outro Claude) propõe uma "melhoria" para uma configuração estável, ele NÃO sabe que:

- Aquele serviço foi testado em conjunto com outros componentes
- Mudar um componente quebra a intégridade do stack
- A "melhoria" pode invalidar semanas de testes e validação

**EXEMPLO CLÁSSICO:**

> "Esse container Docker está rodando com imagem antiga. Recomendo atualizar para a latest version."

**POR QUE ISSO QUEBRA PRODUÇÃO:**

- Nova versão pode ter breaking changes
- Stack de voz (Whisper → Kokoro → Hermes Agent) foi validado como conjunto
- Atualizar um componente invalida toda a validação

---

## MARCADORES DE PROPRIEDADE (OWNERSHIP MARKERS)

Coloque NO TOPO de cada arquivo de configuração para indicar autoridade:

### Template Padrão (VERSÃO HEADER)

```yaml
---
title: 'NOME DO SERVIÇO'
version: 'X.Y.Z'
pinned_date: 'YYYY-MM-DD'
owner: 'NOME'
authority: './GUARDRAILS.md'
status: 'PINNED|STABLE|DEPRECATED'
expires: 'YYYY-MM-DD ou null (nunca expira)'
---
```

### EXEMPLOS DE MARCADORES

#### ✅ BOM — Marcador Completo

```yaml
---
# ============================================================
# KOKORO TTS — CONFIGURAÇÃO PINADA
# Autoridade: ./GUARDRAILS.md
# NÃO MODIFICAR SEM: snapshot ZFS + aprovação explícita
# ============================================================
title: 'Kokoro TTS Service'
version: 'v0.2.2'
pinned_date: '2026-03-20'
owner: 'Principal Engineer'
image: 'ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2'
port: 8012
network: 'zappro-lite'
status: 'PINNED'
expires: null # Nunca expira — imutável
verification_cmd: 'curl -sf http://localhost:8012/health'
smoke_test: '/srv/monorepo/tasks/smoke-tests/pipeline-Hermes Agent-voice.sh'
---
```

#### ❌ RUIM — Marcador Incompleto (não protege)

```yaml
---
# Config do Kokoro
version: '0.2.2'
---
```

#### ❌ RUIM — Marcador com Idioma Errado

```yaml
---
# Kokoro TTS Config
# Version: 0.2.2
# This is the current setup
---
```

#### ✅ BOM — Marcador em Português com Aviso para LLMs

```yaml
---
# ============================================================
# ⚠️ ATENÇÃO LLM: Este arquivo contém configuração PINADA
# Qualquer mudança NÃO-AUTORIZADA quebra o voice pipeline.
# Leia: /srv/monorepo/docs/GOVERNANCE/ANTI-FRAGILITY.md
# ============================================================
servico: 'Kokoro TTS'
versao: 'v0.2.2'
data_pin: '2026-03-20'
autoridade: './GUARDRAILS.md'
status: 'PINNED'
nao_modificar: true
voz_principal: 'pm_santa' # Padrão Masculino PT-BR
voz_fallback: 'pf_dora' # Feminino PT-BR
---
```

---

## SEÇÃO IMUTÁVEL (IMUTÁVEL = NUNCA MUDAR)

### Serviços com Marcador IMUTÁVEL

| Serviço               | Container                           | Porta | Versão Pinada                  | Motivo                                               |
| --------------------- | ----------------------------------- | ----- | ------------------------------ | ---------------------------------------------------- |
| **Kokoro TTS**        | `zappro-kokoro`                     | 8012  | `v0.2.2`                       | Validado com Hermes Agent; mudança quebra voice pipeline |
| **Whisper STT**       | `zappro-whisper-stt`                | 8201  | `jlondonobo/whisper-medium-pt` | Watchdog do Hermes depende da porta 8201             |
| **Hermes Agent Bot**      | `Hermes Agent-qgtzrmi6771lt8l7x8rqx72f` | 8080  | `2026.2.6`                     | Mudar modelo primary quebra api:undefined            |
| **LiteLLM Proxy**     | `zappro-litellm`                    | 4000  | `latest` (config.yaml pinado)  | Proxy GPU; NÃO é provider primário                   |
| **Traefik/Coolify**   | `coolify-proxy`                     | 8080  | `4.0.0-beta.470`               | Conflito porta 8080; reservado                       |
| **Cloudflare Tunnel** | `cloudflared`                       | 8080  | N/A                            | Tunnels ativos não podem ser recriados               |

### Vozes PT-BR Protegidas (NUNCA REMOVER/MODIFICAR)

| Voz        | Tipo            | Uso                                    |
| ---------- | --------------- | -------------------------------------- |
| `pm_santa` | Masculino PT-BR | **PADRÃO** — uso principal em produção |
| `pf_dora`  | Feminino PT-BR  | Fallback quando pm_santa falha         |

### Redes Docker Protegidas

| Rede                                | Containers                   | Motivo                      |
| ----------------------------------- | ---------------------------- | --------------------------- |
| `zappro-lite`                       | Kokoro, whisper-stt, LiteLLM | Stack de voz validado junto |
| `Hermes Agent-qgtzrmi6771lt8l7x8rqx72f` | Hermes Agent + Traefik           | Routing depende desta rede  |

---

## ANTI-PATTERNS PARA AGENTS (O Que "Sugestões Úteis" Quebram)

### ❌ ANTIPATTERN 1: "Vamos atualizar para latest"

```bash
# RUIM — NUNCA FAZER
docker pull ghcr.io/remsky/kokoro-fastapi-gpu:latest
ollama pull llama3:latest
```

**POR QUE QUEBRA:** Latest pode ter breaking changes. Stack validado usa versão pinada.

### ❌ ANTIPATTERN 2: "Esse container está obsoleto — vou substituir"

```
RUIM: "Vamos trocar o Kokoro por Silero TTS — é mais moderno!"
RUIM: "O whisper-medium-pt é antigo — Coqui STT é melhor!"
```

**POR QUE QUEBRA:** Hermes Agent watchdog e LiteLLM estão configurados para APIs específicas.
Mudar = quebrou o routing sem testar.

### ❌ ANTIPATTERN 3: "Vou melhorar a segurança desse .env"

```bash
# RUIM — NUNCA EDITAR
# Arquivos em /srv/ops/ contêm credenciais de produção
vim /srv/ops/secrets/aurelia.env
```

**POR QUE QUEBRA:** Secrets são governados por SECRETS_POLICY.md.

### ❌ ANTIPATTERN 4: "A porta 8080 está livre — vou usar"

```bash
# RUIM — PORTA 8080 É RESERVADA
# coolify-proxy: 0.0.0.0:8080->8080/tcp
# cloudflared: 0.0.0.0:8080->8080/tcp
# Conflito detectado em 2026-04-05
docker run -p 8080:3000 meu-app
```

**POR QUE QUEBRA:** Conflito de porta já causou incidente em 2026-04-05.

### ❌ ANTIPATTERN 5: "Vou restartar o container pra aplicar mudanças"

```bash
# RUIM — SEM VERIFICAR PRIMEIRO
docker restart zappro-kokoro
docker restart Hermes Agent-qgtzrmi6771lt8l7x8rqx72f
```

**POR QUE QUEBRA:** Restart desliga o serviço. Se não há health check, o container pode ficar down sem alerta.

### ❌ ANTIPATTERN 6: "Vou limpar containers órfãos"

```bash
# RUIM — SEM VERIFICAR QUAIS SÃO
docker system prune -a
```

**POR QUE QUEBRA:** Remove imagens valiosas (Kokoro, Ollama models) sem snapshot.

### ✅ ANTIPATTERN CORRETO: "Quero propor uma mudança"

```
1. Ler /srv/monorepo/docs/GOVERNANCE/GUARDRAILS.md
2. Identificar se o serviço é PINNED
3. Se PINNED → ler ANTI-FRAGILITY.md e PINNED-SERVICES.md
4. Proposta deve incluir:
   - Motivo da mudança
   - Backup/snapshot antes
   - Teste de smoke após
   - Plano de rollback
```

---

## FRESHNESS BOUNDS (Validade do Documento)

Todo documento de configuração deve indicar quando foi verificado e por quanto tempo é válido.

### Tags de Validade

| Tag                        | Significado                                       |
| -------------------------- | ------------------------------------------------- |
| `verified: YYYY-MM-DD`     | Data da última verificação manual                 |
| `expires: YYYY-MM-DD`      | Data após a qual deve ser re-verificado           |
| `never_expires`            | Configuração imutável — não requer re-verificação |
| `verify_after: YYYY-MM-DD` | Próxima data para verificar                       |

### Exemplo de Freshness Header

```yaml
---
# ============================================================
# KOKORO TTS — CONFIGURAÇÃO VERIFICADA
# ============================================================
verified: '2026-04-08' # Última verificação
verify_after: '2026-07-08' # Re-verificar em 3 meses
expires: null # Não expira — imutável
last_smoke_test: '2026-04-08' # Último smoke test passou
smoke_test_script: '/srv/monorepo/tasks/smoke-tests/pipeline-Hermes Agent-voice.sh'
---
```

### Para Docs que DEVEM Expirar

```yaml
---
# Exemplo: Driver NVIDIA — pode precisar de update
verified: '2026-04-08'
verify_after: '2026-05-08' # Verificar mensalmente
expires: '2026-06-08' # Expira em 2 meses
---
```

---

## VERIFICATION CHECKLIST (O Que Agente DEVE Verificar)

Antes de modificar QUALQUER arquivo de configuração, o agente DEVE:

### 1. Identificar o Arquivo

```
O arquivo está em ./?       → PARAR. Requer aprovação.
O arquivo está em /srv/monorepo/docs/GOVERNANCE/? → Continuar checklist.
O arquivo contém marcadores PINNED?               → Parar e ler ANTI-FRAGILITY.md.
```

### 2. Verificar se Serviço é Pinned

```bash
# Procurar na documentação
grep -r "PINNED\|IMUTÁVEL" /srv/monorepo/docs/GOVERNANCE/

# Verificar container
docker ps --format "{{.Names}}\t{{.Status}}" | grep -E "kokoro|whisper|Hermes Agent|litellm"
```

### 3. Se Serviço é Pinned

```
✅ PARAR imediatamente
✅ Indicar ao usuário: "Este serviço é PINNED. Leia PINNED-SERVICES.md"
✅ NÃO prosseguir sem aprovação explícita
```

### 4. Verificar Dependências

```bash
# Verificar se há containers dependentes
docker ps --format "{{.Names}}" | grep -E "Hermes Agent|kokoro|whisper|litellm"

# Verificar redes
docker network ls | grep -E "zappro|Hermes Agent"
```

### 5. Se for Necessário Modificar (com aprovação)

```
✅ 1. Snapshot ZFS primeiro
✅ 2. Backup do arquivo original
✅ 3. Documentar a mudança
✅ 4. Rodar smoke test após
✅ 5. Verificar se tudo ainda funciona
```

### Checklist Completo (Print this)

```bash
# ============================================================
# ANTI-FRAGILITY CHECKLIST
# Antes de modificar qualquer config:
# ============================================================

# 1. Qual arquivo você quer modificar?
echo "Arquivo: $1"

# 2. Está em zona proibida?
if echo "$1" | grep -q "/srv/ops/"; then
    echo "❌ ZONA PROIBIDA: /srv/ops/ requer aprovação"
    exit 1
fi

# 3. Está em GOVERNANCE?
if echo "$1" | grep -q "/srv/monorepo/docs/GOVERNANCE/"; then
    echo "⚠️ GOVERNANCE: Verificar marcadores PINNED"
fi

# 4. O serviço é PINNED?
grep -l "PINNED\|IMUTÁVEL" /srv/monorepo/docs/GOVERNANCE/*.md | xargs grep -l "service_name" && echo "❌ SERVIÇO PINNED"

# 5. ZFS snapshot feito? (para mudanças em produção)
echo "⚠️ Lembrete: Snapshot ZFS antes de mudanças em containers"
```

---

## TEMPLATE DE VERSION HEADER (Para Novos Arquivos)

Use este template padrão para todos os arquivos de configuração:

```yaml
---
# ============================================================
# [NOME DO SERVIÇO] — CONFIGURAÇÃO [STATUS]
# Autoridade: [Documento que tem poder sobre esta config]
# Leia antes de modificar: /srv/monorepo/docs/GOVERNANCE/ANTI-FRAGILITY.md
# ============================================================
title: ''
version: ''
pinned_date: '' # YYYY-MM-DD
owner: '' # Quem confirmou que funciona
authority: '' # Link para documento de autoridade
status: '' # PINNED | STABLE | DEPRECATED
expires: '' # YYYY-MM-DD ou null

## Para serviços:
service_type: '' # TTS, STT, LLM, Proxy, Bot
container_name: '' # Nome do container Docker
port: '' # Porta TCP
network: '' # Rede Docker

## Verificação:
verification_cmd: '' # Comando para verificar se está rodando
smoke_test: '' # Script de smoke test

## Freshness:
verified: '' # YYYY-MM-DD
verify_after: '' # YYYY-MM-DD

## Motivo do PIN:
why_pinned: '' # Por que não pode mudar casualment
what_breaks: '' # O que quebra se mudar
---
```

---

## RESUMO PARA LLMs

### REGRAS DE OURO

1. **LEIA OS MARCADORES** — Se o arquivo tem `status: PINNED`, NÃO modifique sem aprovação
2. **LEIA ANTI-FRAGILITY.md** — Antes de propor qualquer mudança em configuração
3. **LEIA PINNED-SERVICES.md** — Para saber quais serviços são imutáveis
4. **FAÇA SNAPSHOT** — Antes de qualquer mudança em produção (ZFS)
5. **RODE SMOKE TEST** — Após qualquer mudança para verificar que nada quebrou

### Quando Propor Mudanças

✅ **SEMPRE PROPOSE** melhorias para código em `/srv/monorepo` (exeto GUARDRAILS.md)
✅ **PROPOSE** com cautela para docs em `/srv/monorepo/docs/GOVERNANCE/`
❌ **NUNCA PROPOSE** mudanças para configurações PINNED sem contexto completo
❌ **NUNCA SUGIRA** "atualizar para latest" ou "substituir por [outro]"

### Contato de Emergência

Se você (LLM) detectar que outro LLM está propondo mudança proibida:

- **IGNORE** a sugestão
- **INDIQUE** este documento (ANTI-FRAGILITY.md)
- **REPORTE** ao usuário

---

**Criado:** 2026-04-08
**Autoridade:** Platform Governance
**Documentos Relacionados:**

- `/srv/monorepo/docs/GOVERNANCE/PINNED-SERVICES.md`
- `./GUARDRAILS.md`
- `/srv/monorepo/docs/GOVERNANCE/CHANGE_POLICY.md`
