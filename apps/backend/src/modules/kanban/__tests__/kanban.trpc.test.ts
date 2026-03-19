import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);

const FAKE_UUID = "00000000-0000-0000-0000-000000000001";
const FAKE_UUID_2 = "00000000-0000-0000-0000-000000000002";
const INVALID_UUID = "not-a-uuid";

// ---------------------------------------------------------------------------
// Auth guard — todas as procedures rejeitam acesso não autenticado
// ---------------------------------------------------------------------------
describe("kanban — auth guard (UNAUTHORIZED)", () => {
	const caller = createCaller(unauthContext());

	it("listBoards rejeita não autenticado", async () => {
		await expect(caller.kanban.listBoards({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("getBoardDetail rejeita não autenticado", async () => {
		await expect(
			caller.kanban.getBoardDetail({ boardId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("createBoard rejeita não autenticado", async () => {
		await expect(
			caller.kanban.createBoard({ nome: "Test", setor: "TI" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("updateBoard rejeita não autenticado", async () => {
		await expect(
			caller.kanban.updateBoard({ boardId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("deleteBoard rejeita não autenticado", async () => {
		await expect(
			caller.kanban.deleteBoard({ boardId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("createColumn rejeita não autenticado", async () => {
		await expect(
			caller.kanban.createColumn({ boardId: FAKE_UUID, nome: "Coluna", ordem: 0 }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("updateColumn rejeita não autenticado", async () => {
		await expect(
			caller.kanban.updateColumn({ columnId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("deleteColumn rejeita não autenticado", async () => {
		await expect(
			caller.kanban.deleteColumn({ columnId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("reorderColumns rejeita não autenticado", async () => {
		await expect(
			caller.kanban.reorderColumns({ boardId: FAKE_UUID, columnIds: [FAKE_UUID] }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("listCards rejeita não autenticado", async () => {
		await expect(caller.kanban.listCards({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("getCardDetail rejeita não autenticado", async () => {
		await expect(
			caller.kanban.getCardDetail({ cardId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("createCard rejeita não autenticado", async () => {
		await expect(
			caller.kanban.createCard({ columnId: FAKE_UUID, titulo: "Card" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("updateCard rejeita não autenticado", async () => {
		await expect(
			caller.kanban.updateCard({ cardId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("moveCard rejeita não autenticado", async () => {
		await expect(
			caller.kanban.moveCard({ cardId: FAKE_UUID, columnId: FAKE_UUID_2, ordem: 0 }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("deleteCard rejeita não autenticado", async () => {
		await expect(
			caller.kanban.deleteCard({ cardId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

// ---------------------------------------------------------------------------
// Validação de input — Zod rejeita campos inválidos
// ---------------------------------------------------------------------------
describe("kanban — validação de input (Zod)", () => {
	const caller = createCaller(authContext());

	// Boards
	it("getBoardDetail rejeita boardId inválido", async () => {
		await expect(
			caller.kanban.getBoardDetail({ boardId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("createBoard rejeita nome vazio", async () => {
		await expect(
			caller.kanban.createBoard({ nome: "", setor: "TI" }),
		).rejects.toThrow();
	});

	it("createBoard rejeita setor vazio", async () => {
		await expect(
			caller.kanban.createBoard({ nome: "Board", setor: "" }),
		).rejects.toThrow();
	});

	it("updateBoard rejeita boardId inválido", async () => {
		await expect(
			caller.kanban.updateBoard({ boardId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("deleteBoard rejeita boardId inválido", async () => {
		await expect(
			caller.kanban.deleteBoard({ boardId: INVALID_UUID }),
		).rejects.toThrow();
	});

	// Columns
	it("createColumn rejeita boardId inválido", async () => {
		await expect(
			caller.kanban.createColumn({ boardId: INVALID_UUID, nome: "Coluna", ordem: 0 }),
		).rejects.toThrow();
	});

	it("createColumn rejeita ordem negativa", async () => {
		await expect(
			caller.kanban.createColumn({ boardId: FAKE_UUID, nome: "Coluna", ordem: -1 }),
		).rejects.toThrow();
	});

	it("updateColumn rejeita columnId inválido", async () => {
		await expect(
			caller.kanban.updateColumn({ columnId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("deleteColumn rejeita columnId inválido", async () => {
		await expect(
			caller.kanban.deleteColumn({ columnId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("reorderColumns rejeita boardId inválido", async () => {
		await expect(
			caller.kanban.reorderColumns({ boardId: INVALID_UUID, columnIds: [FAKE_UUID] }),
		).rejects.toThrow();
	});

	// Cards
	it("getCardDetail rejeita cardId inválido", async () => {
		await expect(
			caller.kanban.getCardDetail({ cardId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("createCard rejeita columnId inválido", async () => {
		await expect(
			caller.kanban.createCard({ columnId: INVALID_UUID, titulo: "Card" }),
		).rejects.toThrow();
	});

	it("createCard rejeita titulo vazio", async () => {
		await expect(
			caller.kanban.createCard({ columnId: FAKE_UUID, titulo: "" }),
		).rejects.toThrow();
	});

	it("createCard rejeita prioridade inválida", async () => {
		await expect(
			caller.kanban.createCard({
				columnId: FAKE_UUID,
				titulo: "Card",
				prioridade: "Urgente" as unknown as "Alta",
			}),
		).rejects.toThrow();
	});

	it("createCard rejeita status inválido", async () => {
		await expect(
			caller.kanban.createCard({
				columnId: FAKE_UUID,
				titulo: "Card",
				status: "EmAberto" as unknown as "Aberto",
			}),
		).rejects.toThrow();
	});

	it("updateCard rejeita cardId inválido", async () => {
		await expect(
			caller.kanban.updateCard({ cardId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("moveCard rejeita cardId inválido", async () => {
		await expect(
			caller.kanban.moveCard({ cardId: INVALID_UUID, columnId: FAKE_UUID, ordem: 0 }),
		).rejects.toThrow();
	});

	it("moveCard rejeita columnId inválido", async () => {
		await expect(
			caller.kanban.moveCard({ cardId: FAKE_UUID, columnId: INVALID_UUID, ordem: 0 }),
		).rejects.toThrow();
	});

	it("listCards rejeita columnId inválido", async () => {
		await expect(
			caller.kanban.listCards({ columnId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("listCards rejeita boardId inválido", async () => {
		await expect(
			caller.kanban.listCards({ boardId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("listCards rejeita status inválido", async () => {
		await expect(
			caller.kanban.listCards({ status: "Invalido" as unknown as "Aberto" }),
		).rejects.toThrow();
	});
});
