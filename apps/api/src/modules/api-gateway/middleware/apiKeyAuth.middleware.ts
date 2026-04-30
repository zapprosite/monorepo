import { db } from "@backend/db/db";
import {
	generateApiKeyLookupHash,
	verifyApiKey,
} from "@backend/modules/api-gateway/utils/apiKeyGenerator.utils";
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

	// O(1) lookup using indexed apiKeyLookupHash, then verify with slow scrypt hash
	const lookupHash = generateApiKeyLookupHash(apiKey);
	const candidateTeam = await db.teams
		.select("*", "apiSecretHash")
		.where({ apiKeyLookupHash: lookupHash })
		.take();

	let matchedTeam = null;
	if (candidateTeam && (await verifyApiKey(apiKey, candidateTeam.apiSecretHash))) {
		matchedTeam = candidateTeam;
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
