import { protectedProcedure, trpcRouter } from "@backend/trpc";
import { z } from "zod";

export const loyaltyRouter = trpcRouter({
  calculateScore: protectedProcedure
    .input(z.object({ clienteId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return { pontos: 150, nivel: "prata" };
    }),

  listLoyalty: protectedProcedure
    .input(z.object({
      status: z.enum(["ativo", "risco-30d", "risco-60d", "risco-90d", "perdido"]).optional(),
      nivelMinimo: z.enum(["bronze", "prata", "ouro", "platinum"]).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return { data: [] };
    }),

  getDashboard: protectedProcedure
    .input(z.object({ clienteId: z.string().uuid() }))
    .query(async ({ input }) => {
      return {
        cliente: null,
        score: null,
        recomendacoes: [],
      };
    }),

  triggerReactivation: protectedProcedure
    .input(z.object({ clienteId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),
});
