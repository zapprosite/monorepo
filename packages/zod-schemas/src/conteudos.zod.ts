import z from 'zod';
import { conteudoStatusZod, conteudoTipoZod } from './crm_enums.zod.js';
import { zString, zTimestamps } from './zod_utils.js';

export const conteudoCreateInputZod = z.object({
	titulo: zString,
	slug: zString,
	descricao: zString.nullable().default(null),
	corpo: zString,
	tipo: conteudoTipoZod,
	status: conteudoStatusZod.default('rascunho'),
	geradoIA: z.boolean().default(false),
	seoTitulo: zString.nullable().default(null),
	seoDescricao: zString.nullable().default(null),
	seoSlug: zString.nullable().default(null),
	metaTags: z.record(z.string(), z.any()).nullable().default(null),
	dataPublicacao: z.date().nullable().default(null),
	clienteId: z.string().uuid(),
	autorId: z.string().uuid(),
});

export const conteudoUpdateInputZod = conteudoCreateInputZod.partial();

export const conteudoSelectAllZod = conteudoCreateInputZod
	.extend({
		id: z.string().uuid(),
	})
	.extend(zTimestamps);

export const conteudoGetBySlugZod = z.object({
	slug: zString,
	clienteId: z.string().uuid(),
});

export type ConteudoCreateInput = z.infer<typeof conteudoCreateInputZod>;
export type ConteudoUpdateInput = z.infer<typeof conteudoUpdateInputZod>;
export type ConteudoSelectAll = z.infer<typeof conteudoSelectAllZod>;

// Conteúdo Revisões
export const conteudoRevisaoCreateInputZod = z.object({
	conteudoId: z.string().uuid(),
	corpo: zString,
	changelog: zString.nullable().default(null),
	revisorId: z.string().uuid(),
});

export const conteudoRevisaoUpdateInputZod = conteudoRevisaoCreateInputZod.partial();

export const conteudoRevisaoSelectAllZod = conteudoRevisaoCreateInputZod.extend({
	id: z.string().uuid(),
	createdAt: z.date(),
});

export type ConteudoRevisaoCreateInput = z.infer<typeof conteudoRevisaoCreateInputZod>;
export type ConteudoRevisaoUpdateInput = z.infer<typeof conteudoRevisaoUpdateInputZod>;
export type ConteudoRevisaoSelectAll = z.infer<typeof conteudoRevisaoSelectAllZod>;
