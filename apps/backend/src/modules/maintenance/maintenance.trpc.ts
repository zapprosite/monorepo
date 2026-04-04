import { protectedProcedure, trpcRouter } from "@backend/trpc";
import { z } from "zod";

const MaintenancePlanOutput = z.object({
	id: z.string(),
	nomeEmpresa: z.string(),
	tipoEquipamento: z.enum(["ar-condicionado", "refrigerador"]),
	periodicidadeDias: z.number(),
	clienteId: z.string().optional(),
	equipamentoId: z.string().optional(),
	proxima: z.date().optional(),
	createdAt: z.date(),
});

export const maintenanceRouter = trpcRouter({
	createPlan: protectedProcedure
		.input(
			z.object({
				nomeEmpresa: z.string().min(1),
				tipoEquipamento: z.enum(["ar-condicionado", "refrigerador"]),
				periodicidadeDias: z.number().int().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return { success: true, id: "plan-" + Date.now(), ...input };
		}),

	listPlans: protectedProcedure.query(async () => {
		return { data: [] as z.infer<typeof MaintenancePlanOutput>[], total: 0 };
	}),
});
