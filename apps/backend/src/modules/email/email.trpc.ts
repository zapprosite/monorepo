import { protectedProcedure, trpcRouter } from "@backend/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const CampaignOutput = z.object({
	id: z.string(),
	nome: z.string(),
	descricao: z.string().optional(),
	tipoCampanha: z.enum(["marketing", "reativacao", "newsletter", "promocional", "transacional"]),
	statusCampanha: z.enum(["rascunho", "agendada", "enviando", "enviada", "cancelada"]),
	templateId: z.string().optional(),
	totalEnviado: z.number().default(0),
	taxaAberturaPercent: z.number().optional(),
	dataAgendada: z.date().optional(),
	createdAt: z.date(),
});

export const emailRouter = trpcRouter({
	createTemplate: protectedProcedure
		.input(
			z.object({
				nome: z.string().min(1).max(255),
				assunto: z.string().min(1).max(255),
				corpo: z.string().min(1).max(10000),
				categoriTemplate: z.enum([
					"bem-vindo",
					"reativacao",
					"promocional",
					"newsletter",
					"confirmacao",
				]),
				variavelSuportadas: z.array(z.string()).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Template creation not yet implemented" });
		}),

	listTemplates: protectedProcedure.query(async () => {
		throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Template listing not yet implemented" });
	}),

	getTemplate: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Template retrieval not yet implemented" });
		}),

	createCampaign: protectedProcedure
		.input(
			z.object({
				nome: z.string().min(1).max(255),
				descricao: z.string().max(1000).optional(),
				tipoCampanha: z.enum([
					"marketing",
					"reativacao",
					"newsletter",
					"promocional",
					"transacional",
				]),
				templateId: z.string().uuid().optional(),
				destinatariosJSON: z.array(z.string().email()),
				dataAgendada: z.coerce.date().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Campaign creation not yet implemented" });
		}),

	listCampaigns: protectedProcedure
		.input(
			z.object({
				status: z.enum(["rascunho", "agendada", "enviando", "enviada", "cancelada"]).optional(),
				tipo: z
					.enum(["marketing", "reativacao", "newsletter", "promocional", "transacional"])
					.optional(),
				limit: z.number().int().min(1).max(100).default(50),
				offset: z.number().int().min(0).default(0),
			}),
		)
		.query(async ({ input }) => {
			throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Campaign listing not yet implemented" });
		}),

	getCampaign: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Campaign retrieval not yet implemented" });
		}),

	updateCampaign: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: z.object({
					nome: z.string().min(1).max(255).optional(),
					descricao: z.string().max(1000).optional(),
					statusCampanha: z
						.enum(["rascunho", "agendada", "enviando", "enviada", "cancelada"])
						.optional(),
					dataAgendada: z.coerce.date().optional(),
				}),
			}),
		)
		.mutation(async ({ input }) => {
			throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Campaign update not yet implemented" });
		}),

	sendTestEmail: protectedProcedure
		.input(
			z.object({
				templateId: z.string().uuid(),
				emailTeste: z.string().email(),
				variaveis: z.record(z.string(), z.unknown()).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Test email sending not yet implemented" });
		}),

	sendCampaign: protectedProcedure
		.input(z.object({ campaignId: z.string().uuid() }))
		.mutation(async ({ input }) => {
			throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Campaign sending not yet implemented" });
		}),
});
