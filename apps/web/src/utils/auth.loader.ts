import { userContext } from "@frontend/contexts/UserContext";
import { queryClient } from "@frontend/utils/queryClient";
import { trpc } from "@frontend/utils/trpc.client";
import type { LoaderFunctionArgs } from "react-router";
import { isRouteErrorResponse, redirect } from "react-router";

const IS_DEV = import.meta.env.DEV;

type DevSessionUser = {
	id: string;
	email: string;
	name: string | null;
};

function readDevSessionUser(): DevSessionUser | null {
	if (!IS_DEV) {
		return null;
	}

	const devUser = sessionStorage.getItem("dev_user");
	if (!devUser) {
		return null;
	}

	try {
		const parsedUser = JSON.parse(devUser) as Partial<DevSessionUser>;
		if (!parsedUser.id || !parsedUser.email) {
			sessionStorage.removeItem("dev_user");
			return null;
		}

		return {
			id: parsedUser.id,
			email: parsedUser.email,
			name: parsedUser.name ?? null,
		};
	} catch {
		sessionStorage.removeItem("dev_user");
		return null;
	}
}

function getDevSessionInfo() {
	const user = readDevSessionUser();
	if (!user) {
		return null;
	}

	return {
		hasSession: true,
		isRegistered: true,
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			displayPicture: null,
		},
	};
}

/**
 * Auth loader for protected routes
 * Fetches session, sets React Router context, and redirects based on auth state
 */
export async function authLoader({ context }: LoaderFunctionArgs) {
	const devSessionInfo = getDevSessionInfo();
	if (devSessionInfo) {
		context.set(userContext, devSessionInfo);
		return devSessionInfo;
	}

	try {
		const sessionInfo = await queryClient.fetchQuery(trpc.auth.getSessionInfo.queryOptions());

		if (!sessionInfo.hasSession) {
			throw redirect("/auth/login");
		}

		if (!sessionInfo.isRegistered) {
			throw redirect("/auth/register");
		}

		context.set(userContext, sessionInfo);
		return sessionInfo;
	} catch (error) {
		if (isRouteErrorResponse(error)) {
			throw error;
		}

		console.error("Auth loader error:", error);
		throw redirect("/auth/login");
	}
}

/**
 * Guest loader for auth pages (login, register)
 * Redirects to dashboard if already authenticated
 */
export async function guestLoader() {
	if (getDevSessionInfo()) {
		return redirect("/dashboard");
	}

	try {
		const sessionInfo = await queryClient.fetchQuery(trpc.auth.getSessionInfo.queryOptions());

		if (sessionInfo.hasSession && sessionInfo.isRegistered) {
			return redirect("/dashboard");
		}

		return sessionInfo;
	} catch (error) {
		if (isRouteErrorResponse(error)) {
			throw error;
		}

		console.error("Guest loader error:", error);
		return null;
	}
}
