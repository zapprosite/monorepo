import { z } from "zod";

// Maintenance Plans
export const maintenancePlanMandatoryZod = z.object({
  nomeEmpresa: z.string().min(1).max(255),
  tipoEquipamento: z.enum([
    "ar-condicionado",
    "refrigerador",
    "freezer",
    "climatizador",
  ]),
  periodicidadeDias: z.number().int().min(1).max(365),
  clienteId: z.string().uuid(),
  equipamentoId: z.string().uuid(),
});

export const maintenancePlanOptionalZod = z.object({
  descricao: z.string().max(1000).optional(),
  carga: z.string().max(100).optional(),
  refrigerante: z.string().max(100).optional(),
  contratoId: z.string().uuid().optional(),
  horasEstimadas: z.number().int().min(1).max(48).optional(),
  custoEstimado: z.number().min(0).optional(),
});

export const maintenancePlanCreateZod = maintenancePlanMandatoryZod.merge(
  maintenancePlanOptionalZod
);

export const maintenancePlanUpdateZod = maintenancePlanMandatoryZod
  .partial()
  .merge(maintenancePlanOptionalZod);

// Maintenance Schedules
export const maintenanceScheduleStatusEnum = z.enum(
  ["agendada", "em-progresso", "concluida", "cancelada", "adiada"] as const
);

export const maintenanceScheduleCreateZod = z.object({
  planoManutencaoId: z.string().uuid(),
  dataAgendada: z.coerce.date(),
  tecnicoAtribuidoId: z.string().uuid().optional(),
  notasExecucao: z.string().max(2000).optional(),
});

export const maintenanceScheduleUpdateZod = z.object({
  statusManutencao: maintenanceScheduleStatusEnum,
  notasExecucao: z.string().max(2000).optional(),
  tempoExecucao: z.number().int().min(0).optional(),
  materialUsado: z.record(z.string(), z.unknown()).optional(),
});

export const maintenanceScheduleListZod = z.object({
  planoId: z.string().uuid().optional(),
  status: maintenanceScheduleStatusEnum.optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
});
