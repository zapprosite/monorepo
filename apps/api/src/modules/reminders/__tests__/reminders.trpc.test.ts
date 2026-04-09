import { appTrpcRouter } from "@backend/routers/trpc.router";
import { authContext, unauthContext } from "@backend/test-utils/mock-context";
import { createCallerFactory } from "@backend/trpc";
import { describe, expect, it } from "vitest";

const createCaller = createCallerFactory(appTrpcRouter);

const FAKE_UUID = "00000000-0000-0000-0000-000000000003";
const INVALID_UUID = "not-a-uuid";

const VALID_REMINDER_INPUT = {
	clienteId: FAKE_UUID,
	tipo: "Email" as const,
	status: "Pendente" as const,
	dataLembrete: "2026-04-15",
	titulo: "Retorno de visita técnica",
};

// ---------------------------------------------------------------------------
// Auth guard — todas as procedures rejeitam acesso não autenticado
// ---------------------------------------------------------------------------
describe("reminders — auth guard (UNAUTHORIZED)", () => {
	const caller = createCaller(unauthContext());

	it("listReminders rejeita não autenticado", async () => {
		await expect(caller.reminders.listReminders({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("getReminderDetail rejeita não autenticado", async () => {
		await expect(
			caller.reminders.getReminderDetail({ reminderId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("createReminder rejeita não autenticado", async () => {
		await expect(caller.reminders.createReminder(VALID_REMINDER_INPUT)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("completeReminder rejeita não autenticado", async () => {
		await expect(
			caller.reminders.completeReminder({ reminderId: FAKE_UUID }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("cancelReminder rejeita não autenticado", async () => {
		await expect(caller.reminders.cancelReminder({ reminderId: FAKE_UUID })).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});
});

// ---------------------------------------------------------------------------
// Validação de input — Zod rejeita campos inválidos
// ---------------------------------------------------------------------------
describe("reminders — validação de input (Zod)", () => {
	const caller = createCaller(authContext());

	it("getReminderDetail rejeita reminderId inválido", async () => {
		await expect(
			caller.reminders.getReminderDetail({ reminderId: INVALID_UUID }),
		).rejects.toThrow();
	});

	it("createReminder rejeita clienteId inválido", async () => {
		await expect(
			caller.reminders.createReminder({
				...VALID_REMINDER_INPUT,
				clienteId: INVALID_UUID,
			}),
		).rejects.toThrow();
	});

	it("createReminder rejeita tipo inválido", async () => {
		await expect(
			caller.reminders.createReminder({
				...VALID_REMINDER_INPUT,
				tipo: "TipoInexistente" as unknown as "Email",
			}),
		).rejects.toThrow();
	});

	it("createReminder rejeita status inválido", async () => {
		await expect(
			caller.reminders.createReminder({
				...VALID_REMINDER_INPUT,
				status: "StatusInexistente" as unknown as "Pendente",
			}),
		).rejects.toThrow();
	});

	it("createReminder rejeita dataLembrete com formato inválido", async () => {
		await expect(
			caller.reminders.createReminder({
				...VALID_REMINDER_INPUT,
				dataLembrete: "15/04/2026", // formato errado — deve ser YYYY-MM-DD
			}),
		).rejects.toThrow();
	});

	it("createReminder rejeita sem titulo", async () => {
		await expect(
			// @ts-expect-error — titulo ausente proposital
			caller.reminders.createReminder({
				clienteId: FAKE_UUID,
				tipo: "Email",
				status: "Pendente",
				dataLembrete: "2026-04-15",
			}),
		).rejects.toThrow();
	});

	it("completeReminder rejeita reminderId inválido", async () => {
		await expect(caller.reminders.completeReminder({ reminderId: INVALID_UUID })).rejects.toThrow();
	});

	it("cancelReminder rejeita reminderId inválido", async () => {
		await expect(caller.reminders.cancelReminder({ reminderId: INVALID_UUID })).rejects.toThrow();
	});

	it("listReminders rejeita clienteId com formato inválido", async () => {
		await expect(caller.reminders.listReminders({ clienteId: INVALID_UUID })).rejects.toThrow();
	});
});
