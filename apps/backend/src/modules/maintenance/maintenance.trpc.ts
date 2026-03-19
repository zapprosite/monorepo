import { protectedProcedure, trpcRouter } from "@backend/trpc";
import { z } from "zod";

export const maintenanceRouter = trpcRouter({
  createPlan: protectedProcedure
    .input(z.object({
      nomeEmpresa: z.string().min(1),
      tipoEquipamento: z.enum(["ar-condicionado", "refrigerador"]),
      periodicidadeDias: z.number().int().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      return { success: true, id: "plan-" + Date.now(), ...input };
    }),

  listPlans: protectedProcedure
    .query(async () => {
      return { data: [], total: 0 };
    }),
});
