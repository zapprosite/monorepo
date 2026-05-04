import { moderateRateLimit, publicProcedure, trpcRouter } from '@backend/trpc';
import { clearSession, setSession } from './session.auth.utils';
import { db } from '@backend/db/db';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const loginWithPasswordInputZod = z.object({
	email: z.email(),
	password: z.string().min(1),
});

const registerWithPasswordInputZod = z.object({
	email: z.email(),
	password: z.string().min(8),
	name: z.string().optional(),
});

export const authRouterTrpc = trpcRouter({
	// Get current session info (for pre-filling registration form)
	// Rate limited to prevent DoS and session probing attacks (20 req/min per IP)
	getSessionInfo: publicProcedure.use(moderateRateLimit).query(async ({ ctx }) => {
		// Return session user data if session exists
		if (ctx.req.session?.user) {
			return {
				hasSession: true,
				user: {
					email: ctx.req.session.user.email,
					name: ctx.req.session.user.name,
					displayPicture: ctx.req.session.user.displayPicture,
				},
				isRegistered: !!ctx.req.session.user.userId, // Has database userId
			};
		}

		return {
			hasSession: false,
			user: null,
			isRegistered: false,
		};
	}),

	// Login with email and password (local auth)
	loginWithPassword: publicProcedure
		.input(loginWithPasswordInputZod)
		.mutation(async ({ input, ctx }) => {
			const user = await db.users.where({ email: input.email }).takeOptional();
			if (!user) {
				throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
			}

			if (user.authType !== 'local' || !user.passwordHash) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Invalid credentials',
				});
			}

			const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
			if (!passwordMatch) {
				throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
			}

			await setSession(ctx.req, {
				userId: user.userId,
				email: user.email,
				name: user.name,
				displayPicture: user.displayPicture,
				teamId: user.teamId,
			});

			return { success: true, userId: user.userId };
		}),

	// Register with email and password (local auth)
	registerWithPassword: publicProcedure
		.input(registerWithPasswordInputZod)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.users.where({ email: input.email }).takeOptional();
			if (existing) {
				throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' });
			}

			const passwordHash = await bcrypt.hash(input.password, 10);

			const newUser = await db.users.create({
				email: input.email,
				name: input.name || null,
				authType: 'local',
				passwordHash,
				teamId: null,
				displayPicture: null,
			});

			await setSession(ctx.req, {
				userId: newUser.userId,
				email: newUser.email,
				name: newUser.name,
				displayPicture: newUser.displayPicture,
				teamId: newUser.teamId,
			});

			return { success: true, userId: newUser.userId };
		}),

	// Logout - destroys current session and generates new session ID
	logout: publicProcedure.mutation(async ({ ctx }) => {
		await clearSession(ctx.req);
		return { success: true };
	}),
});
