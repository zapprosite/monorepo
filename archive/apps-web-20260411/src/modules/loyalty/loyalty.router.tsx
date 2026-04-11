import { LoyaltyDashboardPage } from "@frontend/modules/loyalty/pages/LoyaltyDashboard.page";
import { Route, Routes } from "react-router";

export const LoyaltyRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<LoyaltyDashboardPage />} />
		</Routes>
	);
};

export default LoyaltyRouter;
