import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import {
	subscriptionCreateInputZod,
	subscriptionGetByIdInputZod,
	subscriptionGetActiveByTeamInputZod,
	subscriptionSelectAllZod,
	subscriptionUpdateInputZod,
} from '@repo/zod-schemas/subscription.zod';
import { TRPCError } from '@trpc/server';

export const subscriptionsRouterTrpc = trpcRouter({
	listSubscriptions: protectedProcedure
		.input(subscriptionGetActiveByTeamInputZod)
		.query(async ({ ctx, input }) => {
			const { teamId } = ctx.user;

			let query = db.subscriptions.where({ teamId });

			if (input.apiProductSku) {
				query = query.where({ apiProductSku: input.apiProductSku });
			}

			const subscriptions = await query.order({ createdAt: 'DESC' });

			return subscriptions;
		}),

	getSubscription: protectedProcedure
		.input(subscriptionGetByIdInputZod)
		.query(async ({ ctx, input: { subscriptionId } }) => {
			const { teamId } = ctx.user;
			const subscription = await db.subscriptions.findOptional(subscriptionId);

			if (!subscription) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });
			}

			if (subscription.teamId !== teamId) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
			}

			return subscription;
		}),

	createSubscription: protectedProcedure
		.input(subscriptionCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;

			if (input.teamId !== teamId) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot create subscription for another team' });
			}

			return db.subscriptions.create(input);
		}),

	updateSubscription: protectedProcedure
		.input(subscriptionUpdateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			const subId = (input as any).subscriptionId;

			if (!subId) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'subscriptionId is required' });
			}

			const subscription = await db.subscriptions.findOptional(subId);

			if (!subscription) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });
			}

			if (subscription.teamId !== teamId) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
			}

			const { subscriptionId: _subId, teamId: _teamId, ...updateData } = input;

			return db.subscriptions.where({ subscriptionId: subId }).update(updateData as any);
		}),

	deleteSubscription: protectedProcedure
		.input(subscriptionGetByIdInputZod)
		.mutation(async ({ ctx, input: { subscriptionId } }) => {
			const { teamId } = ctx.user;
			const subscription = await db.subscriptions.findOptional(subscriptionId);

			if (!subscription) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });
			}

			if (subscription.teamId !== teamId) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
			}

			// Soft-delete: mark as invalid by setting invalidAt timestamp
			return db.subscriptions.where({ subscriptionId }).update({ invalidAt: new Date() });
		}),
});
