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

			await db.userRoles
				.where({ userId: input.userId, role: input.role })
				.delete();
		}),
});
