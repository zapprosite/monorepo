import { z } from 'zod';

export const loyaltyLevelEnum = z.enum(['bronze', 'prata', 'ouro', 'platinum']);
export const loyaltyStatusEnum = z.enum([
	'ativo',
	'risco-30d',
	'risco-60d',
	'risco-90d',
	'perdido',
]);

export const loyaltyScoreZod = z.object({
	clienteId: z.string().uuid(),
	pontos: z.number().int().min(0).optional(),
	nivel: loyaltyLevelEnum.optional(),
	diasSemContato: z.number().int().optional(),
	statusReativacao: loyaltyStatusEnum.optional(),
});

export const loyaltyDashboardZod = z.object({
	clienteId: z.string().uuid(),
});

export const reactivationTriggerZod = z.object({
	clienteId: z.string().uuid(),
	mensagem: z.string().max(500).optional(),
});

export const loyaltyListZod = z.object({
	status: loyaltyStatusEnum.optional(),
	nivelMinimo: loyaltyLevelEnum.optional(),
	limit: z.number().int().min(1).max(100).default(50),
	offset: z.number().int().min(0).default(0),
});
