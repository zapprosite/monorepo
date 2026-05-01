import { db } from "@backend/db/db";
import { protectedProcedure, trpcRouter } from "@backend/trpc";
import {
	listUserRoleFilterZod,
	userRoleAssignZod,
	userRoleRevokeZod,
} from "@connected-repo/zod-schemas/user-role.zod";
import { TRPCError } from "@trpc/server";

async function assertAdmin(userId: string): Promise<void> {
	const adminRole = await db.userRoles
		.where({ userId, role: "Admin" })
		.takeOptional();
	if (!adminRole) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Esta operação requer perfil Admin.",
		});
	}
}

// IDOR fix: verify target user belongs to same team as requester
async function assertSameTeam(requestingUserId: string, requestingUserTeamId: string, targetUserId: string): Promise<void> {
	if (requestingUserId === targetUserId) return; // Same user, allowed

	// Verify target user is in the same team
	const targetUser = await db.users.findOptional(targetUserId);
	if (!targetUser || targetUser.teamId !== requestingUserTeamId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Operação não permitida para usuários de outras equipes.",
		});
	}
}

export const userRolesRouterTrpc = trpcRouter({
	getMyRoles: protectedProcedure.query(async ({ ctx }) => {
		return db.userRoles
			.where({ userId: ctx.user.userId })
			.select("userRoleId", "role", "assignedAt");
	}),

	listUserRoles: protectedProcedure
		.input(listUserRoleFilterZod)
		.query(async ({ ctx, input }) => {
			const requestingUserId = input.userId ?? ctx.user.userId;

			// Non-admin users can only see their own roles
			if (requestingUserId !== ctx.user.userId) {
				await assertAdmin(ctx.user.userId);
				// IDOR fix: verify target user is in same team
				await assertSameTeam(ctx.user.userId, ctx.user.teamId, requestingUserId);
			}

			let query = db.userRoles.where({ userId: requestingUserId });

			if (input.role) {
				query = query.where({ role: input.role });
			}

			return query.select("userRoleId", "userId", "role", "assignedAt", "assignedByUserId");
		}),

	assignRole: protectedProcedure
		.input(userRoleAssignZod)
		.mutation(async ({ ctx, input }) => {
			await assertAdmin(ctx.user.userId);

			// IDOR fix: verify target user is in same team
			await assertSameTeam(ctx.user.userId, ctx.user.teamId, input.userId);

			// Verify target user exists
			const targetUser = await db.users.findOptional(input.userId);
			if (!targetUser) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Usuário alvo não encontrado" });
			}

			const existing = await db.userRoles
				.where({ userId: input.userId, role: input.role })
				.takeOptional();

			if (existing) {
				return existing;
			}

			return db.userRoles.create({
				userId: input.userId,
				role: input.role,
				assignedByUserId: ctx.user.userId,
			});
		}),

	revokeRole: protectedProcedure
		.input(userRoleRevokeZod)
		.mutation(async ({ ctx, input }) => {
			await assertAdmin(ctx.user.userId);

			// IDOR fix: verify target user is in same team
			await assertSameTeam(ctx.user.userId, ctx.user.teamId, input.userId);

			// Verify target user exists
			const targetUser = await db.users.findOptional(input.userId);
			if (!targetUser) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Usuário alvo não encontrado" });
			}

			await db.userRoles
				.where({ userId: input.userId, role: input.role })
				.delete();
		}),
});
