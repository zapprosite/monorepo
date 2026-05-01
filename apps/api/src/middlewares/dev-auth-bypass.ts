import { isDev } from "@backend/configs/env.config";
import type { SessionUser } from "@backend/modules/auth/session.auth.utils";
import type { FastifyRequest } from "fastify";

/**
 * Dev auth bypass middleware
 *
 * In development mode, allows setting a fake session via X-Dev-User header.
 * This enables local testing without OAuth flow.
 *
 * Header format: X-Dev-User: <email>
 * Example: X-Dev-User: will@zappro.site
 *
 * The corresponding user must exist in the database (or we create a dev user on the fly).
 */

/**
 * Default dev users for local testing
 * Keyed by email, these are pre-seeded for convenience
 */
export const DEV_USERS: Record<string, Omit<SessionUser, "userId">> = {
	"will@zappro.site": {
		email: "will@zappro.site",
		name: "Will (Dev)",
		displayPicture: null,
		teamId: "dev-team-will",
	},
	"admin@zappro.site": {
		email: "admin@zappro.site",
		name: "Admin (Dev)",
		displayPicture: null,
		teamId: "dev-team-admin",
	},
	"test@example.com": {
		email: "test@example.com",
		name: "Test User",
		displayPicture: null,
		teamId: "dev-team-test",
	},
};

/**
 * Try to extract dev user from request header
 * Returns null if not in dev mode or header not present
 */
export const extractDevUser = (req: FastifyRequest): SessionUser | null => {
	if (!isDev) {
		return null;
	}

	const devUserHeader = req.headers["x-dev-user"];
	if (!devUserHeader || typeof devUserHeader !== "string") {
		return null;
	}

	// Check if it's a known dev user email
	const email = devUserHeader.toLowerCase().trim();
	const devUser = DEV_USERS[email];

	if (!devUser) {
		// Unknown dev user - return a generic dev user with that email
		return {
			userId: "dev-user-placeholder", // Placeholder - in real scenario would lookup DB
			email,
			name: `Dev User (${email})`,
			displayPicture: null,
			teamId: null,
		};
	}

	return {
		userId: "dev-user-placeholder",
		...devUser,
	};
};

/**
 * Check if request has dev auth bypass active
 */
export const isDevAuthBypass = (req: FastifyRequest): boolean => {
	return extractDevUser(req) !== null;
};