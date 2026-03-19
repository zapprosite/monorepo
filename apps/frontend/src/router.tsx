import { CircularProgress } from "@connected-repo/ui-mui/feedback/CircularProgress";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { ErrorFallback } from "@frontend/components/error_fallback";
import { AppLayout } from "@frontend/components/layout/AppLayout";
import { authLoader } from "@frontend/utils/auth.loader";
import { lazy } from "react";
import { createBrowserRouter, type RouteObject, redirect } from "react-router";

type NavbarFields = {
	nb_icon?: string;
};

type BaseRouterWithNavbar = RouteObject & NavbarFields;
export type ReactRouterWithNavbar = BaseRouterWithNavbar & {
	children?: ReactRouterWithNavbar[];
};

// HydrateFallback component for initial app loading
const HydrateFallback = () => (
	<Box
		sx={{
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			minHeight: "100vh",
			bgcolor: "background.default",
		}}
	>
		<CircularProgress size={48} />
	</Box>
);

export const routerObjectWithNavbar: ReactRouterWithNavbar[] = [
	{
		path: "/",
		errorElement: <ErrorFallback />,
		hydrateFallbackElement: <HydrateFallback />,
		children: [
			{
				index: true,
				loader: () => redirect("/dashboard"),
			},
			{
				path: "auth/*",
				Component: lazy(() => import("@frontend/modules/auth/auth.router")),
			},
			// Authenticated routes with AppLayout
			{
				element: <AppLayout />,
				loader: authLoader,
				children: [
					{
						path: "dashboard",
						Component: lazy(() => import("@frontend/pages/Dashboard.page")),
					},
					{
						path: "journal-entries/*",
						Component: lazy(
							() => import("@frontend/modules/journal-entries/journal-entries.router"),
						),
					},
					{
						path: "leads/*",
						Component: lazy(() => import("@frontend/modules/leads/leads.router")),
					},
					{
						path: "clients/*",
						Component: lazy(() => import("@frontend/modules/clients/clients.router")),
					},
					{
						path: "equipment/*",
						Component: lazy(() => import("@frontend/modules/equipment/equipment.router")),
					},
					{
						path: "schedule/*",
						Component: lazy(() => import("@frontend/modules/schedule/schedule.router")),
					},
					{
						path: "service-orders/*",
						Component: lazy(() => import("@frontend/modules/service-orders/service-orders.router")),
					},
					{
						path: "contracts/*",
						Component: lazy(() => import("@frontend/modules/contracts/contracts.router")),
					},
					{
						path: "editorial/*",
						Component: lazy(() => import("@frontend/modules/editorial/editorial.router")),
					},
					{
						path: "reminders/*",
						Component: lazy(() => import("@frontend/modules/reminders/reminders.router")),
					},
					{
						path: "kanban/*",
						Component: lazy(() => import("@frontend/modules/kanban/kanban.router")),
					},
					{
						path: "settings/*",
						Component: lazy(() => import("@frontend/modules/settings/settings.router")),
					},
					{
						path: "profile",
						Component: lazy(() => import("@frontend/pages/Dashboard.page")), // TODO: Create Profile page
					},
				],
			},
		],
	},
];

export const router = createBrowserRouter(routerObjectWithNavbar);
