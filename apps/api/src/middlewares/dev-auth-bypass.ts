import { isDev } from '@backend/configs/env.config';
import type { SessionUser } from '@backend/modules/auth/session.auth.utils';
import type { FastifyRequest } from 'fastify';

const DEV_AUTH_ENABLED = process.env.DEV_AUTH_ENABLED === 'true';

/**
 * Dev auth bypass middleware
 *
 * ONLY active when NODE_ENV=development AND DEV_AUTH_ENABLED=true.
 * This dual-gate prevents accidental activation in production.
 * NEVER use in production.
 */

export const DEV_USERS: Record<string, Omit<SessionUser, 'userId'>> = {
	'will@zappro.site': {
		email: 'will@zappro.site',
		name: 'Will (Dev)',
		displayPicture: null,
		teamId: 'dev-team-will',
	},
	'admin@zappro.site': {
		email: 'admin@zappro.site',
		name: 'Admin (Dev)',
		displayPicture: null,
		teamId: 'dev-team-admin',
	},
	'test@example.com': {
		email: 'test@example.com',
		name: 'Test User',
		displayPicture: null,
		teamId: 'dev-team-test',
	},
};

export const extractDevUser = (req: FastifyRequest): SessionUser | null => {
	if (!isDev || !DEV_AUTH_ENABLED) {
		return null;
	}

	const devUserHeader = req.headers['x-dev-user'];
	if (!devUserHeader || typeof devUserHeader !== 'string') {
		return null;
	}

	const email = devUserHeader.toLowerCase().trim();
	const devUser = DEV_USERS[email];

	if (!devUser) {
		return {
			userId: null,
			email,
			name: `Dev User (${email})`,
			displayPicture: null,
			teamId: null,
		};
	}

	return {
		userId: null,
		...devUser,
	};
};

export const isDevAuthBypass = (req: FastifyRequest): boolean => {
	return extractDevUser(req) !== null;
};
