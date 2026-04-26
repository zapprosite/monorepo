# Skill: ZFS Smart Scrub

**Purpose:** Run ZFS scrub with intelligent error analysis, detect ECC/correctable errors, predict disk failure before it happens, alert on degradation, and automatically create snapshot before any repair operation.
**Complexity:** High
**Risk:** Medium (scrub is read-only, but发现的错误可能需要修复操作)
**When to Use:** Agendado (semanal), após erro no pool, quando disk SMART indicar problema

## When to Use

- Verificação semanal de saúde do pool
- Após qualquer alerta de erro ZFS
- Quando disco começar a mostrar erros corretáveis crescentes
- Antes de qualquer operação de repair no pool
- Após substituição de disco (validar rebuilt completo)

## Preflight Checklist

- [ ] Pool ZFS OK: `zpool status tank`
- [ ] Espaço livre >10%: `df -h /srv`
- [ ] Estado atual dos serviços: `docker ps` (saber antes)
- [ ] Identificar discos do pool: `lsblk` ou `zpool status -v tank`
- [ ] Plano de rollback se repair falhar
- [ ] Telegram bot disponível: @HOMELAB_LOGS_bot

## Procedure: Health Check First

### 1. Verificar Estado do Pool

```bash
# Status geral
zpool status tank

# Erros detalhados (contadores)
zpool status -v tank
```

### 2. Analisar Erros

| Tipo de Erro | Contador | Ação |
|--------------|----------|------|
| Unrecoverable errors | > 0 | CRITICAL → snapshot → alert |
| Correctable errors | > 10 | WARN → possivel disco falhando |
| Correctable errors | crescendo | CRITICAL → disco falhando |
| No errors | 0 | OK → prosseguir com scrub |

### 3. Verificar Último Scrub

```bash
# Verificar data do último scrub
zpool status tank | grep -i scrub

# Se scrub > 7 dias atrás → rodar novo scrub
```

## Decision Tree

```
                    ┌─────────────────────┐
                    │ Pool Status Check    │
                    │ zpool status tank    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         ┌─────────┐     ┌──────────┐     ┌──────────┐
         │ Online  │     │ Degraded │     │  Faulted │
         └────┬────┘     └────┬─────┘     └────┬─────┘
              │               │                │
              ▼               ▼                ▼
    ┌─────────────────┐  CRITICAL          CRITICAL
    │ Check Error Counts
    │ zpool status -v │
    └────────┬────────┘
             │
    ┌────────┼────────┬────────────┐
    ▼        ▼        ▼            ▼
 0 erros  <10 err  >10 err    crescendo
    │        │        │            │
    ▼        ▼        ▼            ▼
   OK     WARN    WARNING      CRITICAL
   └─┐   └─┐      └─┐           └─┐
      │     │        │             │
      ▼     ▼        ▼             ▼
   Scrub   Scrub   Snapshot    Snapshot
  (INFO)  (WARN)   + Alert     + Alert
```

## Procedure: Run Scrub

### 1. Criar Snapshot Antes (se necessário)

```bash
# Se encontrou erros ou pool degradado
SNAPSHOT="tank@pre-scrub-$(date +%Y%m%d-%H%M%S)"
sudo zfs snapshot -r "$SNAPSHOT"
echo "Snapshot created: $SNAPSHOT"
```

### 2. Iniciar Scrub

```bash
# Iniciar scrub em background
nohup zpool scrub tank &

# Alert INFO: scrub started
echo "$(date '+%Y-%m-%d %H:%M') | INFO | ZFS scrub started on tank" >> /srv/ops/ai-governance/logs/zfs-smart-scrub.log
```

### 3. Monitorar Progresso

```bash
# Poll a cada 60 segundos
while true; do
    STATUS=$(zpool status tank | grep -i scrub)
    echo "$(date '+%Y-%m-%d %H:%M') | $STATUS" >> /srv/ops/ai-governance/logs/zfs-smart-scrub.log

    # Verificar se completou
    echo "$STATUS" | grep -q "completed" && break

    # Verificar se há erros
    echo "$STATUS" | grep -q "errors" && {
        echo "$(date '+%Y-%m-%d %H:%M') | ERROR | Errors detected during scrub" >> /srv/ops/ai-governance/logs/zfs-smart-scrub.log
        break
    }

    sleep 60
done
```

### 4. Verificar Duração

```bash
# Se scrub tomou > 4 horas → WARN
# Log warning
echo "$(date '+%Y-%m-%d %H:%M') | WARN | ZFS scrub took more than 4 hours - possible disk issue" >> /srv/ops/ai-governance/logs/zfs-smart-scrub.log
```

## Procedure: SMART Data Check

### 1. Identificar Discos no Pool

```bash
# Listar discos
ls -la /dev/disk/by-id/

# Pegar device path para cada disco no pool
zpool status -v tank
```

### 2. Coletar SMART para Cada Disco

```bash
# Para cada disco
smartctl -a /dev/disk/by-id/<disk-serial>

# Indicadores críticos:
# Reallocated_Sector_Ct > 0 → disk tem bad sectors
# Current_Pending_Sector > 0 → sectors aguardando remap
# UDMA_CRC_Error_Count increasing → problema de cabo/conector
# Power_On_Hours → disco velho
# Temperature_Current → superaquecimento
```

### 3. Analisar SMART

| SMART Attribute | Valor Crítico | Significado |
|----------------|---------------|-------------|
| Reallocated_Sector_Ct | > 0 | Setores ruins realocados - disco em falha |
| Current_Pending_Sector | > 0 | Setores aguardando remapeamento |
| UDMA_CRC_Error_Count | increasing | Problema de cabo/conector SATA |
| Wear_Leveling_Count | < 5% restante | SSD no fim da vida |
| Temperature_Current | > 50°C | Superaquecimento |
| Current_Pending_Sector | growing | Disco prestes a falhar |

## Alert Levels

### INFO
```
DATE | INFO | ZFS scrub completed - no errors found
```
- Scrub iniciado
- Scrub completou limpo

### WARN
```
DATE | WARN | Correctable errors detected: N
DATE | WARN | ZFS scrub took more than 4 hours
DATE | WARN | SMART: Current_Pending_Sector > 0 on disk SERIAL
```
- Erros corretáveis encontrados
- Scrub demorou tempo excessivo
- SMART indica problema potencial

### ERROR
```
DATE | ERROR | Uncorrectable errors found in pool
DATE | ERROR | SMART Reallocated_Sector_Ct > 0 on disk SERIAL
```
- Erros não corrigíveis no pool
- SMART com setor realocado

### CRITICAL
```
DATE | CRITICAL | Pool degradation detected
DATE | CRITICAL | Disk failure imminent: SERIAL - SMART indicators
DATE | CRITICAL | Correctable errors growing over time - disk failing
```
- Pool degradado
- Disco prestes a falhar
- Erros crescentes indicam falha iminente

## Log Format

```bash
# /srv/ops/ai-governance/logs/zfs-smart-scrub.log
# Format: TIMESTAMP | LEVEL | Message

2026-04-05 08:30 | INFO | ZFS scrub started on tank
2026-04-05 09:15 | INFO | ZFS scrub in progress: 45% complete
2026-04-05 10:02 | INFO | ZFS scrub completed - no errors found
2026-04-03 14:22 | WARN | Correctable errors detected: 15
2026-04-03 14:23 | ERROR | SMART Reallocated_Sector_Ct > 0 on disk WDC_WD123
```

## Procedure: After Scrub

### 1. Verificar Resultados

```bash
# Status final
zpool status tank

# Erros desde último scrub
zpool status -v tank | grep -A5 "errors:"
```

### 2. Se Encontrou Erros → Snapshot + Alert

```bash
# Criar snapshot antes de qualquer repair
SNAPSHOT="tank@pre-repair-$(date +%Y%m%d-%H%M%S)"
sudo zfs snapshot -r "$SNAPSHOT"

# Alert via Telegram (simulado - integrar com bot real)
echo "$(date '+%Y-%m-%d %H:%M') | CRITICAL | Errors found during scrub. Snapshot $SNAPSHOT created. Manual inspection required." | tee /srv/ops/agents/state/last-alert.txt
```

### 3. Documentar

```bash
# Log completo
echo "$(date '+%Y-%m-%d %H:%M') | SCRUB RESULT | Errors: N | Duration: T | Status: STATUS" >> /srv/ops/ai-governance/logs/zfs-smart-scrub.log
```

## Validation Checklist

- [ ] Pool status: ONLINE
- [ ] No unrecoverable errors
- [ ] Scrub completed without errors
- [ ] SMART data clean for all disks
- [ ] All services running: `docker ps`
- [ ] Log written to `/srv/ops/ai-governance/logs/zfs-smart-scrub.log`

## Cleanup

```bash
# Manter apenas snapshots de pre-repair dos últimos 30 dias
zfs list -t snapshot | grep pre-scrub

# Remover snapshots antigos se necessário
sudo zfs destroy tank@pre-scrub-20260301-120000
```

## Risk Assessment

| Cenário | Risco | Mitigação |
|---------|-------|-----------|
| Scrub em pool healthy | Baixo | Operation read-only |
| Erros encontrados | Médio | Snapshot antes de repair |
| Pool degradado | Alto | Não fazer scrub - investigar primeiro |
| Disco falhando | Crítico | Snapshot + replace disco |

**WARNING:** Nunca fazer scrub em pool já degradado - pode causar falha total.

## See Also

- `zfs-snapshot-and-rollback.md` — skill base para snapshots
- `linux-host-diagnostic.md` — diagnóstico geral do host
- `monitoring-health-check.md` — verificar serviços após операции
- `/srv/ops/agents/scripts/zfs-scrub.sh` — script agent para execução automática

## Integration Points

- **Telegram Bot:** @HOMELAB_LOGS_bot (alertas de erro)
- **State File:** `/srv/ops/agents/state/last-scrub-status.txt`
- **Agent Script:** `/srv/ops/agents/scripts/zfs-scrub.sh`
- **Schedule:** Executar via cron semanalmente (recomendado: domingo 03:00)