import { TRPCError } from "@trpc/server";
import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	boardCreateInputZod,
	boardGetByIdZod,
	boardUpdateInputZod,
	cardCreateInputZod,
	cardGetByIdZod,
	cardUpdateInputZod,
	columnCreateInputZod,
	columnUpdateInputZod,
	listBoardFilterZod,
	listCardFilterZod,
} from "@connected-repo/zod-schemas/kanban.zod";
import z from "zod";

export const kanbanRouterTrpc = trpcRouter({
	// -------------------------------------------------------------------------
	// Boards
	// -------------------------------------------------------------------------

	listBoards: protectedProcedure.input(listBoardFilterZod).query(async ({ input }) => {
		let query = db.kanbanBoards.select("*");

		if (input.setor) {
			const setor = input.setor;
			query = query.where({ setor });
		}

		return query.order({ createdAt: "DESC" });
	}),

	getBoardDetail: protectedProcedure
		.input(boardGetByIdZod)
		.query(async ({ input: { boardId } }) => {
			const board = await db.kanbanBoards.findOptional(boardId);
			if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board não encontrado" });

			const columns = await db.kanbanColumns
				.where({ boardId })
				.select("*")
				.order({ ordem: "ASC" });

			const columnIds = columns.map((c) => c.columnId);

			const cards =
				columnIds.length > 0
					? await db.kanbanCards
							.where({ columnId: { in: columnIds } })
							.select("*")
							.order({ ordem: "ASC" })
					: [];

			return {
				...board,
				columns: columns.map((col) => ({
					...col,
					cards: cards.filter((card) => card.columnId === col.columnId),
				})),
			};
		}),

	createBoard: protectedProcedure
		.input(boardCreateInputZod)
		.mutation(async ({ input }) => {
			return db.kanbanBoards.create(input);
		}),

	updateBoard: protectedProcedure
		.input(boardUpdateInputZod)
		.mutation(async ({ input: { boardId, ...data } }) => {
			const board = await db.kanbanBoards.findOptional(boardId);
			if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board não encontrado" });
			return db.kanbanBoards.where({ boardId }).update(data);
		}),

	deleteBoard: protectedProcedure
		.input(boardGetByIdZod)
		.mutation(async ({ input: { boardId } }) => {
			const board = await db.kanbanBoards.findOptional(boardId);
			if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board não encontrado" });
			return db.kanbanBoards.where({ boardId }).delete();
		}),

	// -------------------------------------------------------------------------
	// Columns
	// -------------------------------------------------------------------------

	createColumn: protectedProcedure
		.input(columnCreateInputZod)
		.mutation(async ({ input }) => {
			return db.kanbanColumns.create(input);
		}),

	updateColumn: protectedProcedure
		.input(columnUpdateInputZod)
		.mutation(async ({ input: { columnId, ...data } }) => {
			const column = await db.kanbanColumns.findOptional(columnId);
			if (!column) throw new TRPCError({ code: "NOT_FOUND", message: "Coluna não encontrada" });
			return db.kanbanColumns.where({ columnId }).update(data);
		}),

	deleteColumn: protectedProcedure
		.input(z.object({ columnId: z.string().uuid() }))
		.mutation(async ({ input: { columnId } }) => {
			const column = await db.kanbanColumns.findOptional(columnId);
			if (!column) throw new TRPCError({ code: "NOT_FOUND", message: "Coluna não encontrada" });
			return db.kanbanColumns.where({ columnId }).delete();
		}),

	reorderColumns: protectedProcedure
		.input(
			z.object({
				boardId: z.string().uuid(),
				columnIds: z.array(z.string().uuid()),
			}),
		)
		.mutation(async ({ input: { columnIds } }) => {
			await Promise.all(
				columnIds.map(async (columnId, index) => {
					const column = await db.kanbanColumns.findOptional(columnId);
					if (!column) throw new TRPCError({ code: "NOT_FOUND", message: "Coluna não encontrada" });
					return db.kanbanColumns.where({ columnId }).update({ ordem: index });
				}),
			);
			return { success: true };
		}),

	// -------------------------------------------------------------------------
	// Cards
	// -------------------------------------------------------------------------

	listCards: protectedProcedure.input(listCardFilterZod).query(async ({ input }) => {
		let query = db.kanbanCards.select("*");

		if (input.columnId) {
			query = query.where({ columnId: input.columnId });
		}
		if (input.status) {
			query = query.where({ status: input.status });
		}
		if (input.responsavelId) {
			query = query.where({ responsavelId: input.responsavelId });
		}
		if (input.boardId) {
			const boardId = input.boardId;
			const columns = await db.kanbanColumns
				.where({ boardId })
				.select("columnId");
			const columnIds = columns.map((c) => c.columnId);
			if (columnIds.length === 0) return [];
			query = query.where({ columnId: { in: columnIds } });
		}

		return query.order({ ordem: "ASC" });
	}),

	getCardDetail: protectedProcedure
		.input(cardGetByIdZod)
		.query(async ({ input: { cardId } }) => {
			const card = await db.kanbanCards.findOptional(cardId);
			if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card não encontrado" });
			return card;
		}),

	createCard: protectedProcedure
		.input(cardCreateInputZod)
		.mutation(async ({ input }) => {
			const { ordem, prioridade, status, ...rest } = input;
			return db.kanbanCards.create({
				...rest,
				prioridade: prioridade ?? "Media",
				status: status ?? "Aberto",
				...(ordem != null ? { ordem } : {}),
			});
		}),

	updateCard: protectedProcedure
		.input(cardUpdateInputZod)
		.mutation(async ({ input: { cardId, prioridade, status, ordem, ...rest } }) => {
			const card = await db.kanbanCards.findOptional(cardId);
			if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card não encontrado" });
			return db.kanbanCards.where({ cardId }).update({
				...rest,
				...(prioridade !== undefined ? { prioridade: prioridade ?? undefined } : {}),
				...(status !== undefined ? { status: status ?? undefined } : {}),
				...(ordem !== undefined ? { ordem: ordem ?? undefined } : {}),
			});
		}),

	moveCard: protectedProcedure
		.input(
			z.object({
				cardId: z.string().uuid(),
				columnId: z.string().uuid(),
				ordem: z.number().int().min(0),
			}),
		)
		.mutation(async ({ input: { cardId, columnId, ordem } }) => {
			const card = await db.kanbanCards.findOptional(cardId);
			if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card não encontrado" });
			return db.kanbanCards.where({ cardId }).update({ columnId, ordem });
		}),

	deleteCard: protectedProcedure
		.input(cardGetByIdZod)
		.mutation(async ({ input: { cardId } }) => {
			const card = await db.kanbanCards.findOptional(cardId);
			if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card não encontrado" });
			return db.kanbanCards.where({ cardId }).delete();
		}),
});
