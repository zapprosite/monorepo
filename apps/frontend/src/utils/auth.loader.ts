import { userContext } from "@frontend/contexts/UserContext";
import { queryClient } from "@frontend/utils/queryClient";
import { trpc } from "@frontend/utils/trpc.client";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

const IS_DEV = import.meta.env.VITE_NODE_ENV === "development";

/**
 * Auth loader for protected routes
 * Fetches session, sets React Router context, and redirects based on auth state
 */
export async function authLoader({ context }: LoaderFunctionArgs) {
	if (IS_DEV) {
		const devUser = sessionStorage.getItem("dev_user");
		if (devUser) {
			const user = JSON.parse(devUser);
			const sessionInfo = {
				hasSession: true,
				isRegistered: true,
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					displayPicture: null,
				},
			};
			context.set(userContext, sessionInfo);
			return sessionInfo;
		}
		throw redirect("/auth/login");
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
		console.error("Auth loader error:", error);
		throw redirect("/auth/login");
	}
}

/**
 * Guest loader for auth pages (login, register)
 * Redirects to dashboard if already authenticated
 */
export async function guestLoader() {
	if (IS_DEV) {
		const devUser = sessionStorage.getItem("dev_user");
		if (devUser) {
			const user = JSON.parse(devUser);
			if (user) {
				return redirect("/dashboard");
			}
		}
		return null;
	}

	try {
		const sessionInfo = await queryClient.fetchQuery(trpc.auth.getSessionInfo.queryOptions());

		if (sessionInfo.hasSession && sessionInfo.isRegistered) {
			return redirect("/dashboard");
		}

		return sessionInfo;
	} catch (error) {
		console.error("Guest loader error:", error);
		return null;
	}
}
