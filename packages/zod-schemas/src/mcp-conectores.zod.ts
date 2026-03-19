import z from "zod";
import { zString, zTimestamps } from "./zod_utils.js";
import {
	mcpProviderZod,
	mcpConectarStatusZod,
} from "./crm_enums.zod.js";

export const mcpConectorCreateInputZod = z.object({
	provider: mcpProviderZod,
	apiKey: zString,
	configuracao: z.record(z.string(), z.any()).nullable().default(null),
	clienteId: z.string().uuid(),
});

export const mcpConectorUpdateInputZod = mcpConectorCreateInputZod.partial();

export const mcpConectorSelectAllZod = mcpConectorCreateInputZod
	.extend({
		id: z.string().uuid(),
		status: mcpConectarStatusZod.default("pendente"),
		usuarioCriacaoId: z.string().uuid(),
		ultimaTentativaSync: z.date().nullable(),
		erroUltimaTentativa: zString.nullable(),
	})
	.extend(zTimestamps);

export type McpConectorCreateInput = z.infer<typeof mcpConectorCreateInputZod>;
export type McpConectorUpdateInput = z.infer<typeof mcpConectorUpdateInputZod>;
export type McpConectorSelectAll = z.infer<typeof mcpConectorSelectAllZod>;
