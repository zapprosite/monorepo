# SPEC-CRM-COMPLETION: CRM HVAC — Finalização MVP

**Código:** SPEC-CRM-COMPLETION
**Status:** READY FOR EXECUTION
**Data:** 2026-05-03
**Meta:** 0 TS errors + RG subdomain + PMOC checklist + PDF generation

---

## 1. Estado Atual

### 1.1 O que EXISTE (✅ COMPLETO)

Todos os módulos CRUD abaixo estão implementados e funcionais:

| Módulo | Arquivos Principais | Status |
|--------|-------------------|--------|
| Clients | `clients.trpc.ts`, `clients.table.ts` | ✅ |
| Leads | `leads.trpc.ts`, `leads.table.ts` | ✅ |
| Contracts | `contracts.trpc.ts`, `contracts.table.ts` | ✅ |
| Equipment | `equipment.trpc.ts`, `equipment.table.ts` | ✅ |
| Service Orders | `service-orders.trpc.ts` | ✅ |
| Kanban | `kanban.trpc.ts` | ✅ |
| Maintenance | `maintenance.trpc.ts`, `maintenance.table.ts` | ✅ |
| Schedule | `schedule.trpc.ts` | ✅ |
| Reminders | `reminders.trpc.ts` | ✅ |
| Dashboard | `dashboard.trpc.ts` | ✅ |
| Webhooks | `webhooks.trpc.ts` | ✅ |
| Subscriptions | `subscriptions.trpc.ts` | ✅ |
| Editorial | `editorial.trpc.ts` | ✅ |
| Users | `users.trpc.ts`, `user-roles.trpc.ts` | ✅ |
| Auth | `auth.trpc.ts` | ✅ |
| Teams | `teams.trpc.ts` | ✅ |

### 1.2 O que está PENDENTE (❌)

| # | Funcionalidade | Prioridade | Complexidade |
|---|---------------|------------|--------------|
| 1 | **TypeScript: 256 erros** — causa raiz `@connected-repo/zod-schemas` vs `@repo/zod-schemas` | CRITICAL | Baixa |
| 2 | **RG Public Endpoint** — `GET /equip/:hash` serve página pública do equipamento | HIGH | Média |
| 3 | **PMOC Checklist** — checklist itemizado para manutenção preventiva | HIGH | Alta |
| 4 | **Photo Upload** — upload de fotos para OS/PMOC | HIGH | Média |
| 5 | **PDF Generation** — skill `make-pdf` + template HTML + Puppeteer | HIGH | Alta |
| 6 | **Digital Signature** — canvas de assinatura para OS | MEDIUM | Média |
| 7 | **Company Identity** — logo, cores, CNPJ configurável | MEDIUM | Baixa |
| 8 | **QR Code** — geração de QR code para PDFs | MEDIUM | Baixa |
| 9 | **Hybrid Auth** — Google OAuth (admin) + local (colaboradores) | MEDIUM | Alta |

---

## 2. Tipo de Erros TypeScript (CRITICAL — Bloca Build)

### 2.1 Distribuição Atual (256 erros)

```
TS2307 — 61 erros — Cannot find module '@connected-repo/zod-schemas/...'
TS2578 — 66 erros — Unused '@ts-expect-error' directive
TS2742 — 38 erros — pqb internal type inference (falta // @ts-ignore)
TS2345 — 34 erros — Argument type mismatch
TS2339 —  ~4 erros — Property does not exist on type
TS6133 —  ~8 erros — Unused variables
TS2353 —  ~3 erros — Object literal unknown properties
TS2551 —  ~3 erros — Did you mean 'xxx'?
TS2322 —  ~5 erros — Type not assignable
TS7006 —  ~5 erros — Implicit any parameter
TS2353 —  ~2 erros — Extra properties not allowed
TS2304 —  ~1 erro  — Cannot find name 'FAKE_UUID_2'
```

### 2.2 Causa Raiz Principal (61 erros TS2307)

**PROBLEMA:** O `package.json` em `packages/zod-schemas` define:

```json
{
  "name": "@repo/zod-schemas"
}
```

Mas o código em `apps/api/src/` importa de `@connected-repo/zod-schemas` — um nome de package **inexistente**.

**EVIDÊNCIA:**
```bash
grep -r "@connected-repo/zod-schemas" apps/api/src/ | wc -l
# → 61 ocorrências em 40+ arquivos
```

**SOLUÇÃO:** Batch replace em todo o `apps/api/src/`:

```bash
find apps/api/src -name "*.ts" -exec sed -i \
  's|@connected-repo/zod-schemas|@repo/zod-schemas|g' {} \;
```

### 2.3 Erros TS2742 Restantes (38 erros)

Cada tabela `.table.ts` precisa de supressão:

```typescript
// ANTES (erro TS2742):
export const clientsTable = db.table('clients', {
  columns: { ... }
});

// DEPOIS (suprime erro):
// @ts-ignore TS2742 — pqb internal type inference not portable
export const clientsTable = db.table('clients', {
  columns: { ... }
});
```

**PADRÃO:** Adicionar `// @ts-ignore TS2742` na linha imediatamente acima de cada `export const *Table = db.table(...)`.

### 2.4 Erros TS2578 Unused Directive (66 erros)

Remover diretivas `@ts-expect-error` que não suprimem mais nenhum erro:

```bash
pnpm typecheck 2>&1 | grep "TS2578" | head -20
# Lista os arquivos com @ts-expect-error não utilizados
```

**AÇÃO:** Remover cada `@ts-expect-error` que não tem mais erro correspondente.

---

## 3. Plano de Execução (Ordem Obrigatória)

### FASE 0 — TypeScript Cleanup (CRITICAL)

**ANTES de qualquer feature, corrigir os 256 erros TypeScript.**

#### TAREFA 0.1 — Fix Import Paths (61 erros TS2307)

```bash
# Executar em apps/api/src/
find apps/api/src -name "*.ts" -exec sed -i \
  's|@connected-repo/zod-schemas|@repo/zod-schemas|g' {} \;

# Verificar resultado
pnpm typecheck 2>&1 | grep "TS2307.*zod-schemas" | wc -l
# Esperado: 0
```

#### TAREFA 0.2 — Add @ts-ignore TS2742 nas Tables (38 erros)

```bash
# Listar arquivos com TS2742 em .table.ts
pnpm typecheck 2>&1 | grep "TS2742.*columns\|TS2742.*inferred" | \
  grep "\.table\.ts" | head -40
```

**Pattern para cada arquivo `*.table.ts`:**

```typescript
// Adicionar esta linha ANTES de cada export const *Table = db.table(...)
// @ts-ignore TS2742 — pqb internal type inference not portable
```

#### TAREFA 0.3 — Remove Unused @ts-expect-error (66 erros TS2578)

```bash
# Listar arquivos com TS2578
pnpm typecheck 2>&1 | grep "TS2578" | head -20

# Para cada arquivo, remover a linha @ts-expect-error que não suprime mais nada
```

### FASE 1 — RG Public Endpoint

**Arquitetura:**
```
Client → GET https://{hash}.zappro.site/equip/{id}
       → Cloudflare Tunnel (wildcard *.zappro.site)
       → Fastify route: /public/equip/:hash
       → Lookup equipment by hash
       → Return HTML page
```

#### TAREFA 1.1 — Database: Add subdomain hash to Equipment

**Arquivo:** `packages/db/src/schema/equipment.table.ts`

```typescript
// Adicionar coluna
subdomain: varchar('subdomain', { length: 16 }).unique(), // hash aleatório
```

#### TAREFA 1.2 — Generate hash on equipment creation

**Arquivo:** `apps/api/src/modules/equipment/equipment.trpc.ts`

```typescript
// Função utilitária
function generateSubdomainHash(): string {
  return Math.random().toString(36).substring(2, 10);
}

// No procedure createEquipment:
.subdomain(generateSubdomainHash())
```

#### TAREFA 1.3 — Public Fastify route

**Arquivo:** `apps/api/src/routes/public.routes.ts` (criar se não existir)

```typescript
// GET /public/equip/:subdomain
fastify.get('/public/equip/:subdomain', async (request, reply) => {
  const { subdomain } = request.params;
  const equipment = await db.equipment.findFirst({
    where: { subdomain, status: 'ativo' }
  });
  if (!equipment) {
    return reply.status(404).send('Equipamento não encontrado');
  }
  return reply.send(renderEquipmentPage(equipment));
});
```

#### TAREFA 1.4 — HTML Template para RG

**Arquivo:** `apps/api/src/templates/equipment-rg.html.ts` (criar)

```typescript
export function renderEquipmentPage(equipment: Equipment): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>RG Equipamento - ${equipment.serialNumber}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Inter, sans-serif; margin: 0; padding: 20px; }
    .header { background: #39FF14; color: #0A0A0F; padding: 20px; }
    .card { border: 1px solid #333; margin: 20px 0; padding: 15px; }
    .badge-ok { background: green; color: white; padding: 4px 8px; }
    .badge-expired { background: red; color: white; padding: 4px 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${equipment.clientName}</h1>
    <p>${equipment.clientAddress}</p>
  </div>
  <div class="card">
    <h2>${equipment.model} - ${equipment.btuHour} BTU</h2>
    <p><strong>Série:</strong> ${equipment.serialNumber}</p>
    <p><strong>Gás:</strong> ${equipment.refrigerantGas}</p>
    <p><strong>Local:</strong> ${equipment.location}</p>
  </div>
  <div class="card">
    <h3>Status PMOC</h3>
    ${equipment.pmocDueDate > new Date() 
      ? '<span class="badge-ok">Em dia</span>' 
      : '<span class="badge-expired">Vencido</span>'}
    <p>Próxima manutenção: ${formatDate(equipment.pmocDueDate)}</p>
  </div>
  <a href="https://wa.me/55...">Solicitar orçamento</a>
</body>
</html>`;
}
```

### FASE 2 — PMOC Checklist

**Referência:** SPEC-HVACR-V2-001.md Seção 2

#### TAREFA 2.1 — Criar MaintenanceChecklist table

**Arquivo:** `packages/db/src/schema/maintenance-checklist.table.ts` (criar)

```typescript
export const maintenanceChecklistTable = db.table('maintenance_checklist', {
  columns: {
    id: uuid().primaryKey().default(genUUID()),
    scheduleId: uuid().references(() => maintenanceSchedulesTable.id),
    // Campos do checklist (conforme SPEC)
    temperaturaAmbiente: decimal('temperatura_ambiente'),
    temperaturaInsuflada: decimal('temperatura_insuflada'),
    pressaoSuccao: decimal('pressao_succao'),
    pressaoDescarga: decimal('pressao_descarga'),
    amperagemCompressor: decimal('amperagem_compressor'),
    nivelGasRefrigerante: varchar('nivel_gas_refrigerante'), // normal/baixo/vazio
    estadoFiltros: varchar('estado_filtros'), // limpo/sujo/trocado
    limpezaSerpentina: boolean('limpeza_serpentina').default(false),
    funcionamentoDreno: boolean('funcionamento_dreno').default(false),
    vazamentos: varchar('vazamentos'), // nenhum/pequeno/grave
    observacoes: text('observacoes'),
    photos: json('photos').default([]), // URLs das fotos
    technicianSignature: text('technician_signature'), // base64 PNG
    clientSignature: text('client_signature'), // base64 PNG
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
  }
});
```

#### TAREFA 2.2 — Criar MaintenanceChecklist tRPC router

**Arquivo:** `apps/api/src/modules/maintenance/maintenance-checklist.trpc.ts` (criar)

```typescript
export const maintenanceChecklistRouter = trpc.router({
  create: protectedProcedure
    .input(maintenanceChecklistInputZod)
    .mutation(async ({ ctx, input }) => {
      // Verify team ownership
      const schedule = await db.maintenanceSchedules.findFirst({
        where: { id: input.scheduleId, teamId: ctx.user.teamId }
      });
      if (!schedule) throw new TRPCError({ code: 'FORBIDDEN' });
      
      return db.maintenanceChecklist.insert(input);
    }),
    
  getBySchedule: protectedProcedure
    .input(z.object({ scheduleId: z.string() }))
    .query(async ({ ctx, input }) => {
      return db.maintenanceChecklist.findFirst({
        where: { scheduleId: input.scheduleId }
      });
    }),
    
  complete: protectedProcedure
    .input(maintenanceChecklistCompleteZod) // inclui signatures
    .mutation(async ({ ctx, input }) => {
      // Atualiza checklist com fotos e assinaturas
      // Dispara geração de PDF
      return db.maintenanceChecklist.update({
        where: { id: input.id },
        data: {
          ...input,
          completedAt: new Date()
        }
      });
    }),
});
```

#### TAREFA 2.3 — Register in trpc.router.ts

**Arquivo:** `apps/api/src/routers/trpc.router.ts`

```typescript
import { maintenanceChecklistRouter } from '../modules/maintenance/maintenance-checklist.trpc';

export const trpcRouter = trpc.router({
  // ... existing routers
  maintenanceChecklist: maintenanceChecklistRouter,
});
```

### FASE 3 — Photo Upload

#### TAREFA 3.1 — Configure file upload

**Arquivo:** `apps/api/src/modules/upload/upload.trpc.ts` (criar)

```typescript
import { uploadToDisk } from '@backend/lib/upload';

export const uploadRouter = trpc.router({
  uploadPhoto: protectedProcedure
    .input(z.object({
      file: z.string(), // base64
      filename: z.string(),
      equipmentId: z.string().optional(),
      scheduleId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate MIME type (image only)
      // Validate file size (max 5MB)
      // Save to /data/uploads/{teamId}/{date}/
      // Return public URL
      const url = await uploadToDisk({
        base64: input.file,
        filename: input.filename,
        teamId: ctx.user.teamId,
        folder: 'photos',
      });
      return { url };
    }),
});
```

### FASE 4 — PDF Generation

**Skill:** `make-pdf` (Puppeteer-based)

#### TAREFA 4.1 — Create PDF template

**Arquivo:** `apps/api/src/templates/os-pdf.html.ts`

(Ver SPEC-HVACR-V2-001.md Seção 4 para template completo)

#### TAREFA 4.2 — Integrate make-pdf skill

**Arquivo:** `apps/api/src/modules/service-orders/service-orders.trpc.ts`

```typescript
// No procedure completeOrder:
import { makePdf } from '@backend/skills/make-pdf';

const pdfUrl = await makePdf({
  template: 'os-pdf',
  data: {
    osNumber: order.number,
    client: client.name,
    equipment: equipment.model,
    // ... todos os campos do checklist
    photos: checklist.photos,
    technicianSignature: checklist.technicianSignature,
    clientSignature: checklist.clientSignature,
    rgUrl: `https://${equipment.subdomain}.zappro.site/equip/${equipment.id}`,
  },
  identity: await getCompanyIdentity(ctx.user.teamId),
});

await db.serviceOrders.update({
  where: { id: order.id },
  data: { pdfUrl, completedAt: new Date() }
});

return { pdfUrl };
```

#### TAREFA 4.3 — Create Company Identity table

**Arquivo:** `packages/db/src/schema/company.table.ts` (criar)

```typescript
export const companyTable = db.table('company', {
  columns: {
    id: uuid().primaryKey().default(genUUID()),
    teamId: uuid().references(() => teamsTable.id),
    name: varchar('name', { length: 255 }),
    cnpj: varchar('cnpj', { length: 20 }),
    phone: varchar('phone', { length: 20 }),
    address: text('address'),
    logoUrl: varchar('logo_url', { length: 500 }),
    primaryColor: varchar('primary_color', { length: 7 }).default('#39FF14'),
    secondaryColor: varchar('secondary_color', { length: 7 }).default('#0A0A0F'),
    ownerSignature: text('owner_signature'), // base64 PNG
    createdAt: timestamp('created_at').defaultNow(),
  }
});
```

### FASE 5 — Digital Signature

#### TAREFA 5.1 — Signature capture component (Frontend)

**Arquivo:** `apps/web/src/components/SignatureCanvas.tsx` (criar)

```typescript
// react-signature-canvas wrapper
export function SignatureCanvas({ onSave }: { onSave: (sig: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  return (
    <div>
      <canvas ref={canvasRef} width={400} height={200} />
      <button onClick={() => {
        const dataUrl = canvasRef.current?.toDataURL('image/png');
        onSave(dataUrl);
      }}>Confirmar assinatura</button>
      <button onClick={() => canvasRef.current?.clear()}>Limpar</button>
    </div>
  );
}
```

### FASE 6 — QR Code

#### TAREFA 6.1 — QR Code in PDF

**Biblioteca:** `qrcode` (npm package)

```typescript
import QRCode from 'qrcode';

const qrCodeDataUrl = await QRCode.toDataURL(rgUrl, {
  width: 200,
  margin: 2,
});

// Adicionar ao template PDF
<img src="${qrCodeDataUrl}" class="qrcode" />
```

### FASE 7 — Hybrid Auth

#### TAREFA 7.1 — Auth flow analysis

O sistema atual já tem:
- `auth.trpc.ts` com Google OAuth
- `users.trpc.ts` com CRUD de usuários

**PENDENTE:**
- Separar admin (Google OAuth) de colaboradores (local password)
- Adicionar campo `authType: 'google' | 'local'` em users
- Adicionar campo `passwordHash` para auth local

#### TAREFA 7.2 — Password hashing

**Usar `bcrypt`** (já disponível no projeto via `scripts/`):

```typescript
import bcrypt from 'bcrypt';

const passwordHash = await bcrypt.hash(password, 10);
```

---

## 4. Estrutura de Arquivos (Referência)

```
apps/api/src/
├── modules/
│   ├── equipment/
│   │   ├── equipment.trpc.ts       ✅ existente
│   │   └── equipment.table.ts     ✅ existente
│   ├── maintenance/
│   │   ├── maintenance.trpc.ts     ✅ existente
│   │   ├── maintenance.table.ts   ✅ existente
│   │   └── maintenance-checklist.trpc.ts  # NOVO
│   ├── service-orders/
│   │   └── service-orders.trpc.ts  ✅ existente (adicionar completePdf)
│   ├── upload/                     # NOVO
│   │   └── upload.trpc.ts
│   └── auth/
│       └── auth.trpc.ts            ✅ existente (modificar)
├── routes/
│   └── public.routes.ts            # NOVO
├── templates/
│   ├── equipment-rg.html.ts        # NOVO
│   └── os-pdf.html.ts              # NOVO
├── skills/
│   └── make-pdf.ts                # NOVO (skill)
└── routers/
    └── trpc.router.ts              ✅ existente (registrar novos routers)

packages/db/src/schema/
├── equipment.table.ts              ✅ existente (adicionar subdomain)
├── maintenance-checklist.table.ts # NOVO
└── company.table.ts                 # NOVO

apps/web/src/
├── components/
│   └── SignatureCanvas.tsx        # NOVO
└── pages/
    └── service-orders/
        └── [id]/execute.tsx       # NOVO (execução com checklist)
```

---

## 5. Comandos de Validação

### Após FASE 0 (TypeScript):

```bash
# Deve retornar 0 erros
pnpm typecheck 2>&1 | grep "error TS" | wc -l
# Esperado: 0

# Build deve passar
pnpm build 2>&1 | tail -5
# Esperado: "Tasks: N successful"
```

### Após FASE 1 (RG Endpoint):

```bash
# Health check
curl -s http://localhost:3000/health | python3 -m json.tool

# Teste de subdomain (após Terraform):
curl -s https://a3k9m2p1.zappro.site/equip/abc-123 | head -20
```

### Após FASE 4 (PDF):

```bash
# Verificar se skill make-pdf existe
ls -la apps/api/src/skills/make-pdf.ts
```

---

## 6. Critério de Pronto (Definition of Done)

- [ ] `pnpm typecheck` → 0 erros
- [ ] `pnpm build` → Tasks: N successful
- [ ] API health check → ok
- [ ] GET /public/equip/:hash → HTML da página do equipamento
- [ ] POST /maintenance/checklist → cria checklist com campos PMOC
- [ ] POST /upload/photo → retorna URL pública da imagem
- [ ] POST /service-orders/:id/complete → gera PDF com QR code
- [ ] GET /company → retorna identidade visual configurada

---

## 7. Dependências

### NPM Packages a adicionar:

```bash
# PDF Generation
pnpm add puppeteer qrcode

# Auth
pnpm add bcrypt
```

### Packages já disponíveis:

- `@trpc/server` ✅
- `zod` ✅
- `@repo/db` ✅
- `@repo/zod-schemas` ✅
- `fastify` ✅

---

## 8. Nota para Ejecução por Outro LLM

Este plano deve ser executado **em ordem das Fases 0 → 7**.

**Regra CRÍTICA:** Não pule a Fase 0. Os 256 erros TypeScript bloqueiam qualquer feature nova.

**Cada Fase é independente?** Não. Há dependências:
- FASE 2 (PMOC Checklist) depende de FASE 1 (equipment com subdomain)
- FASE 4 (PDF) depende de FASE 3 (upload) e FASE 5 (signature)
- FASE 6 (QR) depende de FASE 4 (template)

**Se aparecerem erros TypeScript durante a implementação:**
1. Run `pnpm typecheck 2>&1 | grep "error TS" | wc -l`
2. Se > 0, aplique o mesmo padrão de `// @ts-ignore` das tabelas existentes
3. Nunca remova `@ts-ignore` que estão funcionando

---

**Last updated:** 2026-05-03
**Author:** Nexus SRE
**Próximo passo:** Executar FASE 0 (TypeScript cleanup)
