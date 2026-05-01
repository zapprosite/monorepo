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

// Helper function to verify board belongs to team
async function assertBoardTeamAccess(boardId: string, teamId: string): Promise<void> {
	const board = await db.kanbanBoards.findOptional(boardId);
	if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board não encontrado" });
	if ("teamId" in board && board.teamId !== teamId) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
	}
}

// Helper function to verify column belongs to team via its board
async function assertColumnTeamAccess(columnId: string, teamId: string): Promise<void> {
	const column = await db.kanbanColumns.findOptional(columnId);
	if (!column) throw new TRPCError({ code: "NOT_FOUND", message: "Coluna não encontrada" });
	await assertBoardTeamAccess(column.boardId, teamId);
}

// Helper function to verify card belongs to team via its column -> board
async function assertCardTeamAccess(cardId: string, teamId: string): Promise<void> {
	const card = await db.kanbanCards.findOptional(cardId);
	if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card não encontrado" });
	const column = await db.kanbanColumns.findOptional(card.columnId);
	if (!column) throw new TRPCError({ code: "NOT_FOUND", message: "Coluna não encontrada" });
	await assertBoardTeamAccess(column.boardId, teamId);
}

export const kanbanRouterTrpc = trpcRouter({
	// -------------------------------------------------------------------------
	// Boards
	// -------------------------------------------------------------------------

	listBoards: protectedProcedure.input(listBoardFilterZod).query(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		let query = db.kanbanBoards.select("*").where({ teamId });

		if (input.setor) {
			const setor = input.setor;
			query = query.where({ setor });
		}

		return query.order({ createdAt: "DESC" });
	}),

	getBoardDetail: protectedProcedure
		.input(boardGetByIdZod)
		.query(async ({ ctx, input: { boardId } }) => {
			const { teamId } = ctx.user;
			const board = await db.kanbanBoards.findOptional(boardId);
			if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board não encontrado" });
			if ("teamId" in board && board.teamId !== teamId) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
			}

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
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			return db.kanbanBoards.create({ ...input, teamId });
		}),

	updateBoard: protectedProcedure
		.input(boardUpdateInputZod)
		.mutation(async ({ ctx, input: { boardId, ...data } }) => {
			const { teamId } = ctx.user;
			await assertBoardTeamAccess(boardId, teamId);
			return db.kanbanBoards.where({ boardId }).update(data);
		}),

	deleteBoard: protectedProcedure
		.input(boardGetByIdZod)
		.mutation(async ({ ctx, input: { boardId } }) => {
			const { teamId } = ctx.user;
			await assertBoardTeamAccess(boardId, teamId);
			return db.kanbanBoards.where({ boardId }).delete();
		}),

	// -------------------------------------------------------------------------
	// Columns
	// -------------------------------------------------------------------------

	createColumn: protectedProcedure
		.input(columnCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			await assertBoardTeamAccess(input.boardId, teamId);
			return db.kanbanColumns.create(input);
		}),

	updateColumn: protectedProcedure
		.input(columnUpdateInputZod)
		.mutation(async ({ ctx, input: { columnId, ...data } }) => {
			const { teamId } = ctx.user;
			await assertColumnTeamAccess(columnId, teamId);
			return db.kanbanColumns.where({ columnId }).update(data);
		}),

	deleteColumn: protectedProcedure
		.input(z.object({ columnId: z.string().uuid() }))
		.mutation(async ({ ctx, input: { columnId } }) => {
			const { teamId } = ctx.user;
			await assertColumnTeamAccess(columnId, teamId);
			return db.kanbanColumns.where({ columnId }).delete();
		}),

	reorderColumns: protectedProcedure
		.input(
			z.object({
				boardId: z.string().uuid(),
				columnIds: z.array(z.string().uuid()),
			}),
		)
		.mutation(async ({ ctx, input: { boardId, columnIds } }) => {
			const { teamId } = ctx.user;
			await assertBoardTeamAccess(boardId, teamId);
			await Promise.all(
				columnIds.map(async (columnId, index) => {
					const column = await db.kanbanColumns.findOptional(columnId);
					if (!column) throw new TRPCError({ code: "NOT_FOUND", message: "Coluna não encontrada" });
					if (column.boardId !== boardId) {
						throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
					}
					return db.kanbanColumns.where({ columnId }).update({ ordem: index });
				}),
			);
			return { success: true };
		}),

	// -------------------------------------------------------------------------
	// Cards
	// -------------------------------------------------------------------------

	listCards: protectedProcedure.input(listCardFilterZod).query(async ({ ctx, input }) => {
		const { teamId } = ctx.user;
		let query = db.kanbanCards.select("*");

		if (input.columnId) {
			await assertColumnTeamAccess(input.columnId, teamId);
			query = query.where({ columnId: input.columnId });
		}
		if (input.status) {
			query = query.where({ status: input.status });
		}
		if (input.responsavelId) {
			query = query.where({ responsavelId: input.responsavelId });
		}
		if (input.boardId) {
			await assertBoardTeamAccess(input.boardId, teamId);
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
		.query(async ({ ctx, input: { cardId } }) => {
			const { teamId } = ctx.user;
			await assertCardTeamAccess(cardId, teamId);
			const card = await db.kanbanCards.findOptional(cardId);
			if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card não encontrado" });
			return card;
		}),

	createCard: protectedProcedure
		.input(cardCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			await assertColumnTeamAccess(input.columnId, teamId);
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
		.mutation(async ({ ctx, input: { cardId, prioridade, status, ordem, ...rest } }) => {
			const { teamId } = ctx.user;
			await assertCardTeamAccess(cardId, teamId);
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
		.mutation(async ({ ctx, input: { cardId, columnId, ordem } }) => {
			const { teamId } = ctx.user;
			await assertCardTeamAccess(cardId, teamId);
			await assertColumnTeamAccess(columnId, teamId);
			return db.kanbanCards.where({ cardId }).update({ columnId, ordem });
		}),

	deleteCard: protectedProcedure
		.input(cardGetByIdZod)
		.mutation(async ({ ctx, input: { cardId } }) => {
			const { teamId } = ctx.user;
			await assertCardTeamAccess(cardId, teamId);
			return db.kanbanCards.where({ cardId }).delete();
		}),
});
