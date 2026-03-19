import { protectedProcedure, trpcRouter } from "@backend/trpc";
import { z } from "zod";

export const emailRouter = trpcRouter({
  createTemplate: protectedProcedure
    .input(z.object({
      nome: z.string().min(1).max(255),
      assunto: z.string().min(1).max(255),
      corpo: z.string().min(1).max(10000),
      categoriTemplate: z.enum(["bem-vindo", "reativacao", "promocional", "newsletter", "confirmacao"]),
      variavelSuportadas: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const id = "template-" + Date.now();
      return { success: true, id };
    }),

  listTemplates: protectedProcedure.query(async () => {
    return [];
  }),

  getTemplate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return null;
    }),

  createCampaign: protectedProcedure
    .input(z.object({
      nome: z.string().min(1).max(255),
      descricao: z.string().max(1000).optional(),
      tipoCampanha: z.enum(["marketing", "reativacao", "newsletter", "promocional", "transacional"]),
      templateId: z.string().uuid().optional(),
      destinatariosJSON: z.array(z.string()),
      dataAgendada: z.coerce.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = "campaign-" + Date.now();
      return { success: true, id };
    }),

  listCampaigns: protectedProcedure
    .input(z.object({
      status: z.enum(["rascunho", "agendada", "enviando", "enviada", "cancelada"]).optional(),
      tipo: z.enum(["marketing", "reativacao", "newsletter", "promocional", "transacional"]).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return { data: [] };
    }),

  getCampaign: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return {
        stats: {
          taxaAbertura: 0,
          taxaClique: 0,
        },
      };
    }),

  updateCampaign: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: z.object({
        nome: z.string().min(1).max(255).optional(),
        descricao: z.string().max(1000).optional(),
        statusCampanha: z.enum(["rascunho", "agendada", "enviando", "enviada", "cancelada"]).optional(),
        dataAgendada: z.coerce.date().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),

  sendTestEmail: protectedProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      emailTeste: z.string(),
      variaveis: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      return { success: true, message: "Email de teste enviado" };
    }),

  sendCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return { success: true, message: "Campanha iniciada" };
    }),
});
