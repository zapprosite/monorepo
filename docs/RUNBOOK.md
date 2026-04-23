# Runbook de Recuperação de Desastres

> **Data de criação:** 2026-04-22
> **Última atualização:** 2026-04-23
> **Versão:** 1.1.0

Este documento contém procedimentos de recuperação para emergências e desastres nos serviços de infraestrutura.

---

## Tabela de Conteúdo

1. [Procedimentos Gerais de Emergência](#procedimentos-gerais-de-emergência)
2. [Serviços](#serviços)
   - [Hermes Agency (porta 3001)](#hermes-agency-porta-3001)
   - [AI Gateway (porta 4002)](#ai-gateway-porta-4002)
   - [LiteLLM (porta 4000)](#litellm-porta-4000)
   - [Qdrant (porta 6333)](#qdrant-porta-6333)
   - [MCP Servers (portas 4011-4016)](#mcp-servers-portas-4011-4016)
   - [Coolify (porta 8000)](#coolify-porta-8000)
3. [Backup e Restauração](#backup-e-restauração)
   - [Gitea](#restaurar-gitea)
   - [Coolify DB](#restaurar-coolify-db)
   - [Redis](#restaurar-redis)
   - [.env Secrets](#restaurar-env-secrets)
4. [Procedimentos de Emergência](#procedimentos-de-emergência)
5. [Contatos de Emergência](#contatos-de-emergência)

---

## Procedimentos Gerais de Emergência

### Primeiro Diagnóstico

```bash
# Verificar status de todos os serviços Docker
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Verificar uso de disco
df -h

# Verificar uso de memória
free -h

# Verificar load average
uptime

# Verificar serviços systemd críticos
systemctl list-units --type=service --state=running | grep -E 'docker|cloudflared'
```

### Checklist Inicial de Emergência

- [ ] Identificar o problema principal
- [ ] Verificar se é um problema de infraestrutura ou aplicação
- [ ] Verificar backups mais recentes disponíveis
- [ ] Notificar equipe de plantão se necessário
- [ ] Documentar ações tomadas durante a recuperação

---

## Serviços

---

### Hermes Agency (porta 3001)

#### Verificar se está rodando

```bash
# Status do container
docker ps | grep hermes-agency

# Testar health endpoint
curl -f http://localhost:3001/health 2>/dev/null && echo "OK" || echo "FAIL"

# Verificar logs recentes
docker logs hermes-agency --tail 50
```

#### Reiniciar

```bash
# Reiniciar via docker compose
cd /srv/docker/hermes-agency && docker compose restart

# Ou via docker restart
docker restart hermes-agency
```

#### Verificar se está fora do ar

- [ ] Verificar se a porta está ouvindo: `ss -tlnp | grep 3001`
- [ ] Verificar logs de erro: `docker logs hermes-agency --tail 100 --since 10m`
- [ ] Verificar variável `CLAUDE_API_KEY` no ambiente
- [ ] Verificar conexão com banco de dados (se aplicável)
- [ ] Verificar espaço em disco

#### Health Endpoints

```
http://localhost:3001/health
http://localhost:3001/ready
```

---

### AI Gateway (porta 4002)

#### Verificar se está rodando

```bash
# Status do container
docker ps | grep ai-gateway

# Testar health endpoint
curl -f http://localhost:4002/health 2>/dev/null && echo "OK" || echo "FAIL"

# Verificar logs recentes
docker logs ai-gateway --tail 50
```

#### Reiniciar

```bash
# Reiniciar via docker compose
cd /srv/docker/ai-gateway && docker compose restart

# Ou via docker restart
docker restart ai-gateway
```

#### Verificar se está fora do ar

- [ ] Verificar se a porta está ouvindo: `ss -tlnp | grep 4002`
- [ ] Verificar logs de erro: `docker logs ai-gateway --tail 100 --since 10m`
- [ ] Verificar configuração em `/srv/docker/ai-gateway/.env`
- [ ] Verificar conexão com LiteLLM (porta 4000)
- [ ] Verificar certificados SSL (se aplicável)

#### Health Endpoints

```
http://localhost:4002/health
http://localhost:4002/api/status
```

---

### LiteLLM (porta 4000)

#### Verificar se está rodando

```bash
# Status do container
docker ps | grep litellm

# Testar health endpoint
curl -f http://localhost:4000/health 2>/dev/null && echo "OK" || echo "FAIL"

# Verificar logs recentes
docker logs litellm --tail 50
```

#### Reiniciar

```bash
# Reiniciar via docker compose
cd /srv/docker/litellm && docker compose restart

# Ou via docker restart
docker restart litellm
```

#### Verificar se está fora do ar

- [ ] Verificar se a porta está ouvindo: `ss -tlnp | grep 4000`
- [ ] Verificar logs de erro: `docker logs litellm --tail 100 --since 10m`
- [ ] Verificar chaves de API dos provedores no config.yaml
- [ ] Verificar conexão com Redis (cache)
- [ ] Verificar configuração de rate limits

#### Health Endpoints

```
http://localhost:4000/health
http://localhost:4000/ollm/v1/model_list
```

---

### Qdrant (porta 6333)

#### Verificar se está rodando

```bash
# Status do container
docker ps | grep qdrant

# Testar health endpoint
curl -f http://localhost:6333/health 2>/dev/null && echo "OK" || echo "FAIL"

# Verificar logs recentes
docker logs qdrant --tail 50
```

#### Reiniciar

```bash
# Reiniciar via docker compose
cd /srv/docker/qdrant && docker compose restart

# Ou via docker restart
docker restart qdrant
```

#### Verificar se está fora do ar

- [ ] Verificar se a porta está ouvindo: `ss -tlnp | grep 6333`
- [ ] Verificar logs de erro: `docker logs qdrant --tail 100 --since 10m`
- [ ] Verificar espaço em disco (Qdrant precisa de espaço significativo)
- [ ] Verificar permissões do volume de dados
- [ ] Verificar se o storage está corrompido: `ls -la /srv/docker/qdrant/data/`

#### Health Endpoints

```
http://localhost:6333/health
http://localhost:6333/readyz
```

---

### MCP Servers (portas 4011-4016)

#### Verificar se estão rodando

```bash
# Status de todos os containers MCP
docker ps | grep mcp

# Verificar cada porta individualmente
for port in 4011 4012 4013 4014 4015 4016; do
  echo "Port $port:"
  curl -sf http://localhost:$port/health 2>/dev/null && echo " OK" || echo " FAIL"
done

# Verificar logs de cada container
for container in $(docker ps --format "{{.Names}}" | grep mcp); do
  echo "=== $container ==="
  docker logs $container --tail 20
done
```

#### Reiniciar

```bash
# Reiniciar todos os MCP servers
docker restart $(docker ps --format "{{.Names}}" | grep mcp)

# Ou reiniciar um específico (exemplo: mcp-server-4011)
docker restart mcp-server-4011
```

#### Verificar se estão fora do ar

- [ ] Verificar se alguma porta está ouvindo: `ss -tlnp | grep -E '401[1-6]'`
- [ ] Verificar logs de erro de cada container
- [ ] Verificar variáveis de ambiente necessárias
- [ ] Verificar conexão com serviços upstream (Ollama, LiteLLM, etc.)

#### Health Endpoints

Cada servidor MCP tem seu próprio health endpoint:
```
http://localhost:4011/health
http://localhost:4012/health
http://localhost:4013/health
http://localhost:4014/health
http://localhost:4015/health
http://localhost:4016/health
```

---

### Coolify (porta 8000)

#### Verificar se está rodando

```bash
# Status do container
docker ps | grep coolify

# Testar health endpoint
curl -sf http://localhost:8000/api/health 2>/dev/null && echo "OK" || echo "FAIL"

# Verificar logs recentes
docker logs coolify --tail 50
```

#### Reiniciar

```bash
# Coolify é gerenciado pelo systemd
sudo systemctl restart coolify

# Ou via docker
docker restart coolify
```

#### Verificar se está fora do ar

- [ ] Verificar se a porta está ouvindo: `ss -tlnp | grep 8000`
- [ ] Verificar logs: `docker logs coolify --tail 100 --since 10m`
- [ ] Verificar status do systemd: `systemctl status coolify`
- [ ] Verificar configuração do Cloudflare Tunnel
- [ ] Verificar certificados SSL

#### Health Endpoints

```
http://localhost:8000/api/health
http://localhost:8000/api/status
```

---

## Backup e Restauração

---

### Restaurar Gitea

#### Localização dos Backups

```
/srv/backups/gitea-dump-*.tar.gz
```

#### Procedimento de Restauração

```bash
# 1. Identificar o backup mais recente
ls -lt /srv/backups/gitea-dump-*.tar.gz | head -5

# 2. Parar o serviço Gitea
cd /srv/docker/gitea && docker compose down

# 3. Fazer backup do estado atual (precaução)
if [ -d /srv/docker/gitea/data ]; then
  sudo cp -r /srv/docker/gitea/data /srv/docker/gitea/data.bak.$(date +%Y%m%d%H%M%S)
fi

# 4. Limpar dados antigos
sudo rm -rf /srv/docker/gitea/data/*

# 5. Extrair o backup
BACKUP_FILE="/srv/backups/gitea-dump-LATEST.tar.gz"  # Substituir pelo arquivo específico
sudo tar -xzf "$BACKUP_FILE" -C /srv/docker/gitea/data/

# 6. Restaurar permissões
sudo chown -R 1000:1000 /srv/docker/gitea/data

# 7. Iniciar o serviço
cd /srv/docker/gitea && docker compose up -d

# 8. Verificar logs
docker logs -f gitea
```

#### Checklist Pós-Restauração

- [ ] Verificar se Gitea inicia corretamente
- [ ] Testar login
- [ ] Verificar repositórios
- [ ] Verificar webhooks
- [ ] Verificar integração com Drone CI (se configurado)

---

### Restaurar Coolify DB

#### Localização dos Backups

```
/srv/backups/coolify-db-*.sql.enc
```

#### Procedimento de Restauração

```bash
# 1. Identificar o backup mais recente
ls -lt /srv/backups/coolify-db-*.sql.enc | head -5

# 2. Parar o Coolify
sudo systemctl stop coolify
cd /srv/docker/coolify && docker compose down

# 3. Localizar container do banco de dados
DB_CONTAINER=$(docker ps -a --format "{{.Names}}" | grep coolify-db)

# 4. Descriptografar e restaurar
BACKUP_FILE="/srv/backups/coolify-db-LATEST.sql.enc"  # Substituir pelo arquivo específico

# Descriptografar (se aplicável - verificar método de criptografia usado)
# openssl enc -d -aes-256-cbc -in "$BACKUP_FILE" -out /tmp/coolify-db.sql

# Copiar para o container
docker cp /tmp/coolify-db.sql $DB_CONTAINER:/tmp/

# 5. Restaurar o banco
docker exec -it $DB_CONTAINER psql -U coolify -d coolify -f /tmp/coolify-db.sql

# 6. Limpar arquivo temporário
rm /tmp/coolify-db.sql

# 7. Iniciar o Coolify
cd /srv/docker/coolify && docker compose up -d
sudo systemctl start coolify
```

#### Checklist Pós-Restauração

- [ ] Verificar se Coolify inicia corretamente
- [ ] Verificar aplicações implantadas
- [ ] Verificar variáveis de ambiente das aplicações
- [ ] Verificar webhooks configurados

---

### Restaurar Redis

#### Localização dos Backups

```
/srv/backups/redis/dump-*.rdb.gz
```

#### Procedimento de Restauração

```bash
# 1. Identificar o backup mais recente
ls -lt /srv/backups/redis/dump-*.rdb.gz | head -5

# 2. Identificar container do Redis
REDIS_CONTAINER=$(docker ps --format "{{.Names}}" | grep redis)

# 3. Parar serviços que usam Redis
# (Verificar quais serviços dependem do Redis antes de parar)

# 4. Parar o Redis
docker exec $REDIS_CONTAINER redis-cli SHUTDOWN NOSAVE

# 5. Fazer backup do RDB atual (precaução)
docker exec $REDIS_CONTAINER redis-cli SAVE
docker cp $REDIS_CONTAINER:/data/dump.rdb /srv/backups/redis/dump.rdb.bak.$(date +%Y%m%d%H%M%S)

# 6. Copiar backup restaurado
BACKUP_FILE="/srv/backups/redis/dump-LATEST.rdb.gz"  # Substituir pelo arquivo específico
gunzip -c "$BACKUP_FILE" | docker exec -i $REDIS_CONTAINER redis-cli --pipe

# 7. Verificar integridade
docker exec $REDIS_CONTAINER redis-cli DEBUG RESTORE-MGR-DONE

# 8. Reiniciar Redis
docker restart $REDIS_CONTAINER
```

#### Checklist Pós-Restauração

- [ ] Verificar se Redis inicia corretamente
- [ ] Verificar keys existentes: `docker exec $REDIS_CONTAINER redis-cli KEYS '*'`
- [ ] Verificar configuração de persistência
- [ ] Reiniciar serviços dependentes

---

### Restaurar .env Secrets

#### Localização dos Backups

```
/srv/backups/env-secrets/
```

#### Procedimento de Restauração

```bash
# 1. Listar backups disponíveis
ls -lt /srv/backups/env-secrets/

# 2. Identificar o backup desejado (por data/serviço)
# Backups são organizados por serviço e data

# 3. Restaurar um arquivo específico
# Exemplo: Restaurar .env do AI Gateway
BACKUP_DIR="/srv/backups/env-secrets"
SERVICE="ai-gateway"
BACKUP_FILE=$(ls -t $BACKUP_DIR/$SERVICE/*.env 2>/dev/null | head -1)

if [ -n "$BACKUP_FILE" ]; then
  echo "Restaurando: $BACKUP_FILE"
  cp "$BACKUP_FILE" /srv/docker/$SERVICE/.env
else
  echo "Nenhum backup encontrado para $SERVICE"
fi

# 4. Verificar permissões
chmod 600 /srv/docker/$SERVICE/.env

# 5. Reiniciar o serviço
cd /srv/docker/$SERVICE && docker compose restart
```

#### Checklist Pós-Restauração

- [ ] Verificar se todas as variáveis necessárias estão presentes
- [ ] Reiniciar serviços afetados
- [ ] Testar conexão com serviços externos

---

## Procedimentos de Emergência

---

### Cloudflare Tunnel - Reiniciar

```bash
# Reiniciar o serviço cloudflared
sudo systemctl restart cloudflared

# Verificar status
sudo systemctl status cloudflared

# Verificar logs
sudo journalctl -u cloudflared -f --since 10m
```

---

### Docker Full - Limpeza de Espaço

```bash
# AVISO: Isso removerá TODAS as imagens, containers e volumes não utilizados

# 1. Verificar uso de disco antes
docker system df

# 2. Verificar o que será removido (dry run)
docker system prune -a --volumes --dry-run

# 3. Se confirmar, executar limpeza completa
docker system prune -a --volumes

# 4. Verificar espaço após limpeza
docker system df

# 5. Verificar espaço em disco geral
df -h
```

#### Alternativa Menos Agressiva (Recomendado)

```bash
# Remover apenas containers parados e imagens não utilizadas
docker container prune -f
docker image prune -f

# Remover volumes órfãos
docker volume prune -f

# Verificar espaço livre
df -h /srv
```

---

### ZFS Pool - Verificar Issues

```bash
# Verificar status do pool
sudo zpool status

# Verificar saúde de todos os pools
sudo zpool status -x

# Verificar capacidade
sudo zpool list

# Verificar propriedades
sudo zpool get all | grep -E 'size|capacity|allocated|free'

# Se houver problemas:
# Verificar discos físicos
lsblk

# Verificar SMART dos discos (se disponível)
sudo smartctl -H /dev/sdX

# Verificar erros no pool
sudo zpool status -v
```

---

### Reinicialização Completa de Emergência

```bash
# Sequência recomendada para reinicialização completa

# 1. Notificar usuários
# 2. Aguardar janela de manutenção

# 3. Parar todos os serviços na ordem
cd /srv/docker
docker compose -f coolify/docker-compose.yml down
docker compose -f litellm/docker-compose.yml down
docker compose -f qdrant/docker-compose.yml down
# ... outros serviços

# 4. Reiniciar Docker
sudo systemctl restart docker

# 5. Aguardar estabilização (30 segundos)
sleep 30

# 6. Iniciar serviços na ordem inversa
cd /srv/docker
docker compose -f qdrant/docker-compose.yml up -d
docker compose -f litellm/docker-compose.yml up -d
# ... outros serviços
docker compose -f coolify/docker-compose.yml up -d

# 7. Verificar todos os serviços
docker ps

# 8. Verificar endpoints de saúde
for port in 3001 4000 4002 6333 8000; do
  echo "Port $port:"
  curl -sf http://localhost:$port/health 2>/dev/null && echo " OK" || echo " FAIL"
done
```

---

## Contatos de Emergência

| Serviço | Responsável | Procedimento |
|---------|-------------|--------------|
| Infraestrutura | Equipe DevOps | Slack: #infra-oncall |
| Gitea | Admin Local | Slack: #devops |
| Coolify | Admin Local | Slack: #platform |
| Network/Tunnel | Admin Local | Slack: #netops |

### Escalação

1. **Nível 1:** Equipe de plantão local
2. **Nível 2:** Engenheiro DevOps sênior
3. **Nível 3:** Gerenciamento de infraestrutura

---

## Referência Rápida de Comandos

### Status de Todos os Serviços

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E 'hermes|ai-gateway|litellm|qdrant|mcp|coolify|gitea|redis'
```

### Reiniciar Todos os Serviços

```bash
for service in hermes-agency ai-gateway litellm qdrant coolify; do
  docker restart $service
done
```

### Verificar Portas

```bash
ss -tlnp | grep -E '3001|4000|4002|6333|8000|401[1-6]'
```

### Verificar Logs de Todos os Serviços

```bash
for service in hermes-agency ai-gateway litellm qdrant coolify; do
  echo "=== $service ==="
  docker logs $service --tail 10
done
```

---

*Este runbook deve ser atualizado sempre que houver mudanças na infraestrutura.*
