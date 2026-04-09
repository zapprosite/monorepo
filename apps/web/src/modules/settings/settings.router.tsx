import SettingsPage from "@frontend/modules/settings/pages/Settings.page";
import UserRolesPage from "@frontend/modules/settings/pages/UserRoles.page";
import { Route, Routes } from "react-router";

export const SettingsRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<SettingsPage />} />
			<Route path="/roles" element={<UserRolesPage />} />
		</Routes>
	);
};

export default SettingsRouter;
