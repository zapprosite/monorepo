import { db } from "@backend/db/db";
import { verifyApiKey } from "@backend/modules/api-gateway/utils/apiKeyGenerator.utils";
import { omitKeys } from "@backend/utils/omit.utils";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * API Key Authentication Middleware
 * Extracts x-api-key and x-team-id headers, verifies API key to identify the team,
 * then ensures the x-team-id header matches the verified team (prevents IDOR attack).
 */
export async function apiKeyAuthHook(request: FastifyRequest, reply: FastifyReply) {
	// Extract headers
	const apiKey = request.headers["x-api-key"];
	const teamIdFromHeader = request.headers["x-team-id"];

	if (!apiKey || typeof apiKey !== "string") {
		return reply.code(401).send({
			statusCode: 401,
			error: "Unauthorized",
			message: "Missing or invalid x-api-key header",
		});
	}

	if (!teamIdFromHeader || typeof teamIdFromHeader !== "string") {
		return reply.code(401).send({
			statusCode: 401,
			error: "Unauthorized",
			message: "Missing or invalid x-team-id header",
		});
	}

	// Find the team that owns this API key by iterating through teams and verifying
	// Note: This is O(n) - for production, consider adding an indexed apiKeyHash column
	// for O(1) lookup. See migration 0013_add_api_key_hash_index.ts as a potential future optimization.
	const teams = await db.teams.select("*", "apiSecretHash");
	let matchedTeam = null;

	for (const team of teams) {
		const isValid = await verifyApiKey(apiKey, team.apiSecretHash);
		if (isValid) {
			matchedTeam = team;
			break;
		}
	}

	if (!matchedTeam) {
		return reply.code(401).send({
			statusCode: 401,
			error: "Unauthorized",
			message: "Invalid API key",
		});
	}

	// CRITICAL: Verify the x-team-id header matches the team that owns the API key
	// This prevents IDOR attacks where a client with a valid API key for Team A
	// tries to access resources as Team B by setting x-team-id: Team B
	if (matchedTeam.teamId !== teamIdFromHeader) {
		return reply.code(403).send({
			statusCode: 403,
			error: "Forbidden",
			message: "x-team-id header does not match the team associated with this API key",
		});
	}

	// Attach team to request object
	request.team = omitKeys(matchedTeam, ["apiSecretHash"]);
}
