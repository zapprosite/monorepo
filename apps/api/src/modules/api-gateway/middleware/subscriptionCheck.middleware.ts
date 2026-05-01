import { db } from "@backend/db/db";
import { findActiveSubscription } from "@backend/modules/api-gateway/utils/subscriptionTracker.utils";
import type { ApiProductSku } from "@connected-repo/zod-schemas/enums.zod";
import { zString } from "@connected-repo/zod-schemas/zod_utils";
import type { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";

/**
 * Subscription Check Middleware
 * Returns a preHandler that checks if team has an active subscription for the given product
 * @param apiProductSku - The API product SKU to check subscription for
 * @returns Fastify preHandler function
 */
export function subscriptionCheckHook(apiProductSku: ApiProductSku) {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		// Ensure team is attached by apiKeyAuthHook
		if (!request.team) {
			return reply.code(401).send({
				statusCode: 401,
				error: "Unauthorized",
				message: "Authentication required",
			});
		}

		const { teamId } = request.team;
		const { teamUserReferenceId } = z.object({ teamUserReferenceId: zString }).parse(request.query);

		// Validate teamUserReferenceId belongs to the authenticated team
		const user = await db.users.findOptional(teamUserReferenceId);
		if (!user || user.teamId !== teamId) {
			return reply.code(403).send({
				statusCode: 403,
				error: "Forbidden",
				message: "teamUserReferenceId does not belong to the authenticated team",
			});
		}

		// Find active subscription for this team and product
		const subscription = await findActiveSubscription(teamId, teamUserReferenceId, apiProductSku);

		if (!subscription) {
			return reply.code(402).send({
				statusCode: 402,
				error: "Payment Required",
				message: `No active subscription found for product: ${apiProductSku}`,
			});
		}

		// Attach subscription to request for later use
		request.subscription = subscription;
	};
}
