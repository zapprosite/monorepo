import { apiKeyAuthHook } from "../apiKeyAuth.middleware";
import { describe, expect, it, vi } from "vitest";

// Mock db and verifyApiKey
vi.mock("@backend/db/db", () => ({
	db: {
		teams: {
			select: vi.fn(() => ({
				where: vi.fn(() => ({
					take: vi.fn(),
				})),
			})),
		},
	},
}));

vi.mock("@backend/modules/api-gateway/utils/apiKeyGenerator.utils", () => ({
	generateApiKeyLookupHash: vi.fn((key: string) => `hash_${key}`),
	verifyApiKey: vi.fn(),
}));

import { db } from "@backend/db/db";
import { verifyApiKey } from "@backend/modules/api-gateway/utils/apiKeyGenerator.utils";

function createRequest(headers: Record<string, string> = {}) {
	return {
		headers,
		team: undefined,
	} as unknown as Parameters<typeof apiKeyAuthHook>[0];
}

function createReply() {
	const reply: any = {
		code: vi.fn(() => reply),
		send: vi.fn(() => reply),
	};
	return reply;
}

describe("apiKeyAuthHook", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 when x-api-key is missing", async () => {
		const req = createRequest({ "x-team-id": "team-1" });
		const reply = createReply();
		await apiKeyAuthHook(req, reply);
		expect(reply.code).toHaveBeenCalledWith(401);
		expect(reply.send).toHaveBeenCalledWith(
			expect.objectContaining({ error: "Unauthorized", message: "Missing or invalid x-api-key header" }),
		);
	});

	it("returns 401 when x-team-id is missing", async () => {
		const req = createRequest({ "x-api-key": "key-1" });
		const reply = createReply();
		await apiKeyAuthHook(req, reply);
		expect(reply.code).toHaveBeenCalledWith(401);
		expect(reply.send).toHaveBeenCalledWith(
			expect.objectContaining({ error: "Unauthorized", message: "Missing or invalid x-team-id header" }),
		);
	});

	it("returns 401 when API key lookup finds no team", async () => {
		const req = createRequest({ "x-api-key": "key-1", "x-team-id": "team-1" });
		const reply = createReply();

		const takeMock = vi.fn().mockResolvedValue(null);
		(db.teams.select as any).mockReturnValue({
			where: vi.fn().mockReturnValue({ take: takeMock }),
		});

		await apiKeyAuthHook(req, reply);
		expect(reply.code).toHaveBeenCalledWith(401);
		expect(reply.send).toHaveBeenCalledWith(
			expect.objectContaining({ error: "Unauthorized", message: "Invalid API key" }),
		);
	});

	it("returns 401 when API key verification fails", async () => {
		const req = createRequest({ "x-api-key": "key-1", "x-team-id": "team-1" });
		const reply = createReply();

		const team = { teamId: "team-1", apiSecretHash: "scrypt:hash", name: "Team A" };
		const takeMock = vi.fn().mockResolvedValue(team);
		(db.teams.select as any).mockReturnValue({
			where: vi.fn().mockReturnValue({ take: takeMock }),
		});
		(verifyApiKey as any).mockResolvedValue(false);

		await apiKeyAuthHook(req, reply);
		expect(verifyApiKey).toHaveBeenCalledWith("key-1", "scrypt:hash");
		expect(reply.code).toHaveBeenCalledWith(401);
	});

	it("returns 403 when x-team-id does not match the team owning the key (IDOR)", async () => {
		const req = createRequest({ "x-api-key": "key-1", "x-team-id": "team-evil" });
		const reply = createReply();

		const team = { teamId: "team-legit", apiSecretHash: "scrypt:hash", name: "Team A" };
		const takeMock = vi.fn().mockResolvedValue(team);
		(db.teams.select as any).mockReturnValue({
			where: vi.fn().mockReturnValue({ take: takeMock }),
		});
		(verifyApiKey as any).mockResolvedValue(true);

		await apiKeyAuthHook(req, reply);
		expect(reply.code).toHaveBeenCalledWith(403);
		expect(reply.send).toHaveBeenCalledWith(
			expect.objectContaining({
				error: "Forbidden",
				message: "x-team-id header does not match the team associated with this API key",
			}),
		);
	});

	it("attaches team to request when key and team-id are valid", async () => {
		const req = createRequest({ "x-api-key": "key-1", "x-team-id": "team-1" }) as any;
		const reply = createReply();

		const team = { teamId: "team-1", apiSecretHash: "scrypt:hash", name: "Team A" };
		const takeMock = vi.fn().mockResolvedValue(team);
		(db.teams.select as any).mockReturnValue({
			where: vi.fn().mockReturnValue({ take: takeMock }),
		});
		(verifyApiKey as any).mockResolvedValue(true);

		await apiKeyAuthHook(req, reply);
		expect(reply.code).not.toHaveBeenCalled();
		expect(req.team).toEqual({ teamId: "team-1", name: "Team A" });
	});
});
