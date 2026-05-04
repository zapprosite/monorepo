import { env } from '@backend/configs/env.config';
import { type SessionUser, setSession } from '@backend/modules/auth/session.auth.utils';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const oauth2SuccessHandler = async (
	request: FastifyRequest,
	reply: FastifyReply,
	sessionUser: SessionUser,
) => {
	await new Promise<void>((resolve, reject) => {
		request.session.regenerate((err) => {
			if (err) reject(err);
			else resolve();
		});
	});
	await setSession(request, sessionUser);

	// Redirect to frontend app
	if (sessionUser.userId) {
		return reply.redirect(`${env.WEBAPP_URL}/dashboard`);
	} else {
		return reply.redirect(`${env.WEBAPP_URL}/auth/register`);
	}
};

export const oauth2ErrorHandler = (reply: FastifyReply, errorType = 'oauth_failed') => {
	return reply.redirect(`${env.WEBAPP_URL}/auth/login?error=${errorType}`);
};
