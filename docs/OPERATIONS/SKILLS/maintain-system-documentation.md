# Skill: Manter Documentação do Sistema

**Propósito:** Manter ~/Desktop/SYSTEM_ARCHITECTURE.md atualizado com estado atual do sistema, histórico e referências de governança

**Usado por:** `codex-host "manter documentação"`

---

## Quando Usar

- Após mudanças significativas (reiniciar serviço, upgrade, snapshot, etc.)
- Mensalmente como parte dos testes de saúde
- Antes de compartilhar estado do sistema com alguém
- Para atualizar o journal do desktop com status mais recente

**Frequência:** Semanal recomendado, manual conforme necessário

---

## Lista de Verificação Prévia

Antes de executar:

- [ ] Você tem acesso de escrita em ~/Desktop
- [ ] Diretório /srv/ops/ai-governance/ existe e é legível
- [ ] Docker está rodando (`docker ps` funciona)
- [ ] ZFS está acessível (`zpool status tank` funciona)
- [ ] Pelo menos 10MB livre no diretório home

---

## Procedimento

### Passo 1: Coletar Estado Atual

A skill irá:

1. Ler todos os documentos em `/srv/ops/ai-governance/`
2. Consultar status dos serviços Docker
3. Verificar saúde do pool ZFS
4. Listar mudanças recentes do git se no monorepo
5. Verificar uso de disco em /srv
6. Encontrar incidentes/mudanças mais recentes em INCIDENTS.md

### Passo 2: Construir Documento de Arquitetura

Gera ~/Desktop/SYSTEM_ARCHITECTURE.md com seções:

```markdown
# System Architecture - homelab

## Current Status

- Timestamp
- All services status (✅ running / ⚠️ warning / ❌ down)
- Disk usage
- ZFS pool health

## System Structure

- Tree of /srv with descriptions
- Tree of /srv/data with dataset info
- Tree of /srv/monorepo with workspace layout

## Services & Dependencies

- Qdrant status, port, storage
- n8n status, port, storage
- PostgreSQL status, port, storage
- Monorepo dev stack

## Governance References

- Links to all /srv/ops/ai-governance/ files
- Quick commands from RUNBOOK.md
- Common operations from guide.md
- Approval matrix from APPROVAL_MATRIX.md

## Recent Changes (Last 30 Days)

- Git commits to monorepo
- Service restarts
- Snapshot/backup operations
- Configuration changes

## Complete History (Since Ubuntu Install)

### Phase 1: Infrastructure (2026-03-??)

- OS installation
- ZFS pool creation
- Docker setup
- Service deployments

### Phase 2: Governance (2026-03-16)

- Governance framework deployment
- Claude Code integration
- Codex CLI integration
- Documentation creation

## Key Files (Quick Reference)

- QUICK_START.md - 5min overview
- GUARDRAILS.md - What's forbidden
- CHANGE_POLICY.md - Safe modification
- RECOVERY.md - When things break
- guide.md - This help guide
- RUNBOOK.md - Official commands

## Service Commands

- Health checks
- Restart procedures
- Backup commands
- Snapshot commands

## Troubleshooting Checklist

- Service won't start
- Disk is full
- ZFS pool degraded
- PostgreSQL issues
- Qdrant issues
```

### Passo 3: Registrar no Log de Histórico

Adiciona entrada em /srv/ops/ai-governance/logs/documentation-updates.log:

```
[TIMESTAMP] Documentação atualizada
  Gatilho: manual via codex-host
  Serviços verificados: qdrant, n8n, postgres, docker
  Mudanças incluídas: [listar novos docs, incidentes, mudanças]
  Arquivo: ~/Desktop/SYSTEM_ARCHITECTURE.md
```

### Passo 4: Validar

A skill irá verificar:

- [ ] ~/Desktop/SYSTEM_ARCHITECTURE.md existe e é legível
- [ ] Todos os arquivos de governança referenciados têm caminhos válidos
- [ ] Seção de histórico recente tem entradas
- [ ] Histórico completo está completo
- [ ] Status de todos os serviços é preciso

---

## Reverter

Se a documentação quebrar ou ficar desatualizada:

```bash
# Versão anterior
cat ~/Desktop/SYSTEM_ARCHITECTURE.md.backup

# Re-executar skill
codex-host "manter documentação"

# Ou deletar manualmente e regenerar
rm ~/Desktop/SYSTEM_ARCHITECTURE.md
codex-host "manter documentação"
```

---

## Riscos & Mitigações

| Risco                                 | Mitigação                                                              |
| ------------------------------------- | ---------------------------------------------------------------------- |
| Arquivo do desktop fica desatualizado | Execute a skill regularmente (semanal)                                 |
| Seção de histórico fica muito longa   | Mantenha janela de 30 dias, arquive antigos                            |
| Symlinks quebrados no doc             | Valide caminhos antes de publicar                                      |
| Problema de permissões                | Skill roda como usuário atual, verifica acesso de escrita em ~/Desktop |

---

## Exemplos

### Execução Normal

```bash
codex-host "manter documentação"
# Saída esperada:
# Coletando estado do sistema...
# ✅ Serviços Docker: 3/3 rodando
# ✅ Pool ZFS: ONLINE
# ✅ Uso de disco: /srv 85% de 3.6TB
# Atualizando ~/Desktop/SYSTEM_ARCHITECTURE.md...
# ✅ Documentação atualizada
# Última execução: 2026-03-16 14:30 UTC
```

### Com Problemas

```bash
codex-host "manter documentação"
# Aviso: Qdrant relata alto uso de CPU
# Aviso: Disco /srv em 92% da capacidade
# ✅ Documentação atualizada (com avisos anotados)
```

---

## Notas de Implementação

A skill:

1. É idempotente (segura executar múltiplas vezes)
2. Apenas lê estado do sistema (sem modificações exceto ~/Desktop/)
3. Preserva versão anterior como .backup
4. Roda como usuário atual (sem sudo necessário)
5. Registra cada execução em /srv/ops/ai-governance/logs/

---

## Manutenção

Atualize esta skill quando:

- Novos serviços são adicionados (adicionar à seção de status)
- Novos documentos de governança criados (adicionar às referências)
- Procedimentos de recovery mudam (atualizar histórico)
- Implementação da skill muda

---

## Skills Relacionadas

- `zfs-snapshot-and-rollback` - Tirar snapshots antes de mudanças maiores
- `docker-platform-ops` - Gerenciar status dos serviços
- `linux-host-change` - Documentar modificações do host

---

**Versão da Skill:** 1.0
**Última Atualização:** 2026-03-16
**Mantenedor:** Framework de Governança
