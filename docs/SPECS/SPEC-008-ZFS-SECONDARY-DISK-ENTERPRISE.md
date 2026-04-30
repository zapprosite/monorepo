---
name: SPEC-008
description: Padrão enterprise ZFS disco secundário — não inabilitar vibe-kit workers + Hermes
status: draft
owner: will-zappro
created: 2026-04-29
---

# SPEC-008 — Padrão Enterprise ZFS Disco Secundário

## Problema

Adicionar disco secundário NVMe ao homelab sem desabilitar a capacidade agentica do sistema (vibe-kit workers via mclaude -p, Hermes Gateway, Ollama). O risco é conflitar com o pool `tank`, mover datasets críticos, ou criar dependência de rede para acessos que precisam ser locais.

## Contexto

### Hardware Atual

| Máquina | Disco | Pool | Uso |
|---------|-------|------|-----|
| PC Principal | NVMe 4TB Gen5 | `tank` (RAID-Z) | ZFS root, /srv/monorepo, Hermes home |
| PC Secundário | NVMe 1TB Gen3 | — | Dashboard + SSH para PC Principal |

### Agentes que dependem de acesso local

| Agente/Serviço | Caminho | Padrão de acesso |
|----------------|---------|------------------|
| vibe-kit workers (mclaude -p) | `/srv/monorepo` | Local filesystem (não SSH) |
| Hermes Gateway (systemd) | `/home/will/.hermes` | Local filesystem |
| Ollama (:11434) | `/srv/models` | Local filesystem |
| Qdrant (Docker) | `/srv/data/qdrant` | Docker volume (em tank/data) |

###发现-chave

PC Secundário é **terminal humano** para PC Principal. Workers do vibe-kit NUNCA executam via SSH remote — rodam como processos locais no PC Principal, herdando permissões do usuário `will`.

## Solução

### Arquitetura de dois pools

```
TANK (disco primário)          TANK2 (disco secundário)
─────────────────────          ─────────────────────────
tank/monorepo    ← workers      tank2/backups   ← ZFS send/receive
tank/models      ← Ollama       tank2/archive   ← projetos antigos
tank/data/qdrant ← Qdrant       tank2/overflow  ← overflow (dataset em tank)
tank/home/.hermes ← Hermes      (nenhum worker acessa tank2)
```

### Regras de nomeclatura

| Regra | Razão |
|-------|-------|
| Pool primário: `tank` | vibe-kit.sh usa `SNAPSHOT_POOL=${ZFS_POOL:-tank}` |
| Pool secundário: `tank2` | Evitar conflito de nome em `zpool import` |
| Datasets: preservar mountpoints originais | workers usam caminhos hardcoded |

### Operações proibidas

```bash
# NUNCA fazer
sudo zpool import -d /dev/disk/by-id/secondary tank      # Conflito de nome
sudo zfs set mountpoint=/secondary-disk/monorepo tank/monorepo  # Move monorepo
sudo zpool create tank /dev/disk/by-id/secondary           # Substitui tank
```

## Funcionalidade

- [ ] Pool `tank2` criado no disco secundário
- [ ] `/srv/backups` migrado para `tank2/backups`
- [ ] Cron de `zfs send/receive` tank → tank2 configurado
- [ ] Dataset `tank/overflow` disponível para overflow
- [ ] Monitoramento de espaço em ambos pools
- [ ] Documentação atualizada em ARCHITECTURE.md

## Fluxo PREVC

### P — Plan
- [ ] Analisar estrutura atual de datasets
- [ ] Definir capacidade do disco secundário
- [ ] Identificar datasets não-críticos para migrar

### R — Review
- [ ] Validar que pool name `tank` permanece inalterado
- [ ] Confirmar que workers acessam via local filesystem
- [ ] Aprovar timeline de migração

### E — Execute
- [ ] `sudo zpool create tank2 <disco>`
- [ ] `sudo zfs create -o mountpoint=/srv/backups tank2/backups`
- [ ] Migrar dados existentes
- [ ] Configurar cron de snapshot replication

### V — Verify
- [ ] `zfs list -o name,mountpoint,used` confirma datasets
- [ ] Workers conseguem acessar `/srv/monorepo`
- [ ] Hermes continua respondendo em :8642
- [ ] Ollama continua servindo modelos

### C — Complete
- [ ] ARCHITECTURE.md atualizado com novo layout
- [ ] ZFS-POLICY.md atualizado com pool `tank2`
- [ ] BACKUP-STATUS.md atualizado

## Acceptance Criteria

1. Quando disco secundário é adicionado, então pool `tank` continua com mesmo nome e mountpoints
2. Quando vibe-kit workers spawnam (VIBE_PARALLEL=15), então `/srv/monorepo` permanece acessível localmente com latência <1ms
3. Quando Hermes Gateway faz restart, então `/home/will/.hermes` continua em `tank/home/.hermes`
4. Quando `zpool list` é executado, então `tank` e `tank2` aparecem como pools independentes
5. Quando `zfs send -i tank@daily tank@daily | zfs receive tank2/backups/daily` executa, então snapshots replicam sem impacto nos workers

## Tech Stack

- ZFS on Linux (native kernel module)
- Ubuntu Server 24.04
- pool: `tank` (existente), `tank2` (novo)
- Scripts: `zfs-snapshot.sh`, `zfs-snapshot-weekly.sh`

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Disco secundário muda boot order | Média | Pool não importa | `zpool set bootfs=tank` após criação |
| Dataset em tank2 acessível por workers | Baixa | Lentidão | tank2/backups não montado em caminho usado por workers |
| Nome `tank` conflita com import automático | Baixa | Acesso quebrado | Manter `tank` como único pool importável via /etc/zfs/zpool.cache |

## Referências

- `/srv/ops/ai-governance/ZFS-POLICY.md`
- `/srv/monorepo/docs/AUDITS/ZFS-SECONDARY-DISK-AGENT-PATTERN-2026-04.md`
- `/srv/monorepo/.claude/vibe-kit/vibe-kit.sh` (SNAPSHOT_POOL)
- `/srv/monorepo/docs/ARCHITECTURE.md` §4 Setup de Hardware