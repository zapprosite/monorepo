import type { TrpcContext } from "@backend/trpc";
import type { SessionUser } from "@backend/modules/auth/session.auth.utils";

/**
 * Mock tRPC context for unauthenticated requests.
 */
export const unauthContext = (): TrpcContext => ({
	user: undefined,
	req: {
		session: { user: undefined },
		headers: { "user-agent": "vitest/1.0" },
		ip: "127.0.0.1",
	} as unknown as TrpcContext["req"],
	res: {} as TrpcContext["res"],
});

/**
 * Mock tRPC context for authenticated requests.
 */
export const authContext = (overrides?: Partial<SessionUser>): TrpcContext => {
	const user: SessionUser = {
		userId: "01JTEST000000000000000001",
		email: "test@example.com",
		name: "Test User",
		displayPicture: null,
		...overrides,
	};
	return {
		user,
		req: {
			session: { user },
			headers: { "user-agent": "vitest/1.0" },
			ip: "127.0.0.1",
		} as unknown as TrpcContext["req"],
		res: {} as TrpcContext["res"],
	};
};
