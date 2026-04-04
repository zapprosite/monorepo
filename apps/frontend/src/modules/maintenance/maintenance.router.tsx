import { MaintenancePlansPage } from "@frontend/modules/maintenance/pages/MaintenancePlans.page";
import { Route, Routes } from "react-router";

export const MaintenanceRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<MaintenancePlansPage />} />
		</Routes>
	);
};

export default MaintenanceRouter;
