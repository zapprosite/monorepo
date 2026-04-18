import { z } from 'zod';

export const emailCampaignTypeEnum = z.enum([
	'marketing',
	'reativacao',
	'newsletter',
	'promocional',
	'transacional',
] as const);

export const emailCampaignStatusEnum = z.enum([
	'rascunho',
	'agendada',
	'enviando',
	'enviada',
	'cancelada',
] as const);

export const emailTemplateCreateZod = z.object({
	nome: z.string().min(1).max(255),
	assunto: z.string().min(1).max(255),
	corpo: z.string().min(1).max(10000),
	categoriTemplate: z.enum(['bem-vindo', 'reativacao', 'promocional', 'newsletter', 'confirmacao']),
	variavelSuportadas: z.array(z.string()).optional(),
});

export const emailCampaignCreateZod = z.object({
	nome: z.string().min(1).max(255),
	descricao: z.string().max(1000).optional(),
	tipoCampanha: emailCampaignTypeEnum,
	templateId: z.string().uuid().optional(),
	destinatariosJSON: z.array(z.string()),
	dataAgendada: z.coerce.date().optional(),
});

export const emailCampaignUpdateZod = z.object({
	nome: z.string().min(1).max(255).optional(),
	descricao: z.string().max(1000).optional(),
	statusCampanha: emailCampaignStatusEnum.optional(),
	dataAgendada: z.coerce.date().optional(),
});

export const emailCampaignListZod = z.object({
	status: emailCampaignStatusEnum.optional(),
	tipo: emailCampaignTypeEnum.optional(),
	limit: z.number().int().min(1).max(100).default(50),
	offset: z.number().int().min(0).default(0),
});

export const emailSendTestZod = z.object({
	templateId: z.string().uuid(),
	emailTeste: z.string(),
	variaveis: z.record(z.string(), z.unknown()).optional(),
});
