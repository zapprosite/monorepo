---
name: env-management
description: Guia de gerenciamento de variáveis de ambiente no monorepo
---

# Guia de Gerenciamento de .env

## Estrutura

O monorepo usa arquivos `.env` em múltiplas localizações, cada um com um propósito específico:

| Local | Purpose |
|-------|---------|
| `.env` (raiz) | Variáveis globais (coolify, cloudflare, telegram) |
| `apps/web/.env` | Configuração do frontend |
| `apps/api/.env` | Configuração do backend |
| `apps/ai-gateway/.env` | Configuração do AI gateway |

## Variáveis Obrigatórias

### Raiz `.env`

As seguintes variáveis são obrigatórias no arquivo `.env` na raiz do monorepo:

- `SESSION_SECRET` — Chave de sessão para autenticação. Deve ter no mínimo 32 caracteres aleatórios.
- `INTERNAL_API_SECRET` — Chave secreta para comunicação interna entre serviços. Mínimo 32 caracteres.
- `LITELLM_MASTER_KEY` — Chave da API do LiteLLM Proxy (produção).
- `REDIS_PASSWORD` — Senha de autenticação do Redis.

## Gerar Secrets Seguros

Use os comandos abaixo para gerar secrets com entropia adequada:

```bash
# Gerar session secret (base64)
openssl rand -base64 32

# Gerar API secret (hexadecimal)
openssl rand -hex 32

# Gerar password para Redis
openssl rand -hex 16
```

## Boas Práticas

### O que FAZER

- Manter todos os arquivos `.env` sincronizados com os templates em `.env.example`
- Usar variáveis de ambiente para qualquer valor sensível (credenciais, chaves API, URLs internas)
- Documentar novas variáveis obrigatórias neste guia quando adicioná-las ao projeto
- Fazer backup dos arquivos de secrets em `/srv/backups/env-secrets/`

### O que NÃO FAZER

- Commitar arquivos `.env` reais no repositório (só `.env.example` vai no controle de versão)
- Hardcodar secrets diretamente no código-fonte
- Imprimir ou logar valores de variáveis sensíveis (senhas, chaves, tokens)
- Usar valores placeholder como `CHANGE_ME`, `xxx`, ou `secret` em produção
- Compartilhar credenciais via canais não seguros (Slack, email, etc.)

## Variáveis por Ambiente

### Desenvolvimento

No ambiente local de desenvolvimento, as variáveis podem ser configuradas manualmente no arquivo `apps/*/.env.local`. Este arquivo deve ser adicionado ao `.gitignore`.

### Produção

Em produção, os valores são injetados pelo sistema de deploy (Coolify) a partir das variáveis configuradas no painel. Nunca fazer commit de valores de produção.

## Troubleshooting

**Problema:** `Missing environment variable: SESSION_SECRET`
- Verifique se o arquivo `.env` existe na raiz do monorepo
- Confirme que a variável está definida com um valor válido (mínimo 32 chars)
- Verifique se não há espaços extras ao redor do `=`

**Problema:** `Redis connection refused`
- Confirme que `REDIS_PASSWORD` está definido corretamente
- Verifique se o serviço Redis está rodando: `systemctl status redis`
- Teste a conexão manualmente: `redis-cli -a $(cat .env | grep REDIS_PASSWORD | cut -d= -f2) ping`

## Backup Strategy

### Location
- **Primary `.env`:** `/srv/monorepo/.env`
- **Backup location:** `/srv/ops/backups/.env.backup` (chmod 600)
- **Template:** `/srv/monorepo/.env.example` (tracked by git)

### Workflow

1. **Before modifying `.env`:**
   ```bash
   # Backup current configuration
   cp .env /srv/ops/backups/.env.backup
   chmod 600 /srv/ops/backups/.env.backup
   ```

2. **After modifying `.env`:**
   ```bash
   # Update backup
   cp .env /srv/ops/backups/.env.backup
   chmod 600 /srv/ops/backups/.env.backup
   ```

3. **To track changes:**
   - Compare with diff: `diff /srv/ops/backups/.env.backup /srv/monorepo/.env`
   - Document changes in commit messages

### Security Notes

- The backup directory `/srv/ops/backups/` is NOT under git control
- Permissions 600 ensures only the owner can read/write
- Never commit actual secrets to git
- Use `.env.example` for sharing non-sensitive defaults

## Links

- Backup: `/srv/ops/backups/.env.backup`
- Runbook DR (Disaster Recovery): `docs/GUIDES/DISASTER-RECOVERY.md`
- Configuração do Coolify: consultar NETWORK_MAP.md na seção de infraestrutura