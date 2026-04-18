import z from 'zod';
import { webhookEventoTipoZod, webhookStatusZod } from './crm_enums.zod.js';
import { zString, zTimestamps } from './zod_utils.js';

export const webhookCreateInputZod = z.object({
	url: zString.url(),
	eventoTipo: webhookEventoTipoZod,
	ativo: z.boolean().default(true),
	tentativasMax: z.number().int().min(1).max(10).default(3),
	intervaloRetryMin: z.number().int().min(30).default(60),
	clienteId: z.string().uuid(),
});

export const webhookUpdateInputZod = webhookCreateInputZod.partial();

export const webhookSelectAllZod = webhookCreateInputZod
	.extend({
		id: z.string().uuid(),
		usuarioCriacaoId: z.string().uuid(),
	})
	.extend(zTimestamps);

export type WebhookCreateInput = z.infer<typeof webhookCreateInputZod>;
export type WebhookUpdateInput = z.infer<typeof webhookUpdateInputZod>;
export type WebhookSelectAll = z.infer<typeof webhookSelectAllZod>;

// Webhook Deliveries
export const webhookDeliveryCreateInputZod = z.object({
	webhookId: z.string().uuid(),
	eventoId: z.string().uuid(),
	eventoTipo: webhookEventoTipoZod,
	payload: z.record(z.string(), z.any()),
});

export const webhookDeliverySelectAllZod = webhookDeliveryCreateInputZod
	.extend({
		id: z.string().uuid(),
		statusEntrega: webhookStatusZod,
		tentativaAtual: z.number().int().default(0),
		proximaTentativa: z.date().nullable(),
		respostaHttp: z.number().int().nullable(),
		erroMensagem: zString.nullable(),
	})
	.extend(zTimestamps);

export type WebhookDeliveryCreateInput = z.infer<typeof webhookDeliveryCreateInputZod>;
export type WebhookDeliverySelectAll = z.infer<typeof webhookDeliverySelectAllZod>;

// Eventos
export const eventoCreateInputZod = z.object({
	tipo: z.string(),
	clienteId: z.string().uuid(),
	entidadeId: z.string().uuid(),
	entidadeTipo: zString,
	payload: z.record(z.string(), z.any()),
});

export const eventoSelectAllZod = eventoCreateInputZod.extend({
	id: z.string().uuid(),
	processado: z.boolean().default(false),
	createdAt: z.date(),
});

export type EventoCreateInput = z.infer<typeof eventoCreateInputZod>;
export type EventoSelectAll = z.infer<typeof eventoSelectAllZod>;
