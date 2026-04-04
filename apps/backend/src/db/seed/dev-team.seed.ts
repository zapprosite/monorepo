import { db } from "@backend/db/db";
import { generateApiKey, hashApiKey } from "@backend/modules/api-gateway/utils/apiKeyGenerator.utils";
import { sql } from "@backend/db/base_table";

/**
 * Seed development team and API key for local testing
 *
 * This creates:
 * - A "Dev Team" with all permissions
 * - A generated API key that can be used with X-Api-Key header
 * - Team ID for use with X-Team-Id header
 *
 * Run: yarn db seed --filter @connected-repo/backend --only dev-team
 */
export async function seedDevTeam() {
	// Check if dev team already exists - use takeOptional to avoid throwing
	const existingTeam = await db.teams
		.where({ name: "Dev Team" })
		.limit(1)
		.takeOptional();

	if (existingTeam) {
		console.log("Dev team already exists, skipping seed.");
		console.log("If you need a new API key, delete the team and re-run.");
		return existingTeam;
	}

	console.log("Seeding dev team for local testing...");

	// Generate API key BEFORE creating team so we can store hash
	const plainApiKey = generateApiKey();
	const apiSecretHash = await hashApiKey(plainApiKey);

	const devTeam = await db.teams.create({
		name: "Dev Team",
		allowedDomains: ["http://localhost:5173", "http://localhost:3000"],
		allowedIPs: ["127.0.0.1", "::1", "localhost"],
		rateLimitPerMinute: 1000, // High limit for dev
		apiSecretHash, // This is required according to the table schema
		subscriptionAlertWebhookUrl: "", // Required field, empty for dev
	});

	console.log("\n===========================================");
	console.log("DEV TEAM CREATED - SAVE THESE CREDENTIALS!");
	console.log("===========================================");
	console.log(`Team ID: ${devTeam.teamId}`);
	console.log(`API Key: ${plainApiKey}`);
	console.log("\nUse these headers for local API testing:");
	console.log(`  X-Team-Id: ${devTeam.teamId}`);
	console.log(`  X-Api-Key: ${plainApiKey}`);
	console.log(`  Base URL: http://localhost:4002`);
	console.log("\nFor tRPC endpoints, use X-Dev-User header:");
	console.log(`  curl -H "X-Dev-User: will@zappro.site" http://localhost:4002/trpc/...`);
	console.log("===========================================\n");

	return devTeam;
}

/**
 * Get dev team credentials for local testing
 * Returns null if not seeded yet
 */
export async function getDevTeamCredentials() {
	const devTeam = await db.teams
		.where({ name: "Dev Team" })
		.limit(1)
		.takeOptional();

	if (!devTeam) return null;

	return {
		teamId: devTeam.teamId,
		name: devTeam.name,
		rateLimitPerMinute: devTeam.rateLimitPerMinute,
	};
}