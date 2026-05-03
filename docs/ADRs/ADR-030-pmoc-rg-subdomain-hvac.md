# ADR-030: PMOC + RG Subdomain HVAC CRM

**Date:** 2026-05-02
**Status:** Proposed
**Authors:** Nexus SRE

## Context

Sistema CRM para empresa de serviços HVAC (refrigerção, climatização) com:
- **RG Subdomain**: Cada equipamento gera um subdomain `001.zappro.site` via Terraform
- **PMOC**: Plano de Manutenção Obrigatória - dois tipos:
  - **Simples** (residencial): sem CREA, apenas registro básico
  - **PMOC** (comercial): com CREA, laudo técnico oficial
- **Frontend**: Dark mode + responsivo como padrão

O monorepo já tem `equipment` e `maintenance` modules parcialmente implementados.

## Decisions

### 1. Modelo de Planos de Manutenção

**Decision:** Criar enum `MAINTENANCE_PLAN_TYPE` com dois valores:

```typescript
export const MAINTENANCE_PLAN_TYPE_ENUM = ['simples', 'pmoc'] as const;
export type MaintenancePlanType = typeof MAINTENANCE_PLAN_TYPE_ENUM[number];
```

**Rationale:** Separação clara entre residencial (sem burocracia) e comercial (com laudo CREA).

### 2. Campos PMOC vs Simples

| Campo | Simples | PMOC |
|-------|---------|------|
| `creaResponsavel` | ❌ | ✅ |
| `laudoTecnico` | ❌ | ✅ |
| `numeroEquipamentos` | ✅ | ✅ |
| `potenciaTotal` | ❌ | ✅ |
| `cargaTermica` | ❌ | ✅ |
| `vazioSanitario` | ❌ | ✅ |
| `periodicidade` | mensal | conforme Norma |
| `ativo` | boolean | boolean |

### 3. RG Subdomain via Terraform

**Decision:** Cada `equipment` com `ativo=true` gera entrada DNS:

```
resource "cloudflare_record" "equipment_rg" {
  name    = format("%03d", equipment.sequence_number)
  type    = "A"
  content = var.crm_service_ip
  proxied = true
  tags    = ["hvac", "equipment", "rg"]
}
```

**Sequence:** `equipment.sequenceNumber` (001, 002, ... 999)

**Rationale:** Permite visualização individual de cada equipamento via subdomain.

### 4. Frontend Dark Mode Default

**Decision:** MUI theme dark como default:

```typescript
const theme = createTheme({
  palette: { mode: 'dark' },
  // accent: #39FF14 (verde ácido)
});
```

## Implementation Plan

### Phase 1: Database (1h)
- [ ] Adicionar `MAINTENANCE_PLAN_TYPE_ENUM` ao schema
- [ ] Adicionar campos PMOC em `maintenance_plans` table
- [ ] Adicionar `sequenceNumber` em `equipment` table
- [ ] Migration

### Phase 2: Backend API (2h)
- [ ] Atualizar `maintenance.trpc.ts` com `planType`
- [ ] Criar `equipment.assignRgNumber()` procedure
- [ ] Criar `equipment.listForRg()` procedure (ativos ordenados)
- [ ] Atualizar Zod schemas

### Phase 3: Terraform (1h)
- [ ] Criar `modules/equipment_rg/` Terraform module
- [ ] Data source para equipment ativos
- [ ] Script generation de registros DNS

### Phase 4: Frontend (2h)
- [ ] Dark theme como default em `apps/web`
- [ ] Page de Equipamentos com RG subdomain
- [ ] Page de Planos PMOC (form com campos condicionais)
- [ ] Responsividade mobile

## Consequences

- Equipamentos comerciais terão subdomain próprio (ex: `015.zappro.site`)
- PMOC empresarial requer laudo assinado por engenheiro CREA
- Frontend unificado em dark mode (padronização visual)
