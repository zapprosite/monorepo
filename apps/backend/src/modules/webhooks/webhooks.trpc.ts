import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	webhookCreateInputZod,
	webhookUpdateInputZod,
	webhookSelectAllZod,
	webhookDeliverySelectAllZod,
	eventoSelectAllZod,
} from "@connected-repo/zod-schemas/webhooks.zod";
import { db } from "@backend/db/db";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const webhookRouter = trpcRouter({
	// Webhooks
	create: protectedProcedure
		.input(webhookCreateInputZod)
		.mutation(async ({ input, ctx }) => {
			const webhook = await db.webhooks.insert({
				url: input.url,
				eventoTipo: input.eventoTipo,
				ativo: input.ativo,
				tentativasMax: input.tentativasMax,
				intervaloRetryMin: input.intervaloRetryMin,
				clienteId: input.clienteId,
				usuarioCriacaoId: ctx.user.userId,
			});
			return webhook;
		}),

	list: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid() }))
		.query(async ({ input }) => {
			const webhooks = await db.webhooks
				.where({ clienteId: input.clienteId })
				.select("*");
			return webhooks;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const webhook = await db.webhooks
				.where({ id: input.id })
				.select("*")
				.take();
			if (!webhook) throw new TRPCError({ code: "NOT_FOUND" });
			return webhook;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: webhookUpdateInputZod,
			})
		)
		.mutation(async ({ input }) => {
			const updated = await db.webhooks
				.where({ id: input.id })
				.update(input.data);
			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			const deleted = await db.webhooks
				.where({ id: input.id })
				.delete();
			if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
			return { success: true };
		}),

	// Webhook Deliveries
	listDeliveries: protectedProcedure
		.input(
			z.object({
				webhookId: z.string().uuid(),
			})
		)
		.query(async ({ input }) => {
			const deliveries = await db.webhookDeliveries
				.where({ webhookId: input.webhookId })
				.select("*")
				.order({ createdAt: "DESC" });
			return deliveries;
		}),

	getDeliveryById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const delivery = await db.webhookDeliveries
				.where({ id: input.id })
				.select("*")
				.take();
			if (!delivery) throw new TRPCError({ code: "NOT_FOUND" });
			return delivery;
		}),

	// Eventos
	listEventos: protectedProcedure
		.input(z.object({ clienteId: z.string().uuid() }))
		.query(async ({ input }) => {
			const eventos = await db.eventos
				.where({ clienteId: input.clienteId })
				.select("*")
				.order({ createdAt: "DESC" });
			return eventos;
		}),

	getEventoById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const evento = await db.eventos
				.where({ id: input.id })
				.select("*")
				.take();
			if (!evento) throw new TRPCError({ code: "NOT_FOUND" });
			return evento;
		}),
});
