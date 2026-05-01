import type { AppTrpcRouter } from "@backend/routers/trpc.router";
import { env } from "@frontend/configs/env.config";
import { queryClient } from "@frontend/utils/queryClient";
import { createTRPCClient, httpBatchLink, httpBatchStreamLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

const linkOpts = {
	url: `${env.VITE_API_URL}/trpc`,
	fetch(url: string | URL | Request, options: RequestInit | undefined) {
		return fetch(url, {
			...options,
			credentials: "include",
		});
	},
	headers() {
		const headers: Record<string, string> = {
			"x-user-id": "123",
		};
		try {
			const devUserRaw = sessionStorage.getItem("dev_user");
			if (devUserRaw) {
				const devUser = JSON.parse(devUserRaw) as { email?: string };
				if (devUser.email) {
					headers["x-dev-user"] = devUser.email;
				}
			}
		} catch {
			// ignore invalid sessionStorage value
		}
		return headers;
	},
};

// Use plain httpBatchLink in Playwright so we can mock responses easily.
// httpBatchStreamLink uses NDJSON streams which are hard to mock reliably.
const isPlaywright = typeof navigator !== "undefined" && navigator.webdriver;

// Create tRPC client factory. We keep the TRPC React wrapper in a separate
// module so components can import `trpc` for hooks, and main can create the
// concrete client instance used by the provider.
export const trpcFetch = createTRPCClient<AppTrpcRouter>({
	links: [isPlaywright ? httpBatchLink(linkOpts) : httpBatchStreamLink(linkOpts)],
});

export const trpc = createTRPCOptionsProxy<AppTrpcRouter>({
	client: trpcFetch,
	queryClient,
});
